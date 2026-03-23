import SwiftUI

struct LiveTVView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @State private var selectedCategory: ChannelCategory = .todos
    @State private var selectedChannel: Channel?
    @State private var showPlayer = false
    @FocusState private var focusedChannelId: String?

    var filteredChannels: [Channel] {
        if selectedCategory == .todos {
            return flowAPI.channels.sorted { $0.number < $1.number }
        }
        return flowAPI.channels
            .filter { $0.category == selectedCategory }
            .sorted { $0.number < $1.number }
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                // Category sidebar — Apple TV style
                VStack(alignment: .leading, spacing: 4) {
                    Text("Categorías")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(Color.white.opacity(0.3))
                        .padding(.horizontal, 24)
                        .padding(.top, 20)
                        .padding(.bottom, 8)

                    ScrollView(.vertical, showsIndicators: false) {
                        VStack(spacing: 2) {
                            ForEach(ChannelCategory.allCases, id: \.self) { category in
                                CategoryButton(
                                    title: category.rawValue,
                                    icon: categoryIcon(category),
                                    count: channelCount(category),
                                    isSelected: selectedCategory == category
                                ) {
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        selectedCategory = category
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, 12)
                    }
                }
                .frame(width: 260)
                .background(Color.white.opacity(0.04))

                // Channel list
                ScrollView {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 360, maximum: 440), spacing: 20)],
                        spacing: 16
                    ) {
                        ForEach(filteredChannels) { channel in
                            ChannelListCard(channel: channel)
                                .focusable()
                                .focused($focusedChannelId, equals: channel.id)
                                .onTapGesture {
                                    selectedChannel = channel
                                    showPlayer = true
                                }
                        }
                    }
                    .padding(36)
                }
            }
            .navigationTitle("TV en Vivo")
            .fullScreenCover(isPresented: $showPlayer) {
                if let channel = selectedChannel {
                    PlayerView(
                        title: channel.name,
                        subtitle: channel.currentProgram?.title,
                        isLive: true,
                        streamURL: channel.streamURL,
                        contentId: channel.id,
                        contentType: .tvChannel
                    )
                }
            }
        }
        .task {
            if flowAPI.channels.isEmpty {
                await flowAPI.fetchChannels()
            }
        }
    }

    private func channelCount(_ category: ChannelCategory) -> Int {
        if category == .todos { return flowAPI.channels.count }
        return flowAPI.channels.filter { $0.category == category }.count
    }

    private func categoryIcon(_ category: ChannelCategory) -> String {
        switch category {
        case .todos: return "rectangle.grid.2x2"
        case .noticias: return "newspaper"
        case .deportes: return "sportscourt"
        case .peliculas: return "film"
        case .series: return "tv"
        case .infantil: return "figure.child"
        case .musica: return "music.note"
        case .documentales: return "doc.text.magnifyingglass"
        case .entretenimiento: return "star"
        case .adultos: return "lock.fill"
        }
    }
}

// MARK: - Category Button

struct CategoryButton: View {
    let title: String
    let icon: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void
    @Environment(\.isFocused) var isFocused

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.caption)
                    .frame(width: 22)
                    .foregroundColor(isSelected ? .white : Color.white.opacity(0.5))

                Text(title)
                    .font(.callout.weight(isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? .white : Color.white.opacity(0.7))

                Spacer()

                Text("\(count)")
                    .font(.caption2)
                    .foregroundColor(Color.white.opacity(0.3))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Color.white.opacity(0.12) : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Channel List Card (tvOS style)

struct ChannelListCard: View {
    let channel: Channel
    @Environment(\.isFocused) var isFocused

    var body: some View {
        HStack(spacing: 16) {
            // Channel logo / number
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.white.opacity(0.08))
                    .frame(width: 64, height: 64)

                if let logoURL = channel.logoURL,
                   let url = FlowAPIService.imageURL(path: logoURL) {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fit)
                    } placeholder: {
                        Text(channel.displayNumber)
                            .font(.system(size: 20, weight: .bold, design: .monospaced))
                            .foregroundColor(.cyan)
                    }
                    .frame(width: 48, height: 48)
                } else {
                    Text(channel.displayNumber)
                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                        .foregroundColor(.cyan)
                }
            }

            // Channel info
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(channel.name)
                        .font(.callout.weight(.semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    if channel.isHD {
                        Text("HD")
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.white.opacity(0.6))
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.12))
                            .cornerRadius(3)
                    }
                }

                if let program = channel.currentProgram {
                    Text(program.title)
                        .font(.caption)
                        .foregroundColor(Color.white.opacity(0.45))
                        .lineLimit(1)

                    // Progress
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color.white.opacity(0.1))
                            Capsule().fill(Color.white.opacity(0.5))
                                .frame(width: geo.size.width * program.progress)
                        }
                    }
                    .frame(height: 2)
                }
            }

            Spacer()

            // Live badge
            HStack(spacing: 4) {
                Circle().fill(Color.red).frame(width: 6, height: 6)
                Text("VIVO")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(Color.red.opacity(0.9))
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white.opacity(isFocused ? 0.12 : 0.04))
        )
        .scaleEffect(isFocused ? 1.03 : 1.0)
        .shadow(
            color: .black.opacity(isFocused ? 0.4 : 0),
            radius: isFocused ? 12 : 0,
            y: isFocused ? 8 : 0
        )
        .animation(.easeInOut(duration: 0.2), value: isFocused)
    }
}
