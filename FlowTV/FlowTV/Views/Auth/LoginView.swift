import SwiftUI
import CoreImage.CIFilterBuiltins

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

    // MARK: - Code Display with QR

    private func codeDisplayView(code: String) -> some View {
        HStack(spacing: 80) {
            // Left side: QR code
            VStack(spacing: 20) {
                Text("Escaneá el QR")
                    .font(.title3.weight(.semibold))
                    .foregroundColor(.white)

                if let qrImage = generateQRCode(
                    from: "https://web.app.flow.com.ar/easyLogin?code=\(code)"
                ) {
                    Image(uiImage: qrImage)
                        .interpolation(.none)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 240, height: 240)
                        .background(Color.white)
                        .cornerRadius(16)
                }

                Text("con la cámara de tu celular")
                    .font(.callout)
                    .foregroundColor(Color.white.opacity(0.5))
            }

            // Divider
            VStack(spacing: 16) {
                Rectangle()
                    .fill(Color.white.opacity(0.15))
                    .frame(width: 1, height: 80)
                Text("o")
                    .font(.title3)
                    .foregroundColor(Color.white.opacity(0.4))
                Rectangle()
                    .fill(Color.white.opacity(0.15))
                    .frame(width: 1, height: 80)
            }

            // Right side: code + instructions
            VStack(spacing: 24) {
                Text("Ingresá este código")
                    .font(.title3.weight(.semibold))
                    .foregroundColor(.white)

                // Large code display
                HStack(spacing: 12) {
                    ForEach(Array(code.enumerated()), id: \.offset) { _, char in
                        Text(String(char))
                            .font(.system(size: 64, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                            .frame(width: 80, height: 100)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(14)
                    }
                }

                VStack(spacing: 8) {
                    Text("en **flow.com.ar/vincular**")
                        .font(.body)
                        .foregroundColor(Color.white.opacity(0.5))
                    Text("o en la app Flow > Vincular dispositivo")
                        .font(.callout)
                        .foregroundColor(Color.white.opacity(0.35))
                }
                .multilineTextAlignment(.center)
            }
        }
        .padding(.bottom, 16)

        // Retry button below
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

    // MARK: - QR Code Generation

    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"

        guard let outputImage = filter.outputImage else { return nil }

        // Scale up for crisp rendering
        let scale = 240.0 / outputImage.extent.width
        let scaledImage = outputImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }
}
