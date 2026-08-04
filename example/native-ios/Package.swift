// swift-tools-version: 5.9
import PackageDescription

// iOS only — an earlier revision also declared `.macOS(.v12)`, which made a bare
// `swift build` produce a macOS binary and quietly pass without ever exercising
// the iOS target this harness exists to test.
//
// SwiftPM cannot build a runnable `.app`: it has no notion of an app bundle, so
// `Info.plist` (URL schemes, `LSApplicationQueriesSchemes`) is never applied to
// any product here. Running on a simulator needs an Xcode project — see the
// README. This package exists so the sources compile and typecheck in CI on a
// Linux-cheap path, not to produce an installable app.
let package = Package(
    name: "FrakExampleiOSApp",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(
            name: "FrakExampleiOSApp",
            targets: ["FrakExampleiOSApp"]
        )
    ],
    targets: [
        .target(
            name: "FrakExampleiOSApp",
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
