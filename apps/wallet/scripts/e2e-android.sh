#!/usr/bin/env bash
# Maestro flows in .maestro/ against the dev wallet already installed and logged in on an
# emulator. Builds nothing: install `tauri:android:build:dev` (`tauri:android:dev` is flaky),
# then log in once by hand (passkey). The flows never clear app data, so the session holds.
# E2E_PASSKEY_FINGER=<emulator finger id> first logs out, opens a referral link from the
# stopped app and logs back in with the passkey, touching that enrolled fingerprint on
# the screen-lock check.
#
# Usage: [E2E_PASSKEY_FINGER=<n>] bun run --cwd apps/wallet e2e:android [flow.yaml ...]
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=e2e-skipped-branches.sh
source "$APP_DIR/scripts/e2e-skipped-branches.sh"
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
[[ "$serial" == emulator-* ]] || die "ANDROID_SERIAL=$serial is not an emulator; the flows wipe app data."
export ANDROID_SERIAL="$serial"

adb shell pm path "$PACKAGE_ID" >/dev/null 2>&1 ||
	die "$PACKAGE_ID is not installed on $serial. Install a dev build and log in once by hand."
# RUNNING_LOCKED after a cold boot; the keyguard alone once the screen has locked again.
if [ "$(adb shell am get-started-user-state 0 | tr -d '\r')" = RUNNING_LOCKED ] ||
	[[ "$(adb shell dumpsys window)" == *isKeyguardShowing=true* ]]; then
	die "$serial is locked. Unlock it (PIN or fingerprint), then re-run."
fi

cap=()
# --foreground: in its own process group Maestro is stopped (SIGTTOU) on exit when run from a terminal.
command -v timeout >/dev/null 2>&1 && cap=(timeout --foreground "${MAESTRO_TIMEOUT:-600}")
maestro_test() {
	MAESTRO_CLI_NO_ANALYTICS=1 \
		MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
		MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-90000}" \
		${cap[@]+"${cap[@]}"} maestro --device "$serial" test "$@"
}
cd "$APP_DIR"

if [ -n "${E2E_PASSKEY_FINGER:-}" ]; then
	log "Logging out, then back in from a referral link (finger $E2E_PASSKEY_FINGER)..."
	maestro_test "$APP_DIR/.maestro/passkey/logout-cold-link.yaml"
	adb emu finger touch "$E2E_PASSKEY_FINGER" >/dev/null
	sleep 1
	adb emu finger remove "$E2E_PASSKEY_FINGER" >/dev/null
	maestro_test "$APP_DIR/.maestro/passkey/join-page-after-login.yaml"
fi

log "Running Maestro flows on $serial..."
debug_dir="$APP_DIR/build/maestro/debug"
rm -rf "$debug_dir"
status=0
maestro_test --debug-output "$debug_dir" --flatten-debug-output "${@:-$APP_DIR/.maestro}" || status=$?
report_skipped_branches "$debug_dir" "$status"
log "Debug output: $debug_dir"
exit "$status"
