# Frak Native SDK — Android Merchant Example App

Android test harness for the Frak Native SDK. Consumes the real `sdk/android` artifacts (`:frak-sdk`, `:frak-sdk-ui`) via a Gradle composite build (`includeBuild("../../sdk/android")` in `settings.gradle.kts`), through the SDK's public API only.

Configured with `env = FrakEnvironment.Development` and a real merchant id (`0a799880-ba54-4276-a734-db8721911bab`) against the Frak development backend (`backend.gcp-dev.frak.id`). That merchant must have this app's bundle id, `id.frak.example.android`, on its allow list, or calls fail with `MerchantResolutionFailed`.

## Overview

Jetpack Compose app that exercises:

- SDK init via `Frak.initialize(...)` with `deepLink = DeepLinkHandling.Automatic`
- `Frak.client.rewards.best(RewardRequest { targetInteraction = "purchase"; products = ... })` for a single catalog-wide reward, and `FrakSharing.Builder(::onResult).build(this)` — the plain-Activity build site, not the `@Composable` one — for the sharing sheet
- the three sharing scopes, one button each: **store** (no `products` and no `link`, so the link falls back to the merchant homepage), **product** (one `SharingProduct` with `imageUrl` and `ProductDetails`), **collection** (all three products, each illustrated, under an explicit collection `link`)
- `Frak.client.tracking.purchase(customerId, orderId, token)` on order confirmation
- inbound deep links via Android intent filters — **cold start is exercised; warm start (`onNewIntent`) has never been run on a device** — plus a manual `appLink.handleReferral(url)` trigger for testing
- an SDK debug panel in the *Checkout & Tools* tab, read back from the live client: SDK version, environment and its wallet/backend origins, configured vs. resolved merchant id, `anonymousId()`, `isTrackingEnabled()`, `isFrakAppInstalled()` and the resolved merchant's name, domain, currency, language and placements
- wallet-detection `<queries>` and the `INTERNET` permission come from `:frak-sdk`'s own manifest, folded in by the manifest merger

Product fixtures and order total match the iOS harness so the two stay comparable.

## Running

```bash
bun run --cwd example/native-android start   # boot/use an emulator, build, install, launch, stream logs
bun run --cwd example/native-android build   # assembleDebug only, no device required
bun run --cwd example/native-android logs    # tail the SDK log stream on a running device
bun run --cwd example/native-android lint    # ktlint check
bun run --cwd example/native-android format  # ktlint auto-format
```

Or `cd example/native-android` and drop the `--cwd` flag.

Pick a specific AVD with `ANDROID_AVD` (default: first from `emulator -list-avds`):

```bash
ANDROID_AVD=Pixel_9a bun run --cwd example/native-android start
```

Android Studio also works: open the `example/native-android` folder and hit Run.

## Formatting and linting

`biome` cannot parse Kotlin, so this folder is excluded from it in `biome.json`. ktlint, via the Gradle plugin, fills that gap. Rules live in `.editorconfig`, scoped to this folder. `@Composable` functions are exempted from ktlint's function-naming rule, since PascalCase is Compose convention.

There is no separate typecheck step — `assembleDebug` is it.

## Testing inbound deep link referral flow

```bash
adb shell am start -a android.intent.action.VIEW -d "https://example-merchant.com/product?fCtx=test_token_123" id.frak.example.android
```

With `DeepLinkHandling.Automatic` configured, the SDK's own `ActivityLifecycleCallbacks` picks up the
intent and calls `appLink.handleReferral` itself; the app only logs that the intent arrived, which is
all it can honestly observe. Open **Debug info** to confirm the SDK actually tracked it.

Run that command while the app is already running and you are testing the *warm* path, which is a
different code path (`OnNewIntentProvider`) and the one with no device evidence. The harness logs
`INFO` there rather than a green tick for exactly that reason.

`example-merchant.com` is a placeholder domain with no `assetlinks.json`, so App Links verification will not pass — that is expected here.
