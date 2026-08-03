// swift-tools-version: 5.9
import PackageDescription

// An earlier revision declared iOS only, specifically so a bare `swift build`
// (no explicit target triple) would produce a macOS binary and fail loudly
// rather than quietly pass without ever exercising the iOS target this harness
// exists to test. Depending on the real SDK reopens that hole: `sdk/ios` declares
// `.macOS(.v12)` (shipping code needs both `os.Logger`, macOS 11+, and
// `URLSession.data(for:delegate:)`, macOS 12+ — the higher of the two sets the
// floor), and SwiftPM requires every dependent package to declare a macOS floor at
// least as high as its dependencies' — omitting `.macOS` here does not opt out of
// that check, it just fails resolution with "requires macos 10.13" (SwiftPM's
// implicit floor) vs. "requires macos 12.0". So `.macOS(.v12)` is back below, and
// the actual protection against a silent macOS pass is `scripts/run.sh build`'s
// explicit `-Xswiftc -target arm64-apple-ios15.0-simulator` — a bare `swift build`
// in this directory now again produces a macOS binary and says nothing about iOS.
//
// SwiftPM cannot build a runnable `.app`: it has no notion of an app bundle, so
// `Info.plist` (URL schemes, `LSApplicationQueriesSchemes`) is never applied to
// any product here. Running on a simulator needs an Xcode project — see the
// README. This package exists so the sources compile and typecheck in CI on a
// Linux-cheap path, not to produce an installable app.
let package = Package(
    name: "FrakExampleiOSApp",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        .library(
            name: "FrakExampleiOSApp",
            targets: ["FrakExampleiOSApp"]
        )
    ],
    dependencies: [
        // Real SDK, consumed as a local path dependency (this harness never publishes).
        .package(path: "../../sdk/ios")
    ],
    targets: [
        .target(
            name: "FrakExampleiOSApp",
            dependencies: [
                // NOTE on the `package:` identifier — a real papercut a merchant would hit:
                // sdk/ios's manifest declares `name: "FrakSDK"`, and that is what you'd expect
                // to write here. It does not resolve. For a *path* dependency, SwiftPM derives
                // the package identity from the last path component of the `path:` above
                // (`ios`), not from the manifest's declared `name:`. The declared name only
                // becomes the identity for a dependency resolved via `url:`. Confirmed by
                // letting `swift build` fail on `product 'FrakSDK' required by package
                // 'frakexampleiosapp' target 'FrakExampleiOSApp' not found in package 'ios'`
                // and switching `package:` below to match.
                .product(name: "FrakSDK", package: "ios"),
                .product(name: "FrakSDKUI", package: "ios"),
            ],
            path: "Sources/FrakExampleiOSApp",
            exclude: [
                "Info.plist"
            ],
            resources: [
                .process("PrivacyInfo.xcprivacy")
            ]
        )
    ]
)
