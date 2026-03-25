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
                        userDeviceToken: "bklkOggBIoABsDUskYo+FVbYmdd1d4iQjIyP4LSIkO4TErDqGaaP7uZm3Nhymnpck7r0j65gjhOtmDuKwqPCbczXuHOs9vY0N0kRulXd5QcNPh3/riCkURrIYOZoes8Pyqap5qmmmPS3cv+AmuRh04aZnP19uZxihT8Nhfn2mhsmbgvfgANS/6w=",
                        casId: "676dda401fe236763b8c0b5c505edf28",
                        deviceId: "d9d0e40a0769acf32b67f81adbd1e37a",
                        profileId: "flow:999900002715839:P"
                    )
                    // Skip login - go directly to content
                    authManager.loginAsDemo()
                    Task {
                        await FlowM11Service.shared.initializeAndLoad()
                    }
                }
                .preferredColorScheme(.dark)
        }
    }
}
