import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @FocusState private var isFocused: Bool

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

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

            VStack(spacing: 60) {
                Spacer()

                // Logo
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
                        .font(.system(size: 64, weight: .bold))
                        .tracking(-2)
                        .foregroundColor(.white)
                }

                // Easy Login content based on state
                easyLoginContent

                // Demo mode
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
            .frame(height: 200)

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
            .frame(height: 200)

        case .failed:
            VStack(spacing: 24) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.system(size: 48))
                    .foregroundColor(Color.white.opacity(0.4))

                Text("No se pudo conectar")
                    .font(.title3)
                    .foregroundColor(Color.white.opacity(0.6))

                Button(action: {
                    authManager.resetEasyLogin()
                    authManager.startEasyLogin()
                }) {
                    Text("Reintentar")
                        .font(.title3.weight(.semibold))
                        .frame(width: 540, height: 66)
                        .background(Color.white)
                        .foregroundColor(.black)
                        .cornerRadius(16)
                }
                .focused($isFocused)
            }
        }
    }

    // MARK: - Code Display

    private func codeDisplayView(code: String) -> some View {
        VStack(spacing: 32) {
            Text("Ingresá este código en tu celular")
                .font(.title3)
                .foregroundColor(Color.white.opacity(0.7))

            // Large code display
            HStack(spacing: 16) {
                ForEach(Array(code), id: \.self) { char in
                    Text(String(char))
                        .font(.system(size: 72, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .frame(width: 90, height: 110)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(16)
                }
            }

            VStack(spacing: 12) {
                Text("Abrí **flow** en tu celular y")
                    .font(.body)
                    .foregroundColor(Color.white.opacity(0.5))
                Text("andá a **Ajustes > Vincular dispositivo**")
                    .font(.body)
                    .foregroundColor(Color.white.opacity(0.5))
            }
            .multilineTextAlignment(.center)

            // Retry button
            Button(action: {
                authManager.resetEasyLogin()
                authManager.startEasyLogin()
            }) {
                Text("Generar nuevo código")
                    .font(.callout.weight(.medium))
                    .frame(width: 540, height: 56)
                    .background(Color.white.opacity(0.08))
                    .foregroundColor(Color.white.opacity(0.7))
                    .cornerRadius(16)
            }
            .buttonStyle(.plain)
        }
    }
}
