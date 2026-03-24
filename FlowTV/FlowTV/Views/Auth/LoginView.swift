import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var email = ""
    @State private var otpCode = ""
    @FocusState private var focusedField: LoginField?

    enum LoginField: Hashable {
        case email, otpCode, sendButton, verifyButton, backButton
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

                    Text(subtitleText)
                        .font(.callout)
                        .foregroundColor(Color.white.opacity(0.5))
                        .multilineTextAlignment(.center)
                }

                // OTP form — tvOS style with large touch targets
                VStack(spacing: 24) {
                    switch authManager.otpStep {
                    case .enterEmail:
                        emailStepView

                    case .enterCode, .verifying:
                        codeStepView
                    }
                }
                .frame(width: 620)

                // Demo mode — skip login entirely
                Button(action: {
                    authManager.loginAsDemo()
                }) {
                    Text("Entrar sin cuenta (Demo)")
                        .font(.callout.weight(.medium))
                        .frame(width: 540, height: 56)
                        .background(Color.white.opacity(0.08))
                        .foregroundColor(Color.white.opacity(0.7))
                        .cornerRadius(16)
                }
                .buttonStyle(.plain)

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
            #if DEBUG
            if email.isEmpty, let envEmail = ProcessInfo.processInfo.environment["FLOW_EMAIL"] {
                email = envEmail
            }
            #endif
            focusedField = .email
        }
    }

    // MARK: - Subtitle text based on current step

    private var subtitleText: String {
        switch authManager.otpStep {
        case .enterEmail:
            return "Ingresá tu email o número de línea de Personal/Flow"
        case .enterCode:
            return "Te enviamos un código a \(email)"
        case .verifying:
            return "Verificando..."
        }
    }

    // MARK: - Step 1: Email entry

    private var emailStepView: some View {
        VStack(spacing: 24) {
            TextField("Email o número de línea", text: $email)
                .focused($focusedField, equals: .email)
                .textContentType(.emailAddress)
                .autocorrectionDisabled()
                .padding(20)
                .background(Color.white.opacity(0.08))
                .cornerRadius(16)

            Button(action: {
                Task { await authManager.sendCode(email: email) }
            }) {
                Group {
                    if authManager.isLoading {
                        ProgressView()
                            .tint(.black)
                    } else {
                        Text("Enviar código")
                            .font(.title3.weight(.semibold))
                    }
                }
                .frame(width: 540, height: 66)
                .background(Color.white)
                .foregroundColor(.black)
                .cornerRadius(16)
            }
            .disabled(authManager.isLoading || email.isEmpty)
            .focused($focusedField, equals: .sendButton)
        }
    }

    // MARK: - Step 2: OTP code entry

    private var codeStepView: some View {
        VStack(spacing: 24) {
            TextField("Código de verificación", text: $otpCode)
                .focused($focusedField, equals: .otpCode)
                .textContentType(.oneTimeCode)
                .autocorrectionDisabled()
                .padding(20)
                .background(Color.white.opacity(0.08))
                .cornerRadius(16)
                .onAppear {
                    focusedField = .otpCode
                }

            Button(action: {
                Task { await authManager.validateCode(email: email, code: otpCode) }
            }) {
                Group {
                    if authManager.isLoading {
                        ProgressView()
                            .tint(.black)
                    } else {
                        Text("Verificar")
                            .font(.title3.weight(.semibold))
                    }
                }
                .frame(width: 540, height: 66)
                .background(Color.white)
                .foregroundColor(.black)
                .cornerRadius(16)
            }
            .disabled(authManager.isLoading || otpCode.isEmpty)
            .focused($focusedField, equals: .verifyButton)

            Button(action: {
                otpCode = ""
                authManager.resetOTPFlow()
                focusedField = .email
            }) {
                Text("Volver")
                    .font(.callout.weight(.medium))
                    .frame(width: 540, height: 56)
                    .background(Color.white.opacity(0.08))
                    .foregroundColor(Color.white.opacity(0.7))
                    .cornerRadius(16)
            }
            .buttonStyle(.plain)
            .disabled(authManager.isLoading)
            .focused($focusedField, equals: .backButton)
        }
    }
}
