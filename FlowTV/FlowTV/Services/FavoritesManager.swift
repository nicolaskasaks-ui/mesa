import Foundation

/// Persists user favorites ("Mi Lista") in UserDefaults.
@MainActor
class FavoritesManager: ObservableObject {

    @Published private(set) var favoriteIDs: Set<String> = []

    private let storageKey = "com.flowtv.favorites"

    init() {
        load()
    }

    func isFavorite(_ id: String) -> Bool {
        favoriteIDs.contains(id)
    }

    func toggle(_ id: String) {
        if favoriteIDs.contains(id) {
            favoriteIDs.remove(id)
        } else {
            favoriteIDs.insert(id)
        }
        save()
    }

    private func load() {
        if let array = UserDefaults.standard.stringArray(forKey: storageKey) {
            favoriteIDs = Set(array)
        }
    }

    private func save() {
        UserDefaults.standard.set(Array(favoriteIDs), forKey: storageKey)
    }
}
