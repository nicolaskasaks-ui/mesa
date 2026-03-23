import SwiftUI

extension Color {
    // Flow brand colors
    static let flowCyan = Color(red: 0.0, green: 0.8, blue: 0.9)
    static let flowPurple = Color(red: 0.4, green: 0.0, blue: 0.8)
    static let flowDarkBg = Color(red: 0.05, green: 0.0, blue: 0.12)
    static let flowCardBg = Color(white: 1.0, opacity: 0.08)
    static let flowLive = Color.red

    // Gradient helpers
    static let flowGradient = LinearGradient(
        colors: [flowCyan, flowPurple],
        startPoint: .leading,
        endPoint: .trailing
    )
}

extension View {
    func flowBackground() -> some View {
        self.background(
            LinearGradient(
                colors: [
                    Color(red: 0.08, green: 0.0, blue: 0.18),
                    Color(red: 0.03, green: 0.0, blue: 0.08)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
        )
    }
}
