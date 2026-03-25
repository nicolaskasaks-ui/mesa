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
                }
                .preferredColorScheme(.dark)
        }
    }
}
