// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-recovery-hint",
    platforms: [
        .macOS(.v10_13),
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-recovery-hint",
            type: .static,
            targets: ["tauri-plugin-recovery-hint"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-recovery-hint",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
