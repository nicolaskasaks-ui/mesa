import Foundation

struct FlowUser: Codable {
    let id: String
    let email: String
    let displayName: String
    let avatarURL: String?
    let plan: FlowPlan
    let maxStreams: Int
    let activeStreams: Int

    var canStream: Bool {
        activeStreams < maxStreams
    }
}

struct FlowPlan: Codable {
    let name: String
    let tier: PlanTier
    let hasHD: Bool
    let has4K: Bool
    let maxDevices: Int
}

enum PlanTier: String, Codable {
    case basico = "basico"
    case estandar = "estandar"
    case premium = "premium"
}

struct AuthToken: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date

    var isExpired: Bool {
        Date() >= expiresAt
    }
}

struct LoginCredentials {
    let email: String
    let password: String
}
