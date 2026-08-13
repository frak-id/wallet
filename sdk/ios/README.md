# Frak Native SDK — iOS

SwiftPM package for the Frak iOS SDK, targeting iOS 15+. Licensed Apache-2.0
(`sdk/ios/LICENSE`), not the monorepo's GPL-3.0, because merchants statically link this
into closed-source App Store binaries.

Two products: `FrakSDK` is UI-free and headlessly testable; `FrakSDKUI` adds the
sharing sheet (`WKWebView` in a SwiftUI sheet) and depends on `FrakSDK` — the
dependency never runs the other way, so a merchant taking only tracking never pulls in
a web view.

## Build, test, lint

```bash
bun run --cwd sdk/ios build    # compile against the iOS simulator SDK
bun run --cwd sdk/ios test     # compile for iOS, then run the suites
bun run --cwd sdk/ios lint     # swift-format lint (strict)
bun run --cwd sdk/ios format   # swift-format rewrite in place
```

These wrap `scripts/run.sh`, which owns the real invocations. `xcframework` is also
defined but not implemented — it exits 1 with the intended outline in the comments
above `do_xcframework()`.

`mirror-stage <dir>` lays out what the SwiftPM mirror publishes: `Sources/`,
`Package.swift`, `LICENSE`, and `README.mirror.md` as `README.md`. Merchants cannot
consume this package from the monorepo — SwiftPM reads `Package.swift` from a repo root
only — so releases go to [`frak-id/frak-ios-sdk`](https://github.com/frak-id/frak-ios-sdk)
via `.github/workflows/release-ios-sdk.yml`, triggered by an `ios-v*` tag. `Tests/` is
deliberately absent from the payload: `GoldenFixtures` reads the corpus out of
`sdk/core`, so a mirrored suite could never pass. `README.mirror.md` is the merchant-facing
README and this file is the contributor-facing one; they are meant to diverge.

`swift build` under Swift 6 strict concurrency is the typecheck: there is no separate
`tsc`-equivalent step. A bare `swift build` without the flags `run.sh` supplies targets
the host and compiles this as macOS, passing without ever exercising iOS.

`biome` cannot parse Swift, so `sdk/ios` is excluded from it in `biome.json`.
`swift format` (ships with Xcode, nothing to install) is the equivalent of `bun run
format`/`lint` here; rules live in `.swift-format`, copied from
`example/native-ios/.swift-format`.

`Package.swift` declares no `dependencies` — zero third-party packages.

## Public API surface

| Target | Folder | Public API |
| --- | --- | --- |
| `FrakSDK` | `Core` | `FrakConfig`, `FrakLogSink`, `FrakEnvironment`, `FrakMetadata`, `FrakError`, `FrakLogger`, `Base64URL`, `Hex` |
| `FrakSDK` | `Net` | `HTTPClient` over `URLSession` (GET + POST), `JSONDecoding`, `URLQuery`, `PercentEncoding` |
| `FrakSDK` | `Config` | `ConfigStore` (SWR, actor-isolated), `MerchantQuery`, `KeyValueStore`, `SingleFlight`, `Backoff` |
| `FrakSDK` | `Rewards` | reward models, decoder, `RewardRepository` |
| `FrakSDK` | `Identity` | `DeviceKey` (Secure Enclave P-256), `ProofCodec`, `AnonymousIdStore` |
| `FrakSDK` | `Sharing` | `FrakContext`, `FrakContextCodec` (v2 binary), attribution merge, `SharingLinkBuilder` |
| `FrakSDK` | `Tracking` | `Interaction`, `EventQueue` (durable JSONL), `InteractionTracker` |
| `FrakSDK` | `AppLink` | `AppLauncher`, `InstallLinks`, `ReferralArrival` |
| `FrakSDK` | (root) | `Frak`, `FrakClient`, `DefaultFrakClient` |
| `FrakSDKUI` | — | `.frakSharingSheet` modifier: native share/copy with a three-tier fallback, and `FrakSharingConfiguration` for its height and install surface |

`Core/`, `Net/`, `Identity/`, etc. are folders inside the single `FrakSDK` target, not
separate Swift modules — SwiftPM has no submodule concept, so they carry no
access-control boundary of their own. `internal` is per-target, not per folder.

`Frak.client` is throwing-synchronous (`get throws`, not `async`); every namespace
member on `FrakClient` (`rewards.best`, `config.resolve`, `sharing.buildLink`, …) is
`async`. The idiom is `private func client() -> FrakClient? { try? Frak.client }`, then
`await client()?.rewards.best(...)`.

Inbound deep links have no automatic handling — wire `appLink.handleReferral(_:)` into
`onOpenURL` or your router:

```swift
.onOpenURL { url in
    Task { await (try? Frak.client)?.appLink.handleReferral(url) }
}
```

## Status

The table above is implemented and covered by 490 Swift Testing tests under
`sdk/ios/Tests`. The FrakContext v2 codec and the signed proof byte layout are
asserted against the golden fixtures in `sdk/core/src/{identity,context}/fixtures/`,
shared with the Kotlin and TypeScript suites.

Not implemented: the 4-tier copy precedence (`copy(placement:component:)`) and the
XCFramework distribution path.

`.github/workflows/apps.yaml`'s `ios-sdk` job runs `lint`, `build` and `test` on every
`dev`/`main` push and PR touching `sdk/ios/**`. Nothing in it has run on a device or a
simulator — every claim above rests on suites executed on the host toolchain
(`swift test`), not on `xcodebuild test` against a simulator destination.

## Toolchain notes

- Swift 6 language mode is declared in `Package.swift` (tools-version 6.0,
  `.swiftLanguageMode(.v6)` on all four targets), so a consumer's own `swift build` or
  Xcode SwiftPM resolve compiles this package the same way CI does. It used to come from
  `scripts/run.sh` alone, which CI called and a merchant never did — a consumer silently
  got Swift 5 mode and its hidden concurrency errors. Cost: resolving this package now
  needs Xcode 16 at minimum. `.unsafeFlags` is not an alternative; SwiftPM refuses it on
  any package resolved as someone else's dependency, which this always is.
- Tests use **Swift Testing, not XCTest**. XCTest's Swift overlay is a zippered
  macOS/Catalyst dylib and cannot be linked for `arm64-apple-ios15.0-simulator` from
  SwiftPM.
- `test` runs in two stages: stage 1 builds the test targets against the iOS simulator
  SDK (proves the suites compile under Swift 6 strict concurrency); stage 2 runs
  `swift test` on the host toolchain, which is what actually executes the suites.
  Everything in `FrakSDKUI` that touches UIKit sits behind `#if canImport(UIKit)`, so
  on the macOS host that target reduces to `SharingPageURL`, `SharingSheetLogic`
  (`SharingSession.navigation`, `sharingDecision`, the products JSON) and `SharingResult`
  — the sheet, the web view pool, the model and native share are type-checked by stage 1
  and executed by neither stage. Logic worth asserting is deliberately kept out from
  under that wall; anything left inside it has no executed coverage on any platform.
- `Package.swift` also declares `platforms: [.iOS(.v15), .macOS(.v12)]`. The macOS
  entry exists only so stage 2 has a deployment target new enough for the APIs the SDK
  uses (`Logger`, `URLSession.data(for:delegate:)`) — it is not a second supported
  platform to ship.
- Versioning sits outside the Changesets linked group. `sdk/ios/package.json` is
  `private` and listed in `.changeset/config.json` `ignore`; it exists only to make
  this folder a workspace member and dispatch `build`/`test`/`lint`/`format` to
  `scripts/run.sh`. The real version is `Sources/FrakSDK/FrakSDKVersion.swift`, which
  feeds the `x-frak-sdk-version` header and the `?sdkVersion=` query parameter, and must not
  move because a web package bumped.
- `Sources/FrakSDK/PrivacyInfo.xcprivacy` (and `FrakSDKUI`'s own copy) must stay
  current with what the code does. Two independent mechanisms live in that one file and
  it is worth not confusing them: `NSPrivacyAccessedAPITypes` is scanned at upload and an
  undeclared required-reason API rejects the merchant's build with ITMS-91053, while
  `NSPrivacyCollectedDataTypes` feeds the privacy report behind the merchant's App Store
  nutrition label and is not an upload gate. Getting the first wrong breaks releases;
  getting the second wrong misdescribes the merchant's app.
  `Interaction.custom(_:data:)` carries an arbitrary `[String: String]` the SDK
  persists and transmits; a merchant who puts an email or user id in there makes the
  manifest incomplete for their own binary.
- The anonymous id is declared as **User ID, not Device ID**. Apple's Device ID means the
  advertising identifier or another device-level id; this one is installation-scoped,
  unreadable by other apps and gone on uninstall, which puts it under "assigned user ID".
  `NSPrivacyTracking` stays `false`: no ad network is in the SDK path (the affiliate
  integration lives in the wallet app), and the cross-merchant linkage is user-initiated
  and serves reward distribution rather than advertising measurement. Both calls are
  argued in full in the manifest comments — revisit if an ad network ever enters the SDK
  path.
- **`track(_:)` and `trackPurchase(...)` no longer fail with `merchantResolutionFailed`.**
  They enqueue durably first and resolve the merchant from cache only (`.cachedOnly`),
  never over the network; an unresolved merchant lands on disk as a `nil` `merchantId` and
  is filled in by the drain once one is available (from config, cache, or a later launch).
  This is a public behaviour change from the old `.required` resolve, even though the
  signature is unchanged: a caller checking for `.merchantResolutionFailed` from `track`
  itself will no longer see it there.

## Open decisions before first publish

- XCFramework build and signing are unbuilt. `bun run --cwd sdk/ios xcframework`
  exits 1; only source distribution via a SwiftPM path/git dependency works today.
- No CI builds either native SDK.
- `golden-rewards.json`'s `format-amount` vectors are hand-copied as literals in
  `RewardsDecoderTests.swift` instead of loaded from the shared fixture corpus.
- `PrivacyInfo.xcprivacy` propagation has not been validated against a real consumer
  app (AppsFlyer's issue #281 shows a comparable manifest failing to bundle in the
  static SPM variant).

Design docs: [`docs/plans/native-sdk/`](../../docs/plans/native-sdk/).
