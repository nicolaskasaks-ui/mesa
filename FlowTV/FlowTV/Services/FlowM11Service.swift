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
                statusMessage = "Error de sesión"
                return false
            }

            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let tokens = json["tokens"] as? [String: Any] else {
                statusMessage = "Respuesta inválida"
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

    func fetchChannels() async {
        // Auto-refresh tokens if needed
        if packagesToken.isEmpty {
            // Try session refresh first
            if !userDeviceToken.isEmpty {
                _ = await refreshSession()
            }
            // If still empty, use hardcoded known-working tokens
            if packagesToken.isEmpty {
                m11Log.info("[M11] Using hardcoded tokens")
                self.packagesToken = "bklkOggBGAMi8AQHvOYwzNjodNmrcuKRRhc8wLC+8nzasrXznA6BwqNElWRC43noPxa0oker/OZc7PN+RDWbqNL0p3q0WEt7R2+wp/qZOr37/ZiamWZDX0A0aufMJY04TiCNiQuV/wJ4oikyzESxb1hgWkPdebHioZ8f08Djz4IKEPNLu8ySlXbnZi0hkiDwMtrWL2XM1oO4/ppzt3Yw33hBM0g2yrjBYZaLg1sObThiAlbEQkBb3qxS2w5WHnOUx9GEqK5v83vvT+gdVMAct61XhMxsg6SVILF+Xje4uW/2d3jDwt9jKoXsQVrVOocLqTEFvb77jFoKrmqoYB39QifbCMEcXa7K3EEtZXxZ9y/x/jM3SV4dhyvUcMmlHP7wFtWzCTVljIAQTnhm7VwqU9pfan3ga0oOFuRrDRh4R7nLwuHXvCA8EvBlI9s9Ki+T5zq9dZMbq06PrMX6PoYBQkkbdYStPztVzKENxEddws+EttPThpzNsSg8VuaJuHHgIt5aZViNaSm+JpBuoq3ImV5oXutLYrBjtGPxY/fJS0tZ+A0PDFhVuxNvegEhfLXzyLTgtonXsBKD/FMTQPdQAjAsA2IHYCg3gzDjiT8Z6dRlrdZji8jZbELhSkT0wVIcmuoQfQSe90aVlshHttkof0m9c/0uhNJ67y/z0zBW/i80Ds23bpOSu1LcrLCIu/eCSTbP5YFv2uTpoQzCLnBeBkoalxBKPGXhXlMZvr4Yl27MMUnV/YIWji72EkSOOO5D8tdIXsSNmlSJg60JaFEe66gBDAwTp6YqAoGMfkI5/BnkvVy/ozIgB3/U9MrSGX7miwX8nNPhYLq5LVg="
                self.servicesToken = "bklkOggBIkBNcXMmCGwXl7LIiwJAfoykrfQs3O/ZN1zXHHdoA1X88fJxAgLzKDWpZVxhR95StuzytBfg1FzpIOFejZ8V7cnj"
                self.regionToken = "bklkOggBImCQp3+kUWjJrhVDoBFSFSWjzSVpxbnS96ChubJcYAr+ijxovCNqP1KU/DmaJp5YruVFyus0Zae3inNQSlIpHGBYQpVNGRezdSfN+AeXg2kQOO6WLXL5fU83IoAEJzOP+YY="
            }
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
