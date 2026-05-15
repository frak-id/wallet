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
        // Tiny Objective-C target that bridges @try/@catch into Swift so the
        // plugin can downgrade NSUbiquitousKeyValueStore NSException crashes
        // (stale entitlement, signed-out iCloud edge cases) into soft failures.
        // Pure Swift cannot catch NSException; mixed-language inside a single
        // SwiftPM target is unsupported, so we declare two targets and depend.
        .target(
            name: "ObjCExceptionCatcher",
            path: "Sources/ObjCExceptionCatcher",
            publicHeadersPath: "include"),
        .target(
            name: "tauri-plugin-recovery-hint",
            dependencies: [
                .byName(name: "Tauri"),
                .byName(name: "ObjCExceptionCatcher"),
            ],
            path: "Sources",
            exclude: ["ObjCExceptionCatcher"])
    ]
)
