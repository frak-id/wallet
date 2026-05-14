// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-firebase",
    platforms: [
        .macOS(.v10_15),
        .iOS(.v14),
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
        // Single firebase-ios-sdk dependency for FCM + Crashlytics. Replaces
        // the two separate clones the FCM + Crashlytics plugins used to pull
        // independently. Keep the version pin in sync with the SwiftPM
        // pre-warm step in .github/workflows/tauri-mobile-release.yml.
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "12.13.0"),
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-firebase",
            dependencies: [
                .byName(name: "Tauri"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
            ],
            path: "Sources"
        )
    ]
)
