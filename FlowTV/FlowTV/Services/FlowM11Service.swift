import Foundation
import os

private let m11Log = Logger(subsystem: "com.flowtv.app", category: "FlowM11")

/// Service that communicates with the real Flow M11 content API
/// API: https://cdn.bo.flow.com.ar/content/api/v1/
///
/// When a local stream-proxy server is running (http://proxyHost:8772),
/// the service can resolve HLS stream URLs through it for Apple TV playback.
@MainActor
class FlowM11Service: ObservableObject {
    static let shared = FlowM11Service()

    @Published var channels: [Channel] = []
    @Published var isReady = false
    @Published var statusMessage = ""
    @Published var epgByChannel: [String: [Program]] = [:]
    @Published var isLoadingEPG = false

    /// Set to the Mac's local IP to use the stream proxy (e.g. "192.168.1.100")
    /// When nil, uses direct Flow API access only (no stream URLs).
    var proxyHost: String? = nil
    var proxyPort: Int = 8772

    /// The base URL of the local stream proxy
    private var proxyBaseURL: String? {
        guard let host = proxyHost else { return nil }
        return "http://\(host):\(proxyPort)"
    }

    private let baseURL = "https://cdn.bo.flow.com.ar/content/api/v1"
    private let sessionURL = "https://cdn.bo.flow.com.ar/users/node/1/api/v1/session"

    // Session tokens - refreshed via /session endpoint
    private var packagesToken = ""
    private var servicesToken = ""
    private var regionToken = ""
    private var sessionToken = ""
    private var deviceId = ""
    private var profileId = ""

    // Stored credentials for token refresh
    private var userDeviceToken = ""
    private var casId = ""

    // EPG refresh timer
    private var epgRefreshTask: Task<Void, Never>?

    func configure(userDeviceToken: String, casId: String, deviceId: String, profileId: String) {
        self.userDeviceToken = userDeviceToken
        self.casId = casId
        self.deviceId = deviceId
        self.profileId = profileId
        m11Log.info("[M11] Configured with device \(deviceId)")
    }

    /// Get fresh tokens from the session endpoint
    func refreshSession() async -> Bool {
        m11Log.info("[M11] Refreshing session tokens...")
        statusMessage = "Conectando a Flow..."

        guard let url = URL(string: sessionURL) else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("https://portal.app.flow.com.ar", forHTTPHeaderField: "Origin")
        request.setValue("https://portal.app.flow.com.ar/", forHTTPHeaderField: "Referer")

        let requestId = "Flow|AppleTV|1.0|999900002715839|\(deviceId)|\(Int.random(in: 1000000000...9999999999))"
        request.setValue(requestId, forHTTPHeaderField: "x-request-id")

        let body: [String: Any] = [
            "userDeviceToken": userDeviceToken,
            "profile": profileId,
            "deviceInfo": [
                "appVersion": "4.26.0",
                "brand": "WEB",
                "casId": casId,
                "model": "PC",
                "name": "WEB(MacIntel)",
                "os": "WindowsPC",
                "osVersion": "4.26.0",
                "playerType": "TheoPlayer",
                "type": "cloud_client"
            ]
        ]

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            m11Log.info("[M11] Session HTTP \(http?.statusCode ?? 0)")

            guard http?.statusCode == 200 else {
                let errBody = String(data: data, encoding: .utf8) ?? ""
                m11Log.info("[M11] Session error: \(errBody.prefix(200))")
                statusMessage = "Error de sesion"
                return false
            }

            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let tokens = json["tokens"] as? [String: Any] else {
                statusMessage = "Respuesta invalida"
                return false
            }

            self.packagesToken = tokens["packages"] as? String ?? ""
            self.servicesToken = tokens["services"] as? String ?? ""
            self.regionToken = tokens["region"] as? String ?? ""
            self.sessionToken = tokens["session"] as? String ?? ""

            m11Log.info("[M11] Session refreshed! packages=\(self.packagesToken.count) chars")
            return true
        } catch {
            m11Log.info("[M11] Session error: \(error)")
            statusMessage = "Error: \(error.localizedDescription)"
            return false
        }
    }

    /// Full initialization: refresh session then fetch channels + EPG
    func initializeAndLoad() async {
        statusMessage = "Iniciando sesion..."

        // Try to refresh session first for fresh tokens
        let sessionOK = await refreshSession()
        if sessionOK {
            m11Log.info("[M11] Session refreshed, fetching channels with fresh tokens")
        } else {
            m11Log.info("[M11] Session refresh failed, using hardcoded tokens")
        }

        await fetchChannels()

        // Fetch EPG for loaded channels
        if !channels.isEmpty {
            await fetchEPGForAllChannels()
        }

        // Start periodic EPG refresh every 5 minutes
        startEPGRefreshTimer()
    }

    func fetchChannels() async {
        // Use hardcoded tokens from Chrome session if no fresh tokens
        if packagesToken.isEmpty {
            m11Log.info("[M11] Using Chrome session tokens")
            self.packagesToken = "bklkOggBGAMi8AQHvOYwzNjodNmrcuKRRhc8RMw2DtBXAljnOhGjV4dsi/vWyZUPtbDr+zYcy81ZNzJ4spgQbW1RsrWXSaeEEWPeV686khvR6RLeUDuWNfob91rpBLINmXWPqOIkViIZP7OsEWE1aERxlyDQH4awPwYbECmeblqXVOXKFZ1YoJegw2Vbuba2LdH0uubUHTVQgqUBlC1wM8Y3UiOAhzg4XVxR2aQW+Ki7E+2/L8hLsAAHC6CMgQPv8NVClTKVOCZYXxAMd5+UnPl3fbcuaLdQffi2DKT7aGImSBIcFt5wWNQOIHlaFJQHOz2Sk+B2LbkG2vhXCHxpgrcR9WEQsA0mteoWDbOIz5nvfBOs1Gh6Dsdil5MEGd+vjoe+GaYgJ7xleKYHxde8zHu+IdqtBc2k5oAPylrSOLSf6P5Gcp9VDl/TfvVSNppzDywrWe9rXBxNt7fIp5huzPP/0JnT7Ekptlg7zrXjL9OCZxA6Xrddp2kxKebU14mq/thUEw+hyS1cws1rGhTOFKW3NnYptWj/m2mSaFsdhKtWo+KBkTOwfG8abKrPZOouhijQfkPxtQSSKoNpnL3wnzFnqI/IW+vcbnkSJ1CZNI9bZrRMVGhtkDY7lumkKxXXqWfYTWw2ceU/JZzsfoo9bhxFSzxxXQpIZWYTnLi+axfsWNQMbTXrCYHNEhazj+1l9vDCSuUULe69br8mteJkb09lqG2PwKa4W0aQbHi71oCj4IVS2PHgJ/m1+b/1d80z1TH+PGs1SGv/ECaT3N70YXhHgs14DxHGJPaN4W4OM4aq3O1uv5sl9rMhGW0J03q5SUiDVjJ7NqtDeLw="
            self.servicesToken = "bklkOggBIkBNcXMmCGwXl7LIiwJAfoykrfQs3O/ZN1zXHHdoA1X88fJxAgLzKDWpZVxhR95StuzcrKX+94qq/gv0HNsE5395"
            self.regionToken = "bklkOggBImCQp3+kUWjJrhVDoBFSFSWjzSVpxbnS96ChubJcYAr+ijxovCNqP1KU/DmaJp5YruWzsFGF8IKXZ2gK+7C5gng6++yviC4/9IOvx+EfkQatLFDfTCqDBWY7rbg1RSeAUx4="
        }

        statusMessage = "Cargando canales..."
        m11Log.info("[M11] Fetching channels...")

        // Manually encode tokens - URLComponents double-encodes + and / chars
        let encodedPkg = packagesToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""
        let encodedSvc = servicesToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""
        let encodedReg = regionToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""

        let urlString = "\(baseURL)/Channel?adult=false&page=0&size=500&images=CH_LOGO&packages=\(encodedPkg)&services=\(encodedSvc)&region=\(encodedReg)"

        guard let url = URL(string: urlString) else {
            m11Log.info("[M11] Invalid URL")
            return
        }
        m11Log.info("[M11] URL length: \(urlString.count)")

        var request = URLRequest(url: url)
        request.setValue("https://portal.app.flow.com.ar", forHTTPHeaderField: "Origin")
        request.setValue("https://portal.app.flow.com.ar/", forHTTPHeaderField: "Referer")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(deviceId, forHTTPHeaderField: "tr-log-deviceid")
        request.setValue("cloud_client", forHTTPHeaderField: "tr-log-devicetype")
        request.setValue(profileId, forHTTPHeaderField: "tr-log-profileid")

        let requestId = "Flow|AppleTV|1.0|\(profileId.split(separator: ":").dropFirst().first ?? "")|\(deviceId)|\(Int.random(in: 1000000...9999999))"
        request.setValue(requestId, forHTTPHeaderField: "x-request-id")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            m11Log.info("[M11] Channels HTTP \(http?.statusCode ?? 0)")

            guard http?.statusCode == 200 else {
                statusMessage = "Error \(http?.statusCode ?? 0)"
                return
            }

            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            guard let channelList = json?["data"] as? [[String: Any]] else {
                statusMessage = "Sin datos"
                return
            }

            var parsed: [Channel] = []
            for ch in channelList {
                guard let id = ch["id"] as? String,
                      let number = ch["number"] as? Int,
                      let nameObj = ch["name"] as? [String: String],
                      let name = nameObj["es"] else { continue }

                // Build logo URL from channel ID using CDN image endpoint
                let logoURL = "https://cdn.bo.flow.com.ar/images/content/228/228/\(id)?tags=CH_LOGO&opt=CHANNEL,CH_LOGO"

                // Map category from API genre/type data
                let category = mapChannelCategory(ch, number: number, name: name)

                let channel = Channel(
                    id: id,
                    number: number,
                    name: name,
                    logoURL: logoURL,
                    category: category,
                    isHD: name.contains("HD") || (ch["hd"] as? Bool ?? false),
                    streamURL: nil,  // Will be resolved on play via proxy
                    currentProgram: nil,
                    nextProgram: nil
                )
                parsed.append(channel)
            }

            parsed.sort { $0.number < $1.number }
            self.channels = parsed
            self.isReady = true
            self.statusMessage = "\(parsed.count) canales"
            m11Log.info("[M11] Loaded \(parsed.count) real channels")

        } catch {
            m11Log.info("[M11] Error: \(error)")
            statusMessage = "Error: \(error.localizedDescription)"
        }
    }

    // MARK: - EPG (Electronic Program Guide)

    /// Fetch EPG schedules for all loaded channels (in batches)
    func fetchEPGForAllChannels() async {
        guard !channels.isEmpty else { return }
        isLoadingEPG = true

        let now = Date()
        let twoHoursLater = now.addingTimeInterval(2 * 3600)

        // Fetch in batches of 50 channels
        let channelIds = channels.map { $0.id }
        let batchSize = 50

        for batchStart in stride(from: 0, to: channelIds.count, by: batchSize) {
            let batchEnd = min(batchStart + batchSize, channelIds.count)
            let batch = Array(channelIds[batchStart..<batchEnd])

            let schedules = await fetchSchedules(channelIds: batch, from: now, to: twoHoursLater)
            parseAndStoreSchedules(schedules)
        }

        // Update channels with current program info
        updateChannelsWithEPG()
        isLoadingEPG = false
        m11Log.info("[M11] EPG loaded for \(self.epgByChannel.count) channels")
    }

    /// Fetch EPG schedules from the API
    func fetchSchedules(channelIds: [String], from: Date, to: Date) async -> [[String: Any]] {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let fromStr = formatter.string(from: from)
        let toStr = formatter.string(from: to)

        // Build URL with manually encoded tokens (same approach as channels)
        let encodedPkg = packagesToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""
        let encodedSvc = servicesToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""
        let encodedReg = regionToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""
        let encodedFrom = fromStr.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? fromStr
        let encodedTo = toStr.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? toStr

        var urlString = "\(baseURL)/schedules?page=0&size=2000&filter[end][gt]=\(encodedFrom)&filter[start][lt]=\(encodedTo)&packages=\(encodedPkg)&services=\(encodedSvc)&region=\(encodedReg)"

        // Add channel filters
        for chId in channelIds {
            urlString += "&filter[channel][]=\(chId)"
        }

        guard let url = URL(string: urlString) else { return [] }

        var request = URLRequest(url: url)
        request.setValue("https://portal.app.flow.com.ar", forHTTPHeaderField: "Origin")
        request.setValue("https://portal.app.flow.com.ar/", forHTTPHeaderField: "Referer")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(deviceId, forHTTPHeaderField: "tr-log-deviceid")

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            let http = response as? HTTPURLResponse
            m11Log.info("[M11] Schedules HTTP \(http?.statusCode ?? 0)")

            guard http?.statusCode == 200 else { return [] }

            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return json?["data"] as? [[String: Any]] ?? []
        } catch {
            m11Log.info("[M11] Schedules error: \(error)")
            return []
        }
    }

    /// Parse schedule data from API and store by channel
    private func parseAndStoreSchedules(_ schedules: [[String: Any]]) {
        let now = Date()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let formatterNoFrac = ISO8601DateFormatter()
        formatterNoFrac.formatOptions = [.withInternetDateTime]

        for schedule in schedules {
            guard let channelId = schedule["channel"] as? String else { continue }

            // Parse program title
            var title = "Programa"
            if let nameObj = schedule["name"] as? [String: String] {
                title = nameObj["es"] ?? nameObj["en"] ?? "Programa"
            } else if let nameStr = schedule["name"] as? String {
                title = nameStr
            }

            // Parse description
            var desc: String?
            if let descObj = schedule["description"] as? [String: String] {
                desc = descObj["es"] ?? descObj["en"]
            } else if let descStr = schedule["description"] as? String {
                desc = descStr
            }

            // Parse start/end times
            let startStr = schedule["start"] as? String ?? ""
            let endStr = schedule["end"] as? String ?? ""
            let startDate = formatter.date(from: startStr) ?? formatterNoFrac.date(from: startStr) ?? now
            let endDate = formatter.date(from: endStr) ?? formatterNoFrac.date(from: endStr) ?? now.addingTimeInterval(3600)

            // Parse rating
            var rating: String?
            if let ratingObj = schedule["rating"] as? [String: Any] {
                rating = ratingObj["name"] as? String
            }

            // Parse genre
            var genre: String?
            if let genreArr = schedule["genres"] as? [[String: Any]], let first = genreArr.first {
                if let nameObj = first["name"] as? [String: String] {
                    genre = nameObj["es"] ?? nameObj["en"]
                }
            }

            // Parse image
            var imageURL: String?
            if let images = schedule["images"] as? [[String: Any]] {
                for img in images {
                    if let urlObj = img["url"] as? [String: String],
                       let url = urlObj["es"] {
                        imageURL = url.replacingOccurrences(of: "http://10.200.182.83:8090/", with: "https://images.flow.com.ar/images/")
                    }
                }
            }

            let scheduleId = schedule["id"] as? String ?? UUID().uuidString

            let program = Program(
                id: scheduleId,
                title: title,
                description: desc,
                startTime: startDate,
                endTime: endDate,
                imageURL: imageURL,
                rating: rating,
                genre: genre
            )

            // Store by channel ID
            if epgByChannel[channelId] == nil {
                epgByChannel[channelId] = []
            }
            epgByChannel[channelId]?.append(program)
        }

        // Sort each channel's programs by start time
        for key in epgByChannel.keys {
            epgByChannel[key]?.sort { $0.startTime < $1.startTime }
        }
    }

    /// Update channel objects with current/next program from EPG
    private func updateChannelsWithEPG() {
        let now = Date()
        var updatedChannels: [Channel] = []

        for channel in channels {
            let programs = epgByChannel[channel.id] ?? []

            // Find current program (now is between start and end)
            let currentProgram = programs.first { prog in
                now >= prog.startTime && now < prog.endTime
            }

            // Find next program
            let nextProgram = programs.first { prog in
                prog.startTime > now
            }

            let updated = Channel(
                id: channel.id,
                number: channel.number,
                name: channel.name,
                logoURL: channel.logoURL,
                category: channel.category,
                isHD: channel.isHD,
                streamURL: channel.streamURL,
                currentProgram: currentProgram,
                nextProgram: nextProgram
            )
            updatedChannels.append(updated)
        }

        self.channels = updatedChannels
    }

    /// Start periodic EPG refresh
    private func startEPGRefreshTimer() {
        epgRefreshTask?.cancel()
        epgRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5 * 60 * 1_000_000_000) // 5 minutes
                guard !Task.isCancelled else { break }
                await self?.fetchEPGForAllChannels()
            }
        }
    }

    // MARK: - Channel Category Mapping

    private func mapChannelCategory(_ ch: [String: Any], number: Int, name: String) -> ChannelCategory {
        // Try to use genre/type from API
        if let genres = ch["genres"] as? [[String: Any]] {
            for genre in genres {
                if let nameObj = genre["name"] as? [String: String],
                   let genreName = nameObj["es"]?.lowercased() ?? nameObj["en"]?.lowercased() {
                    if genreName.contains("notic") || genreName.contains("news") { return .noticias }
                    if genreName.contains("deport") || genreName.contains("sport") { return .deportes }
                    if genreName.contains("pelic") || genreName.contains("cine") || genreName.contains("movie") { return .peliculas }
                    if genreName.contains("serie") { return .series }
                    if genreName.contains("infant") || genreName.contains("kids") || genreName.contains("child") { return .infantil }
                    if genreName.contains("music") { return .musica }
                    if genreName.contains("document") { return .documentales }
                }
            }
        }

        // Fallback: use channel number ranges and name patterns
        let nameLower = name.lowercased()
        if nameLower.contains("espn") || nameLower.contains("tyc") || nameLower.contains("fox sport") ||
           nameLower.contains("dsport") || nameLower.contains("golf") || nameLower.contains("nfl") ||
           nameLower.contains("tnt sport") || (number >= 100 && number < 200) { return .deportes }
        if nameLower.contains("tn") || nameLower.contains("c5n") || nameLower.contains("cronica") ||
           nameLower.contains("nacion") || nameLower.contains("noticias") || nameLower.contains("cnn") ||
           nameLower.contains("a24") || (number >= 20 && number < 30) { return .noticias }
        if nameLower.contains("hbo") || nameLower.contains("star") || nameLower.contains("tnt") ||
           nameLower.contains("space") || nameLower.contains("cinemax") || nameLower.contains("tcm") ||
           nameLower.contains("cinema") || (number >= 200 && number < 300) { return .peliculas }
        if nameLower.contains("axn") || nameLower.contains("warner") || nameLower.contains("fx") ||
           nameLower.contains("paramount") || nameLower.contains("amc") || nameLower.contains("universal") ||
           (number >= 300 && number < 400) { return .series }
        if nameLower.contains("disney") || nameLower.contains("nick") || nameLower.contains("cartoon") ||
           nameLower.contains("baby") || nameLower.contains("junior") || nameLower.contains("boomerang") ||
           (number >= 400 && number < 450) { return .infantil }
        if nameLower.contains("mtv") || nameLower.contains("vh1") || nameLower.contains("much") ||
           nameLower.contains("music") { return .musica }
        if nameLower.contains("nat geo") || nameLower.contains("discovery") || nameLower.contains("history") ||
           nameLower.contains("animal") || nameLower.contains("geo") { return .documentales }

        return .entretenimiento
    }

    /// Fetch channel detail
    func fetchChannelDetail(id: String) async -> [String: Any]? {
        let encodedPkg = packagesToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""
        let encodedSvc = servicesToken.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)?.replacingOccurrences(of: "+", with: "%2B").replacingOccurrences(of: "/", with: "%2F") ?? ""

        let urlString = "\(baseURL)/Channel/\(id)?images=S_DESC&packages=\(encodedPkg)&services=\(encodedSvc)"

        guard let url = URL(string: urlString) else { return nil }

        var request = URLRequest(url: url)
        request.setValue("https://portal.app.flow.com.ar", forHTTPHeaderField: "Origin")
        request.setValue("https://portal.app.flow.com.ar/", forHTTPHeaderField: "Referer")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            return try JSONSerialization.jsonObject(with: data) as? [String: Any]
        } catch {
            return nil
        }
    }

    /// Get current program for a specific channel
    func currentProgram(for channelId: String) -> Program? {
        let now = Date()
        return epgByChannel[channelId]?.first { prog in
            now >= prog.startTime && now < prog.endTime
        }
    }

    /// Get next program for a specific channel
    func nextProgram(for channelId: String) -> Program? {
        let now = Date()
        return epgByChannel[channelId]?.first { prog in
            prog.startTime > now
        }
    }

    // MARK: - Stream Proxy Integration

    /// Check if the stream proxy is available
    func checkProxyAvailability() async -> Bool {
        guard let base = proxyBaseURL else { return false }
        guard let url = URL(string: "\(base)/status") else { return false }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            let http = response as? HTTPURLResponse
            if http?.statusCode == 200 {
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let status = json["status"] as? String {
                    m11Log.info("[M11:Proxy] Proxy status: \(status)")
                    return status == "ready"
                }
            }
        } catch {
            m11Log.info("[M11:Proxy] Proxy not reachable: \(error.localizedDescription)")
        }
        return false
    }

    /// Get the HLS stream URL for a channel via the proxy
    func proxyStreamURL(for channelId: String) -> String? {
        guard let base = proxyBaseURL else { return nil }
        return "\(base)/hls/\(channelId)/stream.m3u8"
    }

    /// Resolve a stream URL through the proxy, returning the best playable URL
    func resolveProxyStream(for channelId: String) async -> String? {
        guard let base = proxyBaseURL else { return nil }
        guard let url = URL(string: "\(base)/stream/\(channelId)") else { return nil }

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            let http = response as? HTTPURLResponse

            guard http?.statusCode == 200 else {
                m11Log.info("[M11:Proxy] Stream resolve failed: HTTP \(http?.statusCode ?? 0)")
                return nil
            }

            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                // Prefer directURL for HLS without DRM (Apple TV handles natively)
                if let directURL = json["directURL"] as? String {
                    m11Log.info("[M11:Proxy] Using direct HLS URL")
                    return directURL
                }
                // Fall back to proxy HLS URL (ffmpeg-converted)
                if let proxyURL = json["proxyURL"] as? String {
                    m11Log.info("[M11:Proxy] Using proxy HLS URL")
                    return proxyURL
                }
            }
        } catch {
            m11Log.info("[M11:Proxy] Stream resolve error: \(error.localizedDescription)")
        }
        return nil
    }

    /// Fetch channels from the proxy server (alternative to direct M11 API)
    func fetchChannelsFromProxy() async {
        guard let base = proxyBaseURL else { return }
        guard let url = URL(string: "\(base)/channels") else { return }

        m11Log.info("[M11:Proxy] Fetching channels from proxy...")
        statusMessage = "Cargando canales (proxy)..."

        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            let http = response as? HTTPURLResponse

            guard http?.statusCode == 200 else {
                m11Log.info("[M11:Proxy] Channels failed: HTTP \(http?.statusCode ?? 0)")
                return
            }

            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let channelList = json["channels"] as? [[String: Any]] else {
                return
            }

            var parsed: [Channel] = []
            for ch in channelList {
                guard let id = ch["id"] as? String,
                      let number = ch["number"] as? Int,
                      let name = ch["name"] as? String else { continue }

                let logoURL = ch["logoURL"] as? String
                let isHD = ch["isHD"] as? Bool ?? false
                let streamURL = ch["streamURL"] as? String
                let catStr = ch["category"] as? String ?? "entretenimiento"

                let category: ChannelCategory
                switch catStr {
                case "noticias": category = .noticias
                case "deportes": category = .deportes
                case "peliculas": category = .peliculas
                case "series": category = .series
                case "infantil": category = .infantil
                case "musica": category = .musica
                case "documentales": category = .documentales
                default: category = .entretenimiento
                }

                let channel = Channel(
                    id: id,
                    number: number,
                    name: name,
                    logoURL: logoURL,
                    category: category,
                    isHD: isHD,
                    streamURL: streamURL,
                    currentProgram: nil,
                    nextProgram: nil
                )
                parsed.append(channel)
            }

            parsed.sort { $0.number < $1.number }
            self.channels = parsed
            self.isReady = true
            self.statusMessage = "\(parsed.count) canales (proxy)"
            m11Log.info("[M11:Proxy] Loaded \(parsed.count) channels from proxy")
        } catch {
            m11Log.info("[M11:Proxy] Error: \(error.localizedDescription)")
        }
    }
}
