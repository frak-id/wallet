// swift-tools-version:5.7

import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-updater",
    platforms: [
        .iOS(.v16),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-updater",
            type: .static,
            targets: ["tauri-plugin-frak-updater"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-updater",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
