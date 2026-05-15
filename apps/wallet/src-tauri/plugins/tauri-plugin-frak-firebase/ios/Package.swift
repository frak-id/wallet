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
        // Tiny Objective-C target that bridges @try/@catch into Swift so the
        // plugin can downgrade FirebaseApp.configure() NSException crashes
        // (missing GoogleService-Info.plist, malformed plist, bundle-id
        // mismatch, double-configure) into soft failures. Pure Swift cannot
        // catch NSException; mixed-language inside a single SwiftPM target
        // is unsupported, so we declare two targets and depend.
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
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
            ],
            path: "Sources",
            exclude: ["FrakObjCExceptionCatcher"])
    ]
)
