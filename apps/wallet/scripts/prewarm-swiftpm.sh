#!/usr/bin/env bash
# Resolves firebase-ios-sdk once, serially, into the global SwiftPM cache.
#
# swift-rs runs `swift build` from every plugin's build.rs in parallel, and on a cold
# cache they race on the same Firebase binary artifacts ("already exists in file
# system", firebase/firebase-ios-sdk#14821). A stub package fetches the same URLs first.
set -euo pipefail

manifest="$(dirname "$0")/../src-tauri/plugins/tauri-plugin-frak-firebase/ios/Package.swift"
version=$(sed -n 's|.*firebase-ios-sdk", from: "\([0-9.]*\)".*|\1|p' "$manifest")
if [ -z "$version" ]; then
    echo "::error::no firebase-ios-sdk pin found in $manifest" >&2
    exit 1
fi

dir=$(mktemp -d)
mkdir -p "$dir/Sources/Prewarm"
echo '// stub' > "$dir/Sources/Prewarm/Stub.swift"
cat > "$dir/Package.swift" <<EOF
// swift-tools-version:5.7
import PackageDescription
let package = Package(
    name: "Prewarm",
    platforms: [.iOS(.v16), .macOS(.v10_15)],
    products: [.library(name: "Prewarm", targets: ["Prewarm"])],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk", from: "$version"),
    ],
    targets: [
        .target(
            name: "Prewarm",
            dependencies: [
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk"),
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAnalytics", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
            ]
        )
    ]
)
EOF
echo "[prewarm] firebase-ios-sdk from $version"
cd "$dir" && swift package resolve
