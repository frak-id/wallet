#!/bin/bash
# Rewrite only the version sites of the wallet, byte-exact, without jq/bun/cargo.
# Usage: [WALLET_DIR=apps/wallet] [REPO_DIR=<repo root>] ./scripts/pin-native-version.sh <x.y.z>

set -euo pipefail

if [ $# -ne 1 ] || ! [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "usage: pin-native-version.sh <x.y.z>" >&2
    exit 1
fi

VERSION="$1"
WALLET_DIR="${WALLET_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
REPO_DIR="${REPO_DIR:-$WALLET_DIR/../..}"
TAURI_DIR="$WALLET_DIR/src-tauri"
APPLE_DIR="$TAURI_DIR/gen/apple"

# Each awk program bumps `n` per site it rewrites; any other count means the site moved.
rewrite() {
    local file="$1" want="$2" program="$3" tmp
    tmp=$(mktemp)
    if ! awk -v v="$VERSION" -v want="$want" "$program"' END { exit (n + 0 != want + 0) }' "$file" > "$tmp"; then
        rm -f "$tmp"
        echo "[pin-native-version] ERROR: expected $want version site(s) in $file, found a different number" >&2
        exit 1
    fi
    # awk always ends the last line with a newline; the substitution drops it
    # again for files that committed without one (project.yml).
    if [ -n "$(tail -c1 "$file")" ]; then
        printf '%s' "$(cat "$tmp")" > "$file"
    else
        cat "$tmp" > "$file"
    fi
    rm -f "$tmp"
}

JSON_FIRST='!done && /^[ \t]*"version":/ { if (sub(/"version": "[^"]*"/, "\"version\": \"" v "\"")) n++; done = 1 } { print }'

rewrite "$WALLET_DIR/package.json" 1 "$JSON_FIRST"
rewrite "$TAURI_DIR/tauri.conf.json" 1 "$JSON_FIRST"

rewrite "$TAURI_DIR/Cargo.toml" 1 \
    '!done && /^version = "/ { $0 = "version = \"" v "\""; n++; done = 1 } { print }'

rewrite "$TAURI_DIR/Cargo.lock" 1 \
    'after_app && /^version = "/ { $0 = "version = \"" v "\""; n++ } { after_app = ($0 == "name = \"app\""); print }'

rewrite "$APPLE_DIR/project.yml" 2 \
    '/^[ \t]*CFBundleShortVersionString: / { if (sub(/CFBundleShortVersionString: .*/, "CFBundleShortVersionString: " v)) n++ }
     /^[ \t]*CFBundleVersion: / { if (sub(/CFBundleVersion: .*/, "CFBundleVersion: \"" v "\"")) n++ }
     { print }'

rewrite "$APPLE_DIR/app_iOS/Info.plist" 2 \
    'pending && /<string>.*<\/string>/ { if (sub(/<string>.*<\/string>/, "<string>" v "</string>")) n++ }
     { pending = ($0 ~ /<key>CFBundleShortVersionString<\/key>/ || $0 ~ /<key>CFBundleVersion<\/key>/); print }'

rewrite "$REPO_DIR/bun.lock" 1 \
    '$0 == "    \"apps/wallet\": {" { in_wallet = 1 }
     in_wallet && !done && /^      "version": "/ { if (sub(/"version": "[^"]*"/, "\"version\": \"" v "\"")) n++; done = 1 }
     /^    }/ { in_wallet = 0 }
     { print }'

echo "[pin-native-version] pinned $VERSION"
