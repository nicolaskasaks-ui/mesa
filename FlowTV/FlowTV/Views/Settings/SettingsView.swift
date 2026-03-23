import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var showLogoutConfirm = false
    @State private var parentalControlEnabled = false
    @State private var autoPlay = true
    @State private var videoQuality: VideoQuality = .auto
    @State private var subtitlesEnabled = false

    var body: some View {
        NavigationStack {
            List {
                // Profile section
                Section {
                    if let user = authManager.currentUser {
                        HStack(spacing: 20) {
                            // Avatar
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [.cyan, .purple],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 80, height: 80)
                                .overlay(
                                    Text(String(user.displayName.prefix(1)).uppercased())
                                        .font(.title.weight(.bold))
                                        .foregroundColor(.white)
                                )

                            VStack(alignment: .leading, spacing: 6) {
                                Text(user.displayName)
                                    .font(.title3.weight(.semibold))

                                Text(user.email)
                                    .font(.callout)
                                    .foregroundColor(.gray)

                                HStack(spacing: 6) {
                                    Image(systemName: "crown.fill")
                                        .foregroundColor(.yellow)
                                        .font(.caption)
                                    Text(user.plan.name)
                                        .font(.caption.weight(.medium))
                                        .foregroundColor(.cyan)
                                }
                            }
                        }
                        .padding(.vertical, 10)
                    }
                } header: {
                    Text("Mi Cuenta")
                }

                // Plan details
                Section {
                    if let plan = authManager.currentUser?.plan {
                        HStack {
                            Text("Plan")
                            Spacer()
                            Text(plan.name)
                                .foregroundColor(.cyan)
                        }

                        HStack {
                            Text("Calidad HD")
                            Spacer()
                            Image(systemName: plan.hasHD ? "checkmark.circle.fill" : "xmark.circle")
                                .foregroundColor(plan.hasHD ? .green : .red)
                        }

                        HStack {
                            Text("Calidad 4K")
                            Spacer()
                            Image(systemName: plan.has4K ? "checkmark.circle.fill" : "xmark.circle")
                                .foregroundColor(plan.has4K ? .green : .red)
                        }

                        HStack {
                            Text("Dispositivos simultáneos")
                            Spacer()
                            Text("\(plan.maxDevices)")
                                .foregroundColor(.gray)
                        }
                    }
                } header: {
                    Text("Mi Plan Flow")
                }

                // Playback settings
                Section {
                    Picker("Calidad de video", selection: $videoQuality) {
                        ForEach(VideoQuality.allCases, id: \.self) { quality in
                            Text(quality.displayName).tag(quality)
                        }
                    }

                    Toggle("Reproducción automática", isOn: $autoPlay)

                    Toggle("Subtítulos", isOn: $subtitlesEnabled)
                } header: {
                    Text("Reproducción")
                }

                // Parental control
                Section {
                    Toggle("Control parental", isOn: $parentalControlEnabled)

                    if parentalControlEnabled {
                        NavigationLink("Configurar PIN") {
                            Text("Configuración de PIN parental")
                        }
                    }
                } header: {
                    Text("Control Parental")
                }

                // App info
                Section {
                    HStack {
                        Text("Versión")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.gray)
                    }

                    HStack {
                        Text("Dispositivo")
                        Spacer()
                        Text("Apple TV")
                            .foregroundColor(.gray)
                    }

                    NavigationLink("Términos y condiciones") {
                        ScrollView {
                            Text("Los términos y condiciones del servicio Flow están disponibles en personal.com.ar/flow/terminos")
                                .padding()
                        }
                        .navigationTitle("Términos y Condiciones")
                    }

                    NavigationLink("Política de privacidad") {
                        ScrollView {
                            Text("La política de privacidad del servicio Flow está disponible en personal.com.ar/flow/privacidad")
                                .padding()
                        }
                        .navigationTitle("Política de Privacidad")
                    }
                } header: {
                    Text("Información")
                }

                // Logout
                Section {
                    Button(action: { showLogoutConfirm = true }) {
                        HStack {
                            Spacer()
                            Text("Cerrar Sesión")
                                .foregroundColor(.red)
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Mi Cuenta")
            .alert("¿Cerrar sesión?", isPresented: $showLogoutConfirm) {
                Button("Cancelar", role: .cancel) {}
                Button("Cerrar Sesión", role: .destructive) {
                    authManager.logout()
                }
            } message: {
                Text("Vas a tener que iniciar sesión de nuevo para seguir usando Flow.")
            }
        }
    }
}

enum VideoQuality: String, CaseIterable {
    case auto = "auto"
    case hd1080 = "1080p"
    case hd720 = "720p"
    case sd480 = "480p"

    var displayName: String {
        switch self {
        case .auto: return "Automática"
        case .hd1080: return "1080p (Full HD)"
        case .hd720: return "720p (HD)"
        case .sd480: return "480p (SD)"
        }
    }
}
