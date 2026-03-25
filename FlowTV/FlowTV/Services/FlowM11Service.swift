import Foundation
import os

private let m11Log = Logger(subsystem: "com.flowtv.app", category: "FlowM11")

/// Service that communicates with the real Flow M11 content API
/// API: https://cdn.bo.flow.com.ar/content/api/v1/
@MainActor
class FlowM11Service: ObservableObject {
    static let shared = FlowM11Service()
    
    @Published var channels: [Channel] = []
    @Published var isReady = false
    @Published var statusMessage = ""
    
    private let baseURL = "https://cdn.bo.flow.com.ar/content/api/v1"
    
    // Session tokens from the CSDK
    private var packagesToken = ""
    private var servicesToken = ""
    private var regionToken = ""
    private var deviceId = ""
    private var profileId = ""
    
    func configure(packages: String, services: String, region: String, deviceId: String, profileId: String) {
        self.packagesToken = packages
        self.servicesToken = services
        self.regionToken = region
        self.deviceId = deviceId
        self.profileId = profileId
        m11Log.info("[M11] Configured with device \(deviceId)")
    }
    
    func fetchChannels() async {
        guard !packagesToken.isEmpty else {
            m11Log.info("[M11] No packages token, skipping")
            return
        }
        
        statusMessage = "Cargando canales..."
        m11Log.info("[M11] Fetching channels...")
        
        var components = URLComponents(string: "\(baseURL)/Channel")!
        components.queryItems = [
            URLQueryItem(name: "adult", value: "false"),
            URLQueryItem(name: "page", value: "0"),
            URLQueryItem(name: "size", value: "500"),
            URLQueryItem(name: "images", value: "CH_LOGO"),
            URLQueryItem(name: "packages", value: packagesToken),
            URLQueryItem(name: "services", value: servicesToken),
            URLQueryItem(name: "region", value: regionToken)
        ]
        
        guard let url = components.url else { return }
        
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
                
                // Extract logo URL from images
                var logoURL: String?
                if let images = ch["images"] as? [[String: Any]] {
                    for img in images {
                        if let urlObj = img["url"] as? [String: String],
                           let url = urlObj["es"] {
                            // Replace internal IP with CDN
                            logoURL = url.replacingOccurrences(of: "http://10.200.182.83:8090/", with: "https://images.flow.com.ar/images/")
                        }
                    }
                }
                
                let category: ChannelCategory
                if number >= 100 && number < 120 {
                    category = .deportes
                } else if number >= 200 && number < 300 {
                    category = .peliculas
                } else if number >= 300 && number < 400 {
                    category = .series
                } else if number >= 400 && number < 500 {
                    category = .infantil
                } else if number < 30 {
                    category = .noticias
                } else {
                    category = .entretenimiento
                }

                let channel = Channel(
                    id: id,
                    number: number,
                    name: name,
                    logoURL: logoURL,
                    category: category,
                    isHD: name.contains("HD"),
                    streamURL: nil,  // Will be resolved on play via PRM
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
    
    /// Fetch channel detail
    func fetchChannelDetail(id: String) async -> [String: Any]? {
        var components = URLComponents(string: "\(baseURL)/Channel/\(id)")!
        components.queryItems = [
            URLQueryItem(name: "images", value: "S_DESC"),
            URLQueryItem(name: "packages", value: packagesToken),
            URLQueryItem(name: "services", value: servicesToken)
        ]
        
        guard let url = components.url else { return nil }
        
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
    
    /// Fetch EPG schedules
    func fetchSchedules(channelIds: [String], from: Date, to: Date) async -> [[String: Any]] {
        let formatter = ISO8601DateFormatter()
        let fromStr = formatter.string(from: from)
        let toStr = formatter.string(from: to)
        
        var components = URLComponents(string: "\(baseURL)/schedules")!
        components.queryItems = [
            URLQueryItem(name: "page", value: "0"),
            URLQueryItem(name: "size", value: "1000"),
            URLQueryItem(name: "filter[end][gt]", value: fromStr),
            URLQueryItem(name: "filter[start][lt]", value: toStr),
            URLQueryItem(name: "packages", value: packagesToken),
            URLQueryItem(name: "services", value: servicesToken),
            URLQueryItem(name: "region", value: regionToken)
        ]
        
        // Add channel IDs
        for id in channelIds.prefix(20) {
            components.queryItems?.append(URLQueryItem(name: "filter[channel][]", value: id))
        }
        
        guard let url = components.url else { return [] }
        
        var request = URLRequest(url: url)
        request.setValue("https://portal.app.flow.com.ar", forHTTPHeaderField: "Origin")
        request.setValue("https://portal.app.flow.com.ar/", forHTTPHeaderField: "Referer")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            return json?["data"] as? [[String: Any]] ?? []
        } catch {
            return []
        }
    }
}
