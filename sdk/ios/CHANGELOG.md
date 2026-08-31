# Changelog

All notable changes to the Frak iOS SDK (`FrakSDK` and `FrakSDKUI`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Add entries under `[Unreleased]` as you work. The release commit promotes `[Unreleased]` to the
version it cuts, in the same commit that moves `FrakSDKVersion.current`; `bun run
check:native-versions` fails when the version being released has no section here, and
`.github/workflows/release-ios-sdk.yml` publishes that section as the GitHub release body.

This file ships in the SwiftPM mirror payload, so it is merchant-facing. Android versions
independently — see [`../android/CHANGELOG.md`](../android/CHANGELOG.md).

## [Unreleased]

### Fixed

- **The install code no longer lands on the pasteboard unprotected.** The install page wrote it
  too, and that plain write landed after the SDK's `localOnly` + `expirationDate` one, replacing
  it. The install URL now carries `clip=host`, telling the page the SDK owns the pasteboard. An
  older wallet page ignores it and behaves as before.

## [1.0.0-beta.2] - 2026-08-14

### Added

- **`FrakSharingConfiguration.language`** forwards a BCP 47 language tag to the sharing page as
  `?lng=`, defaulting to the device locale. The sheet latches the tag it warmed on, so a tag that
  differs between warm-up and tap costs the warm view rather than the language.
- **`RewardRequest`**, so `rewards.best(_:forceRefresh:)` takes a request value rather than four
  defaulted parameters. `products` is a non-optional list sent as absent when empty.
- **`RewardTier.unknown(minValue:maxValue:)`.** A tier band whose payout shape the binary does not
  recognise now degrades to this case instead of failing the entire `rewards.best` call. Absent or
  not-an-object degrades; a malformed object still throws.

### Changed

- **Breaking: `RewardsAPI.best` takes a `RewardRequest`.** Call sites passing the four separate
  arguments must build a `RewardRequest` instead.
- **`FrakLogSink.log` is now `throws`.** A merchant sink that failed previously had no legal way out
  and took the host process down. Existing conformers pay nothing: Swift satisfies a throwing
  requirement with a non-throwing witness.

### Fixed

- **The UIKit sharing host reports a result when the merchant pops the screen.** It reported through
  `presentationControllerDidDismiss`, which fires only for the user's own swipe, so a screen
  dismissed under a live sheet produced no result at all. Now reported from `viewDidDisappear`,
  guarded so the share chooser and store sheet — which cover the sheet rather than dismiss it — do
  not report a session that is still running.
- **`Frak.resetAnonymousId` reports what actually happened.** The underlying delete was an unchecked
  write that returned `true` unconditionally; it now reads back and reports whether the key is gone.

## [1.0.0-beta.1] - 2026-08-13

First published release of `FrakSDK` and `FrakSDKUI` on the SwiftPM mirror
([`frak-id/frak-ios-sdk`](https://github.com/frak-id/frak-ios-sdk)). Nothing consumes it yet, so the
API is nominally frozen and practically still moving — see the breaking changes above.

This is a prerelease, so it has to be pinned with `exact:`. A `from:` bound rolls forward across
later betas, and `from: "1.0.0"` does not resolve a prerelease tag at all.

### Added

- **`FrakSDK`** — UI-free and headlessly testable. `Frak.initialize`, anonymous identity and proof
  signing, the FrakContext v2 codec, inbound `fCtx` capture including warm starts, tracking over a
  durable queue, `config.resolve`, `tracking.purchase` and `rewards.best`.
- **`FrakSDKUI`** — the sharing sheet, with SwiftUI and UIKit entry points, plus the wallet install
  handoff.

### Notes

- `Package.swift` is `swift-tools-version: 6.0` with `.swiftLanguageMode(.v6)` on every target, so a
  merchant's own build gets the same strict concurrency CI does. That puts a hard Xcode 16 floor on
  resolving this package.
