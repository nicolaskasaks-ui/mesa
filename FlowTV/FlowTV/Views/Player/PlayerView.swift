import SwiftUI
import AVKit

struct PlayerView: View {
    let title: String
    let subtitle: String?
    let streamURL: String?
    let isLive: Bool

    @Environment(\.dismiss) private var dismiss
    @State private var player: AVPlayer?
    @State private var isPlaying = true
    @State private var showControls = true
    @State private var controlsTimer: Timer?
    @State private var currentTime: Double = 0
    @State private var duration: Double = 0
    @State private var isBuffering = true
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let player {
                VideoPlayer(player: player)
                    .ignoresSafeArea()
                    .onAppear {
                        player.play()
                    }
            } else if let errorMessage {
                // Error state
                VStack(spacing: 20) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 60))
                        .foregroundColor(.yellow)

                    Text(errorMessage)
                        .font(.title3)
                        .foregroundColor(.white)

                    Button("Volver") { dismiss() }
                }
            } else {
                // Loading / Demo mode
                VStack(spacing: 30) {
                    Image(systemName: isLive ? "antenna.radiowaves.left.and.right" : "play.tv")
                        .font(.system(size: 80))
                        .foregroundColor(.cyan)
                        .symbolEffect(.pulse)

                    VStack(spacing: 10) {
                        Text(title)
                            .font(.system(size: 42, weight: .bold))
                            .foregroundColor(.white)

                        if let subtitle {
                            Text(subtitle)
                                .font(.title3)
                                .foregroundColor(.gray)
                        }
                    }

                    if isLive {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 12, height: 12)
                            Text("EN VIVO")
                                .font(.headline)
                                .foregroundColor(.red)
                        }
                    }

                    if isBuffering {
                        ProgressView()
                            .scaleEffect(1.5)
                            .tint(.cyan)
                            .padding(.top, 20)

                        Text("Conectando con Flow...")
                            .font(.callout)
                            .foregroundColor(.gray)
                    }
                }
            }

            // Overlay controls
            if showControls {
                PlayerControlsOverlay(
                    title: title,
                    subtitle: subtitle,
                    isLive: isLive,
                    isPlaying: $isPlaying,
                    currentTime: currentTime,
                    duration: duration,
                    onDismiss: { dismiss() },
                    onPlayPause: { togglePlayPause() }
                )
                .transition(.opacity)
            }
        }
        .onAppear {
            setupPlayer()
            startControlsTimer()
        }
        .onDisappear {
            player?.pause()
            player = nil
            controlsTimer?.invalidate()
        }
        .onPlayPauseCommand {
            togglePlayPause()
        }
        .onExitCommand {
            dismiss()
        }
        .onMoveCommand { direction in
            showControls = true
            startControlsTimer()
        }
    }

    private func setupPlayer() {
        guard let urlString = streamURL,
              let url = URL(string: urlString) else {
            // Demo mode - show info screen
            isBuffering = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                isBuffering = false
                errorMessage = "Stream no disponible en modo demo.\nConectá tu cuenta Flow para ver contenido en vivo."
            }
            return
        }

        let playerItem = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: playerItem)
        isBuffering = false
    }

    private func togglePlayPause() {
        if isPlaying {
            player?.pause()
        } else {
            player?.play()
        }
        isPlaying.toggle()
        showControls = true
        startControlsTimer()
    }

    private func startControlsTimer() {
        controlsTimer?.invalidate()
        controlsTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: false) { _ in
            Task { @MainActor in
                withAnimation { showControls = false }
            }
        }
    }
}

// MARK: - Player Controls Overlay

struct PlayerControlsOverlay: View {
    let title: String
    let subtitle: String?
    let isLive: Bool
    @Binding var isPlaying: Bool
    let currentTime: Double
    let duration: Double
    let onDismiss: () -> Void
    let onPlayPause: () -> Void

    var body: some View {
        ZStack {
            // Gradient overlay
            VStack {
                LinearGradient(
                    colors: [.black.opacity(0.7), .clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 200)

                Spacer()

                LinearGradient(
                    colors: [.clear, .black.opacity(0.7)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 200)
            }

            VStack {
                // Top bar
                HStack {
                    Button(action: onDismiss) {
                        HStack(spacing: 8) {
                            Image(systemName: "chevron.left")
                            Text("Volver")
                        }
                        .font(.callout)
                        .foregroundColor(.white)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    if isLive {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 8, height: 8)
                            Text("EN VIVO")
                                .font(.caption.weight(.bold))
                                .foregroundColor(.red)
                        }
                    }
                }
                .padding(40)

                Spacer()

                // Bottom info
                VStack(alignment: .leading, spacing: 8) {
                    Text(title)
                        .font(.title.weight(.bold))
                        .foregroundColor(.white)

                    if let subtitle {
                        Text(subtitle)
                            .font(.title3)
                            .foregroundColor(.gray)
                    }

                    if !isLive && duration > 0 {
                        // Progress bar for VOD
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.white.opacity(0.3))
                                    .frame(height: 5)
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.cyan)
                                    .frame(
                                        width: geo.size.width * (duration > 0 ? currentTime / duration : 0),
                                        height: 5
                                    )
                            }
                        }
                        .frame(height: 5)

                        HStack {
                            Text(formatTime(currentTime))
                            Spacer()
                            Text(formatTime(duration))
                        }
                        .font(.caption)
                        .foregroundColor(.gray)
                    }
                }
                .padding(40)
            }
        }
        .ignoresSafeArea()
    }

    private func formatTime(_ seconds: Double) -> String {
        let hours = Int(seconds) / 3600
        let mins = (Int(seconds) % 3600) / 60
        let secs = Int(seconds) % 60
        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, mins, secs)
        }
        return String(format: "%02d:%02d", mins, secs)
    }
}
