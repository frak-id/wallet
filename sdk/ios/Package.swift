// swift-tools-version: 6.0
import PackageDescription

// macOS(.v12) floor: HTTPClient needs URLSession.data(for:delegate:) (macOS 12); FrakLogger needs os.Logger (macOS 11). Do not lower without re-checking both.
// Tools-version 6.0 is what makes `.swiftLanguageMode(.v6)` below available at all. It costs a
// hard Xcode 16 floor for anyone resolving this package. `.unsafeFlags` is not an
// alternative: SwiftPM forbids it on a package resolved as a dependency.
let package = Package(
    name: "FrakSDK",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        // Two artifacts, so a merchant taking only tracking never pulls in a web view.
        .library(
            name: "FrakSDK",
            targets: ["FrakSDK"]
        ),
        .library(
            name: "FrakSDKUI",
            targets: ["FrakSDKUI"]
        ),
    ],
    targets: [
        // Zero third-party runtime dependencies: `dependencies` is intentionally absent rather than empty.
        .target(
            name: "FrakSDK",
            path: "Sources/FrakSDK",
            resources: [
                .copy("PrivacyInfo.xcprivacy")
            ],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .target(
            name: "FrakSDKUI",
            dependencies: ["FrakSDK"],
            path: "Sources/FrakSDKUI",
            resources: [
                // `.copy`, not `.process`: the manifest must land at the resource-bundle root unmodified.
                .copy("PrivacyInfo.xcprivacy")
            ],
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "FrakSDKTests",
            dependencies: ["FrakSDK"],
            path: "Tests/FrakSDKTests",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
        .testTarget(
            name: "FrakSDKUITests",
            dependencies: ["FrakSDKUI", "FrakSDK"],
            path: "Tests/FrakSDKUITests",
            swiftSettings: [.swiftLanguageMode(.v6)]
        ),
    ]
)
