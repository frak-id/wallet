#!/usr/bin/env bash
# Build / test / lint the Frak iOS SDK package.
# One script with subcommands, wrapped by this package's package.json scripts.
#
# Usage:
#   bun run --cwd sdk/ios build         # compile against the iOS simulator SDK
#   bun run --cwd sdk/ios test          # swift test, same triple
#   bun run --cwd sdk/ios lint          # swift-format lint (strict)
#   bun run --cwd sdk/ios format        # swift-format rewrite in place
#   bun run --cwd sdk/ios version       # FrakSDKVersion.current vs package.json (9.10)
#   bun run --cwd sdk/ios xcframework   # NOT IMPLEMENTED — see do_xcframework

set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"

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
		-Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator
	)
}

# Swift Testing (not XCTest) lives in the platform Developer frameworks directory; SwiftPM
# does not add it for a cross-compiled triple. XCTest's overlay cannot link for
# iOS-simulator from SwiftPM at all.
# Sets IOS_TESTING_FLAGS.
set_ios_testing_flags() {
	local dev_dir
	dev_dir="$(xcrun --sdk iphonesimulator --show-sdk-platform-path)/Developer/Library/Frameworks"
	IOS_TESTING_FLAGS=(
		-Xswiftc -F -Xswiftc "$dev_dir"
		-Xlinker -F -Xlinker "$dev_dir"
	)
}

# FrakSDKVersion.current is sent on the wire (x-frak-sdk-version, ?sdkVersion=) and has no
# release pipeline of its own yet, so it is kept in sync with package.json by hand. Android
# has `checkSdkVersionMatchesArtifact` (`frak-publish.gradle.kts`) wired into `check` for the
# same reason; this is that gate's iOS twin. 05-build-and-release.md §3 forbids retagging a
# published version, so a drift caught after tagging ships uncorrectable — this must fail
# loudly on either side being unreadable, not just on a mismatch, or a botched extraction
# reads as an empty-equals-empty pass and the gate is worthless.
# Sets SDK_VERSION. Matched on `current`'s own declaration line, not a line offset, so an
# `@_spi`/doc comment on a neighbouring member (headerName, queryParameterName) can't shift it.
check_sdk_version() {
	local version_file="$PKG_DIR/Sources/FrakSDK/FrakSDKVersion.swift"
	local package_json="$PKG_DIR/package.json"
	local declared package_version

	# || true on both extractions: set -euo pipefail would otherwise abort the script the
	# moment grep finds no match, before the emptiness check below gets to die() with a
	# readable message — the one silent-failure shape this gate must not have.
	declared="$(grep -E 'public static let current: String = "' "$version_file" |
		sed -E 's/.*current: String = "([^"]*)".*/\1/')" || true
	[ -n "$declared" ] || die "Could not find FrakSDKVersion.current in $version_file"

	package_version="$(grep -E '"version"[[:space:]]*:' "$package_json" | head -1 |
		sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')" || true
	[ -n "$package_version" ] || die "Could not find \"version\" in $package_json"

	[ "$declared" = "$package_version" ] ||
		die "FrakSDKVersion.current is \"$declared\" but package.json version is \"$package_version\" — these must match. See finding 9.10 in docs/plans/native-sdk/06-open-findings.md."

	SDK_VERSION="$declared"
}

do_build() {
	cd "$PKG_DIR"
	check_sdk_version
	log "Building against the iOS simulator SDK (Swift 6 strict concurrency)..."
	set_ios_flags
	swift build "${IOS_FLAGS[@]}"
}

# Two stages: neither alone is the full test.
#   1. Build the test targets for arm64-apple-ios15.0-simulator, proving the suites
#      compile under Swift 6 strict concurrency. Cannot run them: SwiftPM's test runner
#      is a macOS process and refuses to dlopen an iOS-simulator bundle. Running on a
#      simulator needs `xcodebuild test -destination 'platform=iOS Simulator,...'` with a
#      generated Xcode project — not done yet, deferred with the XCFramework work.
#   2. Run the suites on the host. FrakSDKUI hides everything UIKit behind
#      `#if canImport(UIKit)`, so on the host that target reduces to `SharingPageURL` and
#      `SharingResult`. The sheet, the web view, the state machine and native share are
#      type-checked by stage 1 only, not executed anywhere yet.
do_test() {
	cd "$PKG_DIR"
	check_sdk_version

	log "Compiling tests against the iOS simulator SDK (Swift 6 strict concurrency)..."
	set_ios_flags
	set_ios_testing_flags
	swift build --build-tests "${IOS_FLAGS[@]}" "${IOS_TESTING_FLAGS[@]}"

	log "Running tests on the host toolchain..."
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
	log "FrakSDKVersion.current matches package.json ($SDK_VERSION)."
}

# NOT IMPLEMENTED. The shipped artifact will be a signed binary XCFramework referenced
# from a consumer's Package.swift by remote zip + checksum. None of that exists yet.
#
# Intended shape:
#
#   1. Archive one slice per destination, with library evolution on for ABI stability:
#
#      for dest in "generic/platform=iOS" "generic/platform=iOS Simulator"; do
#          xcodebuild archive \
#              -scheme FrakSDK \
#              -destination "$dest" \
#              -archivePath "build/$dest.xcarchive" \
#              SKIP_INSTALL=NO \
#              BUILD_LIBRARY_FOR_DISTRIBUTION=YES
#      done
#
#   2. Combine the slices, carrying the .swiftmodule from each archive:
#
#      xcodebuild -create-xcframework \
#          -framework "build/iOS.xcarchive/Products/.../FrakSDK.framework" \
#          -framework "build/iOS Simulator.xcarchive/Products/.../FrakSDK.framework" \
#          -output "build/FrakSDK.xcframework"
#
#   3. Sign it — `codesign --timestamp -s "<Apple Distribution cert>"`.
#
#   4. Zip, checksum with `swift package compute-checksum`, publish, and reference from
#      a distribution manifest via `.binaryTarget(name:url:checksum:)`.
#
#   5. Verify PrivacyInfo.xcprivacy propagates into a real consumer app, not just a local
#      build — AppsFlyer's issue #281 shows the manifest failing to bundle in the static
#      SPM variant.
#
# Repeat for FrakSDKUI. Needs an Xcode project or scheme SwiftPM can archive; `swift
# build` alone cannot produce a framework.
do_xcframework() {
	die "xcframework is not implemented.

XCFramework assembly and .binaryTarget distribution are 05-build-and-release.md
§3.1 work, deferred until the SDK has run on a device. Source distribution via SwiftPM
works today.

The intended xcodebuild archive / -create-xcframework outline is in the comments above
do_xcframework() in $0."
}

case "${1:-build}" in
build) do_build ;;
test) do_test ;;
lint) do_lint ;;
format) do_format ;;
version) do_version ;;
xcframework) do_xcframework ;;
*)
	echo "Usage: $0 {build|test|lint|format|version|xcframework}"
	echo ""
	echo "  build       - compile against the iOS simulator SDK (Swift 6 strict concurrency)"
	echo "  test        - swift test, same triple"
	echo "  lint        - swift-format lint (strict), no simulator"
	echo "  format      - swift-format rewrite in place"
	echo "  version     - checks FrakSDKVersion.current against package.json (9.10)"
	echo "  xcframework - NOT IMPLEMENTED (05 §3) — exits 1 with the intended outline"
	exit 1
	;;
esac
