import Foundation
import SwiftUI

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: FlowUser?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let tokenKey = "com.flowtv.authtoken"
    private let userKey = "com.flowtv.user"
    private let casIdKey = "com.flowtv.casid"
    private var authToken: AuthToken?

    // Shared service references
    var apiService: FlowAPIService?
    var streamingService: StreamingService?

    // MARK: - Login (Real Flow authentication)

    func login(email: String, password: String) async -> Bool {
        isLoading = true
        errorMessage = nil

        let api = apiService ?? FlowAPIService()

        do {
            let (user, token) = try await api.login(email: email, password: password)
            self.currentUser = user
            self.authToken = token
            self.isAuthenticated = true

            // Persist session
            saveToken(token)
            saveUser(user)

            // Ensure the shared API service has the JWT token
            // (important when api == apiService, the token is already set;
            //  but if apiService is a different instance, sync it)
            apiService?.setJWTToken(token.accessToken)

            // Pass VUID to streaming service for DRM
            if let vuid = api.vuid {
                streamingService?.setVUID(vuid)
            }

            // Register PRM token in background (needed for playback)
            Task {
                try? await streamingService?.registerPRM()
            }

            // Verify device registration
            let deviceOk = await api.verifyDevice()
            if !deviceOk {
                // Device not registered but we can still proceed
                // Flow allows new devices after login
            }

            isLoading = false
            return true
        } catch let error as FlowAPIError {
            switch error {
            case .unauthorized:
                errorMessage = "Usuario o contraseña incorrectos."
            case .forbidden:
                errorMessage = "Tu cuenta no tiene acceso a Flow. Verificá tu plan con Personal."
            case .decodingError:
                errorMessage = "Login exitoso pero hubo un error procesando la respuesta. Intentá de nuevo."
            case .serverError(let code):
                errorMessage = "Error del servidor de Flow (HTTP \(code)). Intentá más tarde."
            default:
                errorMessage = "No se pudo conectar con Flow. Intentá de nuevo."
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
            print("[AuthManager] Login error: \(error)")
            isLoading = false
            return false
        }
    }

    // MARK: - Demo Mode (skip login, use mock data)

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
        apiService?.setJWTToken("")
        streamingService?.clear()
        clearStoredData()
    }

    // MARK: - Session Restore

    func restoreSession() async {
        guard let token = loadToken() else { return }

        if token.isExpired {
            // Try to refresh the JWT (Flow tokens last 12h)
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
            // Token refresh failed, need to re-login
            clearStoredData()
        }
    }

    // MARK: - Persistence (UserDefaults for tvOS)

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
