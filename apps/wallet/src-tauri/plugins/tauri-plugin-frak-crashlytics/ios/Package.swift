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
        // Pinned to the same major as tauri-plugin-fcm to keep all Firebase
        // pods/SPM modules on a single internal version.
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "12.11.0"),
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-crashlytics",
            dependencies: [
                .byName(name: "Tauri"),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
            ],
            path: "Sources"
        )
    ]
)
