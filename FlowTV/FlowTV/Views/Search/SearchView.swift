import SwiftUI

struct SearchView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @State private var searchText = ""
    @State private var results: SearchResults?
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?
    @State private var showPlayer = false
    @State private var selectedChannel: Channel?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search field — Apple TV style
                HStack(spacing: 14) {
                    Image(systemName: "magnifyingglass")
                        .font(.title3)
                        .foregroundColor(Color.white.opacity(0.3))

                    TextField("Buscar canales, películas, series...", text: $searchText)
                        .font(.title3)
                        .autocorrectionDisabled()

                    if !searchText.isEmpty {
                        Button(action: { searchText = ""; results = nil }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(Color.white.opacity(0.3))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(22)
                .background(Color.white.opacity(0.06))
                .cornerRadius(18)
                .padding(.horizontal, 60)
                .padding(.top, 20)

                // Results area
                ScrollView {
                    if isSearching {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(1.2)
                            .padding(.top, 80)
                    } else if let results {
                        VStack(alignment: .leading, spacing: 40) {
                            if !results.channels.isEmpty {
                                ShelfRow(title: "Canales") {
                                    ForEach(results.channels) { channel in
                                        LiveChannelPill(channel: channel) {
                                            selectedChannel = channel
                                            showPlayer = true
                                        }
                                    }
                                }
                            }

                            if !results.vod.isEmpty {
                                ShelfRow(title: "Películas y Series") {
                                    ForEach(results.vod) { content in
                                        NavigationLink(value: content) {
                                            PosterCard(content: content)
                                        }
                                        .buttonStyle(.card)
                                    }
                                }
                            }

                            if results.channels.isEmpty && results.vod.isEmpty {
                                VStack(spacing: 14) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.system(size: 40))
                                        .foregroundColor(Color.white.opacity(0.15))
                                    Text("Sin resultados para \"\(searchText)\"")
                                        .font(.callout)
                                        .foregroundColor(Color.white.opacity(0.3))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.top, 80)
                            }
                        }
                        .padding(.top, 20)
                    } else if searchText.isEmpty {
                        // Popular suggestions
                        VStack(spacing: 24) {
                            Text("Sugerencias")
                                .font(.callout.weight(.semibold))
                                .foregroundColor(Color.white.opacity(0.4))
                                .padding(.top, 40)

                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: 180, maximum: 220), spacing: 12)],
                                spacing: 12
                            ) {
                                ForEach(popularSearches, id: \.self) { term in
                                    Button(action: { searchText = term; performSearch() }) {
                                        Text(term)
                                            .font(.caption.weight(.medium))
                                            .foregroundColor(Color.white.opacity(0.6))
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 14)
                                            .background(Color.white.opacity(0.06))
                                            .cornerRadius(10)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            .padding(.horizontal, 80)
                        }
                    }
                }
            }
            .navigationTitle("Buscar")
            .navigationDestination(for: VODContent.self) { content in
                ContentDetailView(content: content)
            }
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
            .onChange(of: searchText) { _, newValue in
                searchTask?.cancel()
                guard !newValue.isEmpty else { results = nil; return }
                searchTask = Task {
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    guard !Task.isCancelled else { return }
                    performSearch()
                }
            }
        }
    }

    private func performSearch() {
        guard !searchText.isEmpty else { return }
        isSearching = true
        Task {
            results = await flowAPI.search(query: searchText)
            isSearching = false
        }
    }

    private let popularSearches = [
        "Fútbol", "Noticias", "Cine argentino",
        "Series", "Disney", "ESPN", "HBO",
        "Documentales", "Comedia", "Drama"
    ]
}
