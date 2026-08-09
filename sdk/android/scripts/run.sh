#!/usr/bin/env bash
# Build / test / lint the Frak Android SDK. No device is ever required.
#
# Usage:
#   bun run --cwd sdk/android build         # assembleRelease — this IS the typecheck
#   bun run --cwd sdk/android test          # JVM unit tests
#   bun run --cwd sdk/android lint          # ktlintCheck
#   bun run --cwd sdk/android format        # ktlintFormat, rewrites in place
#   bun run --cwd sdk/android check         # ktlint, version drift, apiCheck, tests, Android Lint
#   bun run --cwd sdk/android apiCheck      # public ABI vs the committed api/*.api
#   bun run --cwd sdk/android apiDump       # rewrite those dumps; the diff IS the review
#   bun run --cwd sdk/android publishLocal  # publishToMavenLocal (~/.m2)

set -euo pipefail

SDK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

log() { echo "[android-sdk] $*"; }
die() {
	echo "[android-sdk] ERROR: $*" >&2
	exit 1
}

# Gradle reads ANDROID_HOME directly; without it `assembleRelease` fails with "SDK location not found".
resolve_sdk() {
	local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
	[ -d "$sdk" ] || die "Android SDK not found. Set ANDROID_HOME, or install via Android Studio."
	export ANDROID_HOME="$sdk"
	export PATH="$sdk/platform-tools:$PATH"
}

do_build() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Assembling release AARs (frak-sdk, frak-sdk-ui)..."
	./gradlew assembleRelease
}

do_test() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Running JVM unit tests..."
	./gradlew test
}

do_lint() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Checking Kotlin formatting and style..."
	./gradlew ktlintCheck
}

do_format() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Formatting Kotlin sources..."
	./gradlew ktlintFormat
}

do_check() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Running full verification (ktlint, ABI gate, unit tests, Android Lint, version drift)..."
	./gradlew check
}

do_api_check() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Comparing the public ABI against the committed api/*.api dumps..."
	./gradlew apiCheck
}

do_api_dump() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Writing api/frak-sdk.api and api/frak-sdk-ui.api..."
	./gradlew apiDump
}

do_publish_local() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Publishing to mavenLocal (~/.m2/repository/id/frak)..."
	./gradlew publishToMavenLocal
}

# Builds the Central Portal deployment bundle and verifies it is complete.
#
# Signing is opt-in in `frak-publish.gradle.kts` (`isRequired = signingKey != null`), so without
# ORG_GRADLE_PROJECT_signingInMemoryKey this produces an *unsigned* bundle rather than failing —
# which is why `checkCentralBundle`, not `centralBundle`, is what this runs. Uploading is not done
# here; `.github/workflows/release-android-sdk.yml` owns it, so the Portal token stays out of any
# local build.
do_bundle() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Building and verifying the Central Portal bundle..."
	./gradlew checkCentralBundle
	log "Bundle: $SDK_DIR/build/central-bundle.zip"
}

case "${1:-build}" in
build) do_build ;;
test) do_test ;;
lint) do_lint ;;
format) do_format ;;
check) do_check ;;
apiCheck) do_api_check ;;
apiDump) do_api_dump ;;
publishLocal) do_publish_local ;;
bundle) do_bundle ;;
*)
	echo "Usage: $0 {build|test|lint|format|check|apiCheck|apiDump|publishLocal|bundle}"
	echo ""
	echo "  build        - assembleRelease; this IS the typecheck. No device required"
	echo "  test         - JVM unit tests. No device required"
	echo "  lint         - ktlint check. No device required"
	echo "  format       - ktlint auto-format in place"
	echo "  check        - full verification: ktlint, ABI gate, unit tests, Android Lint, version"
	echo "                 drift. NOT a superset of the repo-root 'bun run lint' — ktlint here only"
	echo "                 covers subprojects, not the root Gradle scripts"
	echo "  apiCheck     - public ABI vs the committed api/*.api. Also part of 'check'"
	echo "  apiDump      - write/rewrite those dumps; review the diff, it IS the ABI decision"
	echo "  publishLocal - publishToMavenLocal, for consuming an unreleased build"
	echo "  bundle       - build + verify the Central Portal deployment bundle (no upload)"
	exit 1
	;;
esac
