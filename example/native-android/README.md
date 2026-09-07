# Frak Native SDK — Android Merchant Example App

Android test harness for the Frak Native SDK. Consumes the real `sdk/android` artifacts (`:frak-sdk`, `:frak-sdk-ui`) via a Gradle composite build (`includeBuild("../../sdk/android")` in `settings.gradle.kts`), through the SDK's public API only.

Runs against either Frak stage, picked in-app — see [Environment toggle](#environment-toggle) below. Each stage carries its own real merchant id, and that merchant must have this app's bundle id, `id.frak.example.android`, on its allow list, or calls fail with `MerchantResolutionFailed`.

## Overview

Jetpack Compose app that exercises:

- SDK init via `Frak.initialize(...)` with `deepLink = DeepLinkHandling.Automatic`, against the stage the *Frak Environment* card selected
- `Frak.client.rewards.best(RewardRequest { targetInteraction = "purchase"; products = ... })` for a single catalog-wide reward, and `FrakSharing.Builder(::onResult).build(this)` — the plain-Activity build site, not the `@Composable` one — for the sharing sheet
- the three sharing scopes, one button each: **store** (no `products` and no `link`, so the link falls back to the merchant homepage), **product** (one `SharingProduct` with `imageUrl` and `ProductDetails`), **collection** (all three products, each illustrated, under an explicit collection `link`)
- `Frak.client.tracking.purchase(customerId, orderId, token)` on order confirmation
- inbound deep links via Android intent filters — **cold start is exercised; warm start (`onNewIntent`) has never been run on a device** — plus a manual `appLink.handleReferral(url)` trigger for testing
- an SDK debug panel in the *Debug* tab, read back from the live client: app build, SDK version, environment and its wallet/backend origins, configured vs. resolved merchant id, `anonymousId()`, `isTrackingEnabled()`, `isFrakAppInstalled()` and the resolved merchant's name, domain, currency, language and placements
- wallet-detection `<queries>` and the `INTERNET` permission come from `:frak-sdk`'s own manifest, folded in by the manifest merger

Product fixtures and order total match the iOS harness so the two stay comparable.


## What's on screen

The app is laid out so a non-technical tester can drive it without being told what an `fCtx` is. Three tabs, a status strip above them and the event log below them, always visible.

**Status strip** — one line, four facts: the live stage (red pill on Production), whether the SDK reached its backend, whether the Frak wallet app is installed on this device, and the app build + SDK version. If anything is red, stop and report it before testing further.

| Tab | For | Contains |
|---|---|---|
| **Shop** | anyone | The catalog as a shopper sees it, images included (Coil), with the three share entry points: whole store, Best Sellers collection, single product. The reward figure at the top is one `rewards.best` call for the whole catalog. |
| **Checkout** | anyone | *Complete a test order* (fires `tracking.purchase`) and *Simulate a referral link* (fires `appLink.handleReferral`). |
| **Debug** | engineers, or a tester reading values out | Stage picker with a one-tap *Restart now*, and the SDK debug panel. |

**Reporting a bug**: the event log has *Copy*, *Share* and *Expand*. Share opens the Android chooser, so the whole log goes straight into Slack or a ticket. *Copy* on the SDK debug panel does the same for the wiring values. Every entry is still mirrored to `adb logcat -s FrakHarness`. Prices follow the merchant's resolved currency, and the log is capped at 300 entries.

## Environment toggle

The *Frak environment* card at the top of the **Debug** tab switches the stage the SDK runs against. `dev` and `prod` are separate backend deployments, so each has its own merchant record:

| Stage | Backend | Wallet | Merchant id |
|---|---|---|---|
| Development (default) | `backend.gcp-dev.frak.id` | `wallet-dev.frak.id`, `id.frak.wallet.dev` | `0a799880-ba54-4276-a734-db8721911bab` |
| Production | `backend.frak.id` | `wallet.frak.id`, `id.frak.wallet` | `dab86a41-f685-470d-91c8-e87af5834af9` |

**The choice applies on the next launch, not immediately.** Picking a stage writes it to the harness's own `frak-harness` prefs file and raises a red restart banner with a *Restart now* button; `MainActivity.onCreate` reads it back before `Frak.initialize`. Tapping it relaunches the task and ends the process, which is what makes the new stage take effect.

That is deliberate, not a shortcut. A live `Frak.shutdown()` + re-`initialize` would look like it worked and quietly test the wrong thing:

- **The sharing sheet would stay on the old wallet origin.** `SharingHost` builds `SharingWebViewPool(walletOrigin = Frak.client.environment.wallet)` once, memoised in an Activity-scoped `ViewModel` that survives even `recreate()`, with no public dispose. The client would talk to prod while the sheet loaded the dev wallet page — a false green on exactly the install and sharing handoff this toggle exists to check.
- **Inbound `fCtx` would double-track.** `DeepLinkObserver` only removes its `OnNewIntentListener` in `onActivityDestroyed`, which never fires for a live Activity, so re-initializing leaves a stale listener pointing at the new client. Known open defect: `docs/plans/native-sdk/open.md` §2.3.

Confirm which stage is live in the status strip, or in the **SDK debug info** card for the detail: *Harness environment*, *Configured merchant id*, and the *Wallet origin* / *Backend origin* rows are read back from the live client, not from the picker.

Wallet detection works on both stages without any harness change — `:frak-sdk`'s manifest already declares `id.frak.wallet` and `id.frak.wallet.dev` in `<queries>`.

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
all it can honestly observe. Open the **Debug** tab to confirm the SDK actually tracked it.

Run that command while the app is already running and you are testing the *warm* path, which is a
different code path (`OnNewIntentProvider`) and the one with no device evidence. The harness logs
`INFO` there rather than a green tick for exactly that reason.

`example-merchant.com` is a placeholder domain with no `assetlinks.json`, so App Links verification will not pass — that is expected here.
