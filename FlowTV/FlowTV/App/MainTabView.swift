import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Inicio", systemImage: "house.fill")
                }
                .tag(0)

            LiveTVView()
                .tabItem {
                    Label("TV en Vivo", systemImage: "tv.fill")
                }
                .tag(1)

            OnDemandView()
                .tabItem {
                    Label("On Demand", systemImage: "play.rectangle.fill")
                }
                .tag(2)

            SearchView()
                .tabItem {
                    Label("Buscar", systemImage: "magnifyingglass")
                }
                .tag(3)

            SettingsView()
                .tabItem {
                    Label("Mi Cuenta", systemImage: "person.fill")
                }
                .tag(4)
        }
    }
}
