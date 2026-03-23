import SwiftUI

struct ContentDetailView: View {
    let content: VODContent
    @State private var selectedSeason: Season?
    @State private var showPlayer = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Hero (Apple TV+ style full-width banner)
                ZStack(alignment: .bottomLeading) {
                    // Backdrop
                    if let backdropURL = content.backdropURL,
                       let url = FlowAPIService.imageURL(path: backdropURL) {
                        AsyncImage(url: url) { image in
                            image.resizable().aspectRatio(contentMode: .fill)
                        } placeholder: {
                            heroGradient
                        }
                        .frame(height: 650)
                        .clipped()
                        .overlay(
                            LinearGradient(
                                stops: [
                                    .init(color: .clear, location: 0.2),
                                    .init(color: Color.black.opacity(0.98), location: 1.0)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                    } else {
                        heroGradient
                            .frame(height: 650)
                    }

                    // Info overlay
                    VStack(alignment: .leading, spacing: 16) {
                        Text(content.title)
                            .font(.system(size: 56, weight: .bold))
                            .foregroundColor(.white)

                        // Metadata chips
                        HStack(spacing: 14) {
                            if let year = content.year {
                                Text(String(year))
                                    .foregroundColor(Color.white.opacity(0.5))
                            }

                            if let rating = content.rating {
                                Text(rating)
                                    .font(.caption2.weight(.bold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.white.opacity(0.15))
                                    .cornerRadius(4)
                                    .foregroundColor(Color.white.opacity(0.7))
                            }

                            if let dur = content.durationText {
                                Text(dur)
                                    .foregroundColor(Color.white.opacity(0.5))
                            }

                            if content.contentType == .series, let seasons = content.seasons {
                                Text("\(seasons.count) Temporada\(seasons.count > 1 ? "s" : "")")
                                    .foregroundColor(Color.white.opacity(0.5))
                            }
                        }
                        .font(.subheadline)

                        if !content.genreText.isEmpty {
                            Text(content.genreText)
                                .font(.subheadline)
                                .foregroundColor(.cyan.opacity(0.8))
                        }

                        if let description = content.description {
                            Text(description)
                                .font(.body)
                                .foregroundColor(Color.white.opacity(0.65))
                                .lineLimit(4)
                                .frame(maxWidth: 700)
                        }

                        // Action buttons
                        HStack(spacing: 16) {
                            Button(action: { showPlayer = true }) {
                                Label("Reproducir", systemImage: "play.fill")
                                    .font(.callout.weight(.semibold))
                                    .padding(.horizontal, 36)
                                    .padding(.vertical, 14)
                                    .background(Color.white)
                                    .foregroundColor(.black)
                                    .cornerRadius(10)
                            }

                            Button(action: {}) {
                                Label("Mi Lista", systemImage: content.isFavorite ? "checkmark" : "plus")
                                    .font(.callout.weight(.semibold))
                                    .padding(.horizontal, 28)
                                    .padding(.vertical, 14)
                                    .background(Color.white.opacity(0.15))
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                            }
                        }
                        .padding(.top, 8)
                    }
                    .padding(60)
                }

                // Episodes (for series)
                if content.contentType == .series, let seasons = content.seasons {
                    VStack(alignment: .leading, spacing: 24) {
                        // Season picker
                        if seasons.count > 1 {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(seasons) { season in
                                        Button(action: { selectedSeason = season }) {
                                            Text("Temporada \(season.number)")
                                                .font(.subheadline.weight(
                                                    (selectedSeason ?? seasons.first)?.id == season.id
                                                        ? .bold : .regular
                                                ))
                                                .foregroundColor(
                                                    (selectedSeason ?? seasons.first)?.id == season.id
                                                        ? .white : Color.white.opacity(0.4)
                                                )
                                                .padding(.horizontal, 16)
                                                .padding(.vertical, 10)
                                                .background(
                                                    (selectedSeason ?? seasons.first)?.id == season.id
                                                        ? Color.white.opacity(0.12)
                                                        : Color.clear
                                                )
                                                .cornerRadius(8)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal, 60)
                            }
                        }

                        // Episode list
                        let currentSeason = selectedSeason ?? seasons.first
                        if let episodes = currentSeason?.episodes {
                            VStack(spacing: 8) {
                                ForEach(episodes) { episode in
                                    EpisodeCard(episode: episode)
                                        .onTapGesture { showPlayer = true }
                                }
                            }
                            .padding(.horizontal, 60)
                        }
                    }
                    .padding(.top, 36)
                    .padding(.bottom, 60)
                }
            }
        }
        .fullScreenCover(isPresented: $showPlayer) {
            PlayerView(
                title: content.title,
                subtitle: content.contentType == .series ? "T1 E1" : nil,
                streamURL: content.streamURL,
                isLive: false
            )
        }
    }

    private var heroGradient: some View {
        LinearGradient(
            colors: [
                Color(red: 0.1, green: 0.05, blue: 0.2),
                Color.black
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Episode Card (tvOS style)

struct EpisodeCard: View {
    let episode: Episode
    @Environment(\.isFocused) var isFocused

    var body: some View {
        Button(action: {}) {
            HStack(spacing: 20) {
                // Episode number
                Text(String(format: "%02d", episode.number))
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .foregroundColor(Color.white.opacity(0.3))
                    .frame(width: 44)

                // Thumbnail
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 160, height: 90)
                    .overlay(
                        Image(systemName: "play.fill")
                            .font(.title3)
                            .foregroundColor(Color.white.opacity(0.3))
                    )

                // Info
                VStack(alignment: .leading, spacing: 4) {
                    Text(episode.title)
                        .font(.callout.weight(.medium))
                        .foregroundColor(.white)

                    if let desc = episode.description {
                        Text(desc)
                            .font(.caption)
                            .foregroundColor(Color.white.opacity(0.35))
                            .lineLimit(2)
                    }

                    if let dur = episode.durationText {
                        Text(dur)
                            .font(.caption2)
                            .foregroundColor(Color.white.opacity(0.25))
                    }
                }

                Spacer()
            }
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(isFocused ? 0.1 : 0.02))
            )
            .scaleEffect(isFocused ? 1.02 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: isFocused)
        }
        .buttonStyle(.card)
    }
}
