import Foundation
import os

private let bridgeLog = Logger(subsystem: "com.flowtv.app", category: "MinervaWebBridge")

/// MinervaWebBridge — Connects to the local CSDK Proxy Server
/// that runs the Minerva SDK in a headless Chrome browser.
///
/// The proxy server (csdk-proxy/server.js) handles the proprietary
/// M11 protocol and exposes real Flow data via REST.
@MainActor
class MinervaWebBridge: ObservableObject {
    static let shared = MinervaWebBridge()

    /// The proxy server URL (runs on the host Mac)
    #if targetEnvironment(simulator)
    private let proxyBaseURL = "http://localhost:8765"
    #else
    // On real Apple TV, the proxy would run on a server
    private let proxyBaseURL = "http://192.168.1.100:8765"
    #endif

    @Published var isReady = false
    @Published var channels: [BridgeChannel] = []

    private var token: String?

    init() {}

    /// Start the bridge — tells the proxy to load the token
    func start(with token: String) {
        self.token = token
        bridgeLog.info("[Bridge] Starting with proxy at \(self.proxyBaseURL)")

        Task {
            await pollForChannels()
        }
    }

    /// Poll the proxy server for channel data
    private func pollForChannels() async {
        // Poll every 2 seconds for up to 60 seconds
        for attempt in 1...30 {
            do {
                let statusURL = URL(string: "\(proxyBaseURL)/status")!
                let (data, _) = try await URLSession.shared.data(from: statusURL)
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let ready = json["ready"] as? Bool ?? false
                    let count = json["channelCount"] as? Int ?? 0
                    bridgeLog.info("[Bridge] Poll \(attempt): ready=\(ready), channels=\(count)")

                    if ready && count > 0 {
                        await fetchChannels()
                        return
                    }
                }
            } catch {
                bridgeLog.info("[Bridge] Poll \(attempt) failed: \(error.localizedDescription)")
            }

            try? await Task.sleep(nanoseconds: 2_000_000_000)
        }

        bridgeLog.info("[Bridge] Proxy not ready after 60s timeout")
    }

    /// Fetch channels from the proxy
    func fetchChannels() async {
        do {
            let url = URL(string: "\(proxyBaseURL)/channels")!
            let (data, _) = try await URLSession.shared.data(from: url)
            if let json = try JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                self.channels = json.compactMap { dict -> BridgeChannel? in
                    guard let name = dict["name"] as? String ?? dict["title"] as? String else {
                        return nil
                    }
                    let id = "\(dict["id"] ?? dict["contentId"] ?? "0")"
                    let number = dict["number"] as? Int ?? dict["channelNumber"] as? Int ?? 0
                    let logo = dict["logo"] as? String ?? dict["image"] as? String

                    // Try to extract stream URL
                    var streamURL: String?
                    if let resources = dict["playbackResources"] as? [String: Any],
                       let resource = (resources["resource"] as? [[String: Any]])?.first {
                        streamURL = resource["url"] as? String
                    }

                    return BridgeChannel(
                        id: id,
                        name: name,
                        number: number,
                        logo: logo,
                        streamURL: streamURL
                    )
                }
                self.isReady = true
                bridgeLog.info("[Bridge] Loaded \(self.channels.count) real channels!")
            }
        } catch {
            bridgeLog.info("[Bridge] fetchChannels error: \(error.localizedDescription)")
        }
    }

    struct BridgeChannel: Identifiable {
        let id: String
        let name: String
        let number: Int
        let logo: String?
        let streamURL: String?
    }
}
