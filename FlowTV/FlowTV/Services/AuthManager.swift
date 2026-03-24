import Foundation
import SwiftUI

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

        let api = apiService ?? FlowAPIService()
        api.setJWTToken(token)
        apiService?.setJWTToken(token)

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
            accessToken: token,
            refreshToken: "",
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
