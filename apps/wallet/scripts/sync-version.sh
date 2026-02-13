#!/bin/bash
# Sync version from package.json to Tauri config files
# Usage: ./scripts/sync-version.sh [version]
#   If no version arg, reads from package.json

set -e

WALLET_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$WALLET_DIR/src-tauri"

# Resolve version: argument > package.json
if [ -n "$1" ]; then
    VERSION="$1"
    # Also update package.json
    tmp=$(mktemp)
    jq --arg v "$VERSION" '.version = $v' "$WALLET_DIR/package.json" > "$tmp" && mv "$tmp" "$WALLET_DIR/package.json"
    echo "[sync-version] Updated package.json -> $VERSION"
else
    VERSION=$(jq -r '.version' "$WALLET_DIR/package.json")
fi

if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
    echo "[sync-version] ERROR: No version found"
    exit 1
fi

echo "[sync-version] Syncing version $VERSION"

# 1. tauri.conf.json
tmp=$(mktemp)
jq --arg v "$VERSION" '.version = $v' "$TAURI_DIR/tauri.conf.json" > "$tmp" && mv "$tmp" "$TAURI_DIR/tauri.conf.json"
echo "[sync-version] Updated tauri.conf.json"

# 2. Cargo.toml
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" "$TAURI_DIR/Cargo.toml"
echo "[sync-version] Updated Cargo.toml"

# 3. project.yml (CFBundleShortVersionString + CFBundleVersion)
sed -i '' "s/CFBundleShortVersionString: .*/CFBundleShortVersionString: $VERSION/" "$TAURI_DIR/gen/apple/project.yml"
sed -i '' "s/CFBundleVersion: .*/CFBundleVersion: \"$VERSION\"/" "$TAURI_DIR/gen/apple/project.yml"
echo "[sync-version] Updated project.yml"

echo "[sync-version] Done — all files at $VERSION"
