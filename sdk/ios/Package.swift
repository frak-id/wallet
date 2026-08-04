// swift-tools-version: 5.9
import PackageDescription

// macOS(.v12) floor: HTTPClient needs URLSession.data(for:delegate:) (macOS 12); FrakLogger needs os.Logger (macOS 11). Do not lower without re-checking both.
// `.swiftLanguageMode(.v6)` needs tools-version 6.0; this manifest is 5.9, so `-swift-version 6` is passed from scripts/run.sh instead.
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
            ]
        ),
        .target(
            name: "FrakSDKUI",
            dependencies: ["FrakSDK"],
            path: "Sources/FrakSDKUI",
            resources: [
                // `.copy`, not `.process`: the manifest must land at the resource-bundle root unmodified.
                .copy("PrivacyInfo.xcprivacy")
            ]
        ),
        .testTarget(
            name: "FrakSDKTests",
            dependencies: ["FrakSDK"],
            path: "Tests/FrakSDKTests"
        ),
        .testTarget(
            name: "FrakSDKUITests",
            dependencies: ["FrakSDKUI", "FrakSDK"],
            path: "Tests/FrakSDKUITests"
        ),
    ]
)
