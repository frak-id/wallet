# Frak Native SDK — Android Merchant Example App

Minimal Android test harness and merchant example app for the Frak Native SDK. A
native SDK cannot be exercised without an app to host it — there is no equivalent
of opening a page against `sdk/core` — so this app is how the SDK gets run at all.

> ⚠️ **Scaffolding — the real Android SDK does not exist yet.**
> `app/src/main/kotlin/id/frak/example/android/sdk/FrakSDK.kt` is a type-only
> stand-in: every call logs and returns. Nothing is shared, tracked, or decoded.
> This app therefore **cannot yet answer any of the POC questions** the native SDK
> plan poses. Once `sdk/android/` ships, delete that file and depend on the real
> artifact — the screens should not need changes.
>
> The stub deliberately implements **nothing**. An earlier revision prototyped
> anonymous-id persistence, `fCtx` parsing and the self-referral guard here; that
> was removed because it is real SDK behaviour written twice in two languages with
> nothing asserting the two agreed, and none of it survives into the real SDK —
> which derives a keypair rather than persisting a UUID, and whose invariants are
> pinned by the shared golden-fixture corpus.

## Overview

What this app shows, using Jetpack Compose:

- **SDK Configuration**: Initializes `FrakClient` with `FrakConfig(merchantId = "...", deepLink = DeepLinkHandling.Automatic)`
- **Product Screen**: Renders product information and a "Share & Earn {REWARD}" button triggering `presentSharing(...)`
- **Order Confirmation**: Hands completed purchases to `trackPurchase(...)`
- **Deep Link Handling**: Android intent filters deliver inbound URLs to the activity on cold *and* warm start, then pass them to `handleReferralLink(url)`
- **Manifest Setup**: Includes scoped `<queries>` for both `id.frak.wallet` and `id.frak.wallet.dev` wallet app detection — never `QUERY_ALL_PACKAGES`
- **Design tokens**: `ui/FrakTokens.kt` mirrors `packages/design-system/src/tokens.css.ts`, so the harness renders in Frak brand colours

The intent filter and the cold/warm-start delivery are real and are what this app
usefully proves today. Everything behind `FrakClient` is not.

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

The URL is logged verbatim — parsing `fCtx` is the SDK's job, and there is no SDK
yet. What this confirms is that the intent filter fires and the URL reaches the
activity.

`example-merchant.com` carries no `autoVerify`: it is a placeholder domain we do
not control and it serves no `assetlinks.json`, so App Links verification could
only fail.
