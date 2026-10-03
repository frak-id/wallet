// swift-tools-version:5.7

import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-glass",
    platforms: [
        .iOS(.v16),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-glass",
            type: .static,
            targets: ["tauri-plugin-frak-glass"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-glass",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
