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
                // Filter chips — Apple TV style horizontal scroll
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        // Type filters
                        ChipButton("Todo", isActive: contentTypeFilter == nil) {
                            contentTypeFilter = nil
                        }
                        ChipButton("Películas", isActive: contentTypeFilter == .movie) {
                            contentTypeFilter = .movie
                        }
                        ChipButton("Series", isActive: contentTypeFilter == .series) {
                            contentTypeFilter = .series
                        }

                        Rectangle()
                            .fill(Color.white.opacity(0.15))
                            .frame(width: 1, height: 24)
                            .padding(.horizontal, 4)

                        ForEach(VODGenre.allCases, id: \.self) { genre in
                            ChipButton(genre.rawValue, isActive: selectedGenre == genre) {
                                selectedGenre = genre
                            }
                        }
                    }
                    .padding(.horizontal, 60)
                    .padding(.vertical, 16)
                }

                // Content grid
                ScrollView {
                    if filteredContent.isEmpty {
                        VStack(spacing: 16) {
                            Image(systemName: "film.stack")
                                .font(.system(size: 48))
                                .foregroundColor(Color.white.opacity(0.2))
                            Text("No hay contenido disponible")
                                .font(.callout)
                                .foregroundColor(Color.white.opacity(0.3))
                        }
                        .frame(maxWidth: .infinity, minHeight: 400)
                    } else {
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 220, maximum: 260), spacing: 28)],
                            spacing: 36
                        ) {
                            ForEach(filteredContent) { content in
                                NavigationLink(value: content) {
                                    PosterCard(content: content)
                                }
                                .buttonStyle(TVCardButtonStyle())
                            }
                        }
                        .padding(48)
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

// MARK: - Chip Button (tvOS filter pill)

struct ChipButton: View {
    let title: String
    let isActive: Bool
    let action: () -> Void
    @Environment(\.isFocused) var isFocused

    init(_ title: String, isActive: Bool, action: @escaping () -> Void) {
        self.title = title
        self.isActive = isActive
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(isActive ? .semibold : .regular))
                .foregroundColor(isActive ? .white : Color.white.opacity(0.6))
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(
                    Capsule()
                        .fill(isActive ? Color.white.opacity(0.18) : Color.white.opacity(0.06))
                )
        }
        .buttonStyle(.plain)
        .scaleEffect(isFocused ? 1.08 : 1.0)
        .animation(.easeInOut(duration: 0.15), value: isFocused)
    }
}
