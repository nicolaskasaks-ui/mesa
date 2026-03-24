import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @FocusState private var focusedField: LoginField?

    enum LoginField: Hashable {
        case email, password, loginButton
    }

    var body: some View {
        ZStack {
            // Full-screen dark background like Apple TV+
            Color.black.ignoresSafeArea()

            // Subtle animated gradient accent
            RadialGradient(
                colors: [
                    Color.purple.opacity(0.15),
                    Color.clear
                ],
                center: .topTrailing,
                startRadius: 100,
                endRadius: 800
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [
                    Color.cyan.opacity(0.1),
                    Color.clear
                ],
                center: .bottomLeading,
                startRadius: 100,
                endRadius: 600
            )
            .ignoresSafeArea()

            VStack(spacing: 80) {
                Spacer()

                // Logo — clean, Apple-style
                VStack(spacing: 24) {
                    ZStack {
                        RoundedRectangle(cornerRadius: 24)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.0, green: 0.7, blue: 0.9),
                                        Color(red: 0.5, green: 0.0, blue: 0.8)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 120, height: 120)

                        Image(systemName: "play.tv.fill")
                            .font(.system(size: 56, weight: .medium))
                            .foregroundColor(.white)
                    }

                    Text("flow")
                        .font(.system(size: 64, weight: .bold, design: .default))
                        .tracking(-2)
                        .foregroundColor(.white)

                    Text("Iniciá sesión con tu cuenta de Personal o Flow")
                        .font(.callout)
                        .foregroundColor(Color.white.opacity(0.5))
                }

                // Login form — tvOS style with large touch targets
                VStack(spacing: 24) {
                    TextField("Email o número de línea", text: $email)
                        .focused($focusedField, equals: .email)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        .padding(20)
                        .background(Color.white.opacity(0.08))
                        .cornerRadius(16)

                    HStack(spacing: 12) {
                        if showPassword {
                            TextField("Contraseña", text: $password)
                                .focused($focusedField, equals: .password)
                                .autocorrectionDisabled()
                                .padding(20)
                                .background(Color.white.opacity(0.08))
                                .cornerRadius(16)
                        } else {
                            SecureField("Contraseña", text: $password)
                                .focused($focusedField, equals: .password)
                                .padding(20)
                                .background(Color.white.opacity(0.08))
                                .cornerRadius(16)
                        }

                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .font(.title3)
                                .foregroundColor(Color.white.opacity(0.5))
                                .frame(width: 66, height: 66)
                                .background(Color.white.opacity(0.08))
                                .cornerRadius(16)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .frame(width: 620)

                // Login button
                Button(action: {
                    Task { await authManager.login(email: email, password: password) }
                }) {
                    Group {
                        if authManager.isLoading {
                            ProgressView()
                                .tint(.black)
                        } else {
                            Text("Iniciar Sesión")
                                .font(.title3.weight(.semibold))
                        }
                    }
                    .frame(width: 540, height: 66)
                    .background(Color.white)
                    .foregroundColor(.black)
                    .cornerRadius(16)
                }
                .disabled(authManager.isLoading || email.isEmpty || password.isEmpty)
                .focused($focusedField, equals: .loginButton)

                if let error = authManager.errorMessage {
                    Text(error)
                        .font(.callout)
                        .foregroundColor(Color.red.opacity(0.9))
                        .multilineTextAlignment(.center)
                }

                Spacer()

                Text("flow es un servicio de Telecom Argentina S.A.")
                    .font(.caption2)
                    .foregroundColor(Color.white.opacity(0.25))
                    .padding(.bottom, 40)
            }
        }
        .onAppear {
            // In DEBUG, load credentials from Xcode scheme environment variables
            // Set FLOW_EMAIL and FLOW_PASSWORD in: Product > Scheme > Edit Scheme > Run > Arguments > Environment Variables
            #if DEBUG
            if email.isEmpty, let envEmail = ProcessInfo.processInfo.environment["FLOW_EMAIL"] {
                email = envEmail
            }
            if password.isEmpty, let envPass = ProcessInfo.processInfo.environment["FLOW_PASSWORD"] {
                password = envPass
            }
            #endif
            focusedField = .email
        }
    }
}
