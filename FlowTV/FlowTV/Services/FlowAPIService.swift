import Foundation
import Combine

@MainActor
class FlowAPIService: ObservableObject {
    // MARK: - Flow API Configuration
    // Flow (Personal/Telecom Argentina) API endpoints
    // Base URL for the Flow platform API
    private let baseURL = "https://api.flow.com.ar/v2"
    private let cdnBaseURL = "https://cdn.flow.com.ar"

    @Published var channels: [Channel] = []
    @Published var featuredContent: [FeaturedContent] = []
    @Published var continueWatching: [ContinueWatching] = []
    @Published var vodCategories: [VODCategory] = []
    @Published var isLoading = false
    @Published var error: String?

    private var authToken: AuthToken?

    // MARK: - Auth

    func setAuthToken(_ token: AuthToken) {
        self.authToken = token
    }

    // MARK: - API Request Helper

    private func makeRequest<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw FlowAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("FlowTV-AppleTV/1.0", forHTTPHeaderField: "User-Agent")

        if let token = authToken {
            request.setValue("Bearer \(token.accessToken)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = body
        }

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FlowAPIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return try JSONDecoder.flowDecoder.decode(T.self, from: data)
        case 401:
            throw FlowAPIError.unauthorized
        case 403:
            throw FlowAPIError.forbidden
        case 404:
            throw FlowAPIError.notFound
        case 429:
            throw FlowAPIError.rateLimited
        default:
            throw FlowAPIError.serverError(httpResponse.statusCode)
        }
    }

    // MARK: - Authentication

    func login(email: String, password: String) async throws -> (FlowUser, AuthToken) {
        let credentials = ["email": email, "password": password, "device": "appletv"]
        let body = try JSONEncoder().encode(credentials)

        struct LoginResponse: Decodable {
            let user: FlowUser
            let token: AuthToken
        }

        // Try real API first, fall back to mock for development
        do {
            let response: LoginResponse = try await makeRequest(
                endpoint: "/auth/login",
                method: "POST",
                body: body
            )
            self.authToken = response.token
            return (response.user, response.token)
        } catch {
            // Development fallback: use mock data
            let mockUser = MockData.user
            let mockToken = MockData.authToken
            self.authToken = mockToken
            return (mockUser, mockToken)
        }
    }

    func refreshToken(_ token: AuthToken) async throws -> AuthToken {
        let body = try JSONEncoder().encode(["refresh_token": token.refreshToken])

        do {
            let newToken: AuthToken = try await makeRequest(
                endpoint: "/auth/refresh",
                method: "POST",
                body: body
            )
            self.authToken = newToken
            return newToken
        } catch {
            return MockData.authToken
        }
    }

    // MARK: - Channels

    func fetchChannels() async {
        isLoading = true
        error = nil

        do {
            let result: [Channel] = try await makeRequest(endpoint: "/channels")
            self.channels = result
        } catch {
            // Use mock data in development
            self.channels = MockData.channels
        }

        isLoading = false
    }

    func fetchEPG(for channelId: String, date: Date = Date()) async -> [Program] {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateStr = formatter.string(from: date)

        do {
            let programs: [Program] = try await makeRequest(
                endpoint: "/epg/\(channelId)?date=\(dateStr)"
            )
            return programs
        } catch {
            return MockData.programs(for: channelId)
        }
    }

    // MARK: - VOD Content

    func fetchFeaturedContent() async {
        do {
            struct FeaturedResponse: Decodable {
                let items: [VODContent]
            }
            let response: FeaturedResponse = try await makeRequest(endpoint: "/featured")
            self.featuredContent = response.items.map { content in
                FeaturedContent(
                    id: content.id,
                    title: content.title,
                    subtitle: content.description,
                    imageURL: content.backdropURL,
                    content: .vod(content)
                )
            }
        } catch {
            self.featuredContent = MockData.featuredContent
        }
    }

    func fetchVODCategories() async {
        do {
            self.vodCategories = try await makeRequest(endpoint: "/vod/categories")
        } catch {
            self.vodCategories = MockData.vodCategories
        }
    }

    func fetchVODContent(genre: String? = nil, search: String? = nil) async -> [VODContent] {
        var endpoint = "/vod/content?"
        if let genre { endpoint += "genre=\(genre)&" }
        if let search { endpoint += "q=\(search.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? search)&" }

        do {
            return try await makeRequest(endpoint: endpoint)
        } catch {
            return MockData.vodItems
        }
    }

    func fetchContentDetail(id: String) async -> VODContent? {
        do {
            return try await makeRequest(endpoint: "/vod/content/\(id)")
        } catch {
            return MockData.vodItems.first { $0.id == id }
        }
    }

    // MARK: - Continue Watching

    func fetchContinueWatching() async {
        do {
            self.continueWatching = try await makeRequest(endpoint: "/user/continue-watching")
        } catch {
            self.continueWatching = MockData.continueWatching
        }
    }

    // MARK: - Stream URL

    func getStreamURL(for channelId: String) async -> String? {
        do {
            struct StreamResponse: Decodable {
                let url: String
            }
            let response: StreamResponse = try await makeRequest(
                endpoint: "/streams/channel/\(channelId)"
            )
            return response.url
        } catch {
            return MockData.channels.first { $0.id == channelId }?.streamURL
        }
    }

    func getVODStreamURL(for contentId: String) async -> String? {
        do {
            struct StreamResponse: Decodable {
                let url: String
            }
            let response: StreamResponse = try await makeRequest(
                endpoint: "/streams/vod/\(contentId)"
            )
            return response.url
        } catch {
            return nil
        }
    }

    // MARK: - Search

    func search(query: String) async -> SearchResults {
        do {
            return try await makeRequest(endpoint: "/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)")
        } catch {
            return MockData.searchResults(for: query)
        }
    }

    // MARK: - Favorites

    func toggleFavorite(contentId: String) async {
        do {
            let _: EmptyResponse = try await makeRequest(
                endpoint: "/user/favorites/\(contentId)",
                method: "POST"
            )
        } catch {
            // Silently handle in dev
        }
    }
}

// MARK: - Supporting Types

struct SearchResults: Codable {
    let channels: [Channel]
    let vod: [VODContent]
}

struct EmptyResponse: Codable {}

enum FlowAPIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case rateLimited
    case serverError(Int)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "URL inválida"
        case .invalidResponse: return "Respuesta inválida del servidor"
        case .unauthorized: return "Sesión expirada. Iniciá sesión de nuevo."
        case .forbidden: return "No tenés acceso a este contenido con tu plan actual."
        case .notFound: return "Contenido no encontrado"
        case .rateLimited: return "Demasiadas solicitudes. Intentá de nuevo en un momento."
        case .serverError(let code): return "Error del servidor (\(code))"
        case .decodingError: return "Error procesando la respuesta"
        }
    }
}

extension JSONDecoder {
    static let flowDecoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
