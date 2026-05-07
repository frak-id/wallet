#!/usr/bin/env bash
# Build the iOS dev variant locally (id.frak.wallet.dev / "Frak Wallet Dev").
#
# Variant selection is driven by:
#   - --config src-tauri/tauri.conf.dev.json  (overrides identifier + productName)
#   - FRAK_VARIANT=dev                         (build.rs rewrites entitlements
#                                              to point at wallet-dev.frak.id)
#
# No source files are mutated; no cleanup trap needed.
#
# Usage: bun run --cwd apps/wallet tauri:ios:build:dev

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

cd "$REPO_ROOT"

FRAK_VARIANT=dev sst shell -- bash -c \
    "cd apps/wallet && tauri ios build --config src-tauri/tauri.conf.dev.json --export-method app-store-connect"
