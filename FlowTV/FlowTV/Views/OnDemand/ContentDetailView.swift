import SwiftUI

struct ContentDetailView: View {
    let content: VODContent
    @State private var selectedSeason: Season?
    @State private var showPlayer = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Hero section
                ZStack(alignment: .bottomLeading) {
                    // Background
                    LinearGradient(
                        colors: [
                            Color(red: 0.15, green: 0.0, blue: 0.3),
                            Color(red: 0.05, green: 0.0, blue: 0.1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: 600)

                    // Content info
                    VStack(alignment: .leading, spacing: 16) {
                        Text(content.title)
                            .font(.system(size: 56, weight: .bold))
                            .foregroundColor(.white)

                        // Metadata row
                        HStack(spacing: 16) {
                            if let year = content.year {
                                Text(String(year))
                                    .foregroundColor(.gray)
                            }

                            if let rating = content.rating {
                                Text(rating)
                                    .font(.caption.weight(.bold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.white.opacity(0.2))
                                    .cornerRadius(4)
                            }

                            if let duration = content.durationText {
                                Text(duration)
                                    .foregroundColor(.gray)
                            }

                            if content.contentType == .series, let seasons = content.seasons {
                                Text("\(seasons.count) Temporada\(seasons.count > 1 ? "s" : "")")
                                    .foregroundColor(.gray)
                            }

                            Text(content.genreText)
                                .foregroundColor(.cyan)
                        }
                        .font(.subheadline)

                        if let description = content.description {
                            Text(description)
                                .font(.body)
                                .foregroundColor(.white.opacity(0.8))
                                .lineLimit(4)
                                .frame(maxWidth: 800)
                        }

                        // Action buttons
                        HStack(spacing: 20) {
                            Button(action: { showPlayer = true }) {
                                HStack {
                                    Image(systemName: "play.fill")
                                    Text("Reproducir")
                                }
                                .font(.headline)
                                .padding(.horizontal, 40)
                                .padding(.vertical, 14)
                                .background(Color.white)
                                .foregroundColor(.black)
                                .cornerRadius(8)
                            }

                            Button(action: {}) {
                                HStack {
                                    Image(systemName: content.isFavorite ? "heart.fill" : "heart")
                                    Text("Mi Lista")
                                }
                                .font(.headline)
                                .padding(.horizontal, 30)
                                .padding(.vertical, 14)
                                .background(Color.white.opacity(0.2))
                                .foregroundColor(.white)
                                .cornerRadius(8)
                            }
                        }
                        .padding(.top, 10)
                    }
                    .padding(60)
                }

                // Episodes section (for series)
                if content.contentType == .series, let seasons = content.seasons {
                    VStack(alignment: .leading, spacing: 20) {
                        // Season selector
                        if seasons.count > 1 {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 15) {
                                    ForEach(seasons) { season in
                                        Button(action: { selectedSeason = season }) {
                                            Text("Temporada \(season.number)")
                                                .font(.subheadline.weight(
                                                    (selectedSeason ?? seasons.first)?.id == season.id ? .bold : .regular
                                                ))
                                                .foregroundColor(
                                                    (selectedSeason ?? seasons.first)?.id == season.id ? .cyan : .gray
                                                )
                                                .padding(.horizontal, 16)
                                                .padding(.vertical, 8)
                                                .background(
                                                    (selectedSeason ?? seasons.first)?.id == season.id
                                                        ? Color.cyan.opacity(0.15)
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
                            ForEach(episodes) { episode in
                                EpisodeRow(episode: episode)
                                    .onTapGesture { showPlayer = true }
                            }
                            .padding(.horizontal, 60)
                        }
                    }
                    .padding(.vertical, 30)
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
}

// MARK: - Episode Row

struct EpisodeRow: View {
    let episode: Episode

    var body: some View {
        Button(action: {}) {
            HStack(spacing: 20) {
                // Episode number
                Text("\(episode.number)")
                    .font(.title2.weight(.bold))
                    .foregroundColor(.cyan)
                    .frame(width: 50)

                // Thumbnail placeholder
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 180, height: 100)
                    .overlay(
                        Image(systemName: "play.circle")
                            .font(.title)
                            .foregroundColor(.white.opacity(0.5))
                    )

                // Info
                VStack(alignment: .leading, spacing: 6) {
                    Text(episode.title)
                        .font(.headline)
                        .foregroundColor(.white)

                    if let description = episode.description {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.gray)
                            .lineLimit(2)
                    }

                    if let duration = episode.durationText {
                        Text(duration)
                            .font(.caption2)
                            .foregroundColor(.gray.opacity(0.7))
                    }
                }

                Spacer()
            }
            .padding(16)
            .background(Color.white.opacity(0.03))
            .cornerRadius(10)
        }
        .buttonStyle(.card)
    }
}
