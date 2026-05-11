#!/usr/bin/env bash
# Build the Android dev variant locally (id.frak.wallet.dev / "Frak Wallet Dev").
# `FRAK_VARIANT=dev` flips applicationId, app name, App Link host, and deep-link
# scheme in app/build.gradle.kts. No source files are mutated.
#
# Usage: bun run --cwd apps/wallet tauri:android:build:dev

set -euo pipefail

export FRAK_VARIANT=dev
# Note: we pass `--config src-tauri/tauri.conf.android-dev.json` (NOT `tauri.conf.dev.json`)
# because Android's `applicationId` comes from Gradle's `applicationIdSuffix` (driven by
# FRAK_VARIANT), not Tauri's `identifier`. Overriding `identifier` would make Tauri CLI
# look for sources under id/frak/wallet/dev/. The Android-specific overlay only flips
# `plugins.deep-link.mobile` so the dev variant registers `wallet-dev.frak.id` and the
# `frakwallet-dev://` custom scheme (and only those — strict per-variant routing).
sst shell -- tauri android build --config src-tauri/tauri.conf.android-dev.json
