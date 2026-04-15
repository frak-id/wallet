// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-install-referrer",
    platforms: [
        .macOS(.v10_13),
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-install-referrer",
            type: .static,
            targets: ["tauri-plugin-install-referrer"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-install-referrer",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
