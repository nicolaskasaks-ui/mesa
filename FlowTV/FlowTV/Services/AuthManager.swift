import Foundation
import SwiftUI
import Combine

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
    private let casIdKey = "com.flowtv.casid"
    private var authToken: AuthToken?

    // Shared service references
    var apiService: FlowAPIService?
    var streamingService: StreamingService?

    private var easyLoginObserver: AnyCancellable?

    init() {
        observeEasyLogin()
    }

    // MARK: - Easy Login (WebSocket companion code)

    /// Start the Easy Login flow — connects WebSocket and gets a code to display.
    func startEasyLogin() {
        errorMessage = nil
        easyLogin.start()
    }

    /// Observe EasyLoginService state changes and complete auth when token arrives.
    private func observeEasyLogin() {
        // We poll the state via Combine since EasyLoginService is @MainActor @Published
        easyLoginObserver = easyLogin.$state.sink { [weak self] newState in
            guard let self else { return }
            Task { @MainActor in
                switch newState {
                case .authenticated(let token):
                    await self.completeEasyLogin(token: token)
                case .failed(let msg):
                    self.errorMessage = msg
                default:
                    break
                }
            }
        }
    }

    /// Called when WebSocket receives the flowaccesstoken.
    private func completeEasyLogin(token: String) async {
        isLoading = true
        errorMessage = nil

        let api = apiService ?? FlowAPIService()
        api.setJWTToken(token)
        apiService?.setJWTToken(token)

        let accountId = easyLogin.accountId ?? "user"

        let user = FlowUser(
            id: accountId,
            email: accountId,
            displayName: accountId,
            avatarURL: nil,
            plan: FlowPlan(name: "Flow", tier: .estandar, hasHD: true, has4K: false, maxDevices: 3),
            maxStreams: 3,
            activeStreams: 0
        )

        let authToken = AuthToken(
            accessToken: token,
            refreshToken: "",
            expiresAt: Date().addingTimeInterval(43200) // 12 hours
        )

        self.currentUser = user
        self.authToken = authToken
        self.isAuthenticated = true

        saveToken(authToken)
        saveUser(user)

        // Pass VUID to streaming service for DRM
        if let vuid = api.vuid {
            streamingService?.setVUID(vuid)
        }

        // Register PRM token in background
        Task {
            try? await streamingService?.registerPRM()
        }

        isLoading = false
    }

    /// Reset Easy Login flow.
    func resetEasyLogin() {
        easyLogin.reset()
        errorMessage = nil
    }

    // MARK: - Login (Real Flow authentication — legacy email/password)

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

            Task {
                try? await streamingService?.registerPRM()
            }

            let deviceOk = await api.verifyDevice()
            if !deviceOk { /* Flow allows new devices after login */ }

            isLoading = false
            return true
        } catch let error as FlowAPIError {
            switch error {
            case .unauthorized:
                errorMessage = "Usuario o contraseña incorrectos."
            case .forbidden:
                errorMessage = "Tu cuenta no tiene acceso a Flow."
            case .decodingError:
                errorMessage = "Login exitoso pero hubo un error procesando la respuesta."
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
                errorMessage = "Error de conexión. Verificá tu internet. (\(nsError.code))"
            } else {
                errorMessage = "Error inesperado: \(error.localizedDescription)"
            }
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
