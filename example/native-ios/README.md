# Frak Native SDK — iOS Merchant Example App

Minimal iOS test harness and merchant example app for the Frak Native SDK. A
native SDK cannot be exercised without an app to host it — there is no equivalent
of opening a page against `sdk/core` — so this app is how the SDK gets run at all.

> This app depends on the real SDK at `../../sdk/ios` (products `FrakSDK` and
> `FrakSDKUI`, wired as a local SwiftPM path dependency in `Package.swift` and as
> an XcodeGen `packages:` entry in `project.yml`). It exercises the real,
> asynchronous, throwing client against the Frak **development** backend
> (`env: .development`, i.e. `backend.gcp-dev.frak.id`), configured with a real
> merchant id (`0a799880-ba54-4276-a734-db8721911bab`) — every network call
> (`config.resolve()`, `rewards.best(...)`, `tracking.purchase(...)`, the sharing
> sheet) is expected to succeed. That merchant must have this app's bundle id,
> `id.frak.example.ios`, on its allow list — a `MerchantResolutionFailed` error
> or a validation error from the backend is the symptom when it does not. The
> app still logs any failure legibly rather than fabricating a success.

## Overview

What this app shows, using SwiftUI:

- **SDK Configuration**: `Frak.initialize(FrakConfig(merchantId: "...", metadata:, env: .development, deepLink: .manual, logLevel: .info))` in the `App`'s `init()` — synchronous, non-throwing. `.development` points at `wallet-dev.frak.id` / `backend.gcp-dev.frak.id` and expects the DEV wallet app (`id.frak.wallet.dev`, scheme `frakwallet-dev`) rather than the production one, so `appLink.isFrakAppInstalled()` reports false unless the dev wallet build is installed on the simulator or device
- **Product Catalog**: Renders a single headline reward for the whole visible catalog, looked up **once** via `client.rewards.best(targetInteraction:products:)` and rendered from `BestReward.formatted` (or a clearly-labelled fallback when the lookup fails); per the doc comment on `RewardsAPI.best`, this is one call for the whole listing, not one per row — each product row just has a plain "Share Product" button
- **Sharing**: The `.frakSharingSheet(isPresented:request:onResult:)` view modifier from `FrakSDKUI` — there is no `FrakShareButton`; every `SharingResult` case (`.shared`, `.copied`, `.installStarted`, `.dismissed`, `.failed`) is logged
- **Order Confirmation**: Hands completed purchases to `client.tracking.purchase(customerId:orderId:token:)`, logging the `Result`
- **Deep Link Handling**: `CFBundleURLTypes` registration delivers inbound URLs to `.onOpenURL`, which routes them to `client.appLink.handleReferral(_:)`. This is mandatory on iOS, not optional: `DeepLinkHandling` here has only `.manual` and `.disabled` — no `.automatic` the way Android has, because iOS has no app-wide interception hook equivalent to `ActivityLifecycleCallbacks`. The deep-link simulator button funnels through the same code path as a real inbound URL, matching Android's simulator (which dispatches a real Intent)
- **Startup diagnostics**: logs `appLink.isFrakAppInstalled()` and `config.resolve()` results on launch
- **Privacy Manifest**: Ships `PrivacyInfo.xcprivacy`; the real SDK ships its own manifests for `FrakSDK` and `FrakSDKUI`
- **Info.plist Setup**: Declares `LSApplicationQueriesSchemes` containing `frakwallet` and `frakwallet-dev` for app detection
- **Design tokens**: `UI/FrakTokens.swift` mirrors `packages/design-system/src/tokens.css.ts`, so the harness renders in Frak brand colours — this is the merchant's own styling, not SDK-provided

The app consumes the SDK through its **public API only**, exactly as a merchant
would — an example app reaching past the public surface stops being a test of the
thing being shipped. Product fixtures and the order total are identical to the
Android harness so a divergence between the two shows up in review (reward
amounts are no longer part of that fixture: they come from a live, catalog-wide
`rewards.best(...)` call instead of a hardcoded number).

## Running on a simulator

Requires [XcodeGen](https://github.com/yonaskolb/XcodeGen) once: `brew install xcodegen`.

From the repo root — boots a simulator if none is running, then generates the
project, builds, installs, launches, and streams the SDK log:

```bash
bun run --cwd example/native-ios start
```

Other commands:

```bash
bun run --cwd example/native-ios build    # compile-only typecheck (Swift 6 strict concurrency)
bun run --cwd example/native-ios xcode    # regenerate the project and open it in Xcode
bun run --cwd example/native-ios lint     # swift-format lint (strict), no simulator
bun run --cwd example/native-ios format   # swift-format rewrite in place
```

Or from inside this folder, where the scripts live — `cd example/native-ios`
then `bun run start`, `bun run lint`, and so on. The commands are owned by this
app's `package.json` rather than aliased at the repo root, matching how every
other app in the monorepo declares its own `build` / `lint` / `format`.

Pick a specific simulator with `IOS_SIMULATOR` (default: `iPhone 17`):

```bash
IOS_SIMULATOR="iPhone 17 Pro" bun run --cwd example/native-ios start
```

The app target is generated from `project.yml`; the `.xcodeproj` is **not
committed**, so regenerate it rather than editing it. The SDK's `print()` output
streams to the terminal (via `--console-pty`) and to the on-screen event log — it
does not reach the unified `log` system, so `log show` finds nothing.

### Testing the inbound deep link

```bash
xcrun simctl openurl booted "merchantapp://product?fCtx=test_referral_token_ios_123"
```

iOS shows an *"Open in …?"* confirmation the first time a scheme is opened from
outside the app — accept it, and the handler runs. The URL is passed to
`client.appLink.handleReferral(_:)`, which decodes `fCtx` and reports whether it
carried a Frak referral context; both the raw URL and that result are logged.

## Formatting and linting

`biome` cannot parse Swift, so `example/native-ios` is excluded from it in
`biome.json`. **swift-format** fills that gap and is the equivalent of
`bun run format` and `bun run lint` for this folder:

```bash
bun run --cwd example/native-ios lint     # fails on violations
bun run --cwd example/native-ios format   # rewrites in place
```

Nothing to install: `swift format` ships inside the Xcode toolchain, so the
version is pinned to whatever Xcode the machine already builds with. Rules live
in `.swift-format`, scoped to this folder so it can never collide with biome.

It is configured to 4-space indent to match the repo's biome settings rather than
swift-format's own 2-space default, and runs with `--strict` so style findings
fail rather than warn. `NeverForceUnwrap`, `NeverUseForceTry` and
`NeverUseImplicitlyUnwrappedOptionals` are enabled on top of the defaults — they
are the Swift analogue of the repo's ban on `as any` / `!` in TypeScript.

The typecheck is separate and already exists — see below.

## Compile-only checks

`Package.swift` builds the same sources as a **library**, for a fast typecheck without
Xcode. It cannot produce an app bundle — SwiftPM has no notion of one — so `Info.plist`
(URL schemes, `LSApplicationQueriesSchemes`) does not apply to anything built this way.
Use the Xcode path above to actually run the app.

```bash
swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator
```

A bare `swift build` targets the host and would compile this as macOS — passing
without ever exercising iOS.

Verify Swift 6 strict concurrency, which the real SDK must be clean under — hold
the example app to the same bar:

```bash
swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator \
  -Xswiftc -swift-version -Xswiftc 6
```
