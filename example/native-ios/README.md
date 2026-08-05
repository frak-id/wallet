# Frak Native SDK — iOS Merchant Example App

iOS test harness for the Frak Native SDK. Consumes the real SDK at `../../sdk/ios` (products `FrakSDK`, `FrakSDKUI`) as a local SwiftPM path dependency, wired in `Package.swift` and as an XcodeGen `packages:` entry in `project.yml`, through the SDK's public API only.

Configured with `env: .development` and a real merchant id (`0a799880-ba54-4276-a734-db8721911bab`) against the Frak dev backend (`backend.gcp-dev.frak.id`). That merchant must have this app's bundle id, `id.frak.example.ios`, on its allow list, or calls fail with `MerchantResolutionFailed`.

## Overview

SwiftUI app that exercises:

- SDK init via `Frak.initialize(FrakConfig(...))` in the `App`'s `init()`
- `client.rewards.best(targetInteraction:products:)` for a single catalog-wide reward, and the `.frakSharingSheet(isPresented:request:onResult:)` view modifier from `FrakSDKUI` on each product row, logging every `SharingResult` case
- `client.tracking.purchase(customerId:orderId:token:)` on order confirmation
- inbound deep links via `CFBundleURLTypes` and `.onOpenURL`, routed to `client.appLink.handleReferral(_:)` — mandatory on iOS, since `DeepLinkHandling` here only has `.manual`/`.disabled`, with no `.automatic` counterpart to Android's `ActivityLifecycleCallbacks`
- startup diagnostics: `appLink.isFrakAppInstalled()` and `config.resolve()`
- ships its own `PrivacyInfo.xcprivacy`; `Info.plist` declares `LSApplicationQueriesSchemes` with `frakwallet` and `frakwallet-dev`

Product fixtures and order total match the Android harness so the two stay comparable.

## Running on a simulator

Requires [XcodeGen](https://github.com/yonaskolb/XcodeGen) once: `brew install xcodegen`.

```bash
bun run --cwd example/native-ios start    # generate project, boot/use a simulator, build, install, launch, stream logs
bun run --cwd example/native-ios build    # compile-only typecheck (Swift 6 strict concurrency), no simulator
bun run --cwd example/native-ios xcode    # regenerate the project and open it in Xcode
bun run --cwd example/native-ios lint     # swift-format lint (strict), no simulator
bun run --cwd example/native-ios format   # swift-format rewrite in place
```

Or `cd example/native-ios` and drop the `--cwd` flag.

Pick a specific simulator with `IOS_SIMULATOR` (default: `iPhone 17`):

```bash
IOS_SIMULATOR="iPhone 17 Pro" bun run --cwd example/native-ios start
```

The `.xcodeproj` is generated from `project.yml` and not committed — regenerate rather than edit it.

## Formatting and linting

`biome` cannot parse Swift, so this folder is excluded from it in `biome.json`. `swift format`, from the Xcode toolchain, fills that gap. Rules live in `.swift-format`, scoped to this folder: 4-space indent to match biome, and `--strict` so findings fail rather than warn.

## Compile-only checks

`Package.swift` builds the same sources as a library, for a fast typecheck without Xcode. It cannot produce an app bundle, so `Info.plist` settings (URL schemes, `LSApplicationQueriesSchemes`) do not apply to a build done this way.

```bash
swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator
```

Add `-Xswiftc -swift-version -Xswiftc 6` to also verify Swift 6 strict concurrency.

## Testing the inbound deep link

```bash
xcrun simctl openurl booted "merchantapp://product?fCtx=test_referral_token_ios_123"
```

Accept the "Open in …?" confirmation on first use; the URL routes to `client.appLink.handleReferral(_:)`, which decodes `fCtx` and reports whether it carried a Frak referral context.
