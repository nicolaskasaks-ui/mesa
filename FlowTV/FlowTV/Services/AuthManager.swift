import Foundation
import SwiftUI

enum OTPStep {
    case enterEmail
    case enterCode
    case verifying
}

@MainActor
class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: FlowUser?
    @Published var isLoading = false
    @Published var errorMessage: String?

    // OTP login state
    @Published var otpStep: OTPStep = .enterEmail
    @Published var otpCredentials: String?

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

    // MARK: - OTP Login Flow (New auth-daima endpoints)

    /// Step 1: Send OTP code to the user's email/phone.
    func sendCode(email: String) async {
        isLoading = true
        errorMessage = nil

        let api = apiService ?? FlowAPIService()

        do {
            let credentials = try await api.sendOTPCode(accountId: email)
            self.otpCredentials = credentials
            self.otpStep = .enterCode
        } catch let error as FlowAPIError {
            switch error {
            case .unauthorized:
                errorMessage = "Cuenta no encontrada. Verificá tu email o número de línea."
            case .serverError(let code):
                errorMessage = "Error del servidor (\(code)). Intentá más tarde."
            default:
                errorMessage = "No se pudo enviar el código. Intentá de nuevo."
            }
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain {
                errorMessage = "Error de conexión. Verificá tu internet. (\(nsError.code))"
            } else {
                errorMessage = "Error inesperado: \(error.localizedDescription)"
            }
            print("[AuthManager] sendCode error: \(error)")
        }

        isLoading = false
    }

    /// Step 2: Validate the OTP code and complete login.
    func validateCode(email: String, code: String) async {
        guard let credentials = otpCredentials else {
            errorMessage = "Credenciales OTP no disponibles. Volvé a enviar el código."
            otpStep = .enterEmail
            return
        }

        isLoading = true
        errorMessage = nil
        otpStep = .verifying

        let api = apiService ?? FlowAPIService()

        do {
            // Step 2: Validate OTP and get session JWT
            let sessionToken = try await api.validateOTPCode(
                accountId: email,
                code: code,
                otpCredentials: credentials
            )

            // Step 3: Exchange session JWT for Flow access token
            var flowToken = sessionToken
            do {
                let accessToken = try await api.fetchFlowAccessToken(bearerToken: sessionToken)
                flowToken = accessToken
            } catch {
                // If the access token exchange fails, try using the session token directly
                print("[AuthManager] flowAccessToken exchange failed, using session token: \(error)")
            }

            // Store the JWT and mark authenticated
            api.setJWTToken(flowToken)
            apiService?.setJWTToken(flowToken)

            let user = FlowUser(
                id: email,
                email: email,
                displayName: email,
                avatarURL: nil,
                plan: FlowPlan(name: "Flow", tier: .estandar, hasHD: true, has4K: false, maxDevices: 3),
                maxStreams: 3,
                activeStreams: 0
            )

            let authToken = AuthToken(
                accessToken: flowToken,
                refreshToken: "",
                expiresAt: Date().addingTimeInterval(43200)
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

            // Register PRM token in background (needed for playback)
            Task {
                try? await streamingService?.registerPRM()
            }
        } catch let error as FlowAPIError {
            otpStep = .enterCode
            switch error {
            case .unauthorized:
                errorMessage = "Código incorrecto o expirado. Intentá de nuevo."
            case .serverError(let code):
                errorMessage = "Error del servidor (\(code)). Intentá más tarde."
            default:
                errorMessage = "No se pudo verificar el código. Intentá de nuevo."
            }
        } catch {
            otpStep = .enterCode
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain {
                errorMessage = "Error de conexión. Verificá tu internet. (\(nsError.code))"
            } else {
                errorMessage = "Error inesperado: \(error.localizedDescription)"
            }
            print("[AuthManager] validateCode error: \(error)")
        }

        isLoading = false
    }

    /// Reset OTP flow back to email entry.
    func resetOTPFlow() {
        otpStep = .enterEmail
        otpCredentials = nil
        errorMessage = nil
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
