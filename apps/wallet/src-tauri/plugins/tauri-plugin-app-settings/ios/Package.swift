// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-app-settings",
    platforms: [
        .macOS(.v10_13),
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-app-settings",
            type: .static,
            targets: ["tauri-plugin-app-settings"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-app-settings",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
