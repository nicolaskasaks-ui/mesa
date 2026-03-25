import SwiftUI

struct HomeView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @EnvironmentObject var csdkBridge: CSDKBridge
    @State private var showPlayer = false
    @State private var playerTitle = ""
    @State private var playerSubtitle: String?
    @State private var playerIsLive = false
    @State private var playerStreamURL: String?
    @State private var playerContentId: String?
    @State private var playerContentType: StreamContentType?

    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 65) {
                    // Hero featured content (large banner like Apple TV+)
                    if !flowAPI.featuredContent.isEmpty {
                        FeaturedHeroView(items: flowAPI.featuredContent) { item in
                            playFeatured(item)
                        }
                        .frame(height: 700)
                    }

                    // Continue watching
                    if !flowAPI.continueWatching.isEmpty {
                        ShelfRow(title: "Seguir Viendo") {
                            ForEach(flowAPI.continueWatching) { item in
                                ContinueWatchingCard(item: item) {
                                    playContinueWatching(item)
                                }
                            }
                        }
                    }

                    // Live TV quick access — prefer real CSDK channels
                    if csdkBridge.isReady && !csdkBridge.channels.isEmpty {
                        ShelfRow(title: "TV en Vivo") {
                            ForEach(csdkBridge.channels.prefix(20)) { csdkCh in
                                let channel = csdkCh.toChannel()
                                LiveChannelPill(channel: channel) {
                                    playChannel(channel)
                                }
                            }
                        }
                    } else if !flowAPI.channels.isEmpty {
                        ShelfRow(title: "TV en Vivo") {
                            ForEach(flowAPI.channels.prefix(15)) { channel in
                                LiveChannelPill(channel: channel) {
                                    playChannel(channel)
                                }
                            }
                        }
                    }

                    // CSDK status indicator (shown while loading)
                    if csdkBridge.isLoading {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text("CSDK: \(csdkBridge.statusMessage)")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.4))
                        }
                        .padding(.horizontal, 90)
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
            .fullScreenCover(isPresented: $showPlayer) {
                PlayerView(
                    title: playerTitle,
                    subtitle: playerSubtitle,
                    isLive: playerIsLive,
                    streamURL: playerStreamURL,
                    contentId: playerContentId,
                    contentType: playerContentType
                )
            }
        }
        .task {
            await loadAll()
        }
    }

    // MARK: - Playback helpers

    private func playFeatured(_ item: FeaturedContent) {
        switch item.content {
        case .channel(let channel):
            playChannel(channel)
        case .vod(let vod):
            playerTitle = vod.title
            playerSubtitle = nil
            playerIsLive = false
            playerStreamURL = vod.streamURL
            playerContentId = vod.id
            playerContentType = .vod
            showPlayer = true
        case .liveEvent(let program):
            playerTitle = program.title
            playerSubtitle = nil
            playerIsLive = true
            playerStreamURL = nil
            playerContentId = program.id
            playerContentType = .tvSchedule
            showPlayer = true
        }
    }

    private func playChannel(_ channel: Channel) {
        playerTitle = channel.name
        playerSubtitle = channel.currentProgram?.title
        playerIsLive = true
        playerStreamURL = channel.streamURL
        playerContentId = channel.id
        playerContentType = .tvChannel
        showPlayer = true
    }

    private func playContinueWatching(_ item: ContinueWatching) {
        playerTitle = item.title
        playerSubtitle = nil
        playerIsLive = false
        playerStreamURL = item.streamURL
        playerContentId = item.contentId
        playerContentType = .vod
        showPlayer = true
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
                .padding(.vertical, 24)
            }
        }
    }
}

// MARK: - Featured Hero (like Apple TV+ top banner)

struct FeaturedHeroView: View {
    let items: [FeaturedContent]
    let onPlay: (FeaturedContent) -> Void
    @State private var currentIndex = 0

    var body: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                HeroBannerCard(item: item, onPlay: { onPlay(item) })
                    .tag(index)
            }
        }
        .tabViewStyle(.page)
    }
}

struct HeroBannerCard: View {
    let item: FeaturedContent
    let onPlay: () -> Void
    @EnvironmentObject var favoritesManager: FavoritesManager

    private var contentId: String {
        switch item.content {
        case .channel(let c): return c.id
        case .vod(let v): return v.id
        case .liveEvent(let p): return p.id
        }
    }

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
                    Button(action: onPlay) {
                        Label("Reproducir", systemImage: "play.fill")
                            .font(.callout.weight(.semibold))
                            .padding(.horizontal, 32)
                            .padding(.vertical, 14)
                            .background(Color.white)
                            .foregroundColor(.black)
                            .cornerRadius(10)
                    }

                    Button(action: { favoritesManager.toggle(contentId) }) {
                        Label("Mi Lista", systemImage: favoritesManager.isFavorite(contentId) ? "checkmark" : "plus")
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

struct ContinueWatchingCard: View {
    let item: ContinueWatching
    let onPlay: () -> Void

    var body: some View {
        Button(action: onPlay) {
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
    let onPlay: () -> Void

    var body: some View {
        Button(action: onPlay) {
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
