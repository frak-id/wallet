#!/bin/bash
# Regenerate every Frak Wallet platform icon from the SVG/PNG sources.
#
# Inputs (sibling files):
#   manifest.json          — declares default source PNG + bg_color (#0043EF)
#                            keeping Android adaptive bg + iOS bg in sync
#   iOS-1024x1024.png      — master 1024×1024 raster used by `tauri icon`
#                            for macOS/Windows/Linux/iOS/Android base assets
#   Android-512x512.svg    — full Frak icon (kept for visual reference)
#   frak-white-512x512.svg — white F on transparent (adaptive foreground source)
#
# Pipeline:
#   1. `bun tauri icon` regenerates ALL platform assets:
#        apps/wallet/src-tauri/icons/{icon.icns,icon.ico,*.png,Square*Logo.png}
#        apps/wallet/src-tauri/gen/apple/.../AppIcon.appiconset/*
#        apps/wallet/src-tauri/gen/android/.../mipmap-*/ic_launcher{,_round,_foreground}.png
#   2. ImageMagick step OVERRIDES the 5 Android adaptive `ic_launcher_foreground.png`
#      with a safe-zone-padded white F (Tauri's default uses the full Frak icon, which
#      gets clipped under circular launcher masks).
#   3. ImageMagick renders the Google Play Console feature graphic (1024×500) to
#      apps/wallet/src-tauri/icons/store/feature-graphic-1024x500.png.
#
# Adaptive background stays as the @color/ic_launcher_background = #0043EF resource
# defined in res/values/ic_launcher_background.xml — no PNG needed.
#
# Foreground sizing rationale:
#   The adaptive icon canvas is 108dp × 108dp; the central 66dp safe zone is
#   guaranteed visible across all launcher mask shapes (circle, squircle, etc).
#   The F bbox in frak-white-512x512.svg occupies 58.6% of the viewBox. Rendering
#   the SVG at INNER_SCALE × canvas size and centering on a transparent canvas
#   places the F bbox at INNER_SCALE × 58.6% of the canvas width.
#
#   INNER_SCALE = 0.683 → F at ~40% of canvas → comfortably inside the safe zone
#   on every launcher mask shape (verified visually on Pixel Launcher 2024).
#
#   Smaller F → drop INNER_SCALE (e.g. 0.6 → 35%, 0.5 → 30%).
#   Bigger F → raise INNER_SCALE (max ~0.85 before circle masks start clipping).
#
# Usage:
#   bun run tauri:icons   # from apps/wallet/
#   ./regenerate.sh       # from this directory

set -euo pipefail

if ! command -v magick >/dev/null 2>&1; then
    echo "error: ImageMagick (magick) is required. Install with: brew install imagemagick" >&2
    exit 1
fi

SOURCES_DIR="$(cd "$(dirname "$0")" && pwd)"
WALLET_DIR="$(cd "$SOURCES_DIR/../../.." && pwd)"
ANDROID_RES="$(cd "$SOURCES_DIR/../../gen/android/app/src/main/res" && pwd)"
STORE_DIR="$SOURCES_DIR/../store"

MANIFEST="$SOURCES_DIR/manifest.json"
WHITE_SVG="$SOURCES_DIR/frak-white-512x512.svg"
BG_COLOR="#0043EF"
# Brand fonts bundled in this directory (OFL, https://github.com/rsms/inter).
# Inter is the typeface used by the wallet UI (packages/design-system tokens).
WORDMARK_FONT="$SOURCES_DIR/Inter-Bold.ttf"
TAGLINE_FONT="$SOURCES_DIR/Inter-Regular.ttf"

# ── Step 1: regenerate every platform asset via Tauri ─────────────────────────
echo "▶ Running 'bun tauri icon' for all platform assets…"
(cd "$WALLET_DIR" && bun tauri icon "$MANIFEST")

# ── Step 2: override Android adaptive foregrounds with safe-zone-padded F ─────

# F bbox = 58.6% of viewBox; 0.683 × 58.6% ≈ 40% of canvas (safe-zone friendly)
INNER_SCALE="0.683"

# Adaptive icon canvas size per density (108dp scaled). Legacy ic_launcher.png
# and ic_launcher_round.png are produced by `tauri icon` in step 1.
DENSITIES=(
    "mdpi:108"
    "hdpi:162"
    "xhdpi:216"
    "xxhdpi:324"
    "xxxhdpi:432"
)

for entry in "${DENSITIES[@]}"; do
    density="${entry%%:*}"
    canvas="${entry#*:}"
    inner=$(awk "BEGIN { printf \"%d\", ${canvas} * ${INNER_SCALE} + 0.5 }")
    target="$ANDROID_RES/mipmap-${density}/ic_launcher_foreground.png"
    echo "→ ${density}: foreground ${canvas}px (F at ${inner}px)"

    magick -background none -density 600 "$WHITE_SVG" \
        -resize "${inner}x${inner}" \
        -gravity center -background none -extent "${canvas}x${canvas}" \
        -strip PNG32:"$target"
done

# ── Step 3: Google Play Console feature graphic (1024×500) ───────────────────
#
# Composes: solid #0043EF background + white F mark (left) + "Frak Wallet"
# wordmark + tagline (right). Output is uploaded as the Play Console "Image
# de présentation".
#
# Two-stage pipeline: the SVG must be rasterized to PNG first because this
# ImageMagick build has no librsvg delegate, and combining SVG load + resize +
# text annotate in a single `magick` invocation produces broken output (the
# pre-resize SVG vector data leaks into the composite).
#
# Layout: F at +80px from left edge, optically centered (-12px from vertical
# center to compensate for the heavier bottom bar). Wordmark + tagline as a
# stacked block to the right of the F.

FEATURE_OUT="$STORE_DIR/feature-graphic-1024x500.png"
mkdir -p "$STORE_DIR"

for font in "$WORDMARK_FONT" "$TAGLINE_FONT"; do
    if [[ ! -f "$font" ]]; then
        echo "error: brand font not found at $font" >&2
        exit 1
    fi
done

TMP_DIR="$(mktemp -d -t frak-feature.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT
TMP_F="$TMP_DIR/f.png"

echo "→ feature graphic: rasterizing F mark…"
magick -background none -density 600 "$WHITE_SVG" \
    -resize 360x360 PNG32:"$TMP_F"

echo "→ feature graphic: composing 1024×500 PNG…"
magick -size 1024x500 "xc:$BG_COLOR" \
    "$TMP_F" -gravity West -geometry +80-12 -compose over -composite \
    -font "$WORDMARK_FONT" -fill white -pointsize 80 \
    -gravity NorthWest -annotate +470+178 "Frak Wallet" \
    -font "$TAGLINE_FONT" -fill 'rgba(255,255,255,0.85)' -pointsize 28 \
    -gravity NorthWest -annotate +472+275 "Earn rewards. Secured by passkeys." \
    -strip -define png:compression-level=9 "$FEATURE_OUT"

echo "✓ All platform icons regenerated"
echo "  feature graphic: $FEATURE_OUT"
