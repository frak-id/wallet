// swift-tools-version:5.7

import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-webauthn",
    platforms: [
        .iOS(.v16),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-webauthn",
            type: .static,
            targets: ["tauri-plugin-frak-webauthn"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-webauthn",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
