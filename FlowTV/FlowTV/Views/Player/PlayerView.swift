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

            // Video layer
            if let player {
                VideoPlayer(player: player)
                    .ignoresSafeArea()
                    .onAppear { player.play() }
            }

            // Loading / info state
            if player == nil {
                if let errorMessage {
                    errorState(errorMessage)
                } else {
                    loadingState
                }
            }

            // Controls overlay (Apple TV style — minimal, clean)
            if showControls {
                controlsOverlay
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .onAppear {
            setupPlayer()
            resetControlsTimer()
        }
        .onDisappear {
            player?.pause()
            player = nil
            controlsTimer?.invalidate()
        }
        .onPlayPauseCommand { togglePlayPause() }
        .onExitCommand { dismiss() }
        .onMoveCommand { _ in
            withAnimation { showControls = true }
            resetControlsTimer()
        }
    }

    // MARK: - Loading State

    private var loadingState: some View {
        VStack(spacing: 28) {
            Image(systemName: isLive ? "antenna.radiowaves.left.and.right" : "play.tv")
                .font(.system(size: 64))
                .foregroundColor(.white.opacity(0.4))
                .symbolEffect(.pulse)

            Text(title)
                .font(.system(size: 38, weight: .bold))
                .foregroundColor(.white)

            if let subtitle {
                Text(subtitle)
                    .font(.title3)
                    .foregroundColor(Color.white.opacity(0.4))
            }

            if isLive {
                liveBadge
            }

            if isBuffering {
                ProgressView()
                    .scaleEffect(1.3)
                    .tint(.white)
                    .padding(.top, 16)

                Text("Conectando...")
                    .font(.caption)
                    .foregroundColor(Color.white.opacity(0.3))
            }
        }
    }

    // MARK: - Error State

    private func errorState(_ message: String) -> some View {
        VStack(spacing: 24) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.yellow.opacity(0.7))

            Text(message)
                .font(.callout)
                .foregroundColor(Color.white.opacity(0.6))
                .multilineTextAlignment(.center)
                .frame(maxWidth: 500)

            Button("Volver") { dismiss() }
                .padding(.horizontal, 32)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.15))
                .foregroundColor(.white)
                .cornerRadius(10)
        }
    }

    // MARK: - Controls Overlay (Apple TV style)

    private var controlsOverlay: some View {
        ZStack {
            // Top gradient
            VStack {
                LinearGradient(
                    colors: [.black.opacity(0.6), .clear],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 140)
                Spacer()
            }

            // Bottom gradient + info
            VStack {
                Spacer()
                LinearGradient(
                    colors: [.clear, .black.opacity(0.6)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 180)
            }

            VStack {
                // Top bar — back + live indicator
                HStack {
                    Button(action: { dismiss() }) {
                        Image(systemName: "chevron.left")
                            .font(.title3.weight(.semibold))
                            .foregroundColor(.white)
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    if isLive { liveBadge }
                }
                .padding(.horizontal, 48)
                .padding(.top, 32)

                Spacer()

                // Bottom bar — title + progress
                VStack(alignment: .leading, spacing: 10) {
                    Text(title)
                        .font(.title2.weight(.bold))
                        .foregroundColor(.white)

                    if let subtitle {
                        Text(subtitle)
                            .font(.callout)
                            .foregroundColor(Color.white.opacity(0.5))
                    }

                    if !isLive && duration > 0 {
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(Color.white.opacity(0.2))
                                    .frame(height: 4)
                                Capsule()
                                    .fill(Color.white)
                                    .frame(
                                        width: geo.size.width * (duration > 0 ? currentTime / duration : 0),
                                        height: 4
                                    )
                            }
                        }
                        .frame(height: 4)

                        HStack {
                            Text(formatTime(currentTime))
                            Spacer()
                            Text("-\(formatTime(duration - currentTime))")
                        }
                        .font(.caption2)
                        .foregroundColor(Color.white.opacity(0.4))
                    }
                }
                .padding(48)
            }
        }
        .ignoresSafeArea()
    }

    private var liveBadge: some View {
        HStack(spacing: 5) {
            Circle().fill(Color.red).frame(width: 7, height: 7)
            Text("EN VIVO")
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.red)
        }
    }

    // MARK: - Player Setup

    private func setupPlayer() {
        guard let urlString = streamURL,
              let url = URL(string: urlString) else {
            isBuffering = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                isBuffering = false
                errorMessage = "Stream no disponible en modo demo.\nConectá tu cuenta Flow para ver contenido en vivo."
            }
            return
        }

        let item = AVPlayerItem(url: url)
        player = AVPlayer(playerItem: item)
        isBuffering = false
    }

    private func togglePlayPause() {
        if isPlaying { player?.pause() } else { player?.play() }
        isPlaying.toggle()
        withAnimation { showControls = true }
        resetControlsTimer()
    }

    private func resetControlsTimer() {
        controlsTimer?.invalidate()
        controlsTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: false) { _ in
            Task { @MainActor in
                withAnimation(.easeOut(duration: 0.3)) { showControls = false }
            }
        }
    }

    private func formatTime(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        let s = Int(seconds) % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }
}
