#!/usr/bin/env bash
# Build / install / launch the Android merchant example app.
#
# Usage:
#   bun run native:android          # build + install + launch (boots an AVD if needed)
#   bun run native:android:build    # assembleDebug only, no device required
#   bun run native:android:logs     # tail the SDK log stream
#
# Device selection, in priority order:
#   1. an already-running emulator or attached device
#   2. $ANDROID_AVD                 — ANDROID_AVD=Pixel_4a_2 bun run native:android
#   3. the first AVD from `emulator -list-avds`

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_ID="id.frak.example.android"
ACTIVITY="$PACKAGE_ID/.MainActivity"
# `Frak` is FrakLogger's tag in :frak-sdk; `FrakSharing` is a separate one in
# :frak-sdk-ui, and filtering on `Frak` alone drops every sheet warning. The
# last two catch the crashes and WebView errors the SDK never sees.
LOG_TAGS=(Frak FrakSharing AndroidRuntime:E chromium:E)

log() { echo "[native-android] $*"; }
die() {
	echo "[native-android] ERROR: $*" >&2
	exit 1
}

# Locates the SDK and exports ANDROID_HOME; without it, assembleDebug fails with a raw
# "SDK location not found" even at the default path.
resolve_sdk() {
	local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
	[ -d "$sdk" ] || die "Android SDK not found. Set ANDROID_HOME, or install via Android Studio."
	export ANDROID_HOME="$sdk"
	export PATH="$sdk/platform-tools:$sdk/emulator:$PATH"
}

# Only the device-driven paths need adb; `build` does not.
require_adb() {
	command -v adb >/dev/null 2>&1 || die "adb not found under ${ANDROID_HOME}/platform-tools"
}

device_online() {
	adb devices 2>/dev/null | awk 'NR>1 && $2=="device" {found=1} END {exit !found}'
}

boot_emulator() {
	device_online && {
		log "Using the already-running device."
		return
	}

	command -v emulator >/dev/null 2>&1 || die "No device attached and no emulator binary found."

	local avd="${ANDROID_AVD:-}"
	if [ -z "$avd" ]; then
		avd="$(emulator -list-avds 2>/dev/null | head -1)"
		[ -n "$avd" ] || die "No device attached and no AVD exists. Create one in Android Studio."
	fi

	log "Booting emulator: $avd"
	nohup emulator -avd "$avd" -no-snapshot-load >/tmp/frak-android-emulator.log 2>&1 &

	log "Waiting for device..."
	adb wait-for-device
	# `wait-for-device` returns as soon as adb connects, long before the
	# package manager is usable — installing there fails in confusing ways.
	local tries=180
	while [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" != "1" ]; do
		tries=$((tries - 1))
		[ $tries -gt 0 ] || die "Emulator did not finish booting (see /tmp/frak-android-emulator.log)"
		sleep 2
	done
	log "Emulator ready."
}

do_build() {
	# Needs no device, but still needs the SDK path resolved.
	resolve_sdk
	cd "$APP_DIR"
	log "Building debug APK..."
	./gradlew assembleDebug
}

do_run() {
	resolve_sdk
	require_adb
	boot_emulator
	cd "$APP_DIR"

	log "Installing..."
	./gradlew installDebug

	# installDebug returns before the package manager finishes indexing; an immediate
	# launch fails with a misleading "Activity class ... does not exist". Wait for it
	# to become resolvable.
	log "Waiting for the package manager to index the app..."
	local tries=30
	while ! adb shell cmd package resolve-activity --brief "$PACKAGE_ID" 2>/dev/null |
		grep -q "$PACKAGE_ID/"; do
		tries=$((tries - 1))
		if [ $tries -le 0 ]; then
			die "App installed but never became launchable. Try 'adb reboot', wait for boot, then re-run."
		fi
		sleep 1
	done

	log "Launching $ACTIVITY"
	adb shell am start -n "$ACTIVITY" >/dev/null

	log "Running. Streaming SDK logs (Ctrl-C to stop)..."
	adb logcat -c 2>/dev/null || true
	adb logcat -s "${LOG_TAGS[@]}"
}

do_logs() {
	resolve_sdk
	require_adb
	device_online || die "No device attached."
	adb logcat -s "${LOG_TAGS[@]}"
}

# ktlint comes from the Gradle plugin: first run downloads it, then it's cached.
do_lint() {
	cd "$APP_DIR"
	log "Checking Kotlin formatting and style..."
	./gradlew ktlintCheck
}

do_format() {
	cd "$APP_DIR"
	log "Formatting Kotlin sources..."
	./gradlew ktlintFormat
}

case "${1:-run}" in
run) do_run ;;
build) do_build ;;
logs) do_logs ;;
lint) do_lint ;;
format) do_format ;;
*)
	echo "Usage: $0 {run|build|logs|lint|format}"
	echo ""
	echo "  run    - build + install + launch (boots an AVD if needed), then tail logs"
	echo "  build  - assembleDebug only, no device required"
	echo "  logs   - tail the SDK log stream on the running device"
	echo "  lint   - ktlint check, no device required"
	echo "  format - ktlint auto-format in place"
	exit 1
	;;
esac
