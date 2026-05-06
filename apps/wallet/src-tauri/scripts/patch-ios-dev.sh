#!/usr/bin/env bash
# Rewrites apps/wallet/src-tauri/gen/apple/project.yml in place for the dev variant.
# Idempotent: anchored regexes only match the prod values, so re-runs are no-ops.
#
# xcodegen (invoked by `tauri ios build`) regenerates the Xcode project, Info.plist,
# and entitlements file from project.yml at build time, so patching project.yml is
# enough — no need to touch the generated files directly.
#
# Usage: bash apps/wallet/src-tauri/scripts/patch-ios-dev.sh
# Run from the repo root.

set -euo pipefail

PROJECT_YML="apps/wallet/src-tauri/gen/apple/project.yml"

if [ ! -f "$PROJECT_YML" ]; then
    echo "[patch-ios-dev] ERROR: $PROJECT_YML not found (run from repo root)" >&2
    exit 1
fi

# BSD- and GNU-compatible in-place edit
sed_i() {
    sed -i.bak -E "$1" "$PROJECT_YML"
    rm -f "$PROJECT_YML.bak"
}

# 1. Bundle identifier + product name
sed_i 's|^(  bundleIdPrefix: )id\.frak\.wallet$|\1id.frak.wallet.dev|'
sed_i 's|^(      PRODUCT_NAME: )Frak Wallet$|\1Frak Wallet Dev|'
sed_i 's|^(      PRODUCT_BUNDLE_IDENTIFIER: )id\.frak\.wallet$|\1id.frak.wallet.dev|'

# 2. URL types: CFBundleURLName + custom scheme (frakwallet → frakwallet-dev).
#    Listener-dev (Vite `define`) generates frakwallet-dev:// links targeting this variant.
sed_i 's|^(          - CFBundleURLName: )id\.frak\.wallet$|\1id.frak.wallet.dev|'
sed_i 's|^(              - )frakwallet$|\1frakwallet-dev|'

# 3. Keychain access group reference
sed_i 's|^(          - \$\(AppIdentifierPrefix\)id\.frak\.wallet)$|\1.dev|'

# 4. Associated domains: prod project.yml lists wallet.frak.id only;
#    dev variant retargets to wallet-dev.frak.id.
sed_i 's|^(          - webcredentials:)wallet\.frak\.id$|\1wallet-dev.frak.id|'
sed_i 's|^(          - applinks:)wallet\.frak\.id$|\1wallet-dev.frak.id|'

echo "[patch-ios-dev] $PROJECT_YML rewritten for dev variant (id.frak.wallet.dev)"
