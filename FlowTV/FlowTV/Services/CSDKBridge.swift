import Foundation
import WebKit
import os

private let csdkLog = Logger(subsystem: "com.flowtv.app", category: "CSDKBridge")

// MARK: - CSDKBridge
/// Loads the Flow SmartTV web app in a hidden WKWebView to leverage the
/// proprietary Minerva CSDK JavaScript SDK for channel data and stream URLs.
///
/// Strategy:
///  1. Before page load, inject a user-script that patches `fetch` and
///     `XMLHttpRequest` so we can intercept all CSDK network traffic.
///  2. Load `https://fenix-smarttv.dev.app.flow.com.ar/`
///  3. The SmartTV app shows an EasyLogin screen. We inject our existing
///     Flow access token by simulating the EasyLogin WebSocket callback.
///  4. The CSDK initializes, logs in, and fetches channel data. Our patched
///     `fetch` captures the responses and posts them to native code via
///     `webkit.messageHandlers.csdkBridge`.
///  5. Native code parses the channel list (and later, stream URLs on demand).
@MainActor
class CSDKBridge: NSObject, ObservableObject {
    static let shared = CSDKBridge()

    // MARK: - Published state

    @Published var isReady = false
    @Published var isLoading = false
    @Published var channels: [CSDKChannel] = []
    @Published var statusMessage = "Idle"
    @Published var error: String?

    // MARK: - Internal state

    private var webView: WKWebView?
    private var pendingToken: String?
    private var loginInjected = false
    private var navigationAttempts = 0

    /// Pending content-source continuation (for async stream-URL requests).
    private var contentSourceContinuation: CheckedContinuation<ContentSourceResult?, Never>?

    // SmartTV app URL
    private static let smartTVURL = "https://fenix-smarttv.dev.app.flow.com.ar/"

    // MARK: - Public types

    struct CSDKChannel: Identifiable, Codable {
        let id: String
        let name: String
        let number: Int
        let logoURL: String?
        let category: String?
        let isHD: Bool

        /// Converts to the app's standard Channel model.
        func toChannel() -> Channel {
            Channel(
                id: id,
                name: name,
                number: number,
                logoURL: logoURL,
                category: mapCategory(category),
                isHD: isHD,
                streamURL: nil, // resolved on-demand via getStreamURL
                currentProgram: nil,
                nextProgram: nil
            )
        }

        private func mapCategory(_ cat: String?) -> ChannelCategory {
            guard let cat = cat?.lowercased() else { return .entretenimiento }
            if cat.contains("notic") { return .noticias }
            if cat.contains("deport") { return .deportes }
            if cat.contains("pelic") || cat.contains("cine") { return .peliculas }
            if cat.contains("serie") { return .series }
            if cat.contains("infant") || cat.contains("niño") || cat.contains("kids") { return .infantil }
            if cat.contains("music") || cat.contains("músic") { return .musica }
            if cat.contains("document") { return .documentales }
            if cat.contains("adult") { return .adultos }
            return .entretenimiento
        }
    }

    struct ContentSourceResult: Codable {
        let contentUrl: String?
        let playbackResourceToken: String?
        let protocolType: String?      // "DASH", "HLS", etc.
        let drmType: String?

        enum CodingKeys: String, CodingKey {
            case contentUrl
            case playbackResourceToken
            case protocolType = "protocol"
            case drmType
        }
    }

    // MARK: - Lifecycle

    /// Initialize the bridge with the Flow access token obtained from EasyLogin.
    func start(with token: String) {
        guard webView == nil else {
            csdkLog.info("[CSDK] Bridge already started")
            return
        }

        csdkLog.info("[CSDK] Starting bridge with token length: \(token.count)")
        self.pendingToken = token
        self.isLoading = true
        self.statusMessage = "Loading SmartTV app..."
        self.loginInjected = false
        self.navigationAttempts = 0

        setupWebView()
        loadSmartTVApp()
    }

    /// Tear down the bridge.
    func stop() {
        webView?.stopLoading()
        webView?.configuration.userContentController.removeAllUserScripts()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "csdkBridge")
        webView = nil
        isReady = false
        isLoading = false
        loginInjected = false
        statusMessage = "Stopped"
        csdkLog.info("[CSDK] Bridge stopped")
    }

    // MARK: - WebView Setup

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        let ucc = WKUserContentController()

        // Register our native message handler.
        ucc.add(self, name: "csdkBridge")

        // Inject the network-interception script BEFORE the page loads.
        let interceptScript = WKUserScript(
            source: Self.networkInterceptJS,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        ucc.addUserScript(interceptScript)

        config.userContentController = ucc

        // tvOS WKWebView settings
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Custom user agent matching the SmartTV
        let wv = WKWebView(frame: CGRect(x: 0, y: 0, width: 1920, height: 1080), configuration: config)
        wv.navigationDelegate = self
        wv.customUserAgent = "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36"

        self.webView = wv
    }

    private func loadSmartTVApp() {
        guard let url = URL(string: Self.smartTVURL) else { return }
        csdkLog.info("[CSDK] Loading \(Self.smartTVURL)")
        webView?.load(URLRequest(url: url))
    }

    // MARK: - Token Injection

    /// After the SmartTV app loads, inject the EasyLogin token to trigger CSDK login.
    private func injectToken() {
        guard !loginInjected, let token = pendingToken else { return }
        loginInjected = true
        statusMessage = "Injecting token..."

        // The SmartTV app listens for EasyLogin via WebSocket. We simulate the
        // `flowaccesstoken` callback by dispatching a CustomEvent that the app
        // or by directly calling into the CSDK if we can find it.
        //
        // Strategy: Inject a script that:
        //  1. Waits for the CSDK to be available on the page (polling)
        //  2. Calls csdk.login() with our token
        //  3. Then calls csdk.request("epg", "Channels", ...) for channel data
        //
        // Since the CSDK is module-scoped, we use our fetch interceptor to detect
        // when the login endpoint is called and inject our token into the request.
        // Alternatively, we look for the CSDK instance on common global paths.

        let js = """
        (async function() {
            const log = (msg) => {
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'log', message: String(msg)
                });
            };

            log('Token injection started');

            // --- Approach 1: Find the CSDK instance ---
            // SmartTV apps often store the SDK on a global or on window.__CSDK__
            // or via Redux/MobX stores. Let's poll for it.

            let csdk = null;
            const csdkPaths = [
                () => window.__CSDK__,
                () => window.csdk,
                () => window._csdk,
                () => window.CSDK,
                () => window._t,
                () => window.app?.csdk,
                () => window.__store__?.csdk,
            ];

            for (let attempt = 0; attempt < 60; attempt++) {
                for (const pathFn of csdkPaths) {
                    try {
                        const candidate = pathFn();
                        if (candidate && typeof candidate.request === 'function') {
                            csdk = candidate;
                            log('Found CSDK via global path at attempt ' + attempt);
                            break;
                        }
                        if (candidate && typeof candidate.login === 'function') {
                            csdk = candidate;
                            log('Found CSDK (login method) at attempt ' + attempt);
                            break;
                        }
                    } catch(e) {}
                }
                if (csdk) break;

                // Also try to find it by scanning window properties
                if (attempt === 10 || attempt === 30) {
                    try {
                        const keys = Object.keys(window).filter(k =>
                            !k.startsWith('_') || k === '_t' || k === '__CSDK__'
                        );
                        const interesting = keys.filter(k => {
                            try {
                                const v = window[k];
                                return v && typeof v === 'object' &&
                                    (typeof v.request === 'function' ||
                                     typeof v.login === 'function' ||
                                     typeof v.initialize === 'function');
                            } catch(e) { return false; }
                        });
                        if (interesting.length > 0) {
                            log('Interesting globals: ' + interesting.join(', '));
                            csdk = window[interesting[0]];
                            break;
                        }
                        log('Window keys (sample): ' + keys.slice(0, 30).join(', '));
                    } catch(e) {
                        log('Window scan error: ' + e);
                    }
                }

                await new Promise(r => setTimeout(r, 1000));
            }

            // --- Approach 2: If CSDK not found globally, try intercepting ---
            // Our fetch interceptor captures all requests. If the CSDK makes a
            // login call, we'll see it. But we can also try to trigger login
            // by simulating what EasyLogin does: dispatch a message on
            // the BroadcastChannel or fire a custom event.

            if (!csdk) {
                log('CSDK not found globally. Trying event-based injection...');

                // Try dispatching the flowaccesstoken event
                const tokenData = {
                    flowaccesstoken: '\(token.replacingOccurrences(of: "'", with: "\\'"))',
                    accountId: 'user'
                };

                // Method A: BroadcastChannel (used by some SmartTV builds)
                try {
                    const bc = new BroadcastChannel('easylogin');
                    bc.postMessage({ method: 'flowaccesstoken', data: tokenData });
                    log('Sent BroadcastChannel message');
                } catch(e) {
                    log('BroadcastChannel failed: ' + e);
                }

                // Method B: CustomEvent on window
                try {
                    window.dispatchEvent(new CustomEvent('easylogin-token', {
                        detail: tokenData
                    }));
                    log('Dispatched CustomEvent easylogin-token');
                } catch(e) {}

                // Method C: postMessage to window
                try {
                    window.postMessage({
                        type: 'easylogin',
                        method: 'flowaccesstoken',
                        data: tokenData
                    }, '*');
                    log('Sent window.postMessage');
                } catch(e) {}

                // Method D: Look for WebSocket instances and simulate a message
                try {
                    if (window.__interceptedWebSockets && window.__interceptedWebSockets.length > 0) {
                        const ws = window.__interceptedWebSockets[window.__interceptedWebSockets.length - 1];
                        const msg = JSON.stringify({
                            method: 'flowaccesstoken',
                            data: tokenData
                        });
                        // Dispatch a message event on the WebSocket
                        const event = new MessageEvent('message', { data: msg });
                        ws.dispatchEvent(event);
                        log('Injected WebSocket message');
                    }
                } catch(e) {
                    log('WebSocket injection error: ' + e);
                }

                // Wait for the app to process
                await new Promise(r => setTimeout(r, 5000));

                // Check again for CSDK
                for (const pathFn of csdkPaths) {
                    try {
                        const candidate = pathFn();
                        if (candidate && (typeof candidate.request === 'function' ||
                                          typeof candidate.login === 'function')) {
                            csdk = candidate;
                            log('Found CSDK after event injection');
                            break;
                        }
                    } catch(e) {}
                }
            }

            if (!csdk) {
                log('CSDK still not found. Will rely on fetch intercepts only.');
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'status',
                    message: 'waiting_for_intercepts'
                });
                return;
            }

            // --- We have the CSDK! Try to login and fetch channels ---
            try {
                log('Attempting CSDK login...');
                const loginParams = {
                    token: '\(token.replacingOccurrences(of: "'", with: "\\'"))',
                    providerId: 'flowclient',
                    provisionMethod: 'OAuthToken'
                };

                if (typeof csdk.login === 'function') {
                    await csdk.login(loginParams);
                    log('CSDK login succeeded');
                } else if (typeof csdk.initialize === 'function') {
                    await csdk.initialize();
                    log('CSDK initialized');
                    if (typeof csdk.login === 'function') {
                        await csdk.login(loginParams);
                        log('CSDK login succeeded after init');
                    }
                }

                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'loginSuccess'
                });
            } catch(e) {
                log('CSDK login error: ' + e);
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'loginError', message: String(e)
                });
            }

            // Fetch channels
            try {
                log('Fetching channels via CSDK...');
                let channelResult;
                if (typeof csdk.request === 'function') {
                    channelResult = await csdk.request('epg', 'Channels', {
                        size: 1000,
                        restricted: false,
                        channelTypes: 'CHANNEL',
                        showAdultContent: false,
                        contentType: 'live_tv'
                    });
                }

                if (channelResult) {
                    log('Got channel data, entries: ' + (channelResult.entries?.length || 'unknown'));
                    window.webkit.messageHandlers.csdkBridge.postMessage({
                        type: 'channels',
                        data: JSON.stringify(channelResult)
                    });
                }
            } catch(e) {
                log('Channel fetch error: ' + e);
            }
        })();
        """

        webView?.evaluateJavaScript(js) { _, error in
            if let error {
                csdkLog.error("[CSDK] JS injection error: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Stream URL Resolution

    /// Request a stream URL for a given content ID via the CSDK.
    func getStreamURL(contentId: String, contentType: String = "live_tv") async -> ContentSourceResult? {
        guard webView != nil else { return nil }

        let js = """
        (async function() {
            const log = (msg) => {
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'log', message: 'ContentSource: ' + String(msg)
                });
            };

            // Find CSDK
            const paths = [
                () => window.__CSDK__, () => window.csdk, () => window._csdk,
                () => window.CSDK, () => window._t
            ];
            let csdk = null;
            for (const p of paths) {
                try {
                    const c = p();
                    if (c && typeof c.request === 'function') { csdk = c; break; }
                } catch(e) {}
            }

            if (!csdk) {
                log('No CSDK found for ContentSource');
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'contentSource', data: 'null'
                });
                return;
            }

            try {
                const source = await csdk.request('prm4', 'ContentSource', {
                    contentId: '\(contentId.replacingOccurrences(of: "'", with: "\\'"))',
                    contentType: '\(contentType.replacingOccurrences(of: "'", with: "\\'"))'
                });
                log('Got content source');
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'contentSource',
                    data: JSON.stringify(source)
                });
            } catch(e) {
                log('ContentSource error: ' + e);
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'contentSource', data: 'null'
                });
            }
        })();
        """

        webView?.evaluateJavaScript(js, completionHandler: nil)

        return await withCheckedContinuation { continuation in
            self.contentSourceContinuation = continuation
        }
    }

    // MARK: - Network Interception JS

    /// JavaScript injected at document start to intercept all fetch/XHR traffic.
    /// This lets us capture CSDK API responses even if we can't access the SDK directly.
    private static let networkInterceptJS = """
    (function() {
        'use strict';

        // --- Intercept WebSocket to capture EasyLogin and inject our token ---
        const OriginalWebSocket = window.WebSocket;
        window.__interceptedWebSockets = [];

        window.WebSocket = function(url, protocols) {
            const ws = protocols
                ? new OriginalWebSocket(url, protocols)
                : new OriginalWebSocket(url);

            window.__interceptedWebSockets.push(ws);

            const origOnMessage = null;
            const descriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage') ||
                               Object.getOwnPropertyDescriptor(OriginalWebSocket.prototype, 'onmessage');

            ws.addEventListener('message', function(event) {
                try {
                    window.webkit.messageHandlers.csdkBridge.postMessage({
                        type: 'wsMessage',
                        url: url,
                        data: typeof event.data === 'string' ? event.data.substring(0, 500) : '(binary)'
                    });
                } catch(e) {}
            });

            ws.addEventListener('open', function() {
                try {
                    window.webkit.messageHandlers.csdkBridge.postMessage({
                        type: 'wsOpen', url: url
                    });
                } catch(e) {}
            });

            return ws;
        };
        // Copy static properties
        Object.keys(OriginalWebSocket).forEach(k => {
            try { window.WebSocket[k] = OriginalWebSocket[k]; } catch(e) {}
        });
        window.WebSocket.prototype = OriginalWebSocket.prototype;

        // --- Intercept fetch ---
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
            const method = args[1]?.method || 'GET';

            try {
                window.webkit.messageHandlers.csdkBridge.postMessage({
                    type: 'fetchRequest',
                    url: url.substring(0, 300),
                    method: method
                });
            } catch(e) {}

            const response = await originalFetch.apply(this, args);

            // Clone the response so we can read the body without consuming it
            const clone = response.clone();

            // Capture interesting responses (channels, content source, login)
            const lowerUrl = url.toLowerCase();
            const isInteresting = lowerUrl.includes('/epg/') ||
                                  lowerUrl.includes('channel') ||
                                  lowerUrl.includes('/prm') ||
                                  lowerUrl.includes('contentsource') ||
                                  lowerUrl.includes('content-source') ||
                                  lowerUrl.includes('/provision/') ||
                                  lowerUrl.includes('/login') ||
                                  lowerUrl.includes('sdkconfig');

            if (isInteresting) {
                clone.text().then(body => {
                    try {
                        window.webkit.messageHandlers.csdkBridge.postMessage({
                            type: 'fetchResponse',
                            url: url.substring(0, 300),
                            status: response.status,
                            body: body.substring(0, 10000)
                        });
                    } catch(e) {}
                }).catch(() => {});
            }

            return response;
        };

        // --- Intercept XMLHttpRequest ---
        const OrigXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
            const xhr = new OrigXHR();
            const origOpen = xhr.open;
            let xhrUrl = '';
            let xhrMethod = '';

            xhr.open = function(method, url, ...rest) {
                xhrUrl = url;
                xhrMethod = method;
                try {
                    window.webkit.messageHandlers.csdkBridge.postMessage({
                        type: 'xhrOpen', url: String(url).substring(0, 300), method: method
                    });
                } catch(e) {}
                return origOpen.apply(this, [method, url, ...rest]);
            };

            xhr.addEventListener('load', function() {
                const lowerUrl = xhrUrl.toLowerCase();
                const isInteresting = lowerUrl.includes('/epg/') ||
                                      lowerUrl.includes('channel') ||
                                      lowerUrl.includes('/prm') ||
                                      lowerUrl.includes('contentsource') ||
                                      lowerUrl.includes('content-source') ||
                                      lowerUrl.includes('/provision/') ||
                                      lowerUrl.includes('/login') ||
                                      lowerUrl.includes('sdkconfig');

                if (isInteresting) {
                    try {
                        const body = typeof xhr.response === 'string'
                            ? xhr.response
                            : JSON.stringify(xhr.response);
                        window.webkit.messageHandlers.csdkBridge.postMessage({
                            type: 'xhrResponse',
                            url: xhrUrl.substring(0, 300),
                            status: xhr.status,
                            body: (body || '').substring(0, 10000)
                        });
                    } catch(e) {}
                }
            });

            return xhr;
        };
        window.XMLHttpRequest.prototype = OrigXHR.prototype;

        // Notify native that intercepts are installed
        try {
            window.webkit.messageHandlers.csdkBridge.postMessage({
                type: 'interceptsReady'
            });
        } catch(e) {}
    })();
    """
}

// MARK: - WKNavigationDelegate

extension CSDKBridge: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let urlStr = webView.url?.absoluteString ?? "nil"
        csdkLog.info("[CSDK] Page loaded: \(urlStr)")
        statusMessage = "Page loaded"
        navigationAttempts += 1

        // Give the SmartTV app a few seconds to bootstrap, then inject
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            self?.injectToken()
        }

        // Also start a secondary polling timer that will try to inject
        // periodically in case the first attempt is too early
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self, !self.isReady else { return }
            self.injectToken()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self, !self.isReady else { return }
            self.loginInjected = false
            self.injectToken()
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        csdkLog.error("[CSDK] Navigation failed: \(error.localizedDescription)")
        statusMessage = "Load failed: \(error.localizedDescription)"
        self.error = error.localizedDescription
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        csdkLog.error("[CSDK] Provisional navigation failed: \(error.localizedDescription)")
        statusMessage = "Failed to load SmartTV app"
        self.error = error.localizedDescription

        // Retry once after a delay
        if navigationAttempts < 3 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
                self?.loadSmartTVApp()
            }
        }
    }

    // Allow any HTTPS navigation (the CSDK may redirect)
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
        let urlStr = navigationAction.request.url?.absoluteString ?? ""
        csdkLog.info("[CSDK] Navigation request: \(urlStr.prefix(200))")
        return .allow
    }
}

// MARK: - WKScriptMessageHandler

extension CSDKBridge: WKScriptMessageHandler {
    nonisolated func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        Task { @MainActor in
            handleMessage(message)
        }
    }

    private func handleMessage(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            csdkLog.info("[CSDK] Non-dict message: \(String(describing: message.body))")
            return
        }

        switch type {
        case "interceptsReady":
            csdkLog.info("[CSDK] Network intercepts installed")
            statusMessage = "Intercepts ready"

        case "log":
            let msg = body["message"] as? String ?? ""
            csdkLog.info("[CSDK-JS] \(msg)")

        case "loginSuccess":
            csdkLog.info("[CSDK] Login successful!")
            statusMessage = "Logged in via CSDK"

        case "loginError":
            let msg = body["message"] as? String ?? "unknown"
            csdkLog.error("[CSDK] Login error: \(msg)")
            statusMessage = "Login error: \(msg)"

        case "channels":
            handleChannelsMessage(body)

        case "contentSource":
            handleContentSourceMessage(body)

        case "fetchRequest":
            let url = body["url"] as? String ?? ""
            let method = body["method"] as? String ?? ""
            csdkLog.info("[CSDK] Fetch: \(method) \(url)")

        case "fetchResponse":
            handleFetchResponse(body)

        case "xhrOpen":
            let url = body["url"] as? String ?? ""
            let method = body["method"] as? String ?? ""
            csdkLog.info("[CSDK] XHR: \(method) \(url)")

        case "xhrResponse":
            handleXHRResponse(body)

        case "wsOpen":
            let url = body["url"] as? String ?? ""
            csdkLog.info("[CSDK] WebSocket opened: \(url)")

        case "wsMessage":
            let url = body["url"] as? String ?? ""
            let data = body["data"] as? String ?? ""
            csdkLog.info("[CSDK] WS msg from \(url): \(data.prefix(200))")

        case "status":
            let msg = body["message"] as? String ?? ""
            csdkLog.info("[CSDK] Status: \(msg)")
            statusMessage = msg

        default:
            csdkLog.info("[CSDK] Unknown message type: \(type)")
        }
    }

    // MARK: - Channel Data Parsing

    private func handleChannelsMessage(_ body: [String: Any]) {
        guard let dataStr = body["data"] as? String,
              let data = dataStr.data(using: .utf8) else {
            csdkLog.error("[CSDK] channels: no data string")
            return
        }

        csdkLog.info("[CSDK] Parsing channel data (\(data.count) bytes)")
        parseAndSetChannels(from: data)
    }

    /// Handles intercepted fetch responses that might contain channel data.
    private func handleFetchResponse(_ body: [String: Any]) {
        let url = body["url"] as? String ?? ""
        let status = body["status"] as? Int ?? 0
        let bodyStr = body["body"] as? String ?? ""

        csdkLog.info("[CSDK] Fetch response: \(status) \(url) (\(bodyStr.count) chars)")

        // If this looks like channel data, try to parse it
        let lowerUrl = url.lowercased()
        if (lowerUrl.contains("channel") || lowerUrl.contains("/epg/")) && status == 200 {
            if let data = bodyStr.data(using: .utf8) {
                parseAndSetChannels(from: data)
            }
        }

        // Content source response (from intercept)
        if (lowerUrl.contains("contentsource") || lowerUrl.contains("content-source")) && status == 200 {
            if let data = bodyStr.data(using: .utf8) {
                parseContentSource(from: data)
            }
        }
    }

    /// Handles intercepted XHR responses.
    private func handleXHRResponse(_ body: [String: Any]) {
        let url = body["url"] as? String ?? ""
        let status = body["status"] as? Int ?? 0
        let bodyStr = body["body"] as? String ?? ""

        csdkLog.info("[CSDK] XHR response: \(status) \(url) (\(bodyStr.count) chars)")

        let lowerUrl = url.lowercased()
        if (lowerUrl.contains("channel") || lowerUrl.contains("/epg/")) && status == 200 {
            if let data = bodyStr.data(using: .utf8) {
                parseAndSetChannels(from: data)
            }
        }

        if (lowerUrl.contains("contentsource") || lowerUrl.contains("content-source")) && status == 200 {
            if let data = bodyStr.data(using: .utf8) {
                parseContentSource(from: data)
            }
        }
    }

    /// Try multiple JSON structures to extract channel data from the CSDK response.
    private func parseAndSetChannels(from data: Data) {
        // Guard against re-parsing if we already have channels
        guard channels.isEmpty else { return }

        do {
            let json = try JSONSerialization.jsonObject(with: data)

            // The CSDK response may be:
            // { "entries": [ { "id", "title", "channelNumber", ... } ] }
            // or an array directly
            // or { "response": { "entries": [...] } }

            var entries: [[String: Any]] = []

            if let dict = json as? [String: Any] {
                if let e = dict["entries"] as? [[String: Any]] {
                    entries = e
                } else if let resp = dict["response"] as? [String: Any],
                          let e = resp["entries"] as? [[String: Any]] {
                    entries = e
                } else if let channels = dict["channels"] as? [[String: Any]] {
                    entries = channels
                } else if let data = dict["data"] as? [[String: Any]] {
                    entries = data
                }
            } else if let arr = json as? [[String: Any]] {
                entries = arr
            }

            guard !entries.isEmpty else {
                csdkLog.info("[CSDK] No channel entries found in response")
                return
            }

            let parsed: [CSDKChannel] = entries.compactMap { entry in
                let id = "\(entry["id"] ?? entry["contentId"] ?? entry["channelId"] ?? UUID().uuidString)"
                let name = entry["title"] as? String
                    ?? entry["name"] as? String
                    ?? entry["channelName"] as? String
                    ?? "Channel"
                let number = entry["channelNumber"] as? Int
                    ?? entry["number"] as? Int
                    ?? entry["logicalChannelNumber"] as? Int
                    ?? 0

                // Logo URL: various possible fields
                var logoURL: String?
                if let images = entry["images"] as? [[String: Any]] {
                    logoURL = images.first?["url"] as? String
                } else if let image = entry["image"] as? String {
                    logoURL = image
                } else if let logo = entry["logo"] as? String {
                    logoURL = logo
                } else if let pictures = entry["pictures"] as? [[String: Any]] {
                    logoURL = pictures.first?["url"] as? String
                }

                let category = entry["genre"] as? String
                    ?? entry["category"] as? String
                    ?? entry["channelCategory"] as? String

                let isHD = entry["isHd"] as? Bool
                    ?? entry["hd"] as? Bool
                    ?? (name.contains("HD"))

                return CSDKChannel(
                    id: id,
                    name: name,
                    number: number,
                    logoURL: logoURL,
                    category: category,
                    isHD: isHD
                )
            }

            guard !parsed.isEmpty else { return }

            csdkLog.info("[CSDK] Parsed \(parsed.count) channels!")
            self.channels = parsed.sorted { $0.number < $1.number }
            self.isReady = true
            self.isLoading = false
            self.statusMessage = "Ready - \(parsed.count) channels"

        } catch {
            csdkLog.error("[CSDK] JSON parse error: \(error.localizedDescription)")
        }
    }

    // MARK: - Content Source Parsing

    private func handleContentSourceMessage(_ body: [String: Any]) {
        let dataStr = body["data"] as? String ?? "null"
        if dataStr == "null" {
            contentSourceContinuation?.resume(returning: nil)
            contentSourceContinuation = nil
            return
        }

        if let data = dataStr.data(using: .utf8) {
            parseContentSource(from: data)
        }
    }

    private func parseContentSource(from data: Data) {
        do {
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

            // Look in various places for the content URL
            var contentUrl = json?["contentUrl"] as? String
                ?? json?["url"] as? String
                ?? json?["streamUrl"] as? String

            // The response might nest it under "entries" or "resource"
            if contentUrl == nil, let entries = json?["entries"] as? [[String: Any]],
               let first = entries.first {
                contentUrl = first["contentUrl"] as? String ?? first["url"] as? String
            }

            if contentUrl == nil, let resource = json?["resource"] as? [String: Any] {
                contentUrl = resource["contentUrl"] as? String ?? resource["url"] as? String
            }

            let result = ContentSourceResult(
                contentUrl: contentUrl,
                playbackResourceToken: json?["playbackResourceToken"] as? String
                    ?? json?["prmToken"] as? String,
                protocolType: json?["protocol"] as? String
                    ?? json?["protocolType"] as? String,
                drmType: json?["drmType"] as? String
                    ?? json?["drm"] as? String
            )

            csdkLog.info("[CSDK] ContentSource: url=\(contentUrl ?? "nil"), protocol=\(result.protocolType ?? "nil")")

            contentSourceContinuation?.resume(returning: result)
            contentSourceContinuation = nil

        } catch {
            csdkLog.error("[CSDK] ContentSource parse error: \(error)")
            contentSourceContinuation?.resume(returning: nil)
            contentSourceContinuation = nil
        }
    }
}
