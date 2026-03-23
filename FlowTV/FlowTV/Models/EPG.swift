import Foundation

struct EPGEntry: Identifiable, Codable {
    let id: String
    let channelId: String
    let programs: [Program]
}

struct EPGTimeSlot: Identifiable {
    let id = UUID()
    let time: Date
    let programs: [(channel: Channel, program: Program)]
}

struct FeaturedContent: Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let imageURL: String?
    let content: FeaturedType
}

enum FeaturedType {
    case channel(Channel)
    case vod(VODContent)
    case liveEvent(Program)
}

struct ContinueWatching: Identifiable, Codable {
    let id: String
    let contentId: String
    let title: String
    let imageURL: String?
    let progress: Double // 0.0 - 1.0
    let streamURL: String?
    let lastWatched: Date
}
