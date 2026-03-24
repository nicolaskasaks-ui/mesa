import Foundation

/// WebSocket-based Easy Login service for Flow.
/// Connects to easylogin.app.flow.com.ar, receives a companion code,
/// and waits for the user to enter that code on their phone/web.
/// Once validated, receives the flowaccesstoken via WebSocket.
@MainActor
class EasyLoginService: NSObject, ObservableObject {
    enum State: Equatable {
        case idle
        case connecting
        case waitingForCode
        case showingCode(String)       // code to display on TV
        case authenticated(String)     // flowaccesstoken received
        case failed(String)            // error message
    }

    @Published var state: State = .idle
    @Published var accountId: String?

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var sessionID: String?
    private var pingTimer: Timer?

    private static let easyLoginURL = "wss://easylogin.app.flow.com.ar"

    // MARK: - Public

    /// Start the Easy Login flow: connect WebSocket, receive code.
    func start() {
        disconnect()
        state = .connecting

        let config = URLSessionConfiguration.default
        config.httpAdditionalHeaders = [
            "Origin": "https://fenix-smarttv.dev.app.flow.com.ar",
            "User-Agent": "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36"
        ]
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)

        guard let url = URL(string: Self.easyLoginURL) else {
            state = .failed("URL inválida")
            return
        }

        let task = urlSession!.webSocketTask(with: url)
        self.webSocket = task
        task.resume()

        // Start receiving messages
        receiveMessage()

        // Start keep-alive pings
        startPingTimer()

        print("[EasyLogin] Connecting to \(Self.easyLoginURL)")
    }

    /// Stop the Easy Login flow and clean up.
    func disconnect() {
        pingTimer?.invalidate()
        pingTimer = nil
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        sessionID = nil
    }

    /// Reset to idle state.
    func reset() {
        disconnect()
        state = .idle
        accountId = nil
    }

    // MARK: - WebSocket Message Handling

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            Task { @MainActor in
                guard let self else { return }
                switch result {
                case .success(let message):
                    self.handleMessage(message)
                    // Continue receiving
                    self.receiveMessage()
                case .failure(let error):
                    print("[EasyLogin] WebSocket receive error: \(error)")
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
            // Server asks us to request a code — send OUTPUT to trigger code generation
            state = .waitingForCode
            sendOutputRequest()

        case "start":
            // Received session with companion code
            if let code = msgData?["code"] as? String {
                sessionID = msgData?["sessionID"] as? String
                state = .showingCode(code)
                print("[EasyLogin] Got code: \(code), sessionID: \(sessionID ?? "nil")")
            }

        case "flowaccesstoken":
            // User entered the code on their phone — we got the token!
            if let tokenData = msgData,
               let token = tokenData["flowaccesstoken"] as? String {
                // Extract accountId if present
                if let account = tokenData["accountId"] as? String {
                    accountId = account
                }
                state = .authenticated(token)
                print("[EasyLogin] Got flowaccesstoken! accountId: \(accountId ?? "unknown")")
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

    // MARK: - Keep-alive

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
}

// MARK: - URLSessionWebSocketDelegate

extension EasyLoginService: URLSessionWebSocketDelegate {
    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        print("[EasyLogin] WebSocket connected")
    }

    nonisolated func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        print("[EasyLogin] WebSocket closed: \(closeCode)")
    }
}
