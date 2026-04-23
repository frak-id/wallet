// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-frak-share",
    platforms: [
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-frak-share",
            type: .static,
            targets: ["tauri-plugin-frak-share"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-frak-share",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
