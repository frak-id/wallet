# Native harness app icon

One source, both harnesses: `frak-harness-icon.svg` — the Frak mark in `primary600`
(`#0043EF`) on white. That is the *inverse* of the wallet's own icon (white mark on blue),
which is the point: a tester with Frak Wallet, Frak Wallet Dev and this harness installed
can tell the three apart on the home screen.

The generated files are committed, so a normal build needs none of this. Regenerate only
when the SVG changes:

```bash
cd example
SVG=icons/frak-harness-icon.svg

# iOS — one 1024×1024, no alpha channel (App Store rejects an icon that has one).
rsvg-convert -w 1024 -h 1024 "$SVG" \
  -o native-ios/Sources/FrakExampleiOSApp/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png

# Android — legacy launcher raster for API 24–25. API 26+ uses the adaptive icon in
# res/mipmap-anydpi-v26/, whose foreground is a vector and needs no regeneration.
for pair in "mdpi 48" "hdpi 72" "xhdpi 96" "xxhdpi 144" "xxxhdpi 192"; do
  set -- $pair
  rsvg-convert -w "$2" -h "$2" "$SVG" -o "native-android/app/src/main/res/mipmap-$1/ic_launcher.png"
done
```

`rsvg-convert` comes from `brew install librsvg`. It emits an opaque PNG here only because
the SVG's background rect covers the whole canvas — check with `sips -g hasAlpha` after
changing the artwork.

The Android adaptive foreground (`res/drawable/ic_launcher_foreground.xml`) is a hand-kept
copy of the same path on a 1024 viewport. It stays inside the 174..850 safe zone, so no
launcher mask clips it.
