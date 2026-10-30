#!/usr/bin/env bash
# Maestro flows in .maestro/ against the dev wallet already installed and logged in on an
# emulator. Builds nothing: install with `tauri:android:dev` or `tauri:android:build:dev`,
# then log in once by hand (passkey). The flows never clear app data, so the session holds.
#
# Usage: bun run --cwd apps/wallet e2e:android [flow.yaml ...]
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_ID="id.frak.wallet.dev"

log() { echo "[wallet-e2e] $*"; }
die() {
	echo "[wallet-e2e] ERROR: $*" >&2
	exit 1
}

command -v adb >/dev/null 2>&1 || export PATH="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools:$PATH"
command -v adb >/dev/null 2>&1 || die "adb not found. Set ANDROID_HOME."
command -v maestro >/dev/null 2>&1 ||
	die "maestro not found. Install it with: brew install mobile-dev-inc/tap/maestro"

# Emulator only: an attached phone or TV is never driven.
serial="${ANDROID_SERIAL:-$(adb devices | awk '$1 ~ /^emulator-/ && $2=="device" {print $1; exit}')}"
[ -n "$serial" ] || die "No running emulator. Boot one (it must hold your logged-in wallet)."
export ANDROID_SERIAL="$serial"

adb shell pm path "$PACKAGE_ID" >/dev/null 2>&1 ||
	die "$PACKAGE_ID is not installed on $serial. Install a dev build and log in once by hand."
[ "$(adb shell am get-started-user-state 0 | tr -d '\r')" != RUNNING_LOCKED ] ||
	die "$serial is locked. Enter its screen-lock PIN, then re-run."

log "Running Maestro flows on $serial..."
cap=()
# --foreground: in its own process group Maestro is stopped (SIGTTOU) on exit when run from a terminal.
command -v timeout >/dev/null 2>&1 && cap=(timeout --foreground "${MAESTRO_TIMEOUT:-600}")
cd "$APP_DIR"
MAESTRO_CLI_NO_ANALYTICS=1 \
	MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
	MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-90000}" \
	${cap[@]+"${cap[@]}"} maestro --device "$serial" test "${@:-$APP_DIR/.maestro}"
