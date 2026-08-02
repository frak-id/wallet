// swift-tools-version: 5.9
import PackageDescription

// `scripts/run.sh` always passes an explicit iOS-simulator triple, but `.macOS(.v12)`
// is still declared: `swift test`'s second stage runs the compiled tests directly on
// the host toolchain, and without a macOS floor that falls back to a deployment
// target too old for APIs like `Logger`. Swift 6 language mode isn't set here because
// `.swiftLanguageMode(_:)` needs tools-version 6.0; `scripts/run.sh` passes
// `-swift-version 6` at build/test time instead. See the README for details.
let package = Package(
    name: "FrakSDK",
    // Required for the localized `.lproj` resources FrakSDKUI ships.
    defaultLocalization: "en",
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
                .process("Resources")
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
