#!/usr/bin/env bash
# Build / test / lint the Frak Android SDK.
#
# Mirrors the ergonomics of `example/native-android/scripts/run.sh`: one script
# with subcommands, wrapped by this folder's package.json scripts.
#
# Usage:
#   bun run --cwd sdk/android build         # assembleRelease — this IS the typecheck
#   bun run --cwd sdk/android test          # JVM unit tests
#   bun run --cwd sdk/android lint          # ktlintCheck
#   bun run --cwd sdk/android format        # ktlintFormat, rewrites in place
#   bun run --cwd sdk/android size          # dex size against the budget
#   bun run --cwd sdk/android check         # full `check`: ktlint, version drift, dex budget,
#                                              unit tests (`test`) and Android Lint
#   bun run --cwd sdk/android publishLocal  # publishToMavenLocal (~/.m2)
#
# No device is ever required. This is a library, not an app: there is nothing to install and
# nothing to launch, so unlike the example app's script there is no adb path, no emulator
# boot, and no logcat tail here.
#
# No binary-compatibility gate here yet: committing an api/*.api dump ratifies the public
# shape, which is still undecided. It comes back, with the dump, before the first publish.
#
# `check` also runs Android Lint (an AGP-provided `check` dependency, not something this
# script wires) and the `test` task. Android Lint has never been executed in this project —
# there is no JDK here and no CI job for it either — so its first run may surface
# pre-existing, unrelated findings; do not assume a Lint failure is caused by whatever you
# just changed.
#
# `check` here is scoped to this Gradle build, not the repo-root `bun run lint`: ktlint is
# applied only in this build's root `subprojects {}`, so `./gradlew check` never lints the
# root `build.gradle.kts` / `settings.gradle.kts`. `check` here is not a superset of `lint`.

set -euo pipefail

SDK_DIR="$(cd "$(dirname "$0")/.." && pwd)"

log() { echo "[android-sdk] $*"; }
die() {
	echo "[android-sdk] ERROR: $*" >&2
	exit 1
}

# Locates the SDK and exports ANDROID_HOME: Gradle reads it directly, and without it
# `assembleRelease` fails with a raw "SDK location not found" even when the SDK is at the
# default path.
resolve_sdk() {
	local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
	[ -d "$sdk" ] || die "Android SDK not found. Set ANDROID_HOME, or install via Android Studio."
	export ANDROID_HOME="$sdk"
	export PATH="$sdk/platform-tools:$PATH"
}

do_build() {
	resolve_sdk
	cd "$SDK_DIR"
	# There is no separate typecheck task to add — assembling the release AAR
	# compiles every source set with `explicitApi()` enforced, so this is it.
	log "Assembling release AARs (frak-sdk, frak-sdk-ui)..."
	./gradlew assembleRelease
}

do_test() {
	resolve_sdk
	cd "$SDK_DIR"
	# Local JVM tests only — `test` deliberately excludes `connectedAndroidTest`
	# so this stays runnable on a plain Linux CI runner with no device.
	log "Running JVM unit tests..."
	./gradlew test
}

# ktlint comes from the Gradle plugin, so these need no `brew install` — the
# first run downloads it, later runs are cached like any other dependency.
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

# Dex, not AAR: the budget is app-size impact on a merchant, and an AAR carries
# debug info and Kotlin metadata that never reaches a device.
do_size() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Measuring release dex against the size budget..."
	./gradlew checkDexSizeBudget
}

# `check` is the lifecycle task everything else hangs off: ktlintCheck,
# checkSdkVersionMatchesArtifact and checkDexSizeBudget (frak-publish.gradle.kts) all run
# here, plus the AGP-provided `test` task and Android Lint. Android Lint has never executed
# in this project, so its first run here may need triage for pre-existing findings unrelated
# to your change.
do_check() {
	resolve_sdk
	cd "$SDK_DIR"
	log "Running full verification (ktlint, unit tests, Android Lint, version drift, dex budget)..."
	./gradlew check
}

do_publish_local() {
	resolve_sdk
	cd "$SDK_DIR"
	# Publishes id.frak:frak-sdk / id.frak:frak-sdk-ui into the local ~/.m2 repository, which
	# is how a merchant app (or `example/native-android`) can consume an unreleased build via
	# `mavenLocal()`. Maven Central publishing is a separate, credentialed flow.
	log "Publishing to mavenLocal (~/.m2/repository/id/frak)..."
	./gradlew publishToMavenLocal
}

case "${1:-build}" in
build) do_build ;;
test) do_test ;;
lint) do_lint ;;
format) do_format ;;
size) do_size ;;
check) do_check ;;
publishLocal) do_publish_local ;;
*)
	echo "Usage: $0 {build|test|lint|format|size|check|publishLocal}"
	echo ""
	echo "  build        - assembleRelease; this IS the typecheck. No device required"
	echo "  test         - JVM unit tests. No device required"
	echo "  lint         - ktlint check. No device required"
	echo "  format       - ktlint auto-format in place"
	echo "  size         - release dex size vs the budget. No device required"
	echo "  check        - full verification: ktlint, unit tests, Android Lint, version drift,"
	echo "                 dex budget. NOT a superset of the repo-root"
	echo "                 'bun run lint' — ktlint here only covers subprojects, not the root Gradle"
	echo "                 scripts. Android Lint has never run in this project; its first run may"
	echo "                 surface pre-existing findings unrelated to your change"
	echo "  publishLocal - publishToMavenLocal, for consuming an unreleased build"
	exit 1
	;;
esac
