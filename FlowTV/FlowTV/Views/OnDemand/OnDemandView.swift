import SwiftUI

struct OnDemandView: View {
    @EnvironmentObject var flowAPI: FlowAPIService
    @State private var selectedGenre: VODGenre = .todos
    @State private var contentTypeFilter: ContentType? = nil
    @State private var allContent: [VODContent] = []

    var filteredContent: [VODContent] {
        var items = allContent
        if selectedGenre != .todos {
            items = items.filter { $0.genre.contains(selectedGenre.rawValue) }
        }
        if let typeFilter = contentTypeFilter {
            items = items.filter { $0.contentType == typeFilter }
        }
        return items
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filter bar
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 15) {
                        // Content type filters
                        FilterPill(title: "Todo", isSelected: contentTypeFilter == nil) {
                            contentTypeFilter = nil
                        }
                        FilterPill(title: "Películas", isSelected: contentTypeFilter == .movie) {
                            contentTypeFilter = .movie
                        }
                        FilterPill(title: "Series", isSelected: contentTypeFilter == .series) {
                            contentTypeFilter = .series
                        }

                        Divider()
                            .frame(height: 30)
                            .background(Color.gray.opacity(0.3))

                        // Genre filters
                        ForEach(VODGenre.allCases, id: \.self) { genre in
                            FilterPill(
                                title: genre.rawValue,
                                isSelected: selectedGenre == genre
                            ) {
                                selectedGenre = genre
                            }
                        }
                    }
                    .padding(.horizontal, 50)
                    .padding(.vertical, 20)
                }

                // Content grid
                ScrollView {
                    if filteredContent.isEmpty {
                        VStack(spacing: 20) {
                            Image(systemName: "film.stack")
                                .font(.system(size: 60))
                                .foregroundColor(.gray)
                            Text("No hay contenido disponible")
                                .font(.title3)
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity, minHeight: 400)
                    } else {
                        LazyVGrid(
                            columns: [
                                GridItem(.adaptive(minimum: 250, maximum: 300), spacing: 30)
                            ],
                            spacing: 30
                        ) {
                            ForEach(filteredContent) { content in
                                NavigationLink(value: content) {
                                    VODCard(content: content)
                                }
                                .buttonStyle(.card)
                            }
                        }
                        .padding(40)
                    }
                }
            }
            .navigationTitle("On Demand")
            .navigationDestination(for: VODContent.self) { content in
                ContentDetailView(content: content)
            }
        }
        .task {
            allContent = await flowAPI.fetchVODContent()
        }
    }
}

// MARK: - Filter Pill

struct FilterPill: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(isSelected ? .semibold : .regular))
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(
                    isSelected
                        ? Color.cyan.opacity(0.3)
                        : Color.white.opacity(0.1)
                )
                .foregroundColor(isSelected ? .cyan : .white)
                .cornerRadius(20)
        }
        .buttonStyle(.plain)
    }
}
