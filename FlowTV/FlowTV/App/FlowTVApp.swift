import SwiftUI

@main
struct FlowTVApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var flowAPI = FlowAPIService()
    @StateObject private var streamingService = StreamingService()
    @StateObject private var favoritesManager = FavoritesManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(flowAPI)
                .environmentObject(streamingService)
                .environmentObject(favoritesManager)
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
