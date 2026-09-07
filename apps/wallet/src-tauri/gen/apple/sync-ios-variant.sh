#!/usr/bin/env bash
# Points the iOS shell's URL scheme, associated domains and keychain group at the
# variant Xcode is actually building.
#
# Runs from the "Build Rust Code" phase, last, and reads PRODUCT_BUNDLE_IDENTIFIER
# rather than FRAK_VARIANT: cargo-mobile2 hands xcodebuild an explicit env
# (TAURI*/CARGO_*/RUST_*/PATH/TMPDIR), so FRAK_VARIANT never arrives, while the
# bundle id does and already carries Tauri's merged --config overlay.
#
# Last on purpose. `tauri-plugin-deep-link`'s build script writes the same two files
# from the same merged config, but only when cargo re-runs it, and its entitlements
# branch replaces associated-domains with `applinks:<host>` alone — dropping the
# webcredentials entries passkeys need.
set -euo pipefail

PLIST_BUDDY=/usr/libexec/PlistBuddy
SHELL_DIR="${SRCROOT:?}/app_iOS"
INFO_PLIST="$SHELL_DIR/Info.plist"
ENTITLEMENTS="$SHELL_DIR/app_iOS.entitlements"

BUNDLE_ID="${PRODUCT_BUNDLE_IDENTIFIER:-}"
if [ -z "$BUNDLE_ID" ]; then
    echo "[sync-ios-variant] ERROR: PRODUCT_BUNDLE_IDENTIFIER is unset — cannot tell the variant apart" >&2
    exit 1
fi

case "$BUNDLE_ID" in
id.frak.wallet.dev)
    SCHEME=frakwallet-dev
    HOST=wallet-dev.frak.id
    ;;
id.frak.wallet)
    SCHEME=frakwallet
    HOST=wallet.frak.id
    ;;
*)
    echo "[sync-ios-variant] ERROR: unknown bundle id \"$BUNDLE_ID\"" >&2
    echo "                   Add it here and to scripts/check-ios-url-scheme.ts." >&2
    exit 1
    ;;
esac

# Every write is guarded by a read: an unchanged file keeps its mtime, so Xcode does
# not re-sign, and a prod build leaves the tracked copy byte-identical.
plist_get() {
    "$PLIST_BUDDY" -c "Print $2" "$1" 2>/dev/null || true
}

# --- CFBundleURLTypes -------------------------------------------------------------

if [ "$(plist_get "$INFO_PLIST" ":CFBundleURLTypes:0:CFBundleURLSchemes:0")" != "$SCHEME" ] ||
    [ "$(plist_get "$INFO_PLIST" ":CFBundleURLTypes:0:CFBundleURLName")" != "$BUNDLE_ID" ]; then
    "$PLIST_BUDDY" \
        -c "Delete :CFBundleURLTypes" \
        -c "Add :CFBundleURLTypes array" \
        -c "Add :CFBundleURLTypes:0 dict" \
        -c "Add :CFBundleURLTypes:0:CFBundleURLName string $BUNDLE_ID" \
        -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" \
        -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $SCHEME" \
        "$INFO_PLIST" >/dev/null 2>&1 ||
        "$PLIST_BUDDY" \
            -c "Add :CFBundleURLTypes array" \
            -c "Add :CFBundleURLTypes:0 dict" \
            -c "Add :CFBundleURLTypes:0:CFBundleURLName string $BUNDLE_ID" \
            -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" \
            -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string $SCHEME" \
            "$INFO_PLIST"
    echo "[sync-ios-variant] Info.plist → $SCHEME:// ($BUNDLE_ID)"
fi

# --- Entitlements -----------------------------------------------------------------

DOMAINS_KEY=":com.apple.developer.associated-domains"
WANT_DOMAINS="webcredentials:frak.id webcredentials:$HOST applinks:$HOST"
HAVE_DOMAINS=$(
    "$PLIST_BUDDY" -c "Print $DOMAINS_KEY" "$ENTITLEMENTS" 2>/dev/null |
        grep -Eo '(webcredentials|applinks):[^ ]+' | tr '\n' ' ' | sed 's/ *$//'
)

if [ "$HAVE_DOMAINS" != "$WANT_DOMAINS" ]; then
    "$PLIST_BUDDY" -c "Delete $DOMAINS_KEY" "$ENTITLEMENTS" >/dev/null 2>&1 || true
    "$PLIST_BUDDY" -c "Add $DOMAINS_KEY array" "$ENTITLEMENTS"
    index=0
    for domain in $WANT_DOMAINS; do
        "$PLIST_BUDDY" -c "Add $DOMAINS_KEY:$index string $domain" "$ENTITLEMENTS"
        index=$((index + 1))
    done
    echo "[sync-ios-variant] entitlements → $HOST"
fi

KEYCHAIN_KEY=":keychain-access-groups"
WANT_GROUP="\$(AppIdentifierPrefix)$BUNDLE_ID"
if [ "$(plist_get "$ENTITLEMENTS" "$KEYCHAIN_KEY:0")" != "$WANT_GROUP" ]; then
    "$PLIST_BUDDY" -c "Delete $KEYCHAIN_KEY" "$ENTITLEMENTS" >/dev/null 2>&1 || true
    "$PLIST_BUDDY" \
        -c "Add $KEYCHAIN_KEY array" \
        -c "Add $KEYCHAIN_KEY:0 string $WANT_GROUP" \
        "$ENTITLEMENTS"
    echo "[sync-ios-variant] keychain group → $WANT_GROUP"
fi
