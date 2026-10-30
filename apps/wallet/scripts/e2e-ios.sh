#!/usr/bin/env bash
# Maestro flows in .maestro/ against the dev wallet already installed and logged in on a
# booted iOS simulator. Builds nothing: install a simulator build (`tauri ios build
# --target aarch64-sim --debug` under `sst shell --stage dev`), then log in once by hand.
# The flows never clear app data, so the session holds.
#
# Usage: bun run --cwd apps/wallet e2e:ios [flow.yaml ...]
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
cd "$APP_DIR"
log "Running Maestro flows on $udid..."
MAESTRO_CLI_NO_ANALYTICS=1 \
	MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true \
	MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}" \
	${cap[@]+"${cap[@]}"} maestro --device "$udid" test "${@:-$APP_DIR/.maestro}"
