#!/usr/bin/env bash
# Build / test / lint the Frak iOS SDK package.
# One script with subcommands, wrapped by this package's package.json scripts.
#
# Usage:
#   bun run --cwd sdk/ios build         # compile against the iOS simulator SDK
#   bun run --cwd sdk/ios test          # xcodebuild test on a simulator, then swift test on macOS
#   bun run --cwd sdk/ios lint          # swift-format lint (strict)
#   bun run --cwd sdk/ios format        # swift-format rewrite in place
#   bun run --cwd sdk/ios version       # every version site + the CHANGELOG section
#   bun run --cwd sdk/ios xcframework   # NOT IMPLEMENTED — see do_xcframework
#   bun run --cwd sdk/ios mirror-stage <dir>  # lay out the SwiftPM mirror payload

set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$PKG_DIR/../.." && pwd)"

# Logs go to stderr so stdout stays clean for anything that pipes this script.
log() { echo "[sdk-ios] $*" >&2; }
die() {
	echo "[sdk-ios] ERROR: $*" >&2
	exit 1
}

# The iOS simulator SDK path and target triple, shared by build and test. A bare
# `swift build` targets the host and would compile this package as macOS without ever
# exercising iOS. Cross-compiling to the simulator triple is a separate concern from the
# language mode below and still needs its own flags here.
#
# Swift 6 strict concurrency itself no longer needs a flag here — `Package.swift` declares
# `swift-tools-version: 6.0` and sets `.swiftLanguageMode(.v6)` on every target, so a bare
# `swift build`/`swift test` gets it too, not just this script.
# Sets IOS_FLAGS. Assigns a global rather than echoing: macOS ships bash 3.2, no
# namerefs, no way to return an array.
set_ios_flags() {
	local sdk_path
	sdk_path="$(xcrun --sdk iphonesimulator --show-sdk-path)" ||
		die "Could not locate the iphonesimulator SDK. Is Xcode installed and selected?"
	IOS_FLAGS=(
		--sdk "$sdk_path"
		--triple arm64-apple-ios15.0-simulator
	)
}

# FrakSDKVersion.current rides on the wire (x-frak-sdk-version, ?sdkVersion=) and is one of three
# files carrying this SDK's version — the mirror README pin being the one a merchant copies. The
# list lives at the monorepo root in `scripts/native-version.ts`, shared with Android, whose own set
# spans the harness. The mirror refuses to retag a published version, so drift caught after tagging
# ships uncorrectable; this must fail on a site being unreadable, not only on a mismatch.
# Sets SDK_VERSION.
check_sdk_version() {
	command -v bun >/dev/null 2>&1 ||
		die "bun is required to gate the version sites. See $REPO_ROOT/scripts/native-version.ts."

	# stdout carries the version below and nothing else, so the check's own report goes to stderr.
	(cd "$REPO_ROOT" && bun scripts/native-version.ts check ios >&2) ||
		die "version sites are out of step; fix them before staging a release."

	SDK_VERSION="$(cd "$REPO_ROOT" && bun scripts/native-version.ts version ios)"
	[ -n "$SDK_VERSION" ] || die "Could not read FrakSDKVersion.current"
}

do_build() {
	cd "$PKG_DIR"
	check_sdk_version
	log "Building against the iOS simulator SDK (Swift 6 strict concurrency)..."
	set_ios_flags
	swift build "${IOS_FLAGS[@]}"
}

# SwiftPM's test runner is a macOS process and cannot load an iOS-simulator bundle, so the
# `#if canImport(UIKit)` tests only run through xcodebuild. The simulator gets just those:
# CI's simulator is slow enough to break FrakSDKTests' wall-clock budgets, which `swift test`
# covers on the host. A new UIKit-only test in FrakSDKTests must be added to -only-testing.
do_test() {
	cd "$PKG_DIR"
	check_sdk_version

	local udid
	udid="$(xcrun simctl list devices available | sed -nE 's/^ +iPhone.*\(([0-9A-F-]{36})\).*/\1/p' | head -n 1)"
	[ -n "$udid" ] || die "No available iPhone simulator. Install an iOS runtime in Xcode."

	log "Running tests on the iOS simulator $udid..."
	xcodebuild test \
		-scheme FrakSDK-Package \
		-destination "platform=iOS Simulator,id=$udid" \
		-derivedDataPath .build/xcodebuild \
		-only-testing:FrakSDKUITests \
		'-only-testing:FrakSDKTests/FrakClientTests/foregroundNotificationTriggersADrain()'

	log "Running tests on the macOS host..."
	swift test
}

# `swift format` ships inside the Xcode toolchain — nothing to install; version is
# pinned to whatever Xcode the machine already builds with.
do_lint() {
	cd "$PKG_DIR"
	log "Checking Swift formatting and style..."
	swift format lint --strict --recursive Sources Tests
}

do_format() {
	cd "$PKG_DIR"
	log "Formatting Swift sources..."
	swift format --in-place --recursive Sources Tests
}

# Standalone subcommand so CI (or a merchant) can gate on version sync without paying for a
# full build/test cycle first.
do_version() {
	check_sdk_version
	log "Every version site is in step at $SDK_VERSION."
}

# NOT IMPLEMENTED. Binary distribution needs an Xcode project or scheme SwiftPM can archive;
# `swift build` alone cannot produce a framework.
do_xcframework() {
	die "xcframework is not implemented. Source distribution via SwiftPM works today."
}

# Lays out exactly what the SwiftPM mirror (frak-id/frak-ios-sdk) publishes, into $1.
#
# SwiftPM resolves a package by repo URL + tag and reads `Package.swift` from the repo
# ROOT only, so this package cannot be consumed from `sdk/ios/` in the monorepo — hence a
# mirror whose root is this directory's contents. Open upstream: swift-package-manager#5768.
#
# `Tests/` is deliberately NOT copied, and that is a correctness requirement rather than a
# size one: `Tests/FrakSDKTests/Fixtures/GoldenFixtures.swift` loads the corpus from
# `sdk/core/src/*/fixtures/*.json` by walking up to the monorepo root, and throws loudly
# when it is absent. Mirrored, that suite could never pass. SwiftPM does not validate a
# *dependency's* test-target paths, so `Package.swift` still declaring two `.testTarget`s
# whose directories are missing costs a consumer nothing — verified by resolving a scratch
# package against exactly this payload. It does mean `swift build` inside the mirror fails
# with "invalid custom path 'Tests/FrakSDKTests'"; that is the mirror being un-developable
# on purpose, and the README says so.
#
# README.mirror.md, not README.md: the monorepo README is written for contributors (bun
# scripts, biome, a relative link into docs/plans/) and is wrong for a merchant.
#
# CHANGELOG.md ships as-is. Each release is one force-pushed orphan commit, so it is the only
# history the mirror has, and it is what the GitHub release body quotes.
do_mirror_stage() {
	local out="${1:-}"
	[ -n "$out" ] || die "mirror-stage needs a target directory: $0 mirror-stage <dir>"
	cd "$PKG_DIR"
	check_sdk_version

	[ -d "$out" ] && die "refusing to write into an existing directory: $out"
	mkdir -p "$out"

	cp -R Sources "$out/"
	cp Package.swift LICENSE CHANGELOG.md "$out/"
	cp README.mirror.md "$out/README.md"

	# The privacy manifests ride inside Sources/ as target resources; a missing one is an
	# ITMS-91053 rejection on a merchant's binary, so fail here rather than at their upload.
	local manifest
	for manifest in FrakSDK FrakSDKUI; do
		[ -f "$out/Sources/$manifest/PrivacyInfo.xcprivacy" ] ||
			die "PrivacyInfo.xcprivacy missing from the staged $manifest target"
	done

	log "Staged the mirror payload for $SDK_VERSION in $out"
}

case "${1:-build}" in
build) do_build ;;
test) do_test ;;
lint) do_lint ;;
format) do_format ;;
version) do_version ;;
xcframework) do_xcframework ;;
mirror-stage) do_mirror_stage "${2:-}" ;;
*)
	echo "Usage: $0 {build|test|lint|format|version|xcframework|mirror-stage <dir>}"
	echo ""
	echo "  build        - compile against the iOS simulator SDK (Swift 6 strict concurrency)"
	echo "  test         - xcodebuild test on an iOS simulator, then swift test on macOS"
	echo "  lint         - swift-format lint (strict), no simulator"
	echo "  format       - swift-format rewrite in place"
	echo "  version      - every file carrying the version, plus its CHANGELOG section"
	echo "  xcframework  - NOT IMPLEMENTED (05 §3) — exits 1 with the intended outline"
	echo "  mirror-stage - lay out the frak-ios-sdk mirror payload into <dir>"
	exit 1
	;;
esac
