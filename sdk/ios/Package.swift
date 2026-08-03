// swift-tools-version: 5.9
import PackageDescription

// `.macOS(.v12)` is declared because shipping code in `Sources/FrakSDK` genuinely needs
// it — not a `swift test` host-stage quirk. Two APIs set the floor: `FrakLogger`'s
// `os.Logger` (Core/FrakLogger.swift, needs macOS 11) and `HTTPClient`'s
// `URLSession.data(for:delegate:)` (Net/HTTPClient.swift, needs macOS 12, the higher of
// the two and therefore the actual floor). Verified with `swiftc -typecheck -target
// arm64-apple-macosx<N>` on each API in isolation: `Logger` typechecks at 11.0 and fails
// at 10.15; `data(for:delegate:)` typechecks at 12.0 and fails at 11.0. Do not lower this
// without re-verifying both. Gating both behind `@available` to drop `.macOS` from
// `platforms:` entirely was evaluated and rejected: it would need a parallel pre-12
// fallback implementation of both networking (pre-async `URLSession` completion handlers)
// and logging (`os_log`'s C API, to keep structured `privacy: .public` redaction),
// duplicating two subsystems for a platform this SDK doesn't ship a product on.
// Swift 6 language mode isn't set here because `.swiftLanguageMode(_:)` needs
// tools-version 6.0; `scripts/run.sh` passes `-swift-version 6` at build/test time
// instead. See the README for details.
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
                // `.copy`, never `.process`: the manifest must land at the resource-bundle
                // root unmodified for Apple's aggregation to see it. FrakSDKUI ships its
                // own because it is a separately consumable `.library` product.
                .copy("PrivacyInfo.xcprivacy"),
                .process("Resources"),
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
