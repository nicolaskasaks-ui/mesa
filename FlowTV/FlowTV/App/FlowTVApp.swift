import SwiftUI

@main
struct FlowTVApp: App {
    @StateObject private var authManager = AuthManager()
    @StateObject private var flowAPI = FlowAPIService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .environmentObject(flowAPI)
                .onAppear {
                    // Link auth manager to API service
                    authManager.apiService = flowAPI
                }
                .preferredColorScheme(.dark)
        }
    }
}
