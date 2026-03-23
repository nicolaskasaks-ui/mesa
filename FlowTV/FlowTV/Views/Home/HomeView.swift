import SwiftUI

struct HomeView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @State private var selectedFeatured: FeaturedContent?
    @State private var navigateToPlayer = false
    @State private var selectedContent: VODContent?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 40) {
                    // Hero carousel
                    FeaturedCarouselView(
                        items: flowAPI.featuredContent,
                        onSelect: { item in
                            selectedFeatured = item
                        }
                    )

                    // Continue watching
                    if !flowAPI.continueWatching.isEmpty {
                        ContentRowView(
                            title: "Seguir Viendo",
                            icon: "play.circle.fill"
                        ) {
                            ScrollView(.horizontal, showsIndicators: false) {
                                LazyHStack(spacing: 30) {
                                    ForEach(flowAPI.continueWatching) { item in
                                        ContinueWatchingCard(item: item)
                                    }
                                }
                                .padding(.horizontal, 50)
                            }
                        }
                    }

                    // VOD Categories
                    ForEach(flowAPI.vodCategories) { category in
                        ContentRowView(title: category.name) {
                            ScrollView(.horizontal, showsIndicators: false) {
                                LazyHStack(spacing: 30) {
                                    ForEach(category.items) { item in
                                        NavigationLink(value: item) {
                                            VODCard(content: item)
                                        }
                                        .buttonStyle(.card)
                                    }
                                }
                                .padding(.horizontal, 50)
                            }
                        }
                    }

                    // Quick access to live channels
                    ContentRowView(
                        title: "Canales en Vivo",
                        icon: "antenna.radiowaves.left.and.right"
                    ) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            LazyHStack(spacing: 25) {
                                ForEach(Array(flowAPI.channels.prefix(10))) { channel in
                                    ChannelQuickCard(channel: channel)
                                }
                            }
                            .padding(.horizontal, 50)
                        }
                    }
                }
                .padding(.vertical, 20)
            }
            .navigationDestination(for: VODContent.self) { content in
                ContentDetailView(content: content)
            }
        }
        .task {
            await loadContent()
        }
    }

    private func loadContent() async {
        async let featured: () = flowAPI.fetchFeaturedContent()
        async let watching: () = flowAPI.fetchContinueWatching()
        async let categories: () = flowAPI.fetchVODCategories()
        async let channels: () = flowAPI.fetchChannels()

        _ = await (featured, watching, categories, channels)
    }
}

// MARK: - Content Row Container

struct ContentRowView<Content: View>: View {
    let title: String
    var icon: String? = nil
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack(spacing: 10) {
                if let icon {
                    Image(systemName: icon)
                        .foregroundColor(.cyan)
                }
                Text(title)
                    .font(.title2.weight(.bold))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 50)

            content()
        }
    }
}

// MARK: - Featured Carousel

struct FeaturedCarouselView: View {
    let items: [FeaturedContent]
    let onSelect: (FeaturedContent) -> Void
    @State private var currentIndex = 0

    var body: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                FeaturedCard(item: item)
                    .onTapGesture { onSelect(item) }
                    .tag(index)
            }
        }
        .tabViewStyle(.page)
        .frame(height: 500)
    }
}

struct FeaturedCard: View {
    let item: FeaturedContent

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            // Background
            LinearGradient(
                colors: [
                    Color(red: 0.1, green: 0.0, blue: 0.25),
                    Color(red: 0.05, green: 0.0, blue: 0.15)
                ],
                startPoint: .top,
                endPoint: .bottom
            )

            // Content overlay
            VStack(alignment: .leading, spacing: 12) {
                Spacer()

                Text(item.title)
                    .font(.system(size: 48, weight: .bold))
                    .foregroundColor(.white)

                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(.title3)
                        .foregroundColor(.gray)
                }

                HStack(spacing: 20) {
                    Button(action: {}) {
                        HStack {
                            Image(systemName: "play.fill")
                            Text("Reproducir")
                        }
                        .font(.headline)
                        .padding(.horizontal, 30)
                        .padding(.vertical, 12)
                        .background(Color.white)
                        .foregroundColor(.black)
                        .cornerRadius(8)
                    }

                    Button(action: {}) {
                        HStack {
                            Image(systemName: "info.circle")
                            Text("Más Info")
                        }
                        .font(.headline)
                        .padding(.horizontal, 30)
                        .padding(.vertical, 12)
                        .background(Color.white.opacity(0.2))
                        .foregroundColor(.white)
                        .cornerRadius(8)
                    }
                }
            }
            .padding(60)
        }
        .cornerRadius(20)
        .padding(.horizontal, 50)
    }
}

// MARK: - Continue Watching Card

struct ContinueWatchingCard: View {
    let item: ContinueWatching

    var body: some View {
        Button(action: {}) {
            VStack(alignment: .leading, spacing: 10) {
                ZStack(alignment: .bottomLeading) {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 350, height: 200)
                        .overlay(
                            Image(systemName: "play.circle.fill")
                                .font(.system(size: 50))
                                .foregroundColor(.white.opacity(0.8))
                        )

                    // Progress bar
                    GeometryReader { geo in
                        VStack {
                            Spacer()
                            ZStack(alignment: .leading) {
                                Rectangle()
                                    .fill(Color.white.opacity(0.3))
                                    .frame(height: 4)
                                Rectangle()
                                    .fill(Color.cyan)
                                    .frame(width: geo.size.width * item.progress, height: 4)
                            }
                        }
                    }
                    .frame(width: 350, height: 200)
                }

                Text(item.title)
                    .font(.callout.weight(.medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }
            .frame(width: 350)
        }
        .buttonStyle(.card)
    }
}

// MARK: - VOD Card

struct VODCard: View {
    let content: VODContent

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        LinearGradient(
                            colors: cardColors(for: content.title),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 250, height: 375)

                VStack(spacing: 8) {
                    Image(systemName: content.contentType == .series ? "tv" : "film")
                        .font(.system(size: 40))
                        .foregroundColor(.white.opacity(0.6))

                    Text(content.title)
                        .font(.headline)
                        .foregroundColor(.white)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                        .padding(.horizontal, 16)
                }
            }

            if let year = content.year {
                Text("\(year)")
                    .font(.caption)
                    .foregroundColor(.gray)
            }
        }
        .frame(width: 250)
    }

    private func cardColors(for title: String) -> [Color] {
        let hash = abs(title.hashValue)
        let colors: [[Color]] = [
            [Color(red: 0.2, green: 0.0, blue: 0.4), Color(red: 0.4, green: 0.0, blue: 0.2)],
            [Color(red: 0.0, green: 0.2, blue: 0.4), Color(red: 0.0, green: 0.4, blue: 0.3)],
            [Color(red: 0.3, green: 0.1, blue: 0.0), Color(red: 0.5, green: 0.2, blue: 0.0)],
            [Color(red: 0.1, green: 0.1, blue: 0.3), Color(red: 0.3, green: 0.1, blue: 0.4)],
            [Color(red: 0.0, green: 0.3, blue: 0.3), Color(red: 0.0, green: 0.2, blue: 0.4)],
        ]
        return colors[hash % colors.count]
    }
}

// MARK: - Channel Quick Card

struct ChannelQuickCard: View {
    let channel: Channel

    var body: some View {
        Button(action: {}) {
            VStack(spacing: 8) {
                Circle()
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 100, height: 100)
                    .overlay(
                        Text(channel.displayNumber)
                            .font(.title2.weight(.bold))
                            .foregroundColor(.cyan)
                    )

                Text(channel.name)
                    .font(.caption)
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .frame(width: 100)
            }
        }
        .buttonStyle(.card)
    }
}
