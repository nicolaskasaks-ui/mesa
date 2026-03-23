import Foundation

struct Channel: Identifiable, Codable, Hashable {
    let id: String
    let number: Int
    let name: String
    let logoURL: String?
    let category: ChannelCategory
    let isHD: Bool
    let streamURL: String?
    let currentProgram: Program?
    let nextProgram: Program?

    var displayNumber: String {
        String(format: "%03d", number)
    }
}

struct Program: Identifiable, Codable, Hashable {
    let id: String
    let title: String
    let description: String?
    let startTime: Date
    let endTime: Date
    let imageURL: String?
    let rating: String?
    let genre: String?

    var progress: Double {
        let now = Date()
        let total = endTime.timeIntervalSince(startTime)
        let elapsed = now.timeIntervalSince(startTime)
        guard total > 0 else { return 0 }
        return min(max(elapsed / total, 0), 1)
    }

    var timeRangeText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return "\(formatter.string(from: startTime)) - \(formatter.string(from: endTime))"
    }
}

enum ChannelCategory: String, Codable, CaseIterable {
    case todos = "Todos"
    case noticias = "Noticias"
    case deportes = "Deportes"
    case peliculas = "Películas"
    case series = "Series"
    case infantil = "Infantil"
    case musica = "Música"
    case documentales = "Documentales"
    case entretenimiento = "Entretenimiento"
    case adultos = "Adultos"
}
