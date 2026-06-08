// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-keyboard",
    platforms: [
        .macOS(.v10_13),
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-keyboard",
            type: .static,
            targets: ["tauri-plugin-frak-keyboard"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-keyboard",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
