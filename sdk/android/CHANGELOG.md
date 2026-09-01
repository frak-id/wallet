# Changelog

All notable changes to the Frak Android SDK (`id.frak.sdk:core` and `id.frak.sdk:ui`) are
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add entries under `[Unreleased]` as you work. The release commit promotes `[Unreleased]` to the
version it cuts, in the same commit that moves `frak.sdk.version`; `bun run check:native-versions`
fails when the version being released has no section here, and
`.github/workflows/release-android-sdk.yml` publishes that section as the GitHub release body.

Both artifacts ship in lockstep behind a `strictly` constraint and share this file. iOS versions
independently — see [`../ios/CHANGELOG.md`](../ios/CHANGELOG.md).

## [Unreleased]

### Fixed

- **The install code no longer lands on the clipboard unmarked.** The install page wrote it too,
  and that plain write landed after the SDK's `EXTRA_IS_SENSITIVE` one, so the code showed in the
  system paste preview. The install URL now carries `clip=host`, telling the page the SDK owns
  the clipboard. An older wallet page ignores it and behaves as before.

## [1.0.0-beta.2] - 2026-08-14

### Added

- **`FrakSharing.Builder.language(tag)`** forwards a BCP 47 language tag to the sharing page as
  `?lng=`, defaulting to the device locale. The sheet latches the tag it warmed on, so a tag that
  differs between warm-up and tap costs the warm view rather than the language.
- **`RewardTier.Unknown(minValue, maxValue)`.** A tier band whose payout shape the binary does not
  recognise now degrades to this arm instead of failing the entire `rewards.best` call. Absent or
  not-an-object degrades; a malformed object still throws.

### Changed

- **Breaking: `FrakError.BackingOff` carries `retryAfterSeconds: Double`** instead of
  `retryAfterMillis: Long`, matching `FrakError.Server` beside it and iOS's `TimeInterval`. `Double`
  because the minimum delay is 1s and jitter halves it, so sub-second values are real and integral
  seconds would publish them as `0`.
- **`FrakSharing.Builder.heightFraction` clamps and logs instead of throwing.** A layout number must
  not crash the merchant's app; both platforms already clamped at render.
- **The sharing sheet window uses `WindowCompat.enableEdgeToEdge`**, replacing three setters
  deprecated in API 35. This also sets `layoutInDisplayCutoutMode` and disables status/navigation bar
  contrast enforcement on API 29+, so layout changes on notched devices.
- **`:frak-sdk-ui` declares `androidx.core` 1.18.0 explicitly**, adding one runtime line to the `ui`
  POM. It was already in the resolved graph via `androidx.activity`, so no merchant's resolution
  changes. `:frak-sdk`'s POM is untouched and still declares only `kotlinx-coroutines-core` and
  `kotlin-stdlib`.
- androidx.webkit 1.16.0 → 1.17.0 and androidx.annotation 1.9.1 → 1.10.0. Both are `implementation`,
  so neither reaches a merchant's compile classpath.

## [1.0.0-beta.1] - 2026-08-13

First published release of `id.frak.sdk:core` and `id.frak.sdk:ui` on Maven Central. Nothing consumes
it yet, so the ABI is nominally frozen and practically still moving — see the breaking changes above.

### Added

- **`id.frak.sdk:core`** — UI-free and headlessly testable. `Frak.initialize`, anonymous identity and
  proof signing, the FrakContext v2 codec, inbound `fCtx` capture including warm starts, tracking over
  a durable queue, `config.resolve`, `tracking.purchase` and `rewards.best`.
- **`id.frak.sdk:ui`** — the sharing sheet behind `FrakSharing.Builder`, callable from XML, Java and
  Compose, hosted in a `ComponentDialog`, plus the wallet install handoff.
