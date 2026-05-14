// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-crashlytics",
    platforms: [
        .macOS(.v10_15),
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-crashlytics",
            type: .static,
            targets: ["tauri-plugin-frak-crashlytics"]
        )
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api"),
        // Kept on the same major+minor floor as tauri-plugin-fcm so SPM resolves
        // a single firebase-ios-sdk across both plugins. Bumping one without the
        // other risks two copies of Firebase linked into the app binary, which
        // would silently break Crashlytics' crash handler registration.
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "12.13.0"),
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-crashlytics",
            dependencies: [
                .byName(name: "Tauri"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
            ],
            path: "Sources"
        )
    ]
)
