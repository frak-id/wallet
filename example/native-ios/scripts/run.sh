#!/usr/bin/env bash
# Build / install / launch the iOS merchant example app.
#
# Mirrors the ergonomics of `apps/wallet/scripts/tauri-dev.sh`: one script with
# subcommands, wrapped by root package.json scripts.
#
# Usage:
#   bun run native:ios              # generate + build + install + launch
#   bun run native:ios:build        # compile-only typecheck, no simulator needed
#   bun run native:ios:xcode        # open the generated project in Xcode
#   bun run native:ios:device       # build + install + launch on a physical iPhone
#
# Simulator selection, in priority order:
#   1. an already-booted simulator
#   2. $IOS_SIMULATOR                — IOS_SIMULATOR="iPhone 17 Pro" bun run native:ios
#   3. "iPhone 17", else the first available iPhone
#
# Device selection, in priority order:
#   1. $IOS_DEVICE                   — a name or UDID, matched against connected devices
#   2. the sole connected device; ambiguous if more than one, so $IOS_DEVICE is required
#
# Device signing: automatic, with $FRAK_DEVELOPMENT_TEAM (default: the Frak Labs team)
# and -allowProvisioningUpdates, which registers the device on that Apple team.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_ID="id.frak.example.ios"
SCHEME="FrakExampleiOSApp"
PROJECT="$APP_DIR/$SCHEME.xcodeproj"
DERIVED="$APP_DIR/build"
# Frak Labs. Override for a contributor signing with their own Apple team; the bundle
# id must stay id.frak.example.ios either way, since the dev merchant allow-lists it.
DEVELOPMENT_TEAM="${FRAK_DEVELOPMENT_TEAM:-57DZ6Z2235}"

# Logs go to stderr: `boot_simulator` returns the UDID on stdout, so anything
# chatty on stdout would be captured into the UDID by the caller.
log() { echo "[native-ios] $*" >&2; }
die() {
	echo "[native-ios] ERROR: $*" >&2
	exit 1
}

# xcodebuild is far too chatty to show in full, but silencing it with >/dev/null
# hides the one line that matters when it fails. Tee to a log, print only the
# error lines on failure, and keep the log around for the rest.
run_xcodebuild() {
	local logfile="$DERIVED/xcodebuild.log"
	mkdir -p "$DERIVED"
	if ! xcodebuild "$@" >"$logfile" 2>&1; then
		log "Build failed. Relevant output:"
		grep -iE "error:|warning: .*provisioning|isn't registered|doesn't include" "$logfile" |
			head -20 >&2 || true
		die "xcodebuild failed. Full log: $logfile"
	fi
}

require_xcodegen() {
	command -v xcodegen >/dev/null 2>&1 ||
		die "xcodegen not found. Install it with: brew install xcodegen"
}

generate_project() {
	require_xcodegen
	cd "$APP_DIR"
	# The .xcodeproj is generated, not committed — project.yml is the source of
	# truth, so regenerate on every run rather than trusting a stale tree.
	log "Generating Xcode project from project.yml..."
	xcodegen generate >/dev/null
}

booted_simulator() {
	xcrun simctl list devices booted 2>/dev/null |
		sed -n 's/.*(\([0-9A-F-]\{36\}\)) (Booted).*/\1/p' | head -1
}

boot_simulator() {
	local udid
	udid="$(booted_simulator)"
	if [ -n "$udid" ]; then
		log "Using the already-booted simulator."
		echo "$udid"
		return
	fi

	local name="${IOS_SIMULATOR:-iPhone 17}"
	udid="$(xcrun simctl list devices available 2>/dev/null |
		grep -F "$name (" | sed -n 's/.*(\([0-9A-F-]\{36\}\)).*/\1/p' | head -1)"

	if [ -z "$udid" ]; then
		log "Simulator \"$name\" not found — falling back to the first available iPhone."
		udid="$(xcrun simctl list devices available 2>/dev/null |
			grep -F "iPhone" | sed -n 's/.*(\([0-9A-F-]\{36\}\)).*/\1/p' | head -1)"
	fi
	[ -n "$udid" ] || die "No iOS simulator available. Install one via Xcode > Settings > Components."

	log "Booting simulator $udid"
	xcrun simctl boot "$udid"
	open -a Simulator
	xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
	echo "$udid"
}

do_build_only() {
	cd "$APP_DIR"
	# SwiftPM cannot produce an app bundle, but it typechecks the sources fast
	# and without Xcode. Explicit iOS triple: a bare `swift build` targets the
	# host and would compile this as macOS, passing without exercising iOS.
	log "Type-checking against the iOS simulator SDK (Swift 6 strict concurrency)..."
	swift build \
		--sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
		-Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator \
		-Xswiftc -swift-version -Xswiftc 6
}

do_run() {
	generate_project

	local udid
	udid="$(boot_simulator)"

	log "Building..."
	run_xcodebuild -project "$PROJECT" -scheme "$SCHEME" \
		-sdk iphonesimulator -configuration Debug \
		-derivedDataPath "$DERIVED" build

	local app="$DERIVED/Build/Products/Debug-iphonesimulator/$SCHEME.app"
	[ -d "$app" ] || die "Build succeeded but $app is missing."

	log "Installing..."
	xcrun simctl install "$udid" "$app"

	log "Launching. Streaming SDK logs (Ctrl-C to stop)..."
	# --console-pty streams the SDK's print() output; it does not reach the
	# unified log system, so `log show` would find nothing.
	xcrun simctl launch --console-pty "$udid" "$BUNDLE_ID"
}

# Emits "<udid>\t<name>" per connected device. devicectl's JSON output is the only
# stable read: the human table pads columns and truncates long names.
list_devices() {
	local json
	json="$(mktemp)"
	xcrun devicectl list devices --quiet --json-output "$json" >/dev/null 2>&1 ||
		die "devicectl failed. Is Xcode installed and the device paired?"
	# CoreDevice remembers every device ever paired, so `pairingState` alone still
	# lists phones last seen months ago. A device reachable right now is the one that
	# reports a transport and a tunnelState other than "unavailable" — without this
	# filter a stale entry wins the "sole device" check and the install fails.
	/usr/bin/python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    devices = json.load(f)["result"]["devices"]
for d in devices:
    conn = d.get("connectionProperties", {})
    if conn.get("pairingState") != "paired":
        continue
    if conn.get("tunnelState") == "unavailable" and not conn.get("transportType"):
        continue
    print("\t".join([d["identifier"], d.get("deviceProperties", {}).get("name", "?")]))
' "$json"
	rm -f "$json"
}

select_device() {
	local devices
	devices="$(list_devices)"
	[ -n "$devices" ] || die "No paired device found. Plug in the iPhone, unlock it, and trust this Mac."

	local wanted="${IOS_DEVICE:-}"
	if [ -n "$wanted" ]; then
		local match
		match="$(echo "$devices" | awk -F'\t' -v w="$wanted" '$1 == w || $2 == w {print $1; exit}')"
		[ -n "$match" ] || die "No paired device matching IOS_DEVICE=\"$wanted\". Available:
$(echo "$devices" | awk -F'\t' '{printf "  %s  (%s)\n", $2, $1}')"
		echo "$match"
		return
	fi

	local count
	count="$(echo "$devices" | wc -l | tr -d ' ')"
	[ "$count" -eq 1 ] || die "$count paired devices found — set IOS_DEVICE to pick one:
$(echo "$devices" | awk -F'\t' '{printf "  %s  (%s)\n", $2, $1}')"
	echo "$devices" | cut -f1
}

do_device() {
	generate_project

	local udid
	udid="$(select_device)"
	log "Target device: $udid"

	# Developer Mode is off by default on every iOS 16+ device and cannot be turned on
	# from the host. Failing here beats a bare "unable to install" from devicectl.
	if ! xcrun devicectl device info details --device "$udid" >/dev/null 2>&1; then
		die "Cannot query the device. Unlock it, and enable Settings > Privacy & Security > Developer Mode (the device restarts)."
	fi

	log "Building for device (team $DEVELOPMENT_TEAM)..."
	# -allowProvisioningUpdates lets Xcode create/refresh the profile and register this
	# device on the team, which is what makes a first run on a new phone work unattended.
	# It needs an Apple ID signed into Xcode (Settings > Accounts) with a role that can
	# register devices; without one it fails with "isn't registered in your developer account".
	run_xcodebuild -project "$PROJECT" -scheme "$SCHEME" \
		-destination "id=$udid" -configuration Debug \
		-derivedDataPath "$DERIVED" \
		DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
		-allowProvisioningUpdates build

	local app="$DERIVED/Build/Products/Debug-iphoneos/$SCHEME.app"
	[ -d "$app" ] || die "Build succeeded but $app is missing."

	log "Installing..."
	xcrun devicectl device install app --device "$udid" "$app" >/dev/null ||
		die "Install failed. Check that Developer Mode is on and the device is unlocked."

	log "Launching. Streaming SDK logs (Ctrl-C to stop)..."
	# --console streams the app's stdout, where the SDK's print() output goes.
	# First launch of a build signed by a new team needs the profile trusted on-device:
	# Settings > General > VPN & Device Management.
	xcrun devicectl device process launch --device "$udid" --console \
		--terminate-existing "$BUNDLE_ID"
}

do_xcode() {
	generate_project
	log "Opening $PROJECT"
	open "$PROJECT"
}

# `swift format` ships inside the Xcode toolchain — nothing to install, and the
# version is pinned to whatever Xcode the machine already builds with.
do_lint() {
	cd "$APP_DIR"
	log "Checking Swift formatting and style..."
	swift format lint --strict --recursive Sources
}

do_format() {
	cd "$APP_DIR"
	log "Formatting Swift sources..."
	swift format --in-place --recursive Sources
}

case "${1:-run}" in
run) do_run ;;
device) do_device ;;
build) do_build_only ;;
xcode) do_xcode ;;
lint) do_lint ;;
format) do_format ;;
*)
	echo "Usage: $0 {run|device|build|xcode|lint|format}"
	echo ""
	echo "  run    - generate + build + install + launch on a simulator, then stream logs"
	echo "  device - same, on a physical iPhone (needs Developer Mode and a signing team)"
	echo "  build  - compile-only typecheck (Swift 6 strict concurrency), no simulator"
	echo "  xcode  - regenerate the project and open it in Xcode"
	echo "  lint   - swift-format lint (strict), no simulator"
	echo "  format - swift-format rewrite in place"
	exit 1
	;;
esac
