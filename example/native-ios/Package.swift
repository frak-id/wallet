// swift-tools-version: 5.9
import PackageDescription

// .macOS(.v12) is required: SwiftPM enforces a dependent package's platform floor to be no
// lower than its dependencies' (sdk/ios needs macOS 12). A bare `swift build` here still
// produces a macOS binary — `scripts/run.sh build` passes an iOS simulator target instead.
//
// SwiftPM cannot build a runnable .app: Info.plist (URL schemes,
// LSApplicationQueriesSchemes) is never applied. This typechecks the sources in CI.
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
                // For a *path* dependency, SwiftPM derives the package identity from the last
                // path component of `path:` ("ios"), not from the manifest's declared
                // `name: "FrakSDK"` — that name only becomes the identity via a `url:` dependency.
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
