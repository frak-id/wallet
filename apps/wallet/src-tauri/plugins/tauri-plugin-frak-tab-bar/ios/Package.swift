// swift-tools-version:5.7

import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-tab-bar",
    platforms: [
        .iOS(.v16),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-tab-bar",
            type: .static,
            targets: ["tauri-plugin-frak-tab-bar"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-tab-bar",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
