import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @FocusState private var focusedButton: LoginButton?

    enum LoginButton: Hashable {
        case retry, demo
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Subtle background gradients
            RadialGradient(
                colors: [Color.purple.opacity(0.15), Color.clear],
                center: .topTrailing,
                startRadius: 100,
                endRadius: 800
            )
            .ignoresSafeArea()

            RadialGradient(
                colors: [Color.cyan.opacity(0.1), Color.clear],
                center: .bottomLeading,
                startRadius: 100,
                endRadius: 600
            )
            .ignoresSafeArea()

            // Main content
            HStack(alignment: .center, spacing: 0) {
                // Left side: login UI
                VStack(spacing: 40) {
                    Spacer()

                    // "Ingresá a flow" header
                    HStack(spacing: 16) {
                        Text("Ingresá a")
                            .font(.system(size: 42, weight: .light))
                            .foregroundColor(.white)

                        HStack(spacing: 8) {
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 36))
                                .foregroundColor(Color(red: 0.0, green: 0.8, blue: 0.7))
                            Text("flow")
                                .font(.system(size: 42, weight: .bold))
                                .foregroundColor(.white)
                        }
                    }

                    // Easy Login content
                    easyLoginContent

                    Spacer()

                    Text("flow es un servicio de Telecom Argentina S.A.")
                        .font(.caption2)
                        .foregroundColor(Color.white.opacity(0.25))
                        .padding(.bottom, 40)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .onAppear {
            authManager.startEasyLogin()
        }
        .onDisappear {
            authManager.easyLogin.disconnect()
        }
    }

    // MARK: - Easy Login States

    @ViewBuilder
    private var easyLoginContent: some View {
        switch authManager.easyLogin.state {
        case .idle, .connecting, .waitingForCode:
            VStack(spacing: 20) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.white)
                Text("Conectando...")
                    .font(.title3)
                    .foregroundColor(Color.white.opacity(0.6))
            }
            .frame(height: 300)

        case .showingCode(let code):
            codeDisplayView(code: code)

        case .authenticated:
            VStack(spacing: 20) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.green)
                Text("Conectado")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(.white)
            }
            .frame(height: 300)

        case .failed:
            VStack(spacing: 24) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 48))
                    .foregroundColor(Color.white.opacity(0.4))

                Text("No se pudo conectar")
                    .font(.title3)
                    .foregroundColor(Color.white.opacity(0.6))

                if let error = authManager.errorMessage {
                    Text(error)
                        .font(.callout)
                        .foregroundColor(Color.red.opacity(0.9))
                }

                Button(action: {
                    authManager.resetEasyLogin()
                    authManager.startEasyLogin()
                }) {
                    Text("Reintentar")
                        .font(.title3.weight(.semibold))
                        .frame(width: 500, height: 66)
                        .background(Color.white)
                        .foregroundColor(.black)
                        .cornerRadius(16)
                }
                .focused($focusedButton, equals: .retry)

                demoButton
            }
        }
    }

    // MARK: - Code Display

    private func codeDisplayView(code: String) -> some View {
        VStack(spacing: 36) {
            // Large code display
            HStack(spacing: 16) {
                ForEach(Array(code.enumerated()), id: \.offset) { _, char in
                    Text(String(char))
                        .font(.system(size: 80, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .frame(width: 100, height: 120)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(16)
                }
            }

            // Instructions
            VStack(spacing: 8) {
                Text("Escaneá el QR o entrá a la app de Flow")
                    .font(.system(size: 24))
                    .foregroundColor(Color.white.opacity(0.7))
                Text("y en tu perfil ingresá el **Código de vinculación**")
                    .font(.system(size: 24))
                    .foregroundColor(Color.white.opacity(0.7))
            }
            .multilineTextAlignment(.center)

            // Divider
            Rectangle()
                .fill(Color.white.opacity(0.15))
                .frame(width: 500, height: 1)

            // Bottom buttons
            HStack(spacing: 24) {
                Button(action: {
                    authManager.resetEasyLogin()
                    authManager.startEasyLogin()
                }) {
                    Text("Generar nuevo código")
                        .font(.callout.weight(.medium))
                        .padding(.horizontal, 32)
                        .padding(.vertical, 14)
                        .background(Color.white.opacity(0.08))
                        .foregroundColor(Color.white.opacity(0.7))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .focused($focusedButton, equals: .retry)

                demoButton
            }
        }
    }

    // MARK: - Demo Button

    private var demoButton: some View {
        Button(action: {
            authManager.loginAsDemo()
        }) {
            Text("Entrar sin cuenta (Demo)")
                .font(.callout.weight(.medium))
                .padding(.horizontal, 32)
                .padding(.vertical, 14)
                .background(Color.white.opacity(0.08))
                .foregroundColor(Color.white.opacity(0.5))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .focused($focusedButton, equals: .demo)
    }
}
