import SwiftUI

struct HomeView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @State private var showPlayer = false
    @State private var playerChannel: Channel?
    @State private var playerVOD: VODContent?

    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 65) {
                    // Hero featured content (large banner like Apple TV+)
                    if !flowAPI.featuredContent.isEmpty {
                        FeaturedHeroView(items: flowAPI.featuredContent)
                            .frame(height: 700)
                    }

                    // Continue watching
                    if !flowAPI.continueWatching.isEmpty {
                        ShelfRow(title: "Seguir Viendo") {
                            ForEach(flowAPI.continueWatching) { item in
                                ContinueWatchingCard(item: item)
                            }
                        }
                    }

                    // Live TV quick access
                    if !flowAPI.channels.isEmpty {
                        ShelfRow(title: "TV en Vivo") {
                            ForEach(flowAPI.channels.prefix(15)) { channel in
                                LiveChannelPill(channel: channel)
                            }
                        }
                    }

                    // VOD categories as shelves
                    ForEach(flowAPI.vodCategories) { category in
                        ShelfRow(title: category.name) {
                            ForEach(category.items) { item in
                                NavigationLink(value: item) {
                                    PosterCard(content: item)
                                }
                                .buttonStyle(.card)
                            }
                        }
                    }
                }
                .padding(.bottom, 80)
            }
            .navigationDestination(for: VODContent.self) { content in
                ContentDetailView(content: content)
            }
        }
        .task {
            await loadAll()
        }
    }

    private func loadAll() async {
        async let f: () = flowAPI.fetchFeaturedContent()
        async let w: () = flowAPI.fetchContinueWatching()
        async let c: () = flowAPI.fetchVODCategories()
        async let ch: () = flowAPI.fetchChannels()
        _ = await (f, w, c, ch)
    }
}

// MARK: - tvOS Shelf Row (horizontal scrolling row like Apple TV+)

struct ShelfRow<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text(title)
                .font(.title3.weight(.semibold))
                .foregroundColor(.white)
                .padding(.horizontal, 90)

            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 40) {
                    content()
                }
                .padding(.horizontal, 90)
                .padding(.vertical, 24) // room for .card focus lift
            }
        }
    }
}

// MARK: - Featured Hero (like Apple TV+ top banner)

struct FeaturedHeroView: View {
    let items: [FeaturedContent]
    @State private var currentIndex = 0

    var body: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                HeroBannerCard(item: item)
                    .tag(index)
            }
        }
        .tabViewStyle(.page)
    }
}

struct HeroBannerCard: View {
    let item: FeaturedContent

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Background
            Rectangle()
                .fill(
                    LinearGradient(
                        stops: [
                            .init(color: Color(white: 0.12), location: 0),
                            .init(color: Color.black, location: 1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

            // Image overlay if available
            if let imageURL = item.imageURL, let url = FlowAPIService.imageURL(path: imageURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .overlay(
                            LinearGradient(
                                stops: [
                                    .init(color: .clear, location: 0.3),
                                    .init(color: .black.opacity(0.95), location: 1.0)
                                ],
                                startPoint: .top,
                                endPoint: .bottom
                            )
                        )
                } placeholder: {
                    Color.clear
                }
            }

            // Content info
            VStack(alignment: .leading, spacing: 14) {
                Text(item.title)
                    .font(.system(size: 52, weight: .bold))
                    .foregroundColor(.white)

                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(.body)
                        .foregroundColor(Color.white.opacity(0.6))
                        .lineLimit(2)
                }

                HStack(spacing: 16) {
                    Button(action: {}) {
                        Label("Reproducir", systemImage: "play.fill")
                            .font(.callout.weight(.semibold))
                            .padding(.horizontal, 32)
                            .padding(.vertical, 14)
                            .background(Color.white)
                            .foregroundColor(.black)
                            .cornerRadius(10)
                    }

                    Button(action: {}) {
                        Label("Mi Lista", systemImage: "plus")
                            .font(.callout.weight(.semibold))
                            .padding(.horizontal, 28)
                            .padding(.vertical, 14)
                            .background(Color.white.opacity(0.15))
                            .foregroundColor(.white)
                            .cornerRadius(10)
                    }
                }
            }
            .padding(60)
        }
        .clipped()
        .cornerRadius(20)
        .padding(.horizontal, 50)
    }
}

// MARK: - Poster Card (standard tvOS poster like Apple TV+)

/// Standard tvOS poster card (2:3 aspect ratio, 250x375)
/// Uses native .card ButtonStyle for focus lift/shadow/motion
struct PosterCard: View {
    let content: VODContent

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(posterGradient)

                if let posterURL = content.posterURL,
                   let url = FlowAPIService.imageURL(path: posterURL) {
                    AsyncImage(url: url) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        posterPlaceholder
                    }
                } else {
                    posterPlaceholder
                }
            }
            .frame(width: 250, height: 375)
            .clipped()

            // Title below card (shown by .card style context)
            Text(content.title)
                .font(.callout)
                .lineLimit(1)
                .padding(.horizontal, 4)
                .padding(.top, 10)
        }
        .frame(width: 250)
    }

    private var posterPlaceholder: some View {
        VStack(spacing: 8) {
            Image(systemName: content.contentType == .series ? "tv" : "film")
                .font(.system(size: 36))
                .foregroundColor(.white.opacity(0.3))
            Text(content.title)
                .font(.caption.weight(.medium))
                .foregroundColor(.white.opacity(0.4))
                .multilineTextAlignment(.center)
                .lineLimit(3)
                .padding(.horizontal, 12)
        }
    }

    private var posterGradient: LinearGradient {
        let hash = abs(content.id.hashValue)
        let palettes: [[Color]] = [
            [Color(red: 0.12, green: 0.05, blue: 0.25), Color(red: 0.25, green: 0.05, blue: 0.15)],
            [Color(red: 0.05, green: 0.12, blue: 0.25), Color(red: 0.05, green: 0.2, blue: 0.2)],
            [Color(red: 0.18, green: 0.08, blue: 0.05), Color(red: 0.28, green: 0.1, blue: 0.05)],
            [Color(red: 0.08, green: 0.08, blue: 0.2), Color(red: 0.15, green: 0.05, blue: 0.25)],
        ]
        let pair = palettes[hash % palettes.count]
        return LinearGradient(colors: pair, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

// MARK: - Continue Watching Card

/// Landscape card (16:9) for continue watching — uses native .card focus
struct ContinueWatchingCard: View {
    let item: ContinueWatching

    var body: some View {
        Button(action: {}) {
            VStack(alignment: .leading, spacing: 0) {
                ZStack(alignment: .bottom) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.white.opacity(0.08))
                        .frame(width: 500, height: 281)
                        .overlay(
                            Image(systemName: "play.fill")
                                .font(.system(size: 44))
                                .foregroundColor(.white.opacity(0.5))
                        )

                    // Progress bar
                    GeometryReader { geo in
                        VStack {
                            Spacer()
                            ZStack(alignment: .leading) {
                                Rectangle().fill(Color.white.opacity(0.15))
                                Rectangle().fill(Color.white)
                                    .frame(width: geo.size.width * item.progress)
                            }
                            .frame(height: 3)
                        }
                    }
                    .frame(width: 500, height: 281)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Text(item.title)
                    .font(.callout)
                    .lineLimit(1)
                    .padding(.horizontal, 4)
                    .padding(.top, 10)
            }
            .frame(width: 500)
        }
        .buttonStyle(.card)
    }
}

// MARK: - Live Channel Pill

struct LiveChannelPill: View {
    let channel: Channel

    var body: some View {
        Button(action: {}) {
            HStack(spacing: 12) {
                Text(channel.displayNumber)
                    .font(.system(size: 18, weight: .bold, design: .monospaced))
                    .foregroundColor(.cyan)

                VStack(alignment: .leading, spacing: 2) {
                    Text(channel.name)
                        .font(.callout.weight(.semibold))
                        .lineLimit(1)

                    if let prog = channel.currentProgram {
                        Text(prog.title)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }

                Circle()
                    .fill(Color.red)
                    .frame(width: 6, height: 6)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
        }
        .buttonStyle(.card)
    }
}
