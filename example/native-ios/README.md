# Frak Native SDK — iOS Merchant Example App

Minimal iOS test harness and merchant example app for the Frak Native SDK. A
native SDK cannot be exercised without an app to host it — there is no equivalent
of opening a page against `sdk/core` — so this app is how the SDK gets run at all.

> ⚠️ **Scaffolding — the real iOS SDK does not exist yet.**
> `Sources/FrakExampleiOSApp/SDK/FrakSDK.swift` is a type-only stand-in: every call
> logs and returns. Nothing is shared, tracked, or decoded. This app therefore
> **cannot yet answer any of the POC questions** the native SDK plan poses. Once
> `sdk/ios/` ships, delete that file and depend on the real artifact — the views
> should not need changes.
>
> The stub deliberately implements **nothing**. An earlier revision prototyped
> anonymous-id persistence, `fCtx` parsing and the self-referral guard here; that
> was removed because it is real SDK behaviour written twice in two languages with
> nothing asserting the two agreed, and none of it survives into the real SDK —
> which derives a keypair rather than persisting a UUID, and whose invariants are
> pinned by the shared golden-fixture corpus.

## Overview

What this app shows, using SwiftUI:

- **SDK Configuration**: Initializes `FrakClient` with `FrakConfig(merchantId: "...", deepLink: .automatic)`
- **Product Screen**: Renders product information and a "Share & Earn {REWARD}" button triggering `presentSharing(...)`
- **Order Confirmation**: Hands completed purchases to `trackPurchase(...)`
- **Deep Link Handling**: `CFBundleURLTypes` registration delivers inbound URLs to `.onOpenURL`, which passes them to `handleReferralLink(_:)`
- **Privacy Manifest**: Ships an empty `PrivacyInfo.xcprivacy` — the harness accesses no required-reason API and collects nothing, because there is no SDK behind it. Declared empty rather than omitted so the file is correct on the day the real SDK lands
- **Info.plist Setup**: Declares `LSApplicationQueriesSchemes` containing `frakwallet` and `frakwallet-dev` for app detection
- **Design tokens**: `UI/FrakTokens.swift` mirrors `packages/design-system/src/tokens.css.ts`, so the harness renders in Frak brand colours

The URL scheme registration and the `.onOpenURL` delivery path are real and are
what this app usefully proves today. Everything behind `FrakClient` is not.

The app consumes the SDK through its **public API only**, exactly as a merchant
would — an example app reaching past the public surface stops being a test of the
thing being shipped. Product fixtures and the order total are identical to the
Android harness so a divergence between the two shows up in review.

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
outside the app — accept it, and the handler runs. The URL is logged verbatim —
parsing `fCtx` is the SDK's job, and there is no SDK yet. What this confirms is
that the scheme is registered and the URL reaches `.onOpenURL`.

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
