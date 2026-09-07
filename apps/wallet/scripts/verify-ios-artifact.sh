#!/usr/bin/env bash
# Asserts a built iOS app carries the variant it was supposed to be built for.
#
# Checks the artifact, not the intent: the URL scheme and the entitlements are
# written into the shell by build steps that can be skipped (cargo fingerprint
# reuse on a warm target dir), and a wrong one is invisible until a merchant's
# SDK probes for a wallet that answers nothing.
#
# Usage: verify-ios-artifact.sh <dev|prod> <path to .app | .ipa | .xcarchive>
set -euo pipefail

STAGE="${1:?usage: verify-ios-artifact.sh <dev|prod> <artifact>}"
ARTIFACT="${2:?usage: verify-ios-artifact.sh <dev|prod> <artifact>}"

case "$STAGE" in
dev)
    WANT_ID=id.frak.wallet.dev
    WANT_SCHEME=frakwallet-dev
    WANT_HOST=wallet-dev.frak.id
    ;;
prod | production)
    WANT_ID=id.frak.wallet
    WANT_SCHEME=frakwallet
    WANT_HOST=wallet.frak.id
    ;;
*)
    echo "❌ unknown stage \"$STAGE\" (expected dev or prod)" >&2
    exit 1
    ;;
esac

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Resolve any accepted shape down to a single .app bundle. A directory prefers the
# exported .ipa over the .xcarchive: the archive is pre-export, so its entitlements
# still hold `$(AppIdentifierPrefix)` and its signature is not the one that ships.
if [ -d "$ARTIFACT" ] && [ "${ARTIFACT%.xcarchive}" = "$ARTIFACT" ] && [ "${ARTIFACT%.app}" = "$ARTIFACT" ]; then
    FOUND=$(find "$ARTIFACT" -maxdepth 3 -name "*.ipa" | head -1)
    [ -n "$FOUND" ] || FOUND=$(find "$ARTIFACT" -maxdepth 2 -name "*.xcarchive" | head -1)
    if [ -z "$FOUND" ]; then
        echo "❌ no .ipa or .xcarchive under $ARTIFACT" >&2
        exit 1
    fi
    echo "   verifying $(basename "$FOUND")"
    ARTIFACT=$FOUND
fi

case "$ARTIFACT" in
*.ipa)
    unzip -q "$ARTIFACT" -d "$WORK/ipa"
    APP=$(find "$WORK/ipa/Payload" -maxdepth 1 -name "*.app" | head -1)
    ;;
*.xcarchive)
    APP=$(find "$ARTIFACT/Products/Applications" -maxdepth 1 -name "*.app" | head -1)
    ;;
*.app)
    APP="$ARTIFACT"
    ;;
*)
    echo "❌ $ARTIFACT is not a .app, .ipa, .xcarchive or a directory holding one" >&2
    exit 1
    ;;
esac

if [ -z "${APP:-}" ] || [ ! -d "$APP" ]; then
    echo "❌ no .app bundle inside $ARTIFACT" >&2
    exit 1
fi

FAILED=0
fail() {
    echo "❌ $1" >&2
    echo "   expected: $2" >&2
    echo "   found:    ${3:-<nothing>}" >&2
    FAILED=1
}

plist() { plutil -extract "$1" raw -o - "$APP/Info.plist" 2>/dev/null || true; }

GOT_ID=$(plist CFBundleIdentifier)
[ "$GOT_ID" = "$WANT_ID" ] || fail "wrong bundle identifier" "$WANT_ID" "$GOT_ID"

GOT_SCHEME=$(plist CFBundleURLTypes.0.CFBundleURLSchemes.0)
[ "$GOT_SCHEME" = "$WANT_SCHEME" ] ||
    fail "wrong URL scheme — the SDK's install probe and scheme fallback will find no wallet" \
        "$WANT_SCHEME" "$GOT_SCHEME"

ENTITLEMENTS="$WORK/entitlements.plist"
codesign -d --entitlements :- "$APP" 2>/dev/null | plutil -convert xml1 -o "$ENTITLEMENTS" - 2>/dev/null || true

if [ ! -s "$ENTITLEMENTS" ]; then
    fail "could not read entitlements" "a signed bundle" "unsigned or unreadable"
else
    GOT_DOMAINS=$(
        /usr/libexec/PlistBuddy -c "Print :com.apple.developer.associated-domains" "$ENTITLEMENTS" 2>/dev/null |
            grep -Eo '(webcredentials|applinks):[^ ]+' | tr '\n' ' ' | sed 's/ *$//'
    )
    WANT_DOMAINS="webcredentials:frak.id webcredentials:$WANT_HOST applinks:$WANT_HOST"
    [ "$GOT_DOMAINS" = "$WANT_DOMAINS" ] ||
        fail "wrong associated domains — passkeys and universal links point at the other variant" \
            "$WANT_DOMAINS" "$GOT_DOMAINS"

    GOT_GROUP=$(/usr/libexec/PlistBuddy -c "Print :keychain-access-groups:0" "$ENTITLEMENTS" 2>/dev/null || true)
    # Two legal spellings of the same group: `$(AppIdentifierPrefix)<id>` as authored,
    # and `<team>.<id>` once export expands it. Strip whichever prefix is present.
    case "$GOT_GROUP" in
    '$(AppIdentifierPrefix)'*) GOT_ID_PART=${GOT_GROUP#'$(AppIdentifierPrefix)'} ;;
    *) GOT_ID_PART=${GOT_GROUP#*.} ;;
    esac
    [ "$GOT_ID_PART" = "$WANT_ID" ] ||
        fail "wrong keychain access group" "\$(AppIdentifierPrefix)$WANT_ID or <team>.$WANT_ID" "$GOT_GROUP"
fi

if [ "$FAILED" -ne 0 ]; then
    echo >&2
    echo "   $(basename "$APP") was built for $STAGE but does not carry $STAGE values." >&2
    echo "   sync-ios-variant.sh runs last in the \"Build Rust Code\" phase and keys off" >&2
    echo "   PRODUCT_BUNDLE_IDENTIFIER — check that it ran and that the phase still calls it." >&2
    exit 1
fi

echo "✅ $(basename "$APP") is a valid $STAGE build — $WANT_ID · $WANT_SCHEME:// · $WANT_HOST"
