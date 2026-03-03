#!/bin/bash
# Sync version from package.json to Tauri config files
# Usage: ./scripts/sync-version.sh [version] [build-number]
#   If no version arg, reads from package.json
#   If no build-number arg, auto-increments from current CFBundleVersion

set -e

WALLET_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_DIR="$WALLET_DIR/src-tauri"
INFO_PLIST="$TAURI_DIR/gen/apple/app_iOS/Info.plist"

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

# Resolve build number: argument > auto-increment from Info.plist
if [ -n "$2" ]; then
    BUILD_NUMBER="$2"
else
    if [ -f "$INFO_PLIST" ]; then
        CURRENT_BUILD=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$INFO_PLIST" 2>/dev/null || echo "0")
        # Strip non-numeric chars (CFBundleVersion must be integer build number)
        CURRENT_BUILD="${CURRENT_BUILD//[!0-9]/}"
        CURRENT_BUILD="${CURRENT_BUILD:-0}"
        BUILD_NUMBER=$((CURRENT_BUILD + 1))
    else
        BUILD_NUMBER=1
    fi
fi

echo "[sync-version] Syncing version $VERSION (build $BUILD_NUMBER)"

# 1. tauri.conf.json
tmp=$(mktemp)
jq --arg v "$VERSION" '.version = $v' "$TAURI_DIR/tauri.conf.json" > "$tmp" && mv "$tmp" "$TAURI_DIR/tauri.conf.json"
biome format --write "$TAURI_DIR/tauri.conf.json" > /dev/null 2>&1
echo "[sync-version] Updated tauri.conf.json"

# 2. Cargo.toml
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" "$TAURI_DIR/Cargo.toml"
echo "[sync-version] Updated Cargo.toml"

# 3. project.yml (CFBundleShortVersionString + CFBundleVersion)
sed -i '' "s/CFBundleShortVersionString: .*/CFBundleShortVersionString: $VERSION/" "$TAURI_DIR/gen/apple/project.yml"
sed -i '' "s/CFBundleVersion: .*/CFBundleVersion: \"$BUILD_NUMBER\"/" "$TAURI_DIR/gen/apple/project.yml"
echo "[sync-version] Updated project.yml"

# 4. Info.plist (CFBundleShortVersionString + CFBundleVersion)
if [ -f "$INFO_PLIST" ]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$INFO_PLIST"
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "$INFO_PLIST"
    echo "[sync-version] Updated Info.plist"
fi

echo "[sync-version] Done — version $VERSION, build $BUILD_NUMBER"
