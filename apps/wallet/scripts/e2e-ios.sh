#!/usr/bin/env bash
# Maestro flows in .maestro/ against the dev wallet already installed and logged in on a
# booted iOS simulator. Builds nothing: install a simulator build (`tauri ios build
# --target aarch64-sim --debug` under `sst shell --stage dev`), then log in once by hand.
# The flows never clear app data, so the session holds.
# E2E_PASSKEY_FACEID=1 first logs out and back in with the passkey, answering Face ID
# with the simulator's match signal (Face ID must be enrolled in the simulator).
#
# Usage: [E2E_PASSKEY_FACEID=1] bun run --cwd apps/wallet e2e:ios [flow.yaml ...]
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
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
cd "$APP_DIR"

if [ -n "${E2E_PASSKEY_FACEID:-}" ]; then
	log "Logging out, then back in with the passkey (Face ID)..."
	maestro_test "$APP_DIR/.maestro/passkey/logout-to-prompt.yaml"
	# Repeated because the Face ID sheet may not be listening yet when Maestro returns.
	for _ in 1 2 3 4 5; do
		xcrun simctl spawn "$udid" notifyutil -p com.apple.BiometricKit_Sim.pearl.match >/dev/null
		sleep 2
	done
	# The flows below wait for the wallet home, which proves the login went through.
fi

log "Running Maestro flows on $udid..."
maestro_test "${@:-$APP_DIR/.maestro}"
