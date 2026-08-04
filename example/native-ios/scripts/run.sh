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
#
# Device selection, in priority order:
#   1. an already-booted simulator
#   2. $IOS_SIMULATOR                — IOS_SIMULATOR="iPhone 17 Pro" bun run native:ios
#   3. "iPhone 17", else the first available iPhone

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE_ID="id.frak.example.ios"
SCHEME="FrakExampleiOSApp"
PROJECT="$APP_DIR/$SCHEME.xcodeproj"
DERIVED="$APP_DIR/build"

# Logs go to stderr: `boot_simulator` returns the UDID on stdout, so anything
# chatty on stdout would be captured into the UDID by the caller.
log() { echo "[native-ios] $*" >&2; }
die() {
	echo "[native-ios] ERROR: $*" >&2
	exit 1
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
	xcodebuild -project "$PROJECT" -scheme "$SCHEME" \
		-sdk iphonesimulator -configuration Debug \
		-derivedDataPath "$DERIVED" build >/dev/null

	local app="$DERIVED/Build/Products/Debug-iphonesimulator/$SCHEME.app"
	[ -d "$app" ] || die "Build succeeded but $app is missing."

	log "Installing..."
	xcrun simctl install "$udid" "$app"

	log "Launching. Streaming SDK logs (Ctrl-C to stop)..."
	# --console-pty streams the SDK's print() output; it does not reach the
	# unified log system, so `log show` would find nothing.
	xcrun simctl launch --console-pty "$udid" "$BUNDLE_ID"
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
build) do_build_only ;;
xcode) do_xcode ;;
lint) do_lint ;;
format) do_format ;;
*)
	echo "Usage: $0 {run|build|xcode|lint|format}"
	echo ""
	echo "  run    - generate + build + install + launch on a simulator, then stream logs"
	echo "  build  - compile-only typecheck (Swift 6 strict concurrency), no simulator"
	echo "  xcode  - regenerate the project and open it in Xcode"
	echo "  lint   - swift-format lint (strict), no simulator"
	echo "  format - swift-format rewrite in place"
	exit 1
	;;
esac
