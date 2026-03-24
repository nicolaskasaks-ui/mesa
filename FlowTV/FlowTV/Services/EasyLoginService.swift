import Foundation

/// Easy Login service for Flow SmartTV.
/// Flow: 1) GET /easylogin/v1/code → get code+sessionID
///       2) Connect WebSocket, send method:"start" with code+sessionID
///       3) Wait for flowaccesstoken when user enters code on phone
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

    var onAuthenticated: ((String, String?) -> Void)?

    private var webSocket: URLSessionWebSocketTask?
    private var wsSession: URLSession?
    private var companionCode: String?
    private var companionSessionID: String?
    private var pingTimer: Timer?

    private static let codeURL = "https://easylogin.app.flow.com.ar/easylogin/v1/code"
    private static let wsURL = "wss://easylogin.app.flow.com.ar"
    private static let origin = "https://fenix-smarttv.dev.app.flow.com.ar"
    private static let ua = "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36"

    // MARK: - Public

    func start() {
        disconnect()
        DispatchQueue.main.async { self.state = .connecting }
        print("[EasyLogin] Starting...")

        // Step 1: Fetch companion code via HTTP
        fetchCode()
    }

    func disconnect() {
        DispatchQueue.main.async {
            self.pingTimer?.invalidate()
            self.pingTimer = nil
        }
        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        wsSession?.invalidateAndCancel()
        wsSession = nil
    }

    func reset() {
        disconnect()
        companionCode = nil
        companionSessionID = nil
        DispatchQueue.main.async {
            self.state = .idle
            self.accountId = nil
        }
    }

    // MARK: - Step 1: Fetch code via HTTP GET

    private func fetchCode() {
        guard let url = URL(string: Self.codeURL) else {
            DispatchQueue.main.async { self.state = .failed("URL inválida") }
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue(Self.origin, forHTTPHeaderField: "Origin")
        request.setValue(Self.origin + "/", forHTTPHeaderField: "Referer")
        request.setValue(Self.ua, forHTTPHeaderField: "User-Agent")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        print("[EasyLogin] GET \(Self.codeURL)")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }

            if let error = error {
                print("[EasyLogin] HTTP error: \(error)")
                DispatchQueue.main.async { self.state = .failed("Error de conexión") }
                return
            }

            let http = response as? HTTPURLResponse
            print("[EasyLogin] HTTP \(http?.statusCode ?? 0)")

            guard let data = data else {
                DispatchQueue.main.async { self.state = .failed("Sin respuesta") }
                return
            }

            let body = String(data: data, encoding: .utf8) ?? ""
            print("[EasyLogin] Response: \(body.prefix(500))")

            // Try to parse code and sessionID from response
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let code = json["code"] as? String
                let session = json["sessionID"] as? String ?? json["sessionId"] as? String ?? json["session"] as? String
                print("[EasyLogin] Parsed code: \(code ?? "nil"), session: \(session ?? "nil")")

                if let code = code {
                    self.companionCode = code
                    self.companionSessionID = session
                    // Step 2: Connect WebSocket
                    self.connectWebSocket()
                    return
                }
            }

            // If response is just a plain string code
            let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines.union(.init(charactersIn: "\"")))
            if trimmed.count >= 4 && trimmed.count <= 8 && trimmed.allSatisfy({ $0.isLetter || $0.isNumber }) {
                self.companionCode = trimmed
                self.connectWebSocket()
                return
            }

            DispatchQueue.main.async { self.state = .failed("No se pudo obtener el código") }
        }.resume()
    }

    // MARK: - Step 2: Connect WebSocket

    private func connectWebSocket() {
        let config = URLSessionConfiguration.default
        config.httpAdditionalHeaders = [
            "Origin": Self.origin,
            "User-Agent": Self.ua
        ]
        wsSession = URLSession(configuration: config, delegate: self, delegateQueue: nil)

        guard let url = URL(string: Self.wsURL) else { return }

        let task = wsSession!.webSocketTask(with: url)
        self.webSocket = task
        task.resume()
        receiveMessage()

        DispatchQueue.main.async { self.startPingTimer() }

        // Timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) { [weak self] in
            guard let self = self else { return }
            if case .showingCode = self.state { return }
            if case .authenticated = self.state { return }
            if case .idle = self.state { return }
            self.state = .failed("Timeout. Intentá de nuevo.")
        }

        print("[EasyLogin] WebSocket connecting to \(Self.wsURL)")
    }

    // MARK: - WebSocket Messages

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.receiveMessage()
            case .failure(let error):
                print("[EasyLogin] WS receive error: \(error)")
                DispatchQueue.main.async {
                    if case .authenticated = self.state { return }
                    self.state = .failed("Conexión perdida")
                }
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        let text: String
        switch message {
        case .string(let t): text = t
        case .data(let d): text = String(data: d, encoding: .utf8) ?? ""
        @unknown default: return
        }

        print("[EasyLogin] WS message: \(text.prefix(200))")

        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

        let method = json["method"] as? String ?? ""
        let msgData = json["data"]

        switch method {
        case "code":
            // Server ready — send our pre-registered code
            print("[EasyLogin] Server ready, sending start with code: \(companionCode ?? "?")")
            guard let code = companionCode else { return }
            var startData: [String: Any] = [
                "code": code,
                "SDK": true,
                "sfat": false
            ]
            if let session = companionSessionID {
                startData["sessionID"] = session
            }
            sendJSON(["method": "start", "data": startData])
            DispatchQueue.main.async {
                self.state = .showingCode(code)
            }

        case "start":
            // Server confirmed — show code
            if let dataDict = msgData as? [String: Any], let code = dataDict["code"] as? String {
                print("[EasyLogin] Server confirmed code: \(code)")
                DispatchQueue.main.async { self.state = .showingCode(code) }
            }

        case "flowaccesstoken":
            if let dataDict = msgData as? [String: Any],
               let token = dataDict["flowaccesstoken"] as? String {
                let account = dataDict["accountId"] as? String
                print("[EasyLogin] Authenticated! account: \(account ?? "?")")
                DispatchQueue.main.async {
                    self.accountId = account
                    self.state = .authenticated(token)
                    self.onAuthenticated?(token, account)
                }
                disconnect()
            }

        case "error":
            let errData = msgData as? [String: Any]
            let msg = errData?["message"] as? String ?? "Error"
            print("[EasyLogin] Server error: \(msg)")
            DispatchQueue.main.async { self.state = .failed(msg) }

        default:
            print("[EasyLogin] Unhandled: \(method) - \(json)")
        }
    }

    private func sendJSON(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let text = String(data: data, encoding: .utf8) else { return }
        print("[EasyLogin] Sending: \(text)")
        webSocket?.send(.string(text)) { error in
            if let error { print("[EasyLogin] Send error: \(error)") }
        }
    }

    // MARK: - Keep-alive

    private func startPingTimer() {
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            self?.webSocket?.sendPing { _ in }
        }
    }

    // MARK: - URLSessionWebSocketDelegate

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol proto: String?) {
        print("[EasyLogin] WebSocket connected")
    }

    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith code: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        print("[EasyLogin] WebSocket closed: \(code)")
    }
}
