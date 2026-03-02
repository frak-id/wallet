#!/bin/bash
# Sync version from package.json to Tauri config files
# Usage: ./scripts/sync-version.sh [version]
#   If no version arg, reads from package.json
#   CFBundleVersion uses x.x.x format (matches CFBundleShortVersionString)

set -euo pipefail

WALLET_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$WALLET_DIR/src-tauri"
INFO_PLIST="$TAURI_DIR/gen/apple/app_iOS/Info.plist"

sed_in_place() {
    local expression="$1"
    local file="$2"

    # `-i.bak` works on both GNU and BSD sed.
    sed -i.bak -e "$expression" "$file"
    rm -f "${file}.bak"
}

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
biome format --write "$TAURI_DIR/tauri.conf.json" > /dev/null 2>&1
echo "[sync-version] Updated tauri.conf.json"

# 2. Cargo.toml
sed_in_place "s/^version = \".*\"/version = \"$VERSION\"/" "$TAURI_DIR/Cargo.toml"
echo "[sync-version] Updated Cargo.toml"

# 3. project.yml (CFBundleShortVersionString + CFBundleVersion)
sed_in_place "s/CFBundleShortVersionString: .*/CFBundleShortVersionString: $VERSION/" "$TAURI_DIR/gen/apple/project.yml"
sed_in_place "s/CFBundleVersion: .*/CFBundleVersion: $VERSION/" "$TAURI_DIR/gen/apple/project.yml"
echo "[sync-version] Updated project.yml"

# 4. Info.plist (CFBundleShortVersionString + CFBundleVersion)
if [ -f "$INFO_PLIST" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$INFO_PLIST"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION" "$INFO_PLIST"
    echo "[sync-version] Updated Info.plist"
fi

echo "[sync-version] Done — version $VERSION"
