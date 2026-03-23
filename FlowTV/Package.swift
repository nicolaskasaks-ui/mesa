// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FlowTV",
    platforms: [
        .tvOS(.v17)
    ],
    targets: [
        .executableTarget(
            name: "FlowTV",
            path: "FlowTV"
        )
    ]
)
