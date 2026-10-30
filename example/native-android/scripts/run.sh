#!/usr/bin/env bash
# Build / install / launch the Android merchant example app.
#
# Usage:
#   bun run native:android          # build + install + launch (boots an AVD if needed)
#   bun run native:android:build    # assembleDebug only, no device required
#   bun run native:android:logs     # tail the SDK log stream
#   bun run --cwd example/native-android e2e   # Maestro flows in .maestro/, emulator only
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
LOG_TAGS=(Frak FrakSharing FrakHarness AndroidRuntime:E chromium:E)

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

running_emulator() {
	adb devices 2>/dev/null | awk '$1 ~ /^emulator-/ && $2=="device" {print $1; exit}'
}

boot_emulator() {
	device_online && {
		log "Using the already-running device."
		return
	}
	start_avd
}

# Pins ANDROID_SERIAL to the new emulator: with a phone or TV also attached, a bare
# `adb shell` fails with "more than one device".
start_avd() {
	command -v emulator >/dev/null 2>&1 || die "No device attached and no emulator binary found."

	local avd="${ANDROID_AVD:-}"
	if [ -z "$avd" ]; then
		avd="$(emulator -list-avds 2>/dev/null | head -1)"
		[ -n "$avd" ] || die "No device attached and no AVD exists. Create one in Android Studio."
	fi

	log "Booting emulator: $avd"
	nohup emulator -avd "$avd" -no-snapshot-load >/tmp/frak-android-emulator.log 2>&1 &

	log "Waiting for device..."
	local serial="" waits=60
	while [ -z "$serial" ]; do
		waits=$((waits - 1))
		[ $waits -gt 0 ] || die "Emulator never appeared (see /tmp/frak-android-emulator.log)"
		sleep 2
		serial="$(running_emulator)"
	done
	export ANDROID_SERIAL="$serial"
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

# Play distribution artifact. Signed with the upload keystore when FRAK_KEYSTORE points at
# one; otherwise the debug signer, which Play rejects — good enough to check the build.
do_bundle() {
	resolve_sdk
	cd "$APP_DIR"
	local args=(bundleRelease)
	args+=("-Pfrak.versionCode=${FRAK_VERSION_CODE:-1}")
	args+=("-Pfrak.versionName=${FRAK_VERSION_NAME:-1.0}")
	if [ -n "${FRAK_KEYSTORE:-}" ]; then
		args+=("-Pfrak.keystore=$FRAK_KEYSTORE")
		args+=("-Pfrak.keystorePassword=${FRAK_KEYSTORE_PASSWORD:-}")
		args+=("-Pfrak.keyAlias=${FRAK_KEY_ALIAS:-upload}")
		args+=("-Pfrak.keyPassword=${FRAK_KEY_PASSWORD:-}")
	else
		log "No FRAK_KEYSTORE set — the bundle will be debug-signed and Play will reject it."
	fi
	log "Building release AAB (version ${FRAK_VERSION_NAME:-1.0}, code ${FRAK_VERSION_CODE:-1})..."
	./gradlew "${args[@]}"
	log "AAB: $APP_DIR/app/build/outputs/bundle/release/app-release.aab"
}

user_locked() {
	[ "$(adb shell am get-started-user-state 0 2>/dev/null | tr -d '\r')" = RUNNING_LOCKED ]
}

# A device with a screen lock boots RUNNING_LOCKED: boot_completed is already set, but no
# activity resolves until the PIN is entered, and installs then fail as "never launchable".
wait_for_unlock() {
	user_locked || return 0
	log "The device is locked. Unlock it (enter its screen-lock PIN) to continue..."
	local tries=300
	while user_locked; do
		tries=$((tries - 1))
		[ $tries -gt 0 ] || die "Device still locked after 5 minutes."
		sleep 1
	done
}

install_app() {
	wait_for_unlock
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
}

do_run() {
	resolve_sdk
	require_adb
	boot_emulator
	install_app

	log "Launching $ACTIVITY"
	adb shell am start -n "$ACTIVITY" >/dev/null

	log "Running. Streaming SDK logs (Ctrl-C to stop)..."
	adb logcat -c 2>/dev/null || true
	adb logcat -s "${LOG_TAGS[@]}"
}

# Emulator only, never an attached phone: the flows clear the app's data. Pins every adb
# and Gradle call to it through ANDROID_SERIAL.
do_e2e() {
	resolve_sdk
	require_adb
	command -v maestro >/dev/null 2>&1 ||
		die "maestro not found. Install it with: brew install mobile-dev-inc/tap/maestro"

	local serial="${ANDROID_SERIAL:-$(running_emulator)}"
	if [ -z "$serial" ]; then
		start_avd
		serial="$ANDROID_SERIAL"
	fi
	export ANDROID_SERIAL="$serial"
	install_app

	log "Running Maestro flows on $serial..."
	local cap=()
	# Maestro has no overall timeout and can hang forever when its on-device driver never starts.
	command -v timeout >/dev/null 2>&1 && cap=(timeout "${MAESTRO_TIMEOUT:-600}")
	MAESTRO_CLI_NO_ANALYTICS=1 \
		MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
		MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-90000}" \
		${cap[@]+"${cap[@]}"} maestro --device "$serial" test "${@:-$APP_DIR/.maestro}"
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
e2e) shift && do_e2e "$@" ;;
build) do_build ;;
bundle) do_bundle ;;
logs) do_logs ;;
lint) do_lint ;;
format) do_format ;;
*)
	echo "Usage: $0 {run|build|bundle|logs|lint|format|e2e}"
	echo ""
	echo "  run    - build + install + launch (boots an AVD if needed), then tail logs"
	echo "  build  - assembleDebug only, no device required"
	echo "  bundle - release AAB for Play, no device required"
	echo "  logs   - tail the SDK log stream on the running device"
	echo "  lint   - ktlint check, no device required"
	echo "  format - ktlint auto-format in place"
	echo "  e2e    - build + install, then the Maestro flows in .maestro/ on an emulator"
	exit 1
	;;
esac
