import Foundation
import SwiftUI

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: FlowUser?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let keychainKey = "com.flowtv.authtoken"
    private let userDefaultsKey = "com.flowtv.user"
    private var authToken: AuthToken?

    // MARK: - Login

    func login(email: String, password: String) async -> Bool {
        isLoading = true
        errorMessage = nil

        let api = FlowAPIService()

        do {
            let (user, token) = try await api.login(email: email, password: password)
            self.currentUser = user
            self.authToken = token
            self.isAuthenticated = true

            saveToken(token)
            saveUser(user)

            isLoading = false
            return true
        } catch {
            errorMessage = "No se pudo iniciar sesión. Verificá tus datos."
            isLoading = false
            return false
        }
    }

    // MARK: - Logout

    func logout() {
        isAuthenticated = false
        currentUser = nil
        authToken = nil
        clearStoredData()
    }

    // MARK: - Session Restore

    func restoreSession() async {
        guard let token = loadToken(), !token.isExpired else {
            // Try to refresh if we have a token
            if let token = loadToken() {
                await refreshSession(token)
            }
            return
        }

        if let user = loadUser() {
            self.currentUser = user
            self.authToken = token
            self.isAuthenticated = true
        }
    }

    private func refreshSession(_ token: AuthToken) async {
        let api = FlowAPIService()
        do {
            let newToken = try await api.refreshToken(token)
            self.authToken = newToken
            saveToken(newToken)

            if let user = loadUser() {
                self.currentUser = user
                self.isAuthenticated = true
            }
        } catch {
            clearStoredData()
        }
    }

    // MARK: - Token Persistence (UserDefaults for tvOS)
    // Note: tvOS has limited Keychain support, using UserDefaults

    private func saveToken(_ token: AuthToken) {
        if let data = try? JSONEncoder().encode(token) {
            UserDefaults.standard.set(data, forKey: keychainKey)
        }
    }

    private func loadToken() -> AuthToken? {
        guard let data = UserDefaults.standard.data(forKey: keychainKey) else { return nil }
        return try? JSONDecoder().decode(AuthToken.self, from: data)
    }

    private func saveUser(_ user: FlowUser) {
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userDefaultsKey)
        }
    }

    private func loadUser() -> FlowUser? {
        guard let data = UserDefaults.standard.data(forKey: userDefaultsKey) else { return nil }
        return try? JSONDecoder().decode(FlowUser.self, from: data)
    }

    private func clearStoredData() {
        UserDefaults.standard.removeObject(forKey: keychainKey)
        UserDefaults.standard.removeObject(forKey: userDefaultsKey)
    }
}
