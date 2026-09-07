#!/usr/bin/env bash
# Build the iOS dev variant locally (id.frak.wallet.dev / "Frak Wallet Dev").
#
# Variant selection is driven by:
#   - --config src-tauri/tauri.conf.dev.json  (overrides identifier + productName)
#   - gen/apple/sync-ios-variant.sh            (URL scheme, associated domains and
#                                              keychain group, from the bundle id)
#
# FRAK_VARIANT is exported for the beforeBuildCommand only; cargo-mobile2 strips it
# before xcodebuild, so the iOS shell cannot read it.
#
# The tracked Info.plist and entitlements ARE mutated in place, to dev values. Restore
# them before committing:  git checkout -- apps/wallet/src-tauri/gen/apple/app_iOS
#
# Usage: bun run --cwd apps/wallet tauri:ios:build:dev

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

cd "$REPO_ROOT"

FRAK_VARIANT=dev sst shell -- bash -c \
    "cd apps/wallet && tauri ios build --config src-tauri/tauri.conf.dev.json --export-method app-store-connect"

bash apps/wallet/scripts/verify-ios-artifact.sh dev \
    apps/wallet/src-tauri/gen/apple/build
