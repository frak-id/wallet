# Frak Native SDK — Android Merchant Example App

Minimal Android test harness and merchant example app for the Frak Native SDK. A
native SDK cannot be exercised without an app to host it — there is no equivalent
of opening a page against `sdk/core` — so this app is how the SDK gets run at all.

This app depends on the real `sdk/android` artifacts (`:frak-sdk` and
`:frak-sdk-ui`), built from source via a Gradle composite build
(`includeBuild("../../sdk/android")` in `settings.gradle.kts`) rather than a
published Maven coordinate — see the comments there and in `app/build.gradle.kts`
for why automatic dependency substitution needed an explicit
`dependencySubstitution` block. `MainActivity` configures the SDK with `env =
FrakEnvironment.Development` and a real merchant id
(`0a799880-ba54-4276-a734-db8721911bab`), so every network call the SDK makes
(`config.resolve()`, `rewards.best()`, `tracking.purchase()`, the sharing sheet,
...) is expected to succeed against the Frak development backend
(`backend.gcp-dev.frak.id`). That merchant must have this app's bundle id,
`id.frak.example.android`, on its allow list — a `MerchantResolutionFailed` error
or a validation error from the backend is the symptom when it does not. The app
still degrades gracefully and logs the failure rather than fabricating a success
if any call does fail; that error path is as much a part of what this harness
proves as the happy path is.

## Overview

What this app shows, using Jetpack Compose:

- **SDK Configuration**: `Frak.initialize(applicationContext, FrakConfig(merchantId = "...", metadata = FrakMetadata(name = "..."), env = FrakEnvironment.Development, deepLink = DeepLinkHandling.Automatic, logLevel = FrakLogLevel.INFO))`. `FrakEnvironment.Development` points at `wallet-dev.frak.id` / `backend.gcp-dev.frak.id` and expects the DEV wallet app (`id.frak.wallet.dev`, scheme `frakwallet-dev`) rather than the production one, so `appLink.isFrakAppInstalled()` reports false unless the dev wallet build is installed on the device or emulator
- **Product Catalog**: Renders a single headline reward for the whole visible catalog, looked up **once** via `Frak.client.rewards.best(targetInteraction = "purchase", products = ...)` and rendered from `BestReward.formatted` (or a clearly-labelled placeholder when the lookup fails); per the KDoc on `RewardsApi.best`, this is one call for the whole listing, not one per row — each product row just has a plain "Share Product" button that opens the real sharing sheet via `rememberFrakSharingLauncher()`
- **Order Confirmation**: Hands completed purchases to `Frak.client.tracking.purchase(customerId, orderId, token)` and logs the resulting `FrakResult`
- **Deep Link Handling**: Android intent filters deliver inbound URLs to the activity on cold *and* warm start; with `DeepLinkHandling.Automatic` the SDK itself observes and handles them (see the comment on `MainActivity.logInboundIntent`), and a separate "Simulate Inbound fCtx Link" button calls `appLink.handleReferral(url)` directly to exercise and log its return value without double-handling a real intent
- **Manifest Setup**: Wallet-detection `<queries>` (`id.frak.wallet` / `id.frak.wallet.dev`) and the `INTERNET` permission are no longer declared here — `:frak-sdk`'s own manifest declares them and the manifest merger folds them in
- **Design tokens**: `ui/FrakTokens.kt` mirrors `packages/design-system/src/tokens.css.ts`, so the harness renders in Frak brand colours. This is the merchant's own styling, not part of the SDK.

The app consumes the SDK through its **public API only**, exactly as a merchant
would — an example app reaching past the public surface stops being a test of the
thing being shipped. Product fixtures and the order total are identical to the iOS
harness so a divergence between the two shows up in review.

## Running

From the repo root — boots an emulator if none is running, then builds,
installs, launches, and streams the SDK log:

```bash
bun run --cwd example/native-android start
```

Other commands:

```bash
bun run --cwd example/native-android build    # assembleDebug only, no device required
bun run --cwd example/native-android logs     # tail the SDK log stream on a running device
bun run --cwd example/native-android lint     # ktlint check, no device required
bun run --cwd example/native-android format   # ktlint auto-format in place
```

Or from inside this folder, where the scripts live — `cd example/native-android`
then `bun run start`, `bun run lint`, and so on. The commands are owned by this
app's `package.json` rather than aliased at the repo root, matching how every
other app in the monorepo declares its own `build` / `lint` / `format`.

Pick a specific AVD with `ANDROID_AVD` (default: the first from
`emulator -list-avds`):

```bash
ANDROID_AVD=Pixel_9a bun run --cwd example/native-android start
```

Android Studio works too: **Open** the `example/native-android` folder and hit
**Run ▶**.

## Formatting and linting

`biome` cannot parse Kotlin, so `example/native-android` is excluded from it in
`biome.json`. **ktlint** fills that gap and is the equivalent of `bun run format`
and `bun run lint` for this folder:

```bash
bun run --cwd example/native-android lint     # fails on violations
bun run --cwd example/native-android format   # rewrites in place
```

ktlint is applied through the Gradle plugin rather than a `brew install`, so it
resolves on a clean checkout like any other dependency. Rules live in
`.editorconfig`, scoped to this folder so it can never collide with biome.

Two settings are deliberate:

- `ktlint_function_naming_ignore_when_annotated_with = Composable` — `@Composable`
  functions are PascalCase by Compose convention. ktlint's function-naming rule
  does not know that, so annotated declarations are exempted rather than the rule
  being switched off for the whole source set.
- The default `ktlint_official` code style is kept. `intellij_idea` would match
  Android Studio's built-in formatter more closely, but switching would reformat
  every file; if that trade ever becomes worth it, do it in one isolated commit.

There is no typecheck step to add — `assembleDebug` **is** the typecheck, and
`bun run --cwd example/native-android build` runs it without needing a device.

### Testing Inbound Deep Link Referral Flow in Emulator

To simulate a user opening a referral link in the running emulator:

```bash
adb shell am start -a android.intent.action.VIEW -d "https://example-merchant.com/product?fCtx=test_token_123" id.frak.example.android
```

The intent filter fires and the URL reaches the activity on cold and warm start;
with `DeepLinkHandling.Automatic` configured, the SDK's own
`ActivityLifecycleCallbacks` picks the same intent up and calls
`appLink.handleReferral` itself, so the app only logs that the intent arrived
rather than handling it a second time.

`example-merchant.com` carries no `autoVerify`: it is a placeholder domain we do
not control and it serves no `assetlinks.json`, so App Links verification could
only fail.
