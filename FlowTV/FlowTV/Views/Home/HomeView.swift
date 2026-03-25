import SwiftUI

struct HomeView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @EnvironmentObject var csdkBridge: CSDKBridge
    @EnvironmentObject var m11Service: FlowM11Service
    @State private var showPlayer = false
    @State private var playerTitle = ""
    @State private var playerSubtitle: String?
    @State private var playerIsLive = false
    @State private var playerStreamURL: String?
    @State private var playerContentId: String?
    @State private var playerContentType: StreamContentType?

    /// Channels from M11 service (real Flow data)
    private var liveChannels: [Channel] {
        if m11Service.isReady && !m11Service.channels.isEmpty {
            return m11Service.channels
        }
        if csdkBridge.isReady && !csdkBridge.channels.isEmpty {
            return csdkBridge.channels.map { $0.toChannel() }
        }
        return flowAPI.channels
    }

    var body: some View {
        NavigationStack {
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(alignment: .leading, spacing: 50) {
                    // Hero banner with featured live channels
                    if !liveChannels.isEmpty {
                        FlowHeroBanner(channels: liveChannels) { channel in
                            playChannel(channel)
                        }
                        .frame(height: 620)
                    }

                    // TV en Vivo quick access row with channel logos
                    if !liveChannels.isEmpty {
                        ShelfRow(title: "TV en Vivo") {
                            ForEach(liveChannels.prefix(25)) { channel in
                                ChannelLogoCard(channel: channel) {
                                    playChannel(channel)
                                }
                            }
                        }
                    }

                    // News channels
                    let newsChannels = liveChannels.filter { $0.category == .noticias }
                    if !newsChannels.isEmpty {
                        ShelfRow(title: "Noticias") {
                            ForEach(newsChannels) { channel in
                                ChannelLogoCard(channel: channel) {
                                    playChannel(channel)
                                }
                            }
                        }
                    }

                    // Sports channels
                    let sportsChannels = liveChannels.filter { $0.category == .deportes }
                    if !sportsChannels.isEmpty {
                        ShelfRow(title: "Deportes") {
                            ForEach(sportsChannels) { channel in
                                ChannelLogoCard(channel: channel) {
                                    playChannel(channel)
                                }
                            }
                        }
                    }

                    // Movies channels
                    let movieChannels = liveChannels.filter { $0.category == .peliculas }
                    if !movieChannels.isEmpty {
                        ShelfRow(title: "Cine") {
                            ForEach(movieChannels) { channel in
                                ChannelLogoCard(channel: channel) {
                                    playChannel(channel)
                                }
                            }
                        }
                    }

                    // Kids channels
                    let kidsChannels = liveChannels.filter { $0.category == .infantil }
                    if !kidsChannels.isEmpty {
                        ShelfRow(title: "Infantil") {
                            ForEach(kidsChannels) { channel in
                                ChannelLogoCard(channel: channel) {
                                    playChannel(channel)
                                }
                            }
                        }
                    }

                    // VOD categories as shelves (from mock data for now)
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

                    // Loading status
                    if m11Service.statusMessage.count > 0 && !m11Service.isReady {
                        HStack(spacing: 8) {
                            ProgressView()
                                .scaleEffect(0.7)
                            Text(m11Service.statusMessage)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.4))
                        }
                        .padding(.horizontal, 90)
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

    private func playChannel(_ channel: Channel) {
        playerTitle = channel.name
        playerSubtitle = channel.currentProgram?.title
        playerIsLive = true
        // Use stream proxy URL
        let proxyURL = "http://localhost:8772/hls/\(channel.id)/stream.m3u8"
        playerStreamURL = proxyURL
        playerContentId = channel.id
        playerContentType = .tvChannel
        showPlayer = true
    }

    private func loadAll() async {
        async let w: () = flowAPI.fetchContinueWatching()
        async let c: () = flowAPI.fetchVODCategories()
        _ = await (w, c)
    }
}

// MARK: - Flow Hero Banner (pitch-ready featured banner)

struct FlowHeroBanner: View {
    let channels: [Channel]
    let onPlay: (Channel) -> Void
    @State private var currentIndex = 0
    @State private var autoScrollTimer: Timer?

    // Featured channels for the hero (first few popular ones)
    private var featuredChannels: [Channel] {
        let priorities = ["telefe", "trece", "espn", "hbo", "tn", "star", "disney", "tyc", "fox"]
        var featured: [Channel] = []

        for keyword in priorities {
            if let match = channels.first(where: { $0.name.lowercased().contains(keyword) }) {
                if !featured.contains(where: { $0.id == match.id }) {
                    featured.append(match)
                }
            }
            if featured.count >= 5 { break }
        }

        // Fill with first channels if not enough
        if featured.count < 3 {
            for ch in channels.prefix(5) {
                if !featured.contains(where: { $0.id == ch.id }) {
                    featured.append(ch)
                }
                if featured.count >= 5 { break }
            }
        }

        return featured
    }

    var body: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(featuredChannels.enumerated()), id: \.element.id) { index, channel in
                HeroChannelCard(channel: channel, onPlay: { onPlay(channel) })
                    .tag(index)
            }
        }
        .tabViewStyle(.page)
        .onAppear { startAutoScroll() }
        .onDisappear { autoScrollTimer?.invalidate() }
    }

    private func startAutoScroll() {
        autoScrollTimer?.invalidate()
        autoScrollTimer = Timer.scheduledTimer(withTimeInterval: 6, repeats: true) { _ in
            Task { @MainActor in
                withAnimation(.easeInOut(duration: 0.5)) {
                    currentIndex = (currentIndex + 1) % max(featuredChannels.count, 1)
                }
            }
        }
    }
}

struct HeroChannelCard: View {
    let channel: Channel
    let onPlay: () -> Void

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Background gradient
            Rectangle()
                .fill(heroGradient)

            // Channel logo (prominent, top-right)
            if let logoURL = channel.logoURL, let url = URL(string: logoURL) {
                AsyncImage(url: url) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 220, height: 150)
                        .shadow(color: .black.opacity(0.5), radius: 20)
                } placeholder: {
                    EmptyView()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(60)
            }

            // Content overlay
            VStack(alignment: .leading, spacing: 16) {
                // EN VIVO badge
                HStack(spacing: 6) {
                    Circle().fill(Color.red).frame(width: 8, height: 8)
                    Text("EN VIVO")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundColor(.red)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color.red.opacity(0.15))
                .cornerRadius(6)

                // Channel number + name
                HStack(spacing: 16) {
                    Text(channel.displayNumber)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundColor(.flowCyan)

                    Text(channel.name)
                        .font(.system(size: 48, weight: .bold))
                        .foregroundColor(.white)

                    if channel.isHD {
                        Text("HD")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white.opacity(0.7))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.white.opacity(0.15))
                            .cornerRadius(4)
                    }
                }

                // Current program
                if let program = channel.currentProgram {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(program.title)
                            .font(.title3.weight(.medium))
                            .foregroundColor(.white.opacity(0.8))

                        HStack(spacing: 12) {
                            Text(program.timeRangeText)
                                .font(.callout)
                                .foregroundColor(.white.opacity(0.5))

                            if let genre = program.genre {
                                Text(genre)
                                    .font(.callout)
                                    .foregroundColor(.white.opacity(0.4))
                            }
                        }

                        // Progress bar
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.white.opacity(0.15))
                                Capsule().fill(Color.flowCyan)
                                    .frame(width: geo.size.width * program.progress)
                            }
                        }
                        .frame(width: 400, height: 3)
                    }
                } else {
                    Text(channel.category.rawValue)
                        .font(.title3)
                        .foregroundColor(.white.opacity(0.5))
                }

                // Play button
                Button(action: onPlay) {
                    Label("Ver ahora", systemImage: "play.fill")
                        .font(.callout.weight(.semibold))
                        .padding(.horizontal, 36)
                        .padding(.vertical, 14)
                        .background(Color.white)
                        .foregroundColor(.black)
                        .cornerRadius(10)
                }
                .padding(.top, 8)
            }
            .padding(60)
        }
        .clipped()
        .cornerRadius(20)
        .padding(.horizontal, 50)
    }

    private var heroGradient: LinearGradient {
        let hash = abs(channel.id.hashValue)
        let palettes: [[Color]] = [
            [Color(red: 0.05, green: 0.08, blue: 0.2), Color.black],
            [Color(red: 0.12, green: 0.02, blue: 0.15), Color.black],
            [Color(red: 0.02, green: 0.12, blue: 0.15), Color.black],
            [Color(red: 0.1, green: 0.05, blue: 0.02), Color.black],
            [Color(red: 0.02, green: 0.05, blue: 0.18), Color.black],
        ]
        let pair = palettes[hash % palettes.count]
        return LinearGradient(colors: pair, startPoint: .topLeading, endPoint: .bottomTrailing)
    }
}

// MARK: - Channel Logo Card (for shelves)

struct ChannelLogoCard: View {
    let channel: Channel
    let onPlay: () -> Void
    @Environment(\.isFocused) var isFocused

    var body: some View {
        Button(action: onPlay) {
            VStack(spacing: 10) {
                // Logo container
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color.white.opacity(0.06))
                        .frame(width: 160, height: 100)

                    if let logoURL = channel.logoURL, let url = URL(string: logoURL) {
                        AsyncImage(url: url) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 100, height: 60)
                        } placeholder: {
                            channelNumberLabel
                        }
                    } else {
                        channelNumberLabel
                    }

                    // HD badge
                    if channel.isHD {
                        VStack {
                            HStack {
                                Spacer()
                                Text("HD")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundColor(.white.opacity(0.6))
                                    .padding(.horizontal, 4)
                                    .padding(.vertical, 2)
                                    .background(Color.white.opacity(0.12))
                                    .cornerRadius(3)
                            }
                            Spacer()
                        }
                        .padding(8)
                        .frame(width: 160, height: 100)
                    }

                    // Live dot
                    VStack {
                        HStack {
                            Circle().fill(Color.red).frame(width: 6, height: 6)
                            Spacer()
                        }
                        Spacer()
                    }
                    .padding(10)
                    .frame(width: 160, height: 100)
                }

                // Channel name
                Text(channel.name)
                    .font(.caption.weight(.medium))
                    .foregroundColor(.white.opacity(0.8))
                    .lineLimit(1)
                    .frame(width: 160)

                // Current program
                if let prog = channel.currentProgram {
                    Text(prog.title)
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.4))
                        .lineLimit(1)
                        .frame(width: 160)
                } else {
                    Text("Canal \(channel.displayNumber)")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.3))
                        .frame(width: 160)
                }
            }
        }
        .buttonStyle(.card)
    }

    private var channelNumberLabel: some View {
        Text(channel.displayNumber)
            .font(.system(size: 28, weight: .bold, design: .monospaced))
            .foregroundColor(.flowCyan)
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

// MARK: - Featured Hero (legacy - kept for VOD)

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

// MARK: - Live Channel Pill (kept for backward compat)

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
