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

MANIFEST="$SOURCES_DIR/manifest.json"
WHITE_SVG="$SOURCES_DIR/frak-white-512x512.svg"

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

echo "✓ All platform icons regenerated"
