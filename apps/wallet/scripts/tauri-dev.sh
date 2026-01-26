#!/bin/bash
# Tauri development helper script
# Handles starting dev server and launching mobile simulators

set -e

WALLET_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEV_SERVER_PORT=3010
DEV_SERVER_URL="http://localhost:$DEV_SERVER_PORT"
VITE_PID=""

cleanup() {
    if [ -n "$VITE_PID" ]; then
        kill "$VITE_PID" 2>/dev/null || true
    fi
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
    adb reverse tcp:3013 tcp:3013
    adb reverse tcp:3014 tcp:3014
    adb reverse tcp:3030 tcp:3030
    
    echo "[tauri-dev] ADB reverse ports configured (3010=wallet, 3013-3014=examples, 3030=backend)"
}

run_android() {
    start_dev_server
    setup_adb_reverse
    cd "$WALLET_DIR"
    bun run tauri android dev --no-dev-server -c '{"build":{"beforeDevCommand":""}}'
}

run_ios() {
    local device="${1:-iPhone 17}"
    start_dev_server
    cd "$WALLET_DIR"
    bun run tauri ios dev --no-dev-server -c '{"build":{"beforeDevCommand":""}}' "$device"
}

run_dev_only() {
    cd "$WALLET_DIR"
    bun run build:sw
    vite dev
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
