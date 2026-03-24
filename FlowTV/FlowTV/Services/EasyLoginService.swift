import Foundation

/// WebSocket-based Easy Login service for Flow.
/// Connects to easylogin.app.flow.com.ar, receives a companion code,
/// and waits for the user to enter that code on their phone/web.
/// Once validated, receives the flowaccesstoken via WebSocket.
class EasyLoginService: NSObject, ObservableObject, URLSessionWebSocketDelegate {
    enum LoginState: Equatable {
        case idle
        case connecting
        case waitingForCode
        case showingCode(String)
        case authenticated(String)
        case failed(String)
    }

    @Published var state: LoginState = .idle
    @Published var accountId: String?

    /// Called on main thread when authentication completes.
    var onAuthenticated: ((String, String?) -> Void)?

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var sessionID: String?
    private var pingTimer: Timer?
    private var codeSent = false

    private static let easyLoginURL = "wss://easylogin.app.flow.com.ar"

    // MARK: - Public

    func start() {
        disconnect()
        codeSent = false
        DispatchQueue.main.async {
            self.state = .connecting
        }

        let config = URLSessionConfiguration.default
        config.httpAdditionalHeaders = [
            "Origin": "https://fenix-smarttv.dev.app.flow.com.ar",
            "User-Agent": "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36"
        ]
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)

        guard let url = URL(string: Self.easyLoginURL) else {
            DispatchQueue.main.async { self.state = .failed("URL inválida") }
            return
        }

        let task = urlSession!.webSocketTask(with: url)
        self.webSocket = task
        task.resume()

        receiveMessage()

        DispatchQueue.main.async {
            self.startPingTimer()
        }

        // Timeout: if no code after 15 seconds, show error
        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in
            guard let self = self else { return }
            if case .connecting = self.state { self.state = .failed("Timeout conectando. Intentá de nuevo.") }
            if case .waitingForCode = self.state { self.state = .failed("No se recibió el código. Intentá de nuevo.") }
        }

        print("[EasyLogin] Connecting to \(Self.easyLoginURL)")
    }

    func disconnect() {
        DispatchQueue.main.async {
            self.pingTimer?.invalidate()
            self.pingTimer = nil
        }
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        sessionID = nil
    }

    func reset() {
        disconnect()
        codeSent = false
        DispatchQueue.main.async {
            self.state = .idle
            self.accountId = nil
        }
    }

    // MARK: - WebSocket Message Handling

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.receiveMessage()
            case .failure(let error):
                print("[EasyLogin] WebSocket receive error: \(error)")
                DispatchQueue.main.async {
                    if case .authenticated = self.state { return }
                    self.state = .failed("Conexión perdida. Intentá de nuevo.")
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let t):
            text = t
        case .data(let d):
            text = String(data: d, encoding: .utf8) ?? ""
        @unknown default:
            return
        }

        print("[EasyLogin] Raw message: \(text)")

        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("[EasyLogin] Non-JSON message: \(text)")
            return
        }

        let method = json["method"] as? String ?? json["sendType"] as? String ?? ""
        let msgData = json["data"]

        print("[EasyLogin] Received method: \(method)")

        switch method {
        case "code":
            // Server is ready — generate our own code and session, then register it
            print("[EasyLogin] Server ready, generating code and registering...")
            let code = Self.generateCode()
            let session = UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(32)
            self.sessionID = String(session)
            let startMsg: [String: Any] = [
                "method": "start",
                "data": [
                    "sessionID": String(session),
                    "code": code,
                    "SDK": true,
                    "sfat": false
                ]
            ]
            sendJSON(startMsg)
            print("[EasyLogin] Registered code: \(code)")
            DispatchQueue.main.async {
                self.state = .showingCode(code)
            }

        case "start":
            // Parse data - could be dict or nested
            if let dataDict = msgData as? [String: Any],
               let code = dataDict["code"] as? String {
                sessionID = dataDict["sessionID"] as? String
                print("[EasyLogin] Got code: \(code), sessionID: \(sessionID ?? "nil")")
                DispatchQueue.main.async {
                    self.state = .showingCode(code)
                }
            }

        case "flowaccesstoken":
            if let dataDict = msgData as? [String: Any],
               let token = dataDict["flowaccesstoken"] as? String {
                let account = dataDict["accountId"] as? String
                print("[EasyLogin] Got flowaccesstoken! accountId: \(account ?? "unknown")")
                DispatchQueue.main.async {
                    self.accountId = account
                    self.state = .authenticated(token)
                    self.onAuthenticated?(token, account)
                }
                disconnect()
            }

        default:
            print("[EasyLogin] Unhandled method: \(method), full json: \(json)")
        }
    }

    // MARK: - Code Generation

    /// Generate a 5-character alphanumeric code (uppercase, no ambiguous chars)
    private static func generateCode() -> String {
        let chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I
        return String((0..<5).map { _ in chars.randomElement()! })
    }

    // MARK: - Send Messages

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let text = String(data: data, encoding: .utf8) else { return }
        print("[EasyLogin] Sending: \(text)")
        webSocket?.send(.string(text)) { error in
            if let error {
                print("[EasyLogin] Send error: \(error)")
            } else {
                print("[EasyLogin] Send OK")
            }
        }
    }

    private func sendOutputRequest() {
        let text = "{\"sendType\":\"OUTPUT\",\"method\":\"code\",\"data\":\"\"}"
        print("[EasyLogin] Sending: \(text)")
        webSocket?.send(.string(text)) { error in
            if let error {
                print("[EasyLogin] Send error: \(error)")
            } else {
                print("[EasyLogin] Sent code request OK")
            }
        }
    }

    // MARK: - Keep-alive (must be called on main thread)

    private func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.webSocket?.sendPing { error in
                if let error {
                    print("[EasyLogin] Ping error: \(error)")
                }
            }
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        print("[EasyLogin] WebSocket connected")
        // Don't send here — wait for server's "code" prompt
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        let reasonStr = reason.flatMap { String(data: $0, encoding: .utf8) } ?? "none"
        print("[EasyLogin] WebSocket closed: \(closeCode), reason: \(reasonStr)")
    }
}
