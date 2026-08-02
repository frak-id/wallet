#!/usr/bin/env bash
# Build / test / lint the Frak iOS SDK package.
#
# Mirrors the ergonomics of `example/native-ios/scripts/run.sh`: one script with
# subcommands, wrapped by this package's package.json scripts.
#
# Usage:
#   bun run --cwd sdk/ios build         # compile against the iOS simulator SDK
#   bun run --cwd sdk/ios test          # swift test, same triple
#   bun run --cwd sdk/ios lint          # swift-format lint (strict)
#   bun run --cwd sdk/ios format        # swift-format rewrite in place
#   bun run --cwd sdk/ios xcframework   # NOT IMPLEMENTED — see do_xcframework

set -euo pipefail

PKG_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Logs go to stderr so stdout stays clean for anything that pipes this script.
log() { echo "[sdk-ios] $*" >&2; }
die() {
	echo "[sdk-ios] ERROR: $*" >&2
	exit 1
}

# The iOS simulator SDK path and target triple, shared by build and test.
#
# This is not optional ceremony: a bare `swift build` targets the host and would
# compile this package as macOS, passing without ever exercising iOS. The example
# harness documents the same trap — `example/native-ios/scripts/run.sh`.
#
# `-swift-version 6` is passed here rather than declared in Package.swift because
# `.swiftLanguageMode` is a tools-version 6.0 API and this manifest is 5.9, and the
# 5.9 alternative (`.unsafeFlags`) would make the package unusable as a versioned
# SwiftPM dependency. Swift 6 strict concurrency is a hard requirement (02 §2).
# Sets IOS_FLAGS. Assigns a global rather than echoing, because macOS ships bash 3.2 —
# no namerefs, and no way to return an array.
set_ios_flags() {
	local sdk_path
	sdk_path="$(xcrun --sdk iphonesimulator --show-sdk-path)" ||
		die "Could not locate the iphonesimulator SDK. Is Xcode installed and selected?"
	IOS_FLAGS=(
		--sdk "$sdk_path"
		-Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator
		-Xswiftc -swift-version -Xswiftc 6
	)
}

# Swift Testing (not XCTest) lives in the platform Developer frameworks directory, and
# SwiftPM does not add it for a cross-compiled triple. XCTest's Swift overlay is
# zippered macOS/Catalyst and cannot be linked for iOS-simulator from SwiftPM at all —
# which is why the suites here use Swift Testing.
# Sets IOS_TESTING_FLAGS.
set_ios_testing_flags() {
	local dev_dir
	dev_dir="$(xcrun --sdk iphonesimulator --show-sdk-platform-path)/Developer/Library/Frameworks"
	IOS_TESTING_FLAGS=(
		-Xswiftc -F -Xswiftc "$dev_dir"
		-Xlinker -F -Xlinker "$dev_dir"
	)
}

do_build() {
	cd "$PKG_DIR"
	log "Building against the iOS simulator SDK (Swift 6 strict concurrency)..."
	set_ios_flags
	swift build "${IOS_FLAGS[@]}"
}

# Two stages, because neither one alone is the test.
#
#   1. Build the test targets for arm64-apple-ios15.0-simulator. This is the part that
#      proves the suites compile against the iOS SDK under Swift 6 strict concurrency.
#      It cannot RUN them: SwiftPM's test runner is a macOS process and refuses to
#      dlopen an iOS-simulator bundle ("incompatible platform"). Executing on a real
#      simulator needs `xcodebuild test -destination 'platform=iOS Simulator,...'`,
#      which needs a generated Xcode project — the same gap the example harness has
#      (it uses XcodeGen). Adding that here is deferred with the XCFramework work.
#   2. Run the suites on the host, which is what actually asserts behaviour. FrakSDK has
#      one platform-conditional seam — SystemAppLauncher, a false-returning stub where
#      there is no UIKit, which nothing tests directly, so its suites do not diverge.
#      FrakSDKUI is another matter: everything that touches UIKit sits behind
#      `#if canImport(UIKit)`, so on the host that target reduces to `SharingPageURL`
#      and `SharingResult` and stage 2 asserts only those. The sheet, the web view,
#      the state machine and the native share are type-checked by stage 1 and
#      executed by neither — the xcodebuild-on-simulator path above is what finally
#      runs them, and it is still unbuilt.
do_test() {
	cd "$PKG_DIR"

	log "Compiling tests against the iOS simulator SDK (Swift 6 strict concurrency)..."
	set_ios_flags
	set_ios_testing_flags
	swift build --build-tests "${IOS_FLAGS[@]}" "${IOS_TESTING_FLAGS[@]}"

	log "Running tests on the host toolchain..."
	swift test
}

# `swift format` ships inside the Xcode toolchain — nothing to install, and the
# version is pinned to whatever Xcode the machine already builds with.
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

# NOT IMPLEMENTED. XCFramework assembly and `.binaryTarget` distribution are
# 03-implementation-strategy.md §3.1 work: the shipped artifact is a signed binary
# XCFramework referenced from a consumer's Package.swift by remote zip + checksum.
# None of that exists yet, and there is no SDK behaviour to put inside it.
#
# The intended shape, for whoever builds it:
#
#   1. Archive one slice per destination, with library evolution on so the binary
#      stays ABI-stable across compiler versions:
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
#   3. Sign it — `codesign --timestamp -s "<Apple Distribution cert>"`. Frak is not on
#      Apple's commonly-used third-party SDK list so signing is not yet mandatory, but
#      02 §5.1 calls it the right call regardless.
#
#   4. Zip, checksum with `swift package compute-checksum`, publish, and reference from
#      a distribution manifest via `.binaryTarget(name:url:checksum:)`.
#
#   5. Verify PrivacyInfo.xcprivacy actually propagates into a REAL consumer app, not
#      just a local build — 03 §3.1 records AppsFlyer's issue #281, where the manifest
#      failed to bundle in the static SPM variant.
#
# Repeat all of the above for FrakSDKUI.
#
# Note this needs an Xcode project or a scheme SwiftPM can archive; `swift build`
# alone cannot produce a framework.
do_xcframework() {
	die "xcframework is not implemented.

XCFramework assembly and .binaryTarget distribution are 03-implementation-strategy.md
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
xcframework) do_xcframework ;;
*)
	echo "Usage: $0 {build|test|lint|format|xcframework}"
	echo ""
	echo "  build       - compile against the iOS simulator SDK (Swift 6 strict concurrency)"
	echo "  test        - swift test, same triple"
	echo "  lint        - swift-format lint (strict), no simulator"
	echo "  format      - swift-format rewrite in place"
	echo "  xcframework - NOT IMPLEMENTED (03 §3.1) — exits 1 with the intended outline"
	exit 1
	;;
esac
