import SwiftUI

struct SearchView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @State private var searchText = ""
    @State private var results: SearchResults?
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            VStack(spacing: 30) {
                // Search bar
                HStack(spacing: 16) {
                    Image(systemName: "magnifyingglass")
                        .font(.title2)
                        .foregroundColor(.gray)

                    TextField("Buscar canales, películas, series...", text: $searchText)
                        .font(.title3)
                        .textFieldStyle(.plain)
                        .autocorrectionDisabled()

                    if !searchText.isEmpty {
                        Button(action: {
                            searchText = ""
                            results = nil
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.gray)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(20)
                .background(Color.white.opacity(0.1))
                .cornerRadius(16)
                .padding(.horizontal, 50)

                // Results
                ScrollView {
                    if isSearching {
                        ProgressView()
                            .scaleEffect(1.5)
                            .tint(.cyan)
                            .padding(.top, 60)
                    } else if let results {
                        VStack(alignment: .leading, spacing: 40) {
                            // Channel results
                            if !results.channels.isEmpty {
                                ContentRowView(title: "Canales", icon: "tv.fill") {
                                    ScrollView(.horizontal, showsIndicators: false) {
                                        LazyHStack(spacing: 20) {
                                            ForEach(results.channels) { channel in
                                                ChannelQuickCard(channel: channel)
                                            }
                                        }
                                        .padding(.horizontal, 50)
                                    }
                                }
                            }

                            // VOD results
                            if !results.vod.isEmpty {
                                ContentRowView(title: "Películas y Series", icon: "play.rectangle.fill") {
                                    ScrollView(.horizontal, showsIndicators: false) {
                                        LazyHStack(spacing: 25) {
                                            ForEach(results.vod) { content in
                                                NavigationLink(value: content) {
                                                    VODCard(content: content)
                                                }
                                                .buttonStyle(.card)
                                            }
                                        }
                                        .padding(.horizontal, 50)
                                    }
                                }
                            }

                            if results.channels.isEmpty && results.vod.isEmpty {
                                VStack(spacing: 16) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.system(size: 50))
                                        .foregroundColor(.gray)
                                    Text("No se encontraron resultados para \"\(searchText)\"")
                                        .font(.title3)
                                        .foregroundColor(.gray)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.top, 60)
                            }
                        }
                    } else if searchText.isEmpty {
                        // Suggestions
                        VStack(spacing: 30) {
                            Text("Búsquedas populares")
                                .font(.title3.weight(.semibold))
                                .foregroundColor(.white)
                                .padding(.top, 40)

                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: 200, maximum: 250), spacing: 15)],
                                spacing: 15
                            ) {
                                ForEach(popularSearches, id: \.self) { term in
                                    Button(action: {
                                        searchText = term
                                        performSearch()
                                    }) {
                                        Text(term)
                                            .font(.callout)
                                            .padding(.horizontal, 20)
                                            .padding(.vertical, 12)
                                            .frame(maxWidth: .infinity)
                                            .background(Color.white.opacity(0.1))
                                            .foregroundColor(.white)
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
            .onChange(of: searchText) { _, newValue in
                searchTask?.cancel()
                guard !newValue.isEmpty else {
                    results = nil
                    return
                }
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
        "Fútbol", "Noticias", "Películas argentinas",
        "Series", "Disney", "ESPN", "HBO",
        "Documentales", "Comedia", "Drama"
    ]
}
