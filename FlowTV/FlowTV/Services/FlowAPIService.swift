import Foundation
import Combine

/// Flow API Service - connects to the real Flow (Personal/Telecom Argentina) platform
/// Based on the Minerva OTT platform used by Telecom Argentina
/// API reverse-engineered from github.com/mariano-git/plugin.video.flow
@MainActor
class FlowAPIService: ObservableObject {
    // MARK: - Flow API Configuration (Real endpoints)
    nonisolated static let baseURL = "https://web.flow.com.ar"
    nonisolated static let imagesBaseURL = "https://static.flow.com.ar"
    nonisolated static let appBaseURL = "https://web.app.flow.com.ar"

    // API paths
    private let authPath = "/auth/v2"
    private let contentPath = "/api/v1/content"
    private let dynamicPath = "/api/v1/dynamic"

    // Device identification for API
    // Using WEB profile (same as Kodi plugin) — this is the known working configuration.
    // Flow's backend validates device type and rejects unknown profiles.
    private let apiVersion = "3.78.1"
    private let apiType = "CVA"
    private let deviceType = "WEB"
    private let deviceModel = "PC"
    private let deviceName = "FlowTV"
    private let platform = "WINDOWS"
    private let company = "flow"
    private let requestIdPrefix = "web"

    @Published var channels: [Channel] = []
    @Published var featuredContent: [FeaturedContent] = []
    @Published var continueWatching: [ContinueWatching] = []
    @Published var vodCategories: [VODCategory] = []
    @Published var isLoading = false
    @Published var error: String?

    private var jwtToken: String?
    private var deviceId: String = "0"
    private var casId: String?
    private(set) var vuid: String?

    /// Exposes JWT for services that need it (e.g. StreamingService, FairPlay).
    var currentJWT: String? { jwtToken }

    // MARK: - Request ID Generation (matches Flow's x-request-id format)

    private func generateRequestId() -> String {
        let uuid = UUID().uuidString.prefix(8)
        return "\(requestIdPrefix)-\(apiVersion)-\(deviceId)-\(uuid)"
    }

    // MARK: - API Request Helper

    private func makeRequest<T: Decodable>(
        endpoint: String,
        method: String = "GET",
        body: Data? = nil,
        baseURL: String? = nil
    ) async throws -> T {
        let base = baseURL ?? Self.baseURL
        guard let url = URL(string: "\(base)\(endpoint)") else {
            throw FlowAPIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15

        // Content type
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Mandatory headers (as required by Flow's MandatoryHeadersFilter)
        request.setValue(Self.baseURL, forHTTPHeaderField: "referer")
        request.setValue(Self.baseURL, forHTTPHeaderField: "origin")
        request.setValue(generateRequestId(), forHTTPHeaderField: "x-request-id")

        // JWT Bearer token for authenticated requests
        if let token = jwtToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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
            do {
                return try JSONDecoder.flowDecoder.decode(T.self, from: data)
            } catch {
                let preview = String(data: data.prefix(500), encoding: .utf8) ?? "(binary)"
                print("[FlowAPI] Decoding \(T.self) failed: \(error)\nResponse: \(preview)")
                throw FlowAPIError.decodingError(error)
            }
        case 401:
            throw FlowAPIError.unauthorized
        case 403:
            throw FlowAPIError.forbidden
        case 404:
            throw FlowAPIError.notFound
        case 429:
            throw FlowAPIError.rateLimited
        default:
            let preview = String(data: data.prefix(300), encoding: .utf8) ?? ""
            print("[FlowAPI] HTTP \(httpResponse.statusCode) for \(endpoint): \(preview)")
            throw FlowAPIError.serverError(httpResponse.statusCode)
        }
    }

    // MARK: - Authentication (Real Flow login)
    // Flow uses: POST /auth/v2/provision/login
    // Body: LoginData { accountId, password, deviceName, deviceType, devicePlatform, clientCasId, version, type, deviceModel, company }
    // Returns: LoginModel { accounts: [Account] } + JWT token in response

    func login(email: String, password: String) async throws -> (FlowUser, AuthToken) {
        // Generate a unique CAS ID for this device if we don't have one
        if casId == nil {
            casId = UUID().uuidString
        }

        let loginData = FlowLoginData(
            accountId: email,
            password: password,
            deviceName: deviceName,
            deviceType: deviceType,
            devicePlatform: platform,
            clientCasId: casId ?? UUID().uuidString,
            version: apiVersion,
            type: apiType,
            deviceModel: deviceModel,
            company: company
        )

        let body = try JSONEncoder().encode(loginData)

        do {
            let response: FlowLoginResponse = try await makeRequest(
                endpoint: "\(authPath)/provision/login",
                method: "POST",
                body: body
            )

            // Extract JWT and VUID from response
            if let token = response.effectiveToken {
                self.jwtToken = token
            }
            if let responseVuid = response.multiRightVuid {
                self.vuid = responseVuid
            }
            if let responseDeviceId = response.deviceId {
                self.deviceId = responseDeviceId
            }

            // Build user from Flow's account data
            let user = FlowUser(
                id: response.accounts?.first?.id ?? email,
                email: email,
                displayName: response.accounts?.first?.name ?? email,
                avatarURL: nil,
                plan: FlowPlan(name: "Flow", tier: .estandar, hasHD: true, has4K: false, maxDevices: 3),
                maxStreams: 3,
                activeStreams: 0
            )

            let authToken = AuthToken(
                accessToken: jwtToken ?? "",
                refreshToken: "",
                expiresAt: Date().addingTimeInterval(43200) // 12 hours (Flow's JWT TTL)
            )

            return (user, authToken)
        } catch {
            print("[FlowAPI] Login failed: \(error)")
            throw error
        }
    }

    func setJWTToken(_ token: String) {
        self.jwtToken = token
    }

    // MARK: - Cache Token
    // GET /auth/v2/cachetoken

    func fetchCacheToken() async -> String? {
        struct CacheTokenResponse: Decodable {
            let token: String?
        }
        do {
            let response: CacheTokenResponse = try await makeRequest(
                endpoint: "\(authPath)/cachetoken"
            )
            return response.token
        } catch {
            return nil
        }
    }

    // MARK: - Device Verification
    // GET /auth/v2/device (requires JWT)

    func verifyDevice() async -> Bool {
        do {
            let result: Bool = try await makeRequest(endpoint: "\(authPath)/device")
            return result
        } catch {
            return false
        }
    }

    func refreshToken(_ token: AuthToken) async throws -> AuthToken {
        // Flow uses cachetoken endpoint for token refresh
        if let newToken = await fetchCacheToken() {
            self.jwtToken = newToken
            return AuthToken(
                accessToken: newToken,
                refreshToken: "",
                expiresAt: Date().addingTimeInterval(43200)
            )
        }
        return MockData.authToken
    }

    // MARK: - Channels
    // GET /api/v1/content/channels (requires JWT)

    func fetchChannels() async {
        isLoading = true
        error = nil

        do {
            struct ChannelsWrapper: Decodable {
                let channels: [FlowChannelResponse]?
            }
            // Try array first, then wrapped response
            do {
                let result: [FlowChannelResponse] = try await makeRequest(
                    endpoint: "\(contentPath)/channels"
                )
                self.channels = result.map { $0.toChannel() }
            } catch {
                let wrapped: ChannelsWrapper = try await makeRequest(
                    endpoint: "\(contentPath)/channels"
                )
                self.channels = wrapped.channels?.map { $0.toChannel() } ?? MockData.channels
            }
        } catch {
            // Fallback to mock data in development
            self.channels = MockData.channels
        }

        isLoading = false
    }

    // MARK: - EPG / Programs
    // POST /api/v1/content/channel
    // Body: { channelIds, size, startTime, endTime, tvRating }

    func fetchEPG(for channelId: String, date: Date = Date()) async -> [Program] {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: date)
        let end = calendar.date(byAdding: .hour, value: 24, to: start) ?? date

        let formatter = ISO8601DateFormatter()
        let requestBody: [String: Any] = [
            "channelIds": [channelId],
            "size": 1440,
            "startTime": formatter.string(from: start),
            "endTime": formatter.string(from: end),
            "tvRating": 6
        ]

        do {
            let body = try JSONSerialization.data(withJSONObject: requestBody)
            let programs: [[FlowProgramResponse]] = try await makeRequest(
                endpoint: "\(contentPath)/channel",
                method: "POST",
                body: body
            )
            return programs.flatMap { $0.map { $0.toProgram() } }
        } catch {
            return MockData.programs(for: channelId)
        }
    }

    // MARK: - VOD Content
    // GET /api/v1/content/filter?lang=es&size=20&page=0

    func fetchFeaturedContent() async {
        do {
            let response: FlowDynamicResponse = try await makeRequest(
                endpoint: "\(dynamicPath)/all?deviceType=\(deviceType)&token=\(jwtToken ?? "")"
            )
            self.featuredContent = response.toFeaturedContent()
        } catch {
            self.featuredContent = MockData.featuredContent
        }
    }

    func fetchVODCategories() async {
        do {
            let response: FlowVODResponse = try await makeRequest(
                endpoint: "\(contentPath)/filter?lang=es&size=20&page=0"
            )
            self.vodCategories = response.toCategories()
        } catch {
            self.vodCategories = MockData.vodCategories
        }
    }

    func fetchVODContent(genre: String? = nil, search: String? = nil) async -> [VODContent] {
        var endpoint = "\(contentPath)/filter?lang=es&size=40&page=0"
        if let genre {
            endpoint += "&filters=\(genre.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? genre)"
        }

        do {
            let response: FlowVODResponse = try await makeRequest(endpoint: endpoint)
            return response.items?.map { $0.toVODContent() } ?? []
        } catch {
            let items = MockData.vodItems
            if let genre {
                return items.filter { $0.genre.contains(genre) }
            }
            return items
        }
    }

    func fetchSeriesDetail(id: String) async -> VODContent? {
        do {
            let response: FlowVODItemResponse = try await makeRequest(
                endpoint: "\(contentPath)/serie?id=\(id)"
            )
            return response.toVODContent()
        } catch {
            return MockData.vodItems.first { $0.id == id }
        }
    }

    func fetchContentDetail(id: String) async -> VODContent? {
        return await fetchSeriesDetail(id: id)
    }

    // MARK: - Continue Watching

    func fetchContinueWatching() async {
        // Flow doesn't have a dedicated endpoint for this - managed locally
        self.continueWatching = MockData.continueWatching
    }

    // MARK: - Dynamic Content (Home page)
    // GET /api/v1/dynamic/all?deviceType=Web+Client&token=JWT
    // GET /api/v1/dynamic/page?deviceType=Web+Client&token=JWT&id=PAGE_ID

    func fetchDynamicContent(pageId: String? = nil) async -> FlowDynamicResponse? {
        let endpoint: String
        if let pageId {
            endpoint = "\(dynamicPath)/page?deviceType=\(deviceType)&token=\(jwtToken ?? "")&id=\(pageId)"
        } else {
            endpoint = "\(dynamicPath)/all?deviceType=\(deviceType)&token=\(jwtToken ?? "")"
        }

        do {
            return try await makeRequest(endpoint: endpoint)
        } catch {
            return nil
        }
    }

    // MARK: - Stream URL (legacy helpers, prefer StreamingService.resolveStream)

    func getStreamURL(for channelId: String) async -> String? {
        return channels.first { $0.id == channelId }?.streamURL
    }

    func getVODStreamURL(for contentId: String) async -> String? {
        do {
            struct StreamResponse: Decodable {
                let url: String?
                let streamUrl: String?
            }
            let response: StreamResponse = try await makeRequest(
                endpoint: "\(contentPath)/serie?id=\(contentId)"
            )
            return response.url ?? response.streamUrl
        } catch {
            return nil
        }
    }

    // MARK: - Search

    func search(query: String) async -> SearchResults {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query

        do {
            // Search via VOD filter
            let vodResponse: FlowVODResponse = try await makeRequest(
                endpoint: "\(contentPath)/filter?lang=es&size=20&page=0&filters=\(encoded)"
            )
            let vodItems = vodResponse.items?.map { $0.toVODContent() } ?? []

            // Filter channels locally
            let matchingChannels = channels.filter {
                $0.name.localizedCaseInsensitiveContains(query)
            }

            return SearchResults(channels: matchingChannels, vod: vodItems)
        } catch {
            return MockData.searchResults(for: query)
        }
    }

    // MARK: - Image URL Helper

    static func imageURL(path: String?) -> URL? {
        guard let path else { return nil }
        if path.hasPrefix("http") { return URL(string: path) }
        return URL(string: "\(imagesBaseURL)\(path)")
    }
}

// MARK: - Flow API Response Models

struct FlowLoginData: Encodable {
    let accountId: String
    let password: String
    let deviceName: String
    let deviceType: String
    let devicePlatform: String
    let clientCasId: String
    let version: String
    let type: String
    let deviceModel: String
    let company: String
}

struct FlowLoginResponse: Decodable {
    let accounts: [FlowAccountResponse]?
    let token: String?
    let jwt: String?
    let multiRightVuid: String?
    let deviceId: String?
    let externalID: String?

    /// Flow may return the JWT as either `token` or `jwt`
    var effectiveToken: String? { token ?? jwt }
}

struct FlowAccountResponse: Decodable {
    let id: String?
    let name: String?
}

struct FlowChannelResponse: Decodable {
    let id: String?
    let number: Int?
    let name: String?
    let image: String?
    let category: String?
    let isHd: Bool?
    let url: String?

    func toChannel() -> Channel {
        Channel(
            id: id ?? UUID().uuidString,
            number: number ?? 0,
            name: name ?? "Canal",
            logoURL: image,
            category: mapCategory(category),
            isHD: isHd ?? false,
            streamURL: url,
            currentProgram: nil,
            nextProgram: nil
        )
    }

    private func mapCategory(_ cat: String?) -> ChannelCategory {
        guard let cat = cat?.lowercased() else { return .entretenimiento }
        if cat.contains("notic") { return .noticias }
        if cat.contains("deport") { return .deportes }
        if cat.contains("pelic") || cat.contains("cine") { return .peliculas }
        if cat.contains("serie") { return .series }
        if cat.contains("infant") || cat.contains("niño") || cat.contains("kids") { return .infantil }
        if cat.contains("music") || cat.contains("músic") { return .musica }
        if cat.contains("document") { return .documentales }
        if cat.contains("adult") { return .adultos }
        return .entretenimiento
    }
}

struct FlowProgramResponse: Decodable {
    let id: String?
    let title: String?
    let description: String?
    let startTime: String?
    let endTime: String?
    let image: String?
    let rating: String?
    let genre: String?

    func toProgram() -> Program {
        let formatter = ISO8601DateFormatter()
        return Program(
            id: id ?? UUID().uuidString,
            title: title ?? "",
            description: description,
            startTime: formatter.date(from: startTime ?? "") ?? Date(),
            endTime: formatter.date(from: endTime ?? "") ?? Date(),
            imageURL: image,
            rating: rating,
            genre: genre
        )
    }
}

struct FlowVODResponse: Decodable {
    let items: [FlowVODItemResponse]?
    let total: Int?

    func toCategories() -> [VODCategory] {
        guard let items else { return [] }
        var genreMap: [String: [VODContent]] = [:]
        for item in items {
            let content = item.toVODContent()
            for genre in content.genre where !genre.isEmpty {
                genreMap[genre, default: []].append(content)
            }
        }
        return genreMap.sorted { $0.key < $1.key }.map { genre, contents in
            VODCategory(id: genre, name: genre, items: contents)
        }
    }
}

struct FlowVODItemResponse: Decodable {
    let id: String?
    let title: String?
    let originalTitle: String?
    let description: String?
    let year: Int?
    let duration: Int?
    let rating: String?
    let genre: [String]?
    let image: String?
    let backdrop: String?
    let type: String?

    func toVODContent() -> VODContent {
        VODContent(
            id: id ?? UUID().uuidString,
            title: title ?? "",
            originalTitle: originalTitle,
            description: description,
            year: year,
            duration: duration,
            rating: rating,
            genre: genre ?? [],
            posterURL: image,
            backdropURL: backdrop,
            streamURL: nil,
            contentType: type == "series" ? .series : .movie,
            seasons: nil,
            isFavorite: false
        )
    }
}

struct FlowDynamicResponse: Decodable {
    let panels: [FlowPanel]?

    struct FlowPanel: Decodable {
        let title: String?
        let items: [FlowDynamicItem]?
    }

    struct FlowDynamicItem: Decodable {
        let id: String?
        let title: String?
        let description: String?
        let image: String?
        let type: String?
    }

    func toFeaturedContent() -> [FeaturedContent] {
        panels?.first?.items?.prefix(5).map { item in
            FeaturedContent(
                id: item.id ?? UUID().uuidString,
                title: item.title ?? "",
                subtitle: item.description,
                imageURL: item.image,
                content: .vod(VODContent(
                    id: item.id ?? "",
                    title: item.title ?? "",
                    originalTitle: nil,
                    description: item.description,
                    year: nil,
                    duration: nil,
                    rating: nil,
                    genre: [],
                    posterURL: item.image,
                    backdropURL: item.image,
                    streamURL: nil,
                    contentType: item.type == "series" ? .series : .movie,
                    seasons: nil,
                    isFavorite: false
                ))
            )
        } ?? []
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
