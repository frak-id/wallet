// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-firebase",
    platforms: [
        .macOS(.v11),
        .iOS(.v16),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-firebase",
            type: .static,
            targets: ["tauri-plugin-frak-firebase"]
        )
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api"),
        // Single firebase-ios-sdk dependency for FCM + Crashlytics.
        // apps/wallet/scripts/prewarm-swiftpm.sh parses this line's `from:` pin.
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "13.1.1"),
    ],
    targets: [
        // Objective-C @try/@catch bridge, so a FirebaseApp.configure()
        // NSException (missing or malformed GoogleService-Info.plist, bundle-id
        // mismatch, double-configure) becomes a soft failure. Swift cannot catch
        // NSException, and SwiftPM forbids mixed languages in one target.
        .target(
            name: "FrakObjCExceptionCatcher",
            path: "Sources/FrakObjCExceptionCatcher",
            publicHeadersPath: "include"),
        .target(
            name: "tauri-plugin-frak-firebase",
            dependencies: [
                .byName(name: "Tauri"),
                .byName(name: "FrakObjCExceptionCatcher"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseInstallations", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
            ],
            path: "Sources",
            exclude: ["FrakObjCExceptionCatcher"])
    ]
)
