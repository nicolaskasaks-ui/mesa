import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var showError = false
    @FocusState private var focusedField: LoginField?

    enum LoginField {
        case email, password, loginButton
    }

    var body: some View {
        ZStack {
            // Background gradient - Flow brand colors
            LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.0, blue: 0.2),
                    Color(red: 0.15, green: 0.0, blue: 0.35),
                    Color(red: 0.1, green: 0.0, blue: 0.25)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 60) {
                // Logo area
                VStack(spacing: 20) {
                    Image(systemName: "play.tv.fill")
                        .font(.system(size: 80))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.cyan, .purple],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )

                    Text("Flow")
                        .font(.system(size: 72, weight: .bold))
                        .foregroundColor(.white)

                    Text("Personal · Telecom Argentina")
                        .font(.title3)
                        .foregroundColor(.gray)
                }

                // Login form
                VStack(spacing: 30) {
                    VStack(spacing: 20) {
                        TextField("Email o número de línea Personal", text: $email)
                            .textFieldStyle(.plain)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .focused($focusedField, equals: .email)
                            .textContentType(.emailAddress)
                            .autocorrectionDisabled()

                        SecureField("Contraseña", text: $password)
                            .textFieldStyle(.plain)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .focused($focusedField, equals: .password)
                    }
                    .frame(maxWidth: 600)

                    Button(action: {
                        Task { await login() }
                    }) {
                        HStack {
                            if authManager.isLoading {
                                ProgressView()
                                    .tint(.white)
                            }
                            Text(authManager.isLoading ? "Iniciando sesión..." : "Iniciar Sesión")
                                .font(.title3.weight(.semibold))
                        }
                        .frame(maxWidth: 400)
                        .padding(.vertical, 16)
                        .background(
                            LinearGradient(
                                colors: [.cyan, .purple],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .focused($focusedField, equals: .loginButton)
                    .disabled(authManager.isLoading || email.isEmpty || password.isEmpty)

                    if let error = authManager.errorMessage {
                        Text(error)
                            .foregroundColor(.red)
                            .font(.callout)
                    }

                    VStack(spacing: 10) {
                        Text("Ingresá con tu cuenta de Flow o Mi Personal")
                            .font(.caption)
                            .foregroundColor(.gray)

                        Text("¿No tenés cuenta? Contratá Flow en personal.com.ar")
                            .font(.caption)
                            .foregroundColor(.gray.opacity(0.7))
                    }
                }
            }
            .padding(80)
        }
        .onAppear {
            focusedField = .email
        }
    }

    private func login() async {
        _ = await authManager.login(email: email, password: password)
    }
}
