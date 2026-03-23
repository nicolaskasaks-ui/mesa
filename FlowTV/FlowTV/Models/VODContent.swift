import Foundation

struct VODContent: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let originalTitle: String?
    let description: String?
    let year: Int?
    let duration: Int? // minutes
    let rating: String?
    let genre: [String]
    let posterURL: String?
    let backdropURL: String?
    let streamURL: String?
    let contentType: ContentType
    let seasons: [Season]?
    let isFavorite: Bool

    var durationText: String? {
        guard let duration else { return nil }
        let hours = duration / 60
        let mins = duration % 60
        if hours > 0 {
            return "\(hours)h \(mins)min"
        }
        return "\(mins) min"
    }

    var genreText: String {
        genre.joined(separator: " · ")
    }
}

enum ContentType: String, Codable {
    case movie = "movie"
    case series = "series"
    case documentary = "documentary"
}

struct Season: Identifiable, Codable, Hashable {
    let id: String
    let number: Int
    let episodes: [Episode]
}

struct Episode: Identifiable, Codable, Hashable {
    let id: String
    let number: Int
    let title: String
    let description: String?
    let duration: Int?
    let imageURL: String?
    let streamURL: String?

    var durationText: String? {
        guard let duration else { return nil }
        return "\(duration) min"
    }
}

struct VODCategory: Identifiable {
    let id: String
    let name: String
    let items: [VODContent]
}

enum VODGenre: String, CaseIterable {
    case todos = "Todos"
    case accion = "Acción"
    case comedia = "Comedia"
    case drama = "Drama"
    case terror = "Terror"
    case romance = "Romance"
    case cienciaFiccion = "Ciencia Ficción"
    case animacion = "Animación"
    case documental = "Documental"
    case thriller = "Thriller"
}
