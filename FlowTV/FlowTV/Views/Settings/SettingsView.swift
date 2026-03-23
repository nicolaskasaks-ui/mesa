import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var showLogoutConfirm = false
    @State private var parentalControl = false
    @State private var autoPlay = true
    @State private var videoQuality: VideoQuality = .auto
    @State private var subtitles = false

    var body: some View {
        NavigationStack {
            List {
                // Profile
                Section {
                    if let user = authManager.currentUser {
                        HStack(spacing: 20) {
                            ZStack {
                                Circle()
                                    .fill(
                                        LinearGradient(
                                            colors: [.cyan.opacity(0.6), .purple.opacity(0.6)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 72, height: 72)

                                Text(String(user.displayName.prefix(1)).uppercased())
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(.white)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.displayName)
                                    .font(.callout.weight(.semibold))
                                Text(user.email)
                                    .font(.caption)
                                    .foregroundColor(Color.white.opacity(0.4))
                                Text(user.plan.name)
                                    .font(.caption2.weight(.medium))
                                    .foregroundColor(.cyan)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                } header: {
                    Text("Cuenta")
                }

                // Plan
                Section {
                    if let plan = authManager.currentUser?.plan {
                        planRow("Plan", value: plan.name)
                        planRow("HD", check: plan.hasHD)
                        planRow("4K", check: plan.has4K)
                        planRow("Dispositivos", value: "\(plan.maxDevices)")
                    }
                } header: {
                    Text("Mi Plan")
                }

                // Playback
                Section {
                    Picker("Calidad", selection: $videoQuality) {
                        ForEach(VideoQuality.allCases, id: \.self) {
                            Text($0.displayName).tag($0)
                        }
                    }
                    Toggle("Reproducción automática", isOn: $autoPlay)
                    Toggle("Subtítulos", isOn: $subtitles)
                } header: {
                    Text("Reproducción")
                }

                // Parental
                Section {
                    Toggle("Control parental", isOn: $parentalControl)
                } header: {
                    Text("Restricciones")
                }

                // Info
                Section {
                    planRow("Versión", value: "1.0.0")
                    planRow("Dispositivo", value: "Apple TV")
                } header: {
                    Text("Info")
                }

                // Logout
                Section {
                    Button(role: .destructive, action: { showLogoutConfirm = true }) {
                        HStack {
                            Spacer()
                            Text("Cerrar Sesión")
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
                Text("Vas a tener que iniciar sesión de nuevo.")
            }
        }
    }

    private func planRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(value).foregroundColor(Color.white.opacity(0.4))
        }
    }

    private func planRow(_ label: String, check: Bool) -> some View {
        HStack {
            Text(label)
            Spacer()
            Image(systemName: check ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundColor(check ? .green : Color.white.opacity(0.2))
        }
    }
}

enum VideoQuality: String, CaseIterable {
    case auto, hd1080, hd720, sd480

    var displayName: String {
        switch self {
        case .auto: return "Automática"
        case .hd1080: return "1080p"
        case .hd720: return "720p"
        case .sd480: return "480p"
        }
    }
}
