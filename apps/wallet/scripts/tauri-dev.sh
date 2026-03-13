#!/bin/bash
# Tauri development helper script
# Handles starting dev server and launching mobile simulators

set -e

WALLET_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEV_SERVER_PORT=3010
DEV_SERVER_URL="http://localhost:$DEV_SERVER_PORT"
VITE_PID=""
TAURI_PID=""

cleanup() {
    trap - EXIT INT TERM
    for pid in $VITE_PID $TAURI_PID; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null
    done
    wait 2>/dev/null
}
trap cleanup EXIT INT TERM

start_dev_server() {
    if curl -s --connect-timeout 1 "$DEV_SERVER_URL" >/dev/null 2>&1; then
        echo "[tauri-dev] Dev server already running at $DEV_SERVER_URL"
        return 0
    fi

    echo "[tauri-dev] Starting dev server..."
    cd "$WALLET_DIR"
    bun run build:sw
    vite dev &
    VITE_PID=$!

    # Wait for server to be ready
    local retries=30
    while ! curl -s --connect-timeout 1 "$DEV_SERVER_URL" >/dev/null 2>&1; do
        retries=$((retries - 1))
        if [ $retries -le 0 ]; then
            echo "[tauri-dev] ERROR: Dev server failed to start"
            exit 1
        fi
        sleep 1
    done
    echo "[tauri-dev] Dev server ready"
}

setup_adb_reverse() {
    echo "[tauri-dev] Setting up ADB reverse port forwarding..."

    if ! command -v adb &> /dev/null; then
        echo "[tauri-dev] WARNING: adb not found, skipping port forwarding"
        return 0
    fi

    if ! adb devices | grep -q "device$"; then
        echo "[tauri-dev] WARNING: No Android device connected, skipping port forwarding"
        return 0
    fi

    adb reverse tcp:3010 tcp:3010
    adb reverse tcp:3012 tcp:3012
    adb reverse tcp:3013 tcp:3013
    adb reverse tcp:3014 tcp:3014
    adb reverse tcp:3030 tcp:3030

    echo "[tauri-dev] ADB reverse ports configured (3010=wallet, 3013-3014=examples, 3030=backend)"
}

setup_android_signing() {
    local ANDROID_DIR="$WALLET_DIR/src-tauri/gen/android"
    local KEYSTORE_FILE="$ANDROID_DIR/upload-keystore.jks"
    local KEY_PROPS_FILE="$ANDROID_DIR/key.properties"

    # Skip if both files already exist
    if [ -f "$KEYSTORE_FILE" ] && [ -f "$KEY_PROPS_FILE" ]; then
        echo "[tauri-dev] Android signing files already present"
        return 0
    fi

    # Decode keystore from SST secret
    if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
        echo "[tauri-dev] Writing Android keystore from SST secret..."
        echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$KEYSTORE_FILE"
    else
        echo "[tauri-dev] WARNING: ANDROID_KEYSTORE_BASE64 not set, skipping keystore setup"
        echo "[tauri-dev] Run: sst secret set ANDROID_KEYSTORE_BASE64 \"\$(base64 -i upload-keystore.jks)\""
        return 0
    fi

    # Decode key.properties from SST secret
    if [ -n "${ANDROID_KEY_PROPERTIES_BASE64:-}" ]; then
        echo "[tauri-dev] Writing key.properties from SST secret..."
        echo "$ANDROID_KEY_PROPERTIES_BASE64" | base64 -d > "$KEY_PROPS_FILE"
    else
        echo "[tauri-dev] WARNING: ANDROID_KEY_PROPERTIES_BASE64 not set, skipping key.properties setup"
        echo "[tauri-dev] Run: sst secret set ANDROID_KEY_PROPERTIES_BASE64 \"\$(base64 -i key.properties)\""
    fi

    echo "[tauri-dev] Android signing configured"
}

setup_firebase_config() {
    local IOS_PLIST="$WALLET_DIR/src-tauri/gen/apple/app_iOS/GoogleService-Info.plist"
    local ANDROID_JSON="$WALLET_DIR/src-tauri/gen/android/app/google-services.json"

    # iOS: decode GoogleService-Info.plist from SST secret
    if [ -f "$IOS_PLIST" ]; then
        echo "[tauri-dev] iOS Firebase config already present"
    elif [ -n "${FIREBASE_IOS_CONFIG_BASE64:-}" ]; then
        echo "[tauri-dev] Writing iOS GoogleService-Info.plist from SST secret..."
        echo "$FIREBASE_IOS_CONFIG_BASE64" | base64 -d > "$IOS_PLIST"
    else
        echo "[tauri-dev] WARNING: FIREBASE_IOS_CONFIG_BASE64 not set, skipping iOS Firebase config"
        echo "[tauri-dev] Run: sst secret set FIREBASE_IOS_CONFIG_BASE64 \"\$(base64 -i GoogleService-Info.plist)\""
    fi

    # Android: decode google-services.json from SST secret
    if [ -f "$ANDROID_JSON" ]; then
        echo "[tauri-dev] Android Firebase config already present"
    elif [ -n "${FIREBASE_ANDROID_CONFIG_BASE64:-}" ]; then
        echo "[tauri-dev] Writing Android google-services.json from SST secret..."
        echo "$FIREBASE_ANDROID_CONFIG_BASE64" | base64 -d > "$ANDROID_JSON"
    else
        echo "[tauri-dev] WARNING: FIREBASE_ANDROID_CONFIG_BASE64 not set, skipping Android Firebase config"
        echo "[tauri-dev] Run: sst secret set FIREBASE_ANDROID_CONFIG_BASE64 \"\$(base64 -i google-services.json)\""
    fi
}

run_android() {
    setup_android_signing
    setup_firebase_config
    start_dev_server
    setup_adb_reverse
    cd "$WALLET_DIR"
    bun run tauri android dev --no-dev-server -c '{"build":{"beforeDevCommand":""}}' &
    TAURI_PID=$!
    wait $TAURI_PID
}

run_ios() {
    local device="${1:-iPhone 17}"
    setup_firebase_config
    start_dev_server
    cd "$WALLET_DIR"
    bun run tauri ios dev --no-dev-server -c '{"build":{"beforeDevCommand":""}}' "$device" &
    TAURI_PID=$!
    wait $TAURI_PID
}

run_dev_only() {
    cd "$WALLET_DIR"
    bun run build:sw
    exec vite dev
}

case "${1:-}" in
    android)
        run_android
        ;;
    ios)
        shift
        run_ios "$@"
        ;;
    dev)
        run_dev_only
        ;;
    *)
        echo "Usage: $0 {android|ios|dev}"
        echo ""
        echo "Commands:"
        echo "  dev      - Start Tauri dev server only"
        echo "  android  - Start dev server + launch Android emulator"
        echo "  ios      - Start dev server + launch iOS simulator"
        exit 1
        ;;
esac
