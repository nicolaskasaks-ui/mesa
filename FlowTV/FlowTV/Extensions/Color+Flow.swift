import SwiftUI

// Flow brand + Apple TV design system
extension Color {
    static let flowCyan = Color(red: 0.0, green: 0.78, blue: 0.9)
    static let flowPurple = Color(red: 0.45, green: 0.0, blue: 0.8)
}

extension ShapeStyle where Self == LinearGradient {
    static var flowBrand: LinearGradient {
        LinearGradient(
            colors: [.flowCyan, .flowPurple],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}
