import SwiftUI

struct LiveTVView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @State private var selectedCategory: ChannelCategory = .todos
    @State private var selectedChannel: Channel?
    @State private var showPlayer = false

    var filteredChannels: [Channel] {
        if selectedCategory == .todos {
            return flowAPI.channels
        }
        return flowAPI.channels.filter { $0.category == selectedCategory }
    }

    var body: some View {
        NavigationStack {
            HStack(spacing: 0) {
                // Category sidebar
                ScrollView {
                    VStack(spacing: 5) {
                        ForEach(ChannelCategory.allCases, id: \.self) { category in
                            Button(action: {
                                selectedCategory = category
                            }) {
                                HStack {
                                    Image(systemName: categoryIcon(category))
                                        .frame(width: 30)
                                    Text(category.rawValue)
                                        .font(.callout)
                                    Spacer()
                                    Text("\(channelCount(category))")
                                        .font(.caption)
                                        .foregroundColor(.gray)
                                }
                                .padding(.horizontal, 20)
                                .padding(.vertical, 12)
                                .background(
                                    selectedCategory == category
                                        ? Color.cyan.opacity(0.2)
                                        : Color.clear
                                )
                                .cornerRadius(8)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding()
                }
                .frame(width: 280)
                .background(Color.black.opacity(0.3))

                // Channel grid
                ScrollView {
                    LazyVGrid(
                        columns: [
                            GridItem(.adaptive(minimum: 300, maximum: 400), spacing: 25)
                        ],
                        spacing: 25
                    ) {
                        ForEach(filteredChannels) { channel in
                            ChannelCard(channel: channel)
                                .onTapGesture {
                                    selectedChannel = channel
                                    showPlayer = true
                                }
                        }
                    }
                    .padding(40)
                }
            }
            .navigationTitle("TV en Vivo")
            .fullScreenCover(isPresented: $showPlayer) {
                if let channel = selectedChannel {
                    PlayerView(
                        title: channel.name,
                        subtitle: channel.currentProgram?.title,
                        streamURL: channel.streamURL,
                        isLive: true
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

// MARK: - Channel Card

struct ChannelCard: View {
    let channel: Channel

    var body: some View {
        Button(action: {}) {
            HStack(spacing: 16) {
                // Channel number + logo
                VStack {
                    Text(channel.displayNumber)
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundColor(.cyan)

                    if channel.isHD {
                        Text("HD")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.cyan)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.cyan.opacity(0.2))
                            .cornerRadius(4)
                    }
                }
                .frame(width: 70)

                // Channel info
                VStack(alignment: .leading, spacing: 6) {
                    Text(channel.name)
                        .font(.headline)
                        .foregroundColor(.white)
                        .lineLimit(1)

                    if let program = channel.currentProgram {
                        Text(program.title)
                            .font(.subheadline)
                            .foregroundColor(.gray)
                            .lineLimit(1)

                        // Progress bar
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color.white.opacity(0.2))
                                    .frame(height: 3)
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color.cyan)
                                    .frame(width: geo.size.width * program.progress, height: 3)
                            }
                        }
                        .frame(height: 3)

                        Text(program.timeRangeText)
                            .font(.caption2)
                            .foregroundColor(.gray.opacity(0.7))
                    }
                }

                Spacer()

                // Live indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                    Text("EN VIVO")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.red)
                }
            }
            .padding(16)
            .background(Color.white.opacity(0.05))
            .cornerRadius(12)
        }
        .buttonStyle(.card)
    }
}
