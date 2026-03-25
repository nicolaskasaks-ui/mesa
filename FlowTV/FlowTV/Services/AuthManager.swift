import Foundation
import SwiftUI
import os

private let authLog = Logger(subsystem: "com.flowtv.app", category: "AuthManager")

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: FlowUser?
    @Published var isLoading = false
    @Published var errorMessage: String?

    // Easy Login service (WebSocket companion code flow)
    let easyLogin = EasyLoginService()

    private let tokenKey = "com.flowtv.authtoken"
    private let userKey = "com.flowtv.user"
    private var authToken: AuthToken?

    // Shared service references
    var apiService: FlowAPIService?
    var streamingService: StreamingService?

    init() {
        easyLogin.onAuthenticated = { [weak self] token, accountId in
            guard let self = self else { return }
            Task { @MainActor in
                await self.completeEasyLogin(token: token, accountId: accountId)
            }
        }
    }

    // MARK: - Easy Login (WebSocket companion code)

    func startEasyLogin() {
        errorMessage = nil
        easyLogin.start()
    }

    private func completeEasyLogin(token: String, accountId: String?) async {
        isLoading = true
        errorMessage = nil

        authLog.info("[Auth] completeEasyLogin called. token length: \(token.count), account: \(accountId ?? "nil")")

        // Save token to temp file for API testing
        let tokenPath = NSTemporaryDirectory() + "flow_token.txt"
        try? token.write(toFile: tokenPath, atomically: true, encoding: .utf8)
        authLog.info("[Auth] Token saved to \(tokenPath)")

        let api = apiService ?? FlowAPIService()

        // The EasyLogin WebSocket returns an identity JWT from the auth-sdk.
        // We need to provision a device session to get a content API token.
        var contentToken = token

        // Step 1: Try to provision via gateway login/v2 (what the SmartTV Minerva SDK does)
        do {
            let sessionToken = try await api.provisionWithToken(token)
            authLog.info("[Auth] Provisioned device, got session token length: \(sessionToken.count)")
            contentToken = sessionToken
        } catch {
            authLog.info("[Auth] Provision failed: \(error). Trying token exchange...")
            // Step 2: Fallback — try exchanging via auth-sdk
            do {
                let flowToken = try await api.fetchFlowAccessToken(bearerToken: token)
                authLog.info("[Auth] Exchanged JWT for Flow access token, length: \(flowToken.count)")
                contentToken = flowToken
            } catch {
                authLog.info("[Auth] Token exchange also failed: \(error). Using original token.")
            }
        }

        api.setJWTToken(contentToken)
        apiService?.setJWTToken(contentToken)

        let id = accountId ?? "user"

        let user = FlowUser(
            id: id,
            email: id,
            displayName: id,
            avatarURL: nil,
            plan: FlowPlan(name: "Flow", tier: .estandar, hasHD: true, has4K: false, maxDevices: 3),
            maxStreams: 3,
            activeStreams: 0
        )

        let authToken = AuthToken(
            accessToken: contentToken,
            refreshToken: token, // keep original JWT as refresh
            expiresAt: Date().addingTimeInterval(43200)
        )

        self.currentUser = user
        self.authToken = authToken
        self.isAuthenticated = true

        saveToken(authToken)
        saveUser(user)

        if let vuid = api.vuid {
            streamingService?.setVUID(vuid)
        }

        // Pre-load channels right away
        authLog.info("[Auth] Authenticated. Loading content...")
        await api.fetchChannels()
        authLog.info("[Auth] Channels loaded: \(api.channels.count)")

        // Start the Minerva WebBridge to get real channel data from the CSDK
        // The bridge loads the SmartTV web app in a hidden WKWebView
        authLog.info("[Auth] Starting Minerva WebBridge for real API access...")
        MinervaWebBridge.shared.start(with: token)

        // Start the in-process CSDK Bridge (WKWebView-based)
        // Loads the SmartTV web app in a hidden WebView and intercepts
        // the Minerva CSDK JavaScript SDK to get real channel data.
        authLog.info("[Auth] Starting CSDKBridge (WKWebView)...")
        CSDKBridge.shared.start(with: token)

        Task {
            try? await streamingService?.registerPRM()
        }

        isLoading = false
    }

    func resetEasyLogin() {
        easyLogin.reset()
        errorMessage = nil
    }

    // MARK: - Login (legacy email/password)

    func login(email: String, password: String) async -> Bool {
        isLoading = true
        errorMessage = nil

        let api = apiService ?? FlowAPIService()

        do {
            let (user, token) = try await api.login(email: email, password: password)
            self.currentUser = user
            self.authToken = token
            self.isAuthenticated = true

            saveToken(token)
            saveUser(user)
            apiService?.setJWTToken(token.accessToken)

            if let vuid = api.vuid {
                streamingService?.setVUID(vuid)
            }

            Task { try? await streamingService?.registerPRM() }

            isLoading = false
            return true
        } catch let error as FlowAPIError {
            switch error {
            case .unauthorized:
                errorMessage = "Usuario o contraseña incorrectos."
            case .forbidden:
                errorMessage = "Tu cuenta no tiene acceso a Flow."
            case .serverError(let code):
                errorMessage = "Error del servidor de Flow (HTTP \(code))."
            default:
                errorMessage = "No se pudo conectar con Flow."
            }
            isLoading = false
            return false
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain {
                errorMessage = "Error de conexión (\(nsError.code))"
            } else {
                errorMessage = "Error: \(error.localizedDescription)"
            }
            isLoading = false
            return false
        }
    }

    // MARK: - OTP Login (code via email)

    private var otpCredentials: String?

    /// Step 1: Send OTP code to user's email
    func sendOTPCode(email: String) async -> Bool {
        isLoading = true
        errorMessage = nil
        authLog.info("[Auth] Sending OTP code to \(email)")

        do {
            var request = URLRequest(url: URL(string: "https://authdaima.app.flow.com.ar/auth-daima/v1/provision/sendCode")!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["accountId": email, "country": "AR"])

            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            authLog.info("[Auth] sendCode HTTP \(http?.statusCode ?? 0)")

            if http?.statusCode == 200,
               let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let creds = json["otpCredentials"] as? String {
                self.otpCredentials = creds
                authLog.info("[Auth] OTP sent! Credentials length: \(creds.count)")
                isLoading = false
                return true
            } else {
                errorMessage = "No se pudo enviar el código."
                isLoading = false
                return false
            }
        } catch {
            errorMessage = "Error: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    /// Step 2: Validate OTP code and authenticate
    func validateOTPCode(code: String) async -> Bool {
        guard let creds = otpCredentials else {
            errorMessage = "Primero enviá el código."
            return false
        }
        isLoading = true
        errorMessage = nil
        authLog.info("[Auth] Validating OTP code: \(code)")

        do {
            var request = URLRequest(url: URL(string: "https://authdaima.app.flow.com.ar/auth-daima/v1/provision/validateCode")!)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["otpCredentials": creds, "code": code])

            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            authLog.info("[Auth] validateCode HTTP \(http?.statusCode ?? 0)")

            if http?.statusCode == 200,
               let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let idToken = json["id_token"] as? String {
                let accessToken = json["access_token"] as? String ?? ""
                authLog.info("[Auth] OTP validated! id_token: \(idToken.count) chars, access_token: \(accessToken.count) chars")

                // Save both tokens
                let tokenPath = NSTemporaryDirectory() + "flow_token.txt"
                try? idToken.write(toFile: tokenPath, atomically: true, encoding: .utf8)

                // Use the id_token for the CSDK bridge
                await completeEasyLogin(token: idToken, accountId: "nico.kskff@gmail.com")
                return true
            } else if http?.statusCode == 450 {
                errorMessage = "Código incorrecto."
                isLoading = false
                return false
            } else {
                errorMessage = "Error validando código."
                isLoading = false
                return false
            }
        } catch {
            errorMessage = "Error: \(error.localizedDescription)"
            isLoading = false
            return false
        }
    }

    // MARK: - Demo Mode

    func loginAsDemo() {
        self.currentUser = MockData.user
        self.authToken = MockData.authToken
        self.isAuthenticated = true
    }

    // MARK: - Logout

    func logout() {
        isAuthenticated = false
        currentUser = nil
        authToken = nil
        easyLogin.reset()
        apiService?.setJWTToken("")
        streamingService?.clear()
        clearStoredData()
    }

    // MARK: - Session Restore

    func restoreSession() async {
        guard let token = loadToken() else { return }

        if token.isExpired {
            await refreshSession(token)
            return
        }

        if let user = loadUser() {
            self.currentUser = user
            self.authToken = token
            self.isAuthenticated = true
            apiService?.setJWTToken(token.accessToken)
        }
    }

    private func refreshSession(_ token: AuthToken) async {
        let api = apiService ?? FlowAPIService()
        do {
            let newToken = try await api.refreshToken(token)
            self.authToken = newToken
            saveToken(newToken)
            api.setJWTToken(newToken.accessToken)

            if let user = loadUser() {
                self.currentUser = user
                self.isAuthenticated = true
            }
        } catch {
            clearStoredData()
        }
    }

    // MARK: - Persistence

    private func saveToken(_ token: AuthToken) {
        if let data = try? JSONEncoder().encode(token) {
            UserDefaults.standard.set(data, forKey: tokenKey)
        }
    }

    private func loadToken() -> AuthToken? {
        guard let data = UserDefaults.standard.data(forKey: tokenKey) else { return nil }
        return try? JSONDecoder().decode(AuthToken.self, from: data)
    }

    private func saveUser(_ user: FlowUser) {
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userKey)
        }
    }

    private func loadUser() -> FlowUser? {
        guard let data = UserDefaults.standard.data(forKey: userKey) else { return nil }
        return try? JSONDecoder().decode(FlowUser.self, from: data)
    }

    private func clearStoredData() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: userKey)
    }
}
