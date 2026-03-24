// swift-tools-version:5.3

import PackageDescription

let package = Package(
    name: "tauri-plugin-web-auth-session",
    platforms: [
        .macOS(.v10_13),
        .iOS(.v14),
    ],
    products: [
        .library(
            name: "tauri-plugin-web-auth-session",
            type: .static,
            targets: ["tauri-plugin-web-auth-session"]),
    ],
    dependencies: [
        .package(name: "Tauri", path: "../.tauri/tauri-api")
    ],
    targets: [
        .target(
            name: "tauri-plugin-web-auth-session",
            dependencies: [
                .byName(name: "Tauri")
            ],
            path: "Sources")
    ]
)
