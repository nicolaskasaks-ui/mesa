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

    private static let easyLoginURL = "wss://easylogin.app.flow.com.ar"

    // MARK: - Public

    func start() {
        disconnect()
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
        let data: Data
        switch message {
        case .string(let text):
            data = Data(text.utf8)
        case .data(let d):
            data = d
        @unknown default:
            return
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            print("[EasyLogin] Non-JSON message received")
            return
        }

        let method = json["method"] as? String ?? ""
        let msgData = json["data"] as? [String: Any]

        print("[EasyLogin] Received method: \(method)")

        switch method {
        case "code":
            DispatchQueue.main.async {
                self.state = .waitingForCode
            }
            sendOutputRequest()

        case "start":
            if let code = msgData?["code"] as? String {
                sessionID = msgData?["sessionID"] as? String
                print("[EasyLogin] Got code: \(code), sessionID: \(sessionID ?? "nil")")
                DispatchQueue.main.async {
                    self.state = .showingCode(code)
                }
            }

        case "flowaccesstoken":
            if let tokenData = msgData,
               let token = tokenData["flowaccesstoken"] as? String {
                let account = tokenData["accountId"] as? String
                print("[EasyLogin] Got flowaccesstoken! accountId: \(account ?? "unknown")")
                DispatchQueue.main.async {
                    self.accountId = account
                    self.state = .authenticated(token)
                    self.onAuthenticated?(token, account)
                }
                disconnect()
            }

        default:
            print("[EasyLogin] Unknown method: \(method), data: \(json)")
        }
    }

    // MARK: - Send Messages

    private func sendOutputRequest() {
        let msg: [String: Any] = [
            "sendType": "OUTPUT",
            "method": "code",
            "data": ""
        ]
        sendJSON(msg)
    }

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let text = String(data: data, encoding: .utf8) else { return }
        webSocket?.send(.string(text)) { error in
            if let error {
                print("[EasyLogin] Send error: \(error)")
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
        print("[EasyLogin] WebSocket connected, requesting code...")
        // Send code request immediately after connection
        sendOutputRequest()
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        print("[EasyLogin] WebSocket closed: \(closeCode)")
    }
}
