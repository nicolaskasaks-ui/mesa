import Foundation
import AVFoundation

/// Manages PRM token registration, stream resolution, concurrency control,
/// and FairPlay DRM for playback on Apple TV.
///
/// Flow's playback pipeline:
///   1. Login → JWT + VUID  (handled by FlowAPIService)
///   2. PRM register → PRM token  (this service)
///   3. Content source → stream URL + DRM info  (this service)
///   4. FairPlay key exchange → decrypted playback  (this service)
@MainActor
class StreamingService: ObservableObject {

    // MARK: - Published state

    @Published var isResolvingStream = false
    @Published var streamError: String?

    // MARK: - Token state

    private var prmToken: String?
    private var prmTokenExpiry: Date?
    private var vuid: String?

    // PRM refreshes every 6h, JWT every 12h
    private let prmTTL: TimeInterval = 6 * 3600

    // MARK: - Dependencies

    private weak var apiService: FlowAPIService?
    private var jwtToken: String { apiService?.currentJWT ?? "" }

    func configure(apiService: FlowAPIService) {
        self.apiService = apiService
    }

    // MARK: - PRM Registration
    // POST /prm/v1/register  (Bearer JWT)
    // Returns tokenForPRM used to authorize stream requests

    func registerPRM() async throws {
        guard !jwtToken.isEmpty else {
            throw StreamError.notAuthenticated
        }

        let url = URL(string: "\(FlowAPIService.baseURL)/prm/v1/register")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "referer")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "origin")

        let body: [String: String] = [
            "deviceBrand": "Apple",
            "deviceModel": "AppleTV",
            "deviceType": "STB",
            "playerType": "NATIVE",
            "networkType": "BROADBAND"
        ]
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            throw StreamError.prmRegistrationFailed(code)
        }

        let decoded = try JSONDecoder().decode(PRMRegisterResponse.self, from: data)
        guard let token = decoded.tokenForPRM ?? decoded.token else {
            throw StreamError.prmRegistrationFailed(0)
        }

        self.prmToken = token
        self.prmTokenExpiry = Date().addingTimeInterval(prmTTL)
    }

    /// Ensures a valid PRM token is available, registering if needed.
    func ensurePRMToken() async throws {
        if let expiry = prmTokenExpiry, Date() < expiry, prmToken != nil {
            return // still valid
        }
        try await registerPRM()
    }

    // MARK: - Store VUID from login

    func setVUID(_ vuid: String) {
        self.vuid = vuid
    }

    // MARK: - Content Source Resolution
    // GET /prm/v1/contentSource?id=<id>&type=<type>&drmId=<vuid>
    // Bearer PRM token (not JWT)

    func resolveStream(id: String, type: StreamContentType) async throws -> ResolvedStream {
        isResolvingStream = true
        streamError = nil
        defer { isResolvingStream = false }

        try await ensurePRMToken()

        guard let prmToken else {
            throw StreamError.prmRegistrationFailed(0)
        }

        var components = URLComponents(string: "\(FlowAPIService.baseURL)/prm/v1/contentSource")!
        components.queryItems = [
            URLQueryItem(name: "id", value: id),
            URLQueryItem(name: "type", value: type.rawValue),
            URLQueryItem(name: "drmId", value: vuid ?? "")
        ]

        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Bearer \(prmToken)", forHTTPHeaderField: "Authorization")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "referer")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "origin")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw StreamError.invalidResponse
        }

        switch http.statusCode {
        case 200...299:
            break
        case 401:
            // PRM token expired, retry once
            self.prmToken = nil
            try await registerPRM()
            return try await resolveStream(id: id, type: type)
        case 403:
            throw StreamError.notEntitled
        default:
            throw StreamError.serverError(http.statusCode)
        }

        let decoded = try JSONDecoder.flowDecoder.decode(ContentSourceResponse.self, from: data)

        guard let contentURL = decoded.content?.contentUrl ?? decoded.content?.url else {
            throw StreamError.noStreamAvailable
        }

        // Force HTTPS
        let secureURL = contentURL.replacingOccurrences(of: "http://", with: "https://")

        return ResolvedStream(
            contentURL: secureURL,
            drmLicenseURL: decoded.content?.drm?.url,
            drmToken: decoded.content?.drm?.token,
            fairPlayCertURL: decoded.content?.drm?.certificateUrl,
            protocol: decoded.content?.protocol ?? "HLS",
            encryption: decoded.content?.encryption
        )
    }

    // MARK: - Concurrency Check
    // POST /prm/v1/concurrency  (Bearer JWT)

    func checkConcurrency() async throws {
        let url = URL(string: "\(FlowAPIService.baseURL)/prm/v1/concurrency")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(jwtToken)", forHTTPHeaderField: "Authorization")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "referer")
        request.setValue(FlowAPIService.baseURL, forHTTPHeaderField: "origin")
        request.httpBody = "{}".data(using: .utf8)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw StreamError.invalidResponse
        }

        if http.statusCode == 429 || http.statusCode == 403 {
            throw StreamError.concurrencyLimitReached
        }
    }

    // MARK: - Full playback pipeline

    /// Resolves a channel or VOD item into a playable AVPlayerItem with DRM configured.
    func preparePlayback(id: String, type: StreamContentType) async throws -> PlaybackSession {
        // 1. Check concurrency
        do {
            try await checkConcurrency()
        } catch StreamError.concurrencyLimitReached {
            throw StreamError.concurrencyLimitReached
        } catch {
            // Non-fatal: continue even if concurrency check fails
        }

        // 2. Resolve stream
        let resolved = try await resolveStream(id: id, type: type)

        guard let url = URL(string: resolved.contentURL) else {
            throw StreamError.invalidURL
        }

        // 3. Create AVPlayerItem
        let asset = AVURLAsset(url: url)
        let item = AVPlayerItem(asset: asset)

        // 4. Configure FairPlay DRM if present
        var drmManager: FairPlayDRMManager?
        if let licenseURL = resolved.drmLicenseURL,
           resolved.encryption?.lowercased().contains("fairplay") == true ||
           resolved.encryption?.lowercased().contains("fps") == true {
            drmManager = FairPlayDRMManager(
                licenseURL: licenseURL,
                drmToken: resolved.drmToken,
                certificateURL: resolved.fairPlayCertURL,
                jwtToken: jwtToken
            )
            drmManager?.configureAsset(asset)
        }

        return PlaybackSession(
            playerItem: item,
            resolved: resolved,
            drmManager: drmManager
        )
    }

    // MARK: - Clear on logout

    func clear() {
        prmToken = nil
        prmTokenExpiry = nil
        vuid = nil
    }
}

// MARK: - Response Models

struct PRMRegisterResponse: Decodable {
    let tokenForPRM: String?
    let token: String?
}

struct ContentSourceResponse: Decodable {
    let content: ContentSourceContent?

    struct ContentSourceContent: Decodable {
        let contentUrl: String?
        let url: String?
        let `protocol`: String?
        let encryption: String?
        let drm: DRMInfo?

        struct DRMInfo: Decodable {
            let url: String?
            let token: String?
            let certificateUrl: String?
        }
    }
}

// MARK: - Domain Models

struct ResolvedStream {
    let contentURL: String
    let drmLicenseURL: String?
    let drmToken: String?
    let fairPlayCertURL: String?
    let `protocol`: String
    let encryption: String?
}

struct PlaybackSession {
    let playerItem: AVPlayerItem
    let resolved: ResolvedStream
    let drmManager: FairPlayDRMManager?
}

enum StreamContentType: String {
    case tvChannel = "TV_CHANNEL"
    case tvSchedule = "TV_SCHEDULE"
    case vod = "VOD"
    case asset = "ASSET"
    case radio = "RADIO"
}

enum StreamError: LocalizedError {
    case notAuthenticated
    case prmRegistrationFailed(Int)
    case invalidURL
    case invalidResponse
    case notEntitled
    case noStreamAvailable
    case concurrencyLimitReached
    case serverError(Int)
    case drmFailed(String)
    case fairPlayCertificateNotAvailable

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Iniciá sesión para ver contenido."
        case .prmRegistrationFailed(let code):
            return "No se pudo registrar el dispositivo (código \(code))."
        case .invalidURL:
            return "URL de stream inválida."
        case .invalidResponse:
            return "Respuesta inválida del servidor."
        case .notEntitled:
            return "No tenés acceso a este contenido con tu plan actual."
        case .noStreamAvailable:
            return "Stream no disponible en este momento."
        case .concurrencyLimitReached:
            return "Alcanzaste el límite de dispositivos simultáneos. Cerrá otro dispositivo para continuar."
        case .serverError(let code):
            return "Error del servidor (\(code))."
        case .drmFailed(let detail):
            return "Error de protección de contenido: \(detail)"
        case .fairPlayCertificateNotAvailable:
            return "No se pudo obtener el certificado de protección."
        }
    }
}
