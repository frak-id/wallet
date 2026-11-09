// swift-tools-version:5.7

import PackageDescription

let package = Package(
    name: "tauri-plugin-store-review",
    platforms: [
        .macOS(.v10_13),
        .iOS(.v16),
    ],
    products: [
        .library(
            name: "tauri-plugin-store-review",
            type: .static,
            targets: ["tauri-plugin-store-review"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-store-review",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
