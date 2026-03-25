import SwiftUI

struct LiveTVView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @EnvironmentObject var csdkBridge: CSDKBridge
    @EnvironmentObject var m11Service: FlowM11Service
    @State private var selectedCategory: ChannelCategory = .todos
    @State private var selectedChannel: Channel?
    @State private var showPlayer = false
    @FocusState private var focusedChannelId: String?

    /// Use M11 channels when available, then CSDK, then FlowAPI.
    private var allChannels: [Channel] {
        if m11Service.isReady && !m11Service.channels.isEmpty {
            return m11Service.channels
        }
        if csdkBridge.isReady && !csdkBridge.channels.isEmpty {
            return csdkBridge.channels.map { $0.toChannel() }
        }
        return flowAPI.channels
    }

    var filteredChannels: [Channel] {
        let source = allChannels
        if selectedCategory == .todos {
            return source.sorted { $0.number < $1.number }
        }
        return source
            .filter { $0.category == selectedCategory }
            .sorted { $0.number < $1.number }
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                // Category sidebar
                VStack(alignment: .leading, spacing: 4) {
                    // Header with channel count
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Categorias")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(Color.white.opacity(0.3))

                        Text("\(allChannels.count) canales")
                            .font(.system(size: 11))
                            .foregroundColor(Color.flowCyan.opacity(0.6))
                    }
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

                    // EPG loading indicator
                    if m11Service.isLoadingEPG {
                        HStack(spacing: 6) {
                            ProgressView()
                                .scaleEffect(0.5)
                            Text("Cargando guia...")
                                .font(.system(size: 10))
                                .foregroundColor(.white.opacity(0.3))
                        }
                        .padding(.horizontal, 24)
                        .padding(.bottom, 12)
                    }
                }
                .frame(width: 260)
                .background(Color.white.opacity(0.04))

                // Channel grid
                ScrollView {
                    LazyVGrid(
                        columns: [GridItem(.adaptive(minimum: 380, maximum: 460), spacing: 20)],
                        spacing: 16
                    ) {
                        ForEach(filteredChannels) { channel in
                            Button {
                                selectedChannel = channel
                                showPlayer = true
                            } label: {
                                ChannelListCard(channel: channel)
                            }
                            .buttonStyle(.plain)
                            .focused($focusedChannelId, equals: channel.id)
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
                        streamURL: "http://localhost:8772/hls/\(channel.id)/stream.m3u8",
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
        let source = allChannels
        if category == .todos { return source.count }
        return source.filter { $0.category == category }.count
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
                    .foregroundColor(isSelected ? .flowCyan : Color.white.opacity(0.5))

                Text(title)
                    .font(.callout.weight(isSelected ? .semibold : .regular))
                    .foregroundColor(isSelected ? .white : Color.white.opacity(0.7))

                Spacer()

                Text("\(count)")
                    .font(.caption2)
                    .foregroundColor(isSelected ? .flowCyan.opacity(0.7) : Color.white.opacity(0.3))
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

// MARK: - Channel List Card (tvOS style with logo + EPG)

struct ChannelListCard: View {
    let channel: Channel
    @Environment(\.isFocused) var isFocused

    var body: some View {
        HStack(spacing: 16) {
            // Channel logo / number
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.06))
                    .frame(width: 72, height: 72)

                if let logoURL = channel.logoURL, let url = URL(string: logoURL) {
                    AsyncImage(url: url) { image in
                        image.resizable().aspectRatio(contentMode: .fit)
                    } placeholder: {
                        Text(channel.displayNumber)
                            .font(.system(size: 22, weight: .bold, design: .monospaced))
                            .foregroundColor(.flowCyan)
                    }
                    .frame(width: 52, height: 52)
                } else {
                    Text(channel.displayNumber)
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundColor(.flowCyan)
                }
            }

            // Channel info
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    Text(channel.displayNumber)
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundColor(.flowCyan.opacity(0.7))

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
                        .foregroundColor(Color.white.opacity(0.5))
                        .lineLimit(1)

                    HStack(spacing: 8) {
                        // Time range
                        Text(program.timeRangeText)
                            .font(.system(size: 10))
                            .foregroundColor(Color.white.opacity(0.3))

                        // Progress bar
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.white.opacity(0.1))
                                Capsule().fill(Color.flowCyan.opacity(0.7))
                                    .frame(width: geo.size.width * program.progress)
                            }
                        }
                        .frame(height: 2)
                    }
                } else {
                    Text(channel.category.rawValue)
                        .font(.caption)
                        .foregroundColor(Color.white.opacity(0.3))
                }
            }

            Spacer()

            // EN VIVO badge
            VStack(spacing: 4) {
                Circle().fill(Color.red).frame(width: 7, height: 7)
                Text("EN VIVO")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundColor(Color.red.opacity(0.8))
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.white.opacity(isFocused ? 0.12 : 0.04))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(isFocused ? Color.flowCyan.opacity(0.3) : Color.clear, lineWidth: 1)
                )
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
