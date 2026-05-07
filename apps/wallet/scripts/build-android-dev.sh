#!/usr/bin/env bash
# Build the Android dev variant locally (id.frak.wallet.dev / "Frak Wallet Dev").
# `FRAK_VARIANT=dev` flips applicationId, app name, App Link host, and deep-link
# scheme in app/build.gradle.kts. No source files are mutated.
#
# Usage: bun run --cwd apps/wallet tauri:android:build:dev

set -euo pipefail

export FRAK_VARIANT=dev
# Note: no `--config src-tauri/tauri.conf.dev.json` — on Android the dev bundle id
# comes from Gradle's `applicationId` (driven by FRAK_VARIANT), not Tauri's `identifier`.
# Overriding `identifier` would make Tauri CLI look for sources under id/frak/wallet/dev/.
sst shell -- tauri android build
