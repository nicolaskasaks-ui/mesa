import SwiftUI

@main
struct FlowTVApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var flowAPI = FlowAPIService()
    @StateObject private var streamingService = StreamingService()
    @StateObject private var favoritesManager = FavoritesManager()
    @StateObject private var csdkBridge = CSDKBridge.shared
    @StateObject private var m11Service = FlowM11Service.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(authManager.easyLogin)
                .environmentObject(flowAPI)
                .environmentObject(streamingService)
                .environmentObject(favoritesManager)
                .environmentObject(csdkBridge)
                .environmentObject(m11Service)
                .onAppear {
                    // Link services together
                    authManager.apiService = flowAPI
                    authManager.streamingService = streamingService
                    streamingService.configure(apiService: flowAPI)

                    // Auto-load real Flow channels on launch
                    FlowM11Service.shared.configure(
                        packages: "bklkOggBGAMi8AQHvOYwzNjodNmrcuKRRhc8wLC+8nzasrXznA6BwqNElWRC43noPxa0oker/OZc7PN+RDWbqNL0p3q0WEt7R2+wp/qZOr37/ZiamWZDX0A0aufMJY04TiCNiQuV/wJ4oikyzESxb1hgWkPdebHioZ8f08Djz4IKEPNLu8ySlXbnZi0hkiDwMtrWL2XM1oO4/ppzt3Yw33hBM0g2yrjBYZaLg1sObThiAlbEQkBb3qxS2w5WHnOUx9GEqK5v83vvT+gdVMAct61XhMxsg6SVILF+Xje4uW/2d3jDwt9jKoXsQVrVOocLqTEFvb77jFoKrmqoYB39QifbCMEcXa7K3EEtZXxZ9y/x/jM3SV4dhyvUcMmlHP7wFtWzCTVljIAQTnhm7VwqU9pfan3ga0oOFuRrDRh4R7nLwuHXvCA8EvBlI9s9Ki+T5zq9dZMbq06PrMX6PoYBQkkbdYStPztVzKENxEddws+EttPThpzNsSg8VuaJuHHgIt5aZViNaSm+JpBuoq3ImV5oXutLYrBjtGPxY/fJS0tZ+A0PDFhVuxNvegEhfLXzyLTgtonXsBKD/FMTQPdQAjAsA2IHYCg3gzDjiT8Z6dRlrdZji8jZbELhSkT0wVIcmuoQfQSe90aVlshHttkof0m9c/0uhNJ67y/z0zBW/i80Ds23bpOSu1LcrLCIu/eCSTbP5YFv2uTpoQzCLnBeBkoalxBKPGXhXlMZvr4Yl27MMUnV/YIWji72EkSOOO5D8tdIXsSNmlSJg60JaFEe66gBDAwTp6YqAoGMfkI5/BnkvVy/ozIgB3/U9MrSGX7miwX8nNPhYLq5LVg=",
                        services: "bklkOggBIkBNcXMmCGwXl7LIiwJAfoykrfQs3O/ZN1zXHHdoA1X88fJxAgLzKDWpZVxhR95StuzytBfg1FzpIOFejZ8V7cnj",
                        region: "bklkOggBImCQp3+kUWjJrhVDoBFSFSWjzSVpxbnS96ChubJcYAr+ijxovCNqP1KU/DmaJp5YruVFyus0Zae3inNQSlIpHGBYQpVNGRezdSfN+AeXg2kQOO6WLXL5fU83IoAEJzOP+YY=",
                        deviceId: "d9d0e40a0769acf32b67f81adbd1e37a",
                        profileId: "flow:999900002715839:P"
                    )
                    // Skip login - go directly to content
                    authManager.loginAsDemo()
                    Task {
                        await FlowM11Service.shared.fetchChannels()
                    }
                }
                .preferredColorScheme(.dark)
        }
    }
}
