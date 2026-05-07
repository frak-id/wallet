#!/usr/bin/env bash
# Build the iOS dev variant locally (id.frak.wallet.dev / "Frak Wallet Dev").
# Patches gen/apple/project.yml in place, builds, then restores via `git checkout`
# so the working tree stays clean.
#
# Usage: bun run --cwd apps/wallet tauri:ios:build:dev

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT_YML_REL="apps/wallet/src-tauri/gen/apple/project.yml"

cd "$REPO_ROOT"

restore() {
    git checkout -- "$PROJECT_YML_REL" 2>/dev/null || true
}
trap restore EXIT

bash apps/wallet/src-tauri/scripts/patch-ios-dev.sh

sst shell -- bash -c "cd apps/wallet && tauri ios build --config src-tauri/tauri.conf.dev.json --export-method app-store-connect"
