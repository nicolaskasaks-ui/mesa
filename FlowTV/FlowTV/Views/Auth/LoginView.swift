import SwiftUI
import CoreImage.CIFilterBuiltins

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    @FocusState private var focusedButton: LoginButton?

    enum LoginButton: Hashable {
        case retry, demo
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // Background content preview (like the real Flow SmartTV login)
            HStack {
                Spacer()
                ZStack {
                    LinearGradient(
                        colors: [.black, Color.black.opacity(0.3), Color.black.opacity(0.1)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: 900)

                    // Placeholder grid of colored rectangles mimicking content posters
                    VStack(spacing: 12) {
                        ForEach(0..<3, id: \.self) { row in
                            HStack(spacing: 12) {
                                ForEach(0..<4, id: \.self) { col in
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(
                                            LinearGradient(
                                                colors: posterColors(row: row, col: col),
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                        .frame(width: 200, height: 120)
                                        .opacity(0.3)
                                }
                            }
                        }
                    }
                    .offset(x: 100)

                    // Fade overlay
                    LinearGradient(
                        colors: [.black, .clear],
                        startPoint: .leading,
                        endPoint: .center
                    )
                }
                .frame(width: 900)
            }
            .ignoresSafeArea()

            // Main content
            HStack(alignment: .top, spacing: 0) {
                // Left side: login UI
                VStack(alignment: .leading, spacing: 40) {
                    Spacer()

                    // "Ingresá a flow" header
                    HStack(spacing: 16) {
                        Text("Ingresá a")
                            .font(.system(size: 42, weight: .light))
                            .foregroundColor(.white)

                        // Flow logo
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
                }
                .frame(maxWidth: 700)
                .padding(.leading, 100)

                Spacer()
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
            VStack(alignment: .leading, spacing: 20) {
                ProgressView()
                    .scaleEffect(1.5)
                    .tint(.white)
                Text("Conectando...")
                    .font(.title3)
                    .foregroundColor(Color.white.opacity(0.6))
            }
            .frame(height: 400)

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
            .frame(height: 400)

        case .failed:
            VStack(alignment: .leading, spacing: 24) {
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
                        .frame(width: 400, height: 66)
                        .background(Color.white.opacity(0.12))
                        .foregroundColor(.white)
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.3), lineWidth: 1)
                        )
                }
                .focused($focusedButton, equals: .retry)

                demoButton
            }
        }
    }

    // MARK: - Code Display (matches real Flow SmartTV)

    private func codeDisplayView(code: String) -> some View {
        VStack(alignment: .leading, spacing: 40) {
            // QR Code
            if let qrImage = generateQRCode(
                from: "https://web.app.flow.com.ar/easyLogin?code=\(code)"
            ) {
                Image(uiImage: qrImage)
                    .interpolation(.none)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 280, height: 280)
                    .padding(16)
                    .background(Color.white)
                    .cornerRadius(12)
            }

            // Instructions + code
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top, spacing: 0) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Escaneá el QR o entrá a la app de Flow y en tu")
                            .font(.system(size: 22))
                            .foregroundColor(Color.white.opacity(0.7))
                        HStack(spacing: 16) {
                            Text("perfil ingresá en **Código de vinculación**:")
                                .font(.system(size: 22))
                                .foregroundColor(Color.white.opacity(0.7))

                            // Code box
                            Text(code)
                                .font(.system(size: 28, weight: .bold, design: .monospaced))
                                .foregroundColor(.black)
                                .padding(.horizontal, 24)
                                .padding(.vertical, 10)
                                .background(Color.white)
                                .cornerRadius(8)
                        }
                    }
                }

                // Divider
                Rectangle()
                    .fill(Color.white.opacity(0.15))
                    .frame(height: 1)
                    .padding(.vertical, 8)

                // Alternative: send code by email/SMS
                Text("¿No tenés la app de Flow en tu celular?")
                    .font(.system(size: 20))
                    .foregroundColor(Color.white.opacity(0.5))

                // Bottom buttons
                HStack(spacing: 24) {
                    Button(action: {
                        authManager.resetEasyLogin()
                        authManager.startEasyLogin()
                    }) {
                        Text("Generar nuevo código")
                            .font(.system(size: 20, weight: .medium))
                            .padding(.horizontal, 32)
                            .padding(.vertical, 14)
                            .background(Color.white.opacity(0.08))
                            .foregroundColor(Color.white.opacity(0.8))
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color.white.opacity(0.25), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .focused($focusedButton, equals: .retry)

                    demoButton
                }
            }
        }
    }

    // MARK: - Demo Button

    private var demoButton: some View {
        Button(action: {
            authManager.loginAsDemo()
        }) {
            Text("Entrar sin cuenta (Demo)")
                .font(.system(size: 20, weight: .medium))
                .padding(.horizontal, 32)
                .padding(.vertical, 14)
                .background(Color.white.opacity(0.08))
                .foregroundColor(Color.white.opacity(0.5))
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.white.opacity(0.15), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .focused($focusedButton, equals: .demo)
    }

    // MARK: - QR Code Generation

    private func generateQRCode(from string: String) -> UIImage? {
        let context = CIContext()
        let filter = CIFilter.qrCodeGenerator()
        filter.message = Data(string.utf8)
        filter.correctionLevel = "M"

        guard let outputImage = filter.outputImage else { return nil }

        let scale = 280.0 / outputImage.extent.width
        let scaledImage = outputImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))

        guard let cgImage = context.createCGImage(scaledImage, from: scaledImage.extent) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }

    // MARK: - Background Poster Colors

    private func posterColors(row: Int, col: Int) -> [Color] {
        let palettes: [[Color]] = [
            [.blue, .purple], [.orange, .red], [.teal, .blue],
            [.purple, .pink], [.green, .teal], [.red, .orange],
            [.indigo, .blue], [.yellow, .orange], [.mint, .green],
            [.pink, .purple], [.cyan, .blue], [.brown, .orange]
        ]
        let index = (row * 4 + col) % palettes.count
        return palettes[index]
    }
}
