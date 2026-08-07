// swift-tools-version: 6.0
import PackageDescription

// macOS(.v12) floor: HTTPClient needs URLSession.data(for:delegate:) (macOS 12); FrakLogger needs os.Logger (macOS 11). Do not lower without re-checking both.
// Tools-version 6.0 (up from 5.9) is what makes `.swiftLanguageMode(.v6)` below available at
// all — it's a PackageDescription 6.0 API. The consequence: a merchant's own `swift build` or
// Xcode SwiftPM resolve now needs Xcode 16 at minimum to read this manifest, not just to run
// scripts/run.sh's CI-only flags. `.unsafeFlags` was considered instead and rejected — SwiftPM
// refuses `.unsafeFlags` on any target of a package resolved as someone else's dependency, which
// this always is.
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
