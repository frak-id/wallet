#!/usr/bin/env bash
# Build the Android dev variant locally (id.frak.wallet.dev / "Frak Wallet Dev").
# The Gradle property `appVariant=dev` flips applicationId, app name, and the
# App Link host in app/build.gradle.kts (no source files are mutated).
#
# Usage: bun run --cwd apps/wallet tauri:android:build:dev

set -euo pipefail

export ORG_GRADLE_PROJECT_appVariant=dev
sst shell -- tauri android build
