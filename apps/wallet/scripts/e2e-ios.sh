#!/usr/bin/env bash
# Maestro flows in .maestro/ against the dev wallet already installed and logged in on a
# booted iOS simulator. Builds nothing: install a simulator build (`tauri ios build
# --target aarch64-sim --debug` under `sst shell --stage dev`), then log in once by hand.
# The flows never clear app data, so the session holds.
# E2E_PASSKEY_FACEID=1 first logs out, opens a referral link from the stopped app and
# logs back in with the passkey, answering Face ID with the simulator's match signal
# (the script enrolls Face ID in the simulator).
# E2E_ONBOARDING=1 first logs out and onboards a brand-new wallet (new passkey, new dev
# account), which stays logged in for every later flow. The new wallet redeems the previous
# one's referral code, then deletes it; then the biometric lock is turned on, unlocks a cold
# start, and is turned off.
#
# Usage: [E2E_ONBOARDING=1] [E2E_PASSKEY_FACEID=1] bun run --cwd apps/wallet e2e:ios [flow.yaml ...]
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=e2e-skipped-branches.sh
source "$APP_DIR/scripts/e2e-skipped-branches.sh"
BUNDLE_ID="id.frak.wallet.dev"

log() { echo "[wallet-e2e] $*"; }
die() {
	echo "[wallet-e2e] ERROR: $*" >&2
	exit 1
}

command -v maestro >/dev/null 2>&1 ||
	die "maestro not found. Install it with: brew install mobile-dev-inc/tap/maestro"

udid="${IOS_SIMULATOR_UDID:-$(xcrun simctl list devices booted | sed -nE 's/.*\(([0-9A-F-]{36})\) \(Booted\).*/\1/p' | head -1)}"
[ -n "$udid" ] || die "No booted simulator. Boot the one that holds your logged-in wallet."
xcrun simctl get_app_container "$udid" "$BUNDLE_ID" >/dev/null 2>&1 ||
	die "$BUNDLE_ID is not installed on $udid. Install a simulator build and log in once by hand."

cap=()
# --foreground: in its own process group Maestro is stopped (SIGTTOU) on exit when run from a terminal.
command -v timeout >/dev/null 2>&1 && cap=(timeout --foreground "${MAESTRO_TIMEOUT:-900}")
maestro_test() {
	MAESTRO_CLI_NO_ANALYTICS=1 \
		MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
		MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}" \
		${cap[@]+"${cap[@]}"} maestro --device "$udid" test "$@"
}
# Runs a flow while answering Face ID: the scan opens seconds after the tap, so keep
# matching until the flow ends. A match with no scan open does nothing.
maestro_test_with_faceid() {
	while :; do
		xcrun simctl spawn "$udid" notifyutil -p com.apple.BiometricKit_Sim.pearl.match >/dev/null
		sleep 2
	done &
	local matcher=$! flow_status=0
	maestro_test "$@" || flow_status=$?
	kill "$matcher"
	wait "$matcher" 2>/dev/null || true
	return "$flow_status"
}
cd "$APP_DIR"

if [ -n "${E2E_ONBOARDING:-}${E2E_PASSKEY_FACEID:-}" ]; then
	# Without enrolled Face ID the simulator refuses to save or use a passkey.
	xcrun simctl spawn "$udid" notifyutil -s com.apple.BiometricKit.enrollmentChanged 1
	xcrun simctl spawn "$udid" notifyutil -p com.apple.BiometricKit.enrollmentChanged
fi

if [ -n "${E2E_ONBOARDING:-}" ]; then
	log "Reading the current wallet's referral code..."
	code_dir="$APP_DIR/build/maestro/referral-code"
	rm -rf "$code_dir"
	referral_code=""
	if maestro_test --debug-output "$code_dir" --flatten-debug-output \
		"$APP_DIR/.maestro/onboarding/read-referral-code.yaml"; then
		referral_code="$(grep -rhoE 'FRAK_REFERRAL_CODE=[A-Z0-9]+' "$code_dir" | tail -1 | cut -d= -f2 || true)"
	fi
	[ -n "$referral_code" ] || log "No referral code read: the onboarding skips the accepted code."
	log "Onboarding a new wallet (Face ID)..."
	maestro_test "$APP_DIR/.maestro/onboarding/to-passkey.yaml"
	maestro_test_with_faceid -e REFERRAL_CODE="$referral_code" \
		"$APP_DIR/.maestro/onboarding/after-passkey.yaml" ||
		die "Onboarding after the passkey creation failed."

	log "Biometric lock on, cold start, unlock, lock off (Face ID)..."
	maestro_test_with_faceid "$APP_DIR/.maestro/biometric/enable.yaml" ||
		die "Turning the biometric lock on failed."
	maestro_test "$APP_DIR/.maestro/biometric/relaunch-locked.yaml"
	maestro_test_with_faceid "$APP_DIR/.maestro/biometric/unlocked-disable.yaml" ||
		die "Unlocking or turning the biometric lock off failed."
fi

if [ -n "${E2E_PASSKEY_FACEID:-}" ]; then
	log "Logging out, then back in from a referral link (Face ID)..."
	maestro_test "$APP_DIR/.maestro/passkey/logout-cold-link.yaml"
	maestro_test_with_faceid "$APP_DIR/.maestro/passkey/join-page-after-login.yaml" ||
		die "Passkey login from the referral link failed."
fi

log "Running Maestro flows on $udid..."
debug_dir="$APP_DIR/build/maestro/debug"
rm -rf "$debug_dir"
status=0
# Flows tagged android drive the network or other emulator-only controls.
maestro_test --debug-output "$debug_dir" --flatten-debug-output --exclude-tags android \
	"${@:-$APP_DIR/.maestro}" || status=$?
report_skipped_branches "$debug_dir" "$status"
log "Debug output: $debug_dir"
exit "$status"
