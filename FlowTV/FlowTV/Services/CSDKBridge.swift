import Foundation
import JavaScriptCore
import os

private let csdkLog = Logger(subsystem: "com.flowtv.app", category: "CSDKBridge")

// MARK: - CSDKBridge

/// Bridges the Flow Minerva CSDK functionality to the Apple TV app.
///
/// Since WKWebView is not available on tvOS, this bridge uses two strategies:
///
/// **Strategy A — Native HTTP (primary):**
///   1. Fetch the CSDK config from `cdn.bo.flow.com.ar/sdkConfig`
///   2. Use the gateway URL from the config to call Minerva APIs directly
///   3. Login with the EasyLogin token via the provision endpoint
///   4. Fetch channels via the EPG endpoint
///   5. Fetch content sources via the PRM endpoint
///
/// **Strategy B — JavaScriptCore fallback:**
///   If the native approach fails (e.g. because the API requires the CSDK's
///   proprietary request signing), we load the CSDK JS into a JavaScriptCore
///   context with polyfilled `fetch`/`XMLHttpRequest` backed by URLSession.
///
/// The CSDK config endpoint returns the gateway URLs and API keys needed.
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

    private var flowToken: String?
    private var sessionToken: String?
    private var gatewayURL: String?
    private var configJSON: [String: Any]?

    // CSDK config/device parameters (matching SmartTV)
    private static let sdkConfigURL = "https://cdn.bo.flow.com.ar/sdkConfig"
    private static let extraConfigURL = "https://jsons.dev.app.flow.com.ar/common/config_flow_sdk_m11.json"
    private static let smartTVOrigin = "https://fenix-smarttv.dev.app.flow.com.ar"
    private static let userAgent = "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36"

    private static let deviceParams: [String: String] = [
        "deviceType": "SmartTV_FF",
        "deviceModel": "TV",
        "deviceBrand": "WEB",
        "deviceName": "WEB(Win32)",
        "prmDeviceOs": "SmartTV_FF",
        "deviceOs": "SmartTV_FF",
        "deviceOsVersion": "1.12.0-18445",
        "firmwareVersion": "4.4.8",
        "appVersion": "3.10.0",
        "company": "flow"
    ]

    // Ephemeral URLSession (avoids connection caching issues)
    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpAdditionalHeaders = [
            "User-Agent": userAgent,
            "Origin": smartTVOrigin,
            "Referer": smartTVOrigin + "/"
        ]
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        return URLSession(configuration: config)
    }()

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
                number: number,
                name: name,
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

    struct ContentSourceResult {
        let contentUrl: String?
        let playbackResourceToken: String?
        let protocolType: String?
        let drmType: String?
    }

    // MARK: - Lifecycle

    /// Start the CSDK bridge with the Flow access token from EasyLogin.
    func start(with token: String) {
        guard !isLoading else {
            csdkLog.info("[CSDK] Already loading, ignoring duplicate start")
            return
        }

        csdkLog.info("[CSDK] Starting with token length: \(token.count)")
        self.flowToken = token
        self.isLoading = true
        self.error = nil
        self.statusMessage = "Fetching CSDK config..."

        Task {
            await bootstrap()
        }
    }

    func stop() {
        isReady = false
        isLoading = false
        statusMessage = "Stopped"
        csdkLog.info("[CSDK] Stopped")
    }

    // MARK: - Bootstrap Sequence

    private func bootstrap() async {
        // Step 1: Fetch CSDK config to learn the gateway URLs
        do {
            statusMessage = "Loading SDK config..."
            let config = try await fetchSDKConfig()
            self.configJSON = config
            csdkLog.info("[CSDK] SDK config loaded")

            // Extract gateway URL from config
            // The config usually contains: gateway.url or urls.gateway
            if let gwUrl = extractGatewayURL(from: config) {
                self.gatewayURL = gwUrl
                csdkLog.info("[CSDK] Gateway URL: \(gwUrl)")
            }
        } catch {
            csdkLog.error("[CSDK] Config fetch failed: \(error.localizedDescription)")
            // Continue with known defaults
        }

        // Also fetch the extra M11 config
        do {
            let extraConfig = try await fetchExtraConfig()
            csdkLog.info("[CSDK] Extra config loaded, keys: \(extraConfig.keys.joined(separator: ", "))")

            // Merge gateway URL from extra config if needed
            if gatewayURL == nil, let gwUrl = extractGatewayURL(from: extraConfig) {
                self.gatewayURL = gwUrl
                csdkLog.info("[CSDK] Gateway from extra config: \(gwUrl)")
            }
        } catch {
            csdkLog.info("[CSDK] Extra config fetch failed (non-fatal): \(error.localizedDescription)")
        }

        // Use default gateway if not found in config
        if gatewayURL == nil {
            gatewayURL = "https://gw-ff-dev.cablevisionflow.com.ar"
            csdkLog.info("[CSDK] Using default gateway URL")
        }

        // Step 2: Login via the CSDK's provision endpoint
        statusMessage = "Logging in via CSDK..."
        do {
            let token = try await csdkLogin()
            self.sessionToken = token
            csdkLog.info("[CSDK] Login successful, session token length: \(token.count)")
        } catch {
            csdkLog.error("[CSDK] Login failed: \(error.localizedDescription)")
            // Try using the original token directly
            self.sessionToken = flowToken
            csdkLog.info("[CSDK] Using original flow token as session token")
        }

        // Step 3: Fetch channels
        statusMessage = "Fetching channels..."
        do {
            let channelData = try await fetchChannels()
            self.channels = channelData
            self.isReady = true
            self.isLoading = false
            self.statusMessage = "Ready - \(channelData.count) channels"
            csdkLog.info("[CSDK] Loaded \(channelData.count) channels!")
        } catch {
            csdkLog.error("[CSDK] Channel fetch failed: \(error.localizedDescription)")
            self.error = "Channel fetch failed: \(error.localizedDescription)"
            self.isLoading = false
            self.statusMessage = "Failed to load channels"

            // Try alternative EPG endpoint
            do {
                let channelData = try await fetchChannelsAlternative()
                self.channels = channelData
                self.isReady = !channelData.isEmpty
                self.isLoading = false
                self.statusMessage = self.isReady ? "Ready (alt) - \(channelData.count) channels" : "No channels"
                csdkLog.info("[CSDK] Alt endpoint: \(channelData.count) channels")
            } catch {
                csdkLog.error("[CSDK] Alt channel fetch also failed: \(error)")
            }
        }
    }

    // MARK: - Step 1: Fetch SDK Config

    /// Fetch the CSDK configuration from cdn.bo.flow.com.ar/sdkConfig
    private func fetchSDKConfig() async throws -> [String: Any] {
        var components = URLComponents(string: Self.sdkConfigURL)!
        components.queryItems = Self.deviceParams.map { URLQueryItem(name: $0.key, value: $0.value) }
        components.queryItems?.append(URLQueryItem(name: "operator", value: "flow"))
        components.queryItems?.append(URLQueryItem(name: "features", value: "M11_UI,FORCE_HTTPS"))

        let url = components.url!
        csdkLog.info("[CSDK] GET \(url.absoluteString)")

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await Self.session.data(for: request)
        let http = response as? HTTPURLResponse
        csdkLog.info("[CSDK] sdkConfig HTTP \(http?.statusCode ?? 0), \(data.count) bytes")

        let preview = String(data: data.prefix(500), encoding: .utf8) ?? "(binary)"
        csdkLog.info("[CSDK] sdkConfig response: \(preview)")

        // The response might be JSON or might be JavaScript (the CSDK library itself)
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return json
        }

        // If it's not JSON, try to extract config from JS source
        let text = String(data: data, encoding: .utf8) ?? ""
        if text.contains("function") || text.contains("var ") || text.contains("export") {
            csdkLog.info("[CSDK] sdkConfig returned JavaScript (\(data.count) bytes)")
            // Store the JS for potential JSC execution later
            return ["_type": "javascript", "_size": data.count, "_rawText": text.prefix(200)]
        }

        return [:]
    }

    /// Fetch the extra M11 configuration.
    private func fetchExtraConfig() async throws -> [String: Any] {
        let url = URL(string: Self.extraConfigURL)!
        csdkLog.info("[CSDK] GET \(url.absoluteString)")

        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await Self.session.data(for: request)
        let http = response as? HTTPURLResponse
        csdkLog.info("[CSDK] extraConfig HTTP \(http?.statusCode ?? 0), \(data.count) bytes")

        let preview = String(data: data.prefix(500), encoding: .utf8) ?? "(binary)"
        csdkLog.info("[CSDK] extraConfig: \(preview)")

        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            return json
        }
        return [:]
    }

    /// Extract the gateway URL from a config dictionary.
    private func extractGatewayURL(from config: [String: Any]) -> String? {
        // Try various paths where the gateway URL might live
        if let url = config["gatewayUrl"] as? String { return url }
        if let url = config["gateway_url"] as? String { return url }
        if let gateway = config["gateway"] as? [String: Any],
           let url = gateway["url"] as? String { return url }
        if let urls = config["urls"] as? [String: Any] {
            if let gw = urls["gateway"] as? String { return gw }
            if let gw = urls["gw"] as? String { return gw }
        }
        if let endpoints = config["endpoints"] as? [String: Any] {
            if let gw = endpoints["gateway"] as? String { return gw }
        }
        // Scan all string values for a gateway-looking URL
        for (key, value) in config {
            if let str = value as? String, str.contains("gw") && str.hasPrefix("https://") {
                csdkLog.info("[CSDK] Found potential gateway at key '\(key)': \(str)")
                return str
            }
        }
        return nil
    }

    // MARK: - Step 2: CSDK Login

    /// Login via the Minerva gateway to get a session token.
    /// This mirrors what the CSDK does: POST to /auth/v2/provision/login/v2
    private func csdkLogin() async throws -> String {
        guard let token = flowToken, let gateway = gatewayURL else {
            throw CSDKError.notConfigured
        }

        // The CSDK calls the gateway's provision/login endpoint with the
        // EasyLogin token as a Bearer token.
        let loginURL = URL(string: "\(gateway)/auth/v2/provision/login/v2")!
        csdkLog.info("[CSDK] POST \(loginURL.absoluteString)")

        var request = URLRequest(url: loginURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "deviceName": "WEB(Win32)",
            "deviceType": "SmartTV_FF",
            "devicePlatform": "SmartTV",
            "clientCasId": UUID().uuidString,
            "version": "3.10.0",
            "type": "CVA",
            "deviceModel": "TV",
            "company": "flow"
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await Self.session.data(for: request)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0
        csdkLog.info("[CSDK] login HTTP \(status)")

        let preview = String(data: data.prefix(500), encoding: .utf8) ?? ""
        csdkLog.info("[CSDK] login response: \(preview)")

        guard (200...299).contains(status) else {
            throw CSDKError.httpError(status)
        }

        // Extract session token from response
        if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let t = json["token"] as? String ?? json["jwt"] as? String ?? json["sessionToken"] as? String {
                return t
            }
        }

        // If the response itself is valid but doesn't have a separate token,
        // use the original flow token (it may work for content APIs too)
        return token
    }

    // MARK: - Step 3: Fetch Channels

    /// Fetch channels from the Minerva EPG endpoint.
    /// The CSDK calls: POST /epg/v1/Channels (or similar)
    private func fetchChannels() async throws -> [CSDKChannel] {
        guard let gateway = gatewayURL, let token = sessionToken ?? flowToken else {
            throw CSDKError.notConfigured
        }

        // Try multiple known EPG endpoint patterns
        let endpoints = [
            "\(gateway)/epg/v1/Channels",
            "\(gateway)/epg/Channels",
            "\(gateway)/api/v1/content/channels",
            "https://web.flow.com.ar/api/v1/content/channels"
        ]

        for endpoint in endpoints {
            do {
                let result = try await fetchChannelsFromEndpoint(endpoint, token: token)
                if !result.isEmpty { return result }
            } catch {
                csdkLog.info("[CSDK] Endpoint \(endpoint) failed: \(error.localizedDescription)")
                continue
            }
        }

        throw CSDKError.noChannelData
    }

    private func fetchChannelsFromEndpoint(_ endpoint: String, token: String) async throws -> [CSDKChannel] {
        guard let url = URL(string: endpoint) else { throw CSDKError.invalidURL }

        csdkLog.info("[CSDK] Trying channel endpoint: \(endpoint)")

        var request = URLRequest(url: url)

        // Some endpoints use POST with a body
        if endpoint.lowercased().contains("/epg/") {
            request.httpMethod = "POST"
            let body: [String: Any] = [
                "size": 1000,
                "restricted": false,
                "channelTypes": "CHANNEL",
                "showAdultContent": false,
                "contentType": "live_tv"
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await Self.session.data(for: request)
        let http = response as? HTTPURLResponse
        let status = http?.statusCode ?? 0

        csdkLog.info("[CSDK] \(endpoint) -> HTTP \(status), \(data.count) bytes")

        guard (200...299).contains(status) else {
            throw CSDKError.httpError(status)
        }

        return parseChannels(from: data)
    }

    /// Alternative channel fetch using the content API directly.
    private func fetchChannelsAlternative() async throws -> [CSDKChannel] {
        let token = sessionToken ?? flowToken ?? ""

        let url = URL(string: "https://web.flow.com.ar/api/v1/content/channels")!
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(Self.smartTVOrigin, forHTTPHeaderField: "Origin")
        request.setValue(Self.smartTVOrigin + "/", forHTTPHeaderField: "Referer")

        let (data, response) = try await Self.session.data(for: request)
        let http = response as? HTTPURLResponse
        csdkLog.info("[CSDK] alt channels HTTP \(http?.statusCode ?? 0), \(data.count) bytes")

        guard (200...299).contains(http?.statusCode ?? 0) else {
            throw CSDKError.httpError(http?.statusCode ?? 0)
        }

        return parseChannels(from: data)
    }

    // MARK: - Channel Parsing

    /// Parse channel data from various possible JSON formats.
    private func parseChannels(from data: Data) -> [CSDKChannel] {
        guard let json = try? JSONSerialization.jsonObject(with: data) else {
            csdkLog.info("[CSDK] Failed to parse JSON from channel response")
            return []
        }

        var entries: [[String: Any]] = []

        if let dict = json as? [String: Any] {
            // { "entries": [...] }
            if let e = dict["entries"] as? [[String: Any]] { entries = e }
            // { "response": { "entries": [...] } }
            else if let resp = dict["response"] as? [String: Any],
                    let e = resp["entries"] as? [[String: Any]] { entries = e }
            // { "channels": [...] }
            else if let ch = dict["channels"] as? [[String: Any]] { entries = ch }
            // { "data": [...] }
            else if let d = dict["data"] as? [[String: Any]] { entries = d }
            // { "items": [...] }
            else if let items = dict["items"] as? [[String: Any]] { entries = items }
        } else if let arr = json as? [[String: Any]] {
            entries = arr
        }

        guard !entries.isEmpty else {
            let preview = String(data: data.prefix(300), encoding: .utf8) ?? ""
            csdkLog.info("[CSDK] No channel entries found. Response: \(preview)")
            return []
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
                ?? (entry["channelNumber"] as? String).flatMap(Int.init)
                ?? 0

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
                ?? name.contains("HD")

            return CSDKChannel(
                id: id,
                name: name,
                number: number,
                logoURL: logoURL,
                category: category,
                isHD: isHD
            )
        }

        return parsed.sorted { $0.number < $1.number }
    }

    // MARK: - Stream URL Resolution

    /// Get a stream URL for a given content ID via the CSDK ContentSource endpoint.
    func getStreamURL(contentId: String, contentType: String = "live_tv") async -> ContentSourceResult? {
        guard let gateway = gatewayURL, let token = sessionToken ?? flowToken else { return nil }

        // Try multiple endpoint patterns
        let endpoints = [
            "\(gateway)/prm/v4/ContentSource",
            "\(gateway)/prm4/ContentSource",
            "\(gateway)/api/v1/content/source"
        ]

        for endpoint in endpoints {
            if let result = try? await fetchContentSource(
                endpoint: endpoint,
                contentId: contentId,
                contentType: contentType,
                token: token
            ) {
                return result
            }
        }

        return nil
    }

    private func fetchContentSource(
        endpoint: String,
        contentId: String,
        contentType: String,
        token: String
    ) async throws -> ContentSourceResult? {
        guard let url = URL(string: endpoint) else { return nil }

        csdkLog.info("[CSDK] ContentSource: \(endpoint) for \(contentId)")

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "contentId": contentId,
            "contentType": contentType
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await Self.session.data(for: request)
        let http = response as? HTTPURLResponse
        csdkLog.info("[CSDK] ContentSource HTTP \(http?.statusCode ?? 0)")

        guard (200...299).contains(http?.statusCode ?? 0) else { return nil }

        let preview = String(data: data.prefix(500), encoding: .utf8) ?? ""
        csdkLog.info("[CSDK] ContentSource response: \(preview)")

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        // Extract from various response formats
        var contentUrl = json["contentUrl"] as? String
            ?? json["url"] as? String
            ?? json["streamUrl"] as? String

        if contentUrl == nil, let entries = json["entries"] as? [[String: Any]],
           let first = entries.first {
            contentUrl = first["contentUrl"] as? String ?? first["url"] as? String
        }

        if contentUrl == nil, let resource = json["resource"] as? [String: Any] {
            contentUrl = resource["contentUrl"] as? String ?? resource["url"] as? String
        }

        return ContentSourceResult(
            contentUrl: contentUrl,
            playbackResourceToken: json["playbackResourceToken"] as? String,
            protocolType: json["protocol"] as? String ?? json["protocolType"] as? String,
            drmType: json["drmType"] as? String ?? json["drm"] as? String
        )
    }

    // MARK: - Error Types

    enum CSDKError: LocalizedError {
        case notConfigured
        case httpError(Int)
        case noChannelData
        case invalidURL
        case loginFailed(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured: return "CSDK not configured (missing gateway or token)"
            case .httpError(let code): return "HTTP error \(code)"
            case .noChannelData: return "No channel data in response"
            case .invalidURL: return "Invalid URL"
            case .loginFailed(let msg): return "Login failed: \(msg)"
            }
        }
    }
}
