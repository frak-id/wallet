# Regression sweep — prior P0/P1/ABI list re-verified against `origin/dev` (f1dc693)

**Scope:** every item in `docs/plans/native-sdk/11-alpha-audit.md` §2 (P0 ×6), §3 (P1 ×10) and §4 (ABI ×10), re-anchored against the tree at `origin/dev`, plus `ios-core.md` F2 and `tests-and-coverage.md` F4.
**Method:** source read only. No JDK / Android SDK / Swift toolchain. All anchors re-derived at `origin/dev`, not copied from the prior audit.

---

## Verdict on the delta

For the regression list specifically, the tree is **marginally better and materially unchanged**. Of 16 P0+P1 items, **one is half-fixed** (§3.9's `teardown` leak, `48d7e2c`), **one is partly mitigated** (§2.1's iOS half — `0e74a65`…`48d7e2c` put a universal-link rung *ahead* of the leaky custom-scheme handoff, `DefaultFrakClient.swift:378-387`), and **one merchant-setup gap is partly narrowed** (§2.6 — `LSApplicationQueriesSchemes` finally appears in the merchant README, once, in a sub-clause, with no value and no Associated Domains). **Fourteen of sixteen are untouched**, including every one of the Android P0s. All ten §4 ABI rows are open; the delta *added* to two of them (a new `SharingResult` case on both platforms, and an iOS-only `FrakSharingConfiguration` with no Android twin).

The delta is 2 000 lines of new iOS install-detection surface landing on top of an audit whose week-1 list ("`setPackage()`, `.rejected → continue`, `OnNewIntentProvider`, loopback the test, run ktlint") is a day of work and was not started. Net: **no worse, not meaningfully closer to alpha**, and the new surface (`InstallProbe`, `StoreInvite`, `FrakSharingConfiguration`, 6 new wire params on `/install`) enlarges the ungated native↔web contract that §2.4 named as the frozen-binary risk.

---

## Prior findings CLOSED by these commits

Only one, and it is a half.

| Prior id | What closed | Proof |
|---|---|---|
| **§3.9 / `ios-sharing-sheet` F3 — "WKWebView leaked"** (the leak half only) | `48d7e2c` | `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:269` now calls `presentation?.dispose()` **before** `reclaimWebView()`. F3's mechanism was that `reclaimWebView`'s `guard disposed, !reclaimed` (`SharingPresentation.swift:49`) short-circuited because `disposed` was still false; `dispose()` sets `disposed = true` at `:62`, so `pool.release(webView)` at `:51` and `pool?.destroy()` at `:272` now actually run. The probe-stop half is also real: `dispose()` → `model.release()` → `installProbe?.stop()` (`SharingSheetModel.swift:182`). |

Nothing else on the P0/P1/ABI list is closed. Two doc-accuracy sub-claims improved (see below) but neither was a listed finding.

---

## Prior findings NOT closed, or made worse

### P0

**§2.1 Android implicit-intent install-proof leak — STILL OPEN, untouched.**
`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/AppLauncher.kt:24-30`:
```kotlin
override fun open(url: String): Boolean {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return runCatching { appContext.startActivity(intent) }.isSuccess
}
```
No `setPackage`. `git diff c0a0cec origin/dev -- sdk/android/` touches exactly five files, none of them `applink/`. The URL still carries the 30-day bearer proof (`DefaultFrakClient.kt` install path → `InstallLinks.kt`).

**And `eccb8c2` made its symptom worse.** `SharingSheetState.kt:438-443` now reads:
```kotlin
outcome.launch {
    if (guarded { dependencies.openFrakApp() } == OpenAppResult.OpenedApp) {
        outcome.record(SharingResult.WalletOpened)
    }
}
```
A hijacking app that claims `frakwallet://` makes `startActivity` succeed → `OpenedApp` → the merchant now receives an affirmative **`SharingResult.WalletOpened`** for a handoff that went to the attacker. Previously the hijack was merely invisible; it is now positively confirmed to the merchant.

**§2.1 iOS half — CHANGED (partly mitigated, not closed).**
`sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:378-387` now tries a universal link first:
```swift
let universalLink = InstallLinks.universalLink(walletOrigin: settings.env.wallet, ...)
if await launcher.openUniversalLink(universalLink) { return .openedApp }
```
`openUniversalLink` uses `.universalLinksOnly: true` (`AppLink/AppLauncher.swift:35`), which cannot fall through to Safari — this is exactly the fix §2.1 prescribed ("move the iOS handoff to a Universal Link on `wallet.frak.id`"). The AASA that makes it work is real and served on the wallet origin (`services/backend/src/api/common/wellKnown.ts:25-33`, routed by `infra/gcp/wallet.ts:294-297`), and the wallet parses `#p=` (`apps/wallet/app/utils/deepLink.ts:122-127`).
**But the leaky rung was kept as the fallback**, `DefaultFrakClient.swift:389-395` → `launcher.open(deepLink)` with `installProof` in `?p=`. Universal links fail whenever the user has toggled "Open in App" off for `wallet.frak.id`, or the AASA has not been fetched yet on a fresh install — in which case the proof goes out on `frakwallet://` to whichever app iOS resolved that scheme to. **The window is narrowed, the hole is not plugged.** No commit message claims it is closed.

**§2.2 `?fmt=` auto-merge with no origin check — STILL OPEN, untouched.**
`sdk/ios/Sources/FrakSDK/Identity/IdentityMerge.swift:8` / `sdk/android/.../identity/IdentityMerge.kt:26` still `tokenKey = "fmt"`, still consumed unconditionally by `handleReferral` (`DefaultFrakClient.swift:311`, `DefaultFrakClient.kt:258`). No origin check, no confirmation, no feature flag. Nothing in the delta touches `Identity/`.

**§2.3 `DeepLinkHandling.Automatic` misses warm starts — STILL OPEN, untouched.**
`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/DeepLinkObserver.kt:23-29` still `activity.intent`. `grep -rn "setIntent\|OnNewIntent" sdk/android/ example/native-android/` returns **zero matches** — the harness still does not call `setIntent(intent)` and the SDK still does not register `OnNewIntentProvider`. `FrakConfig.kt:135` still defaults `deepLink = DeepLinkHandling.Automatic`. The misleading KDoc is verbatim at `DeepLinkObserver.kt:7-12` ("a `singleTask` activity delivers a warm-start intent via `onNewIntent`/`onResume`" — it delivers it to `onNewIntent`, and `getIntent()` does not follow).

**§2.4 loaded-but-blank + ungated native↔web contract — STILL OPEN; the second half is WORSE.**
The decision function is unchanged: `sdk/ios/Sources/FrakSDKUI/SharingSheetLogic.swift:93` — `if fellBack || closed || pageLoaded { return .doNothing }`. `pageLoaded` is still `page != .loading` (`SharingSheetModel.swift:46`) and `onPageReady()` still promotes on document-finish alone (`SharingSheetModel.swift:227-231`). A 200-OK page whose JS never boots still cancels the deadline and shows nothing forever. Android is the same shape (`SharingSheetState.kt:242` `pageLoaded = true`, `:265` `if (pageLoaded) return`).
*Worse:* the delta adds **six new fragment keys** to the frozen contract — `p`, `sid`, `probe`, `installed`, `dt`, `via` (`sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift:119-142` ↔ `apps/wallet/app/module/install/params/table.ts:37-44`) — plus `SharingPageURL.installPageProbed`/`installDetectedFragment`. The two tables are hand-mirrored in Swift and TypeScript with no shared source and no contract test that a shipped SDK version's params stay read. The delta did add a wallet-side table (`table.ts`), which is a genuine improvement in *shape*, but it is still a second hand-maintained copy, not a gate.

**§2.5 merchant cannot integrate — STILL OPEN on all three legs.**
1. *No artifact.* `sdk/android/README.md` still has no `implementation "id.frak.sdk:core:…"` snippet (only the artifact-name table at `:36` and the composite-build note at `:170`). `sdk/ios/README.mirror.md:17` still pins `exact: "0.1.0-alpha.1"` while `sdk/ios/package.json:3` and `sdk/android/package.json:3` say `"0.0.1"`, and `git tag` is still empty.
2. *Silence by default.* `sdk/android/.../core/FrakConfig.kt:139` `logLevel: FrakLogLevel = FrakLogLevel.NONE`; `sdk/ios/Sources/FrakSDK/Core/FrakConfig.swift:92` `logLevel: FrakLogLevel = .none`. The mirror README quickstart (`README.mirror.md:43-49`) still does not set it. **This is now actively load-bearing**: `48d7e2c`/`b68f989` added a careful one-time diagnostic explaining the missing plist entry (`DefaultFrakClient.swift:378-386`, gated at `FrakLogger.swift:47` `guard level >= messageLevel`) and it is dropped on the floor for every merchant who follows the quickstart.
3. *Allow-listing.* Still only in `example/native-android/README.md:5` and `example/native-ios/README.md:5,57`. Zero occurrences in either SDK README.
Add-ons: the non-compiling snippet is still there — `README.mirror.md:54` `let reward = await Frak.clientOrNull?.rewards.best(...)` with no `try`, against `RewardsAPI.swift:26` `public func best(...) async throws`. `sdk/ios/README.md:37` still lists `InteractionTracker` under `FrakSDK | Tracking | Public API` when the only occurrence left in `Sources/` is a comment (`DefaultFrakClient.swift:214`), and `:31-39` still lists ~20 `internal` types (`HTTPClient`, `ConfigStore`, `SingleFlight`, `AppLauncher`, `InstallLinks`, `DefaultFrakClient`, …) as the public surface.

**§2.6 / `ios-core` F2 Info.plist + Associated Domains — CHANGED (≈30 % closed).**
`README.mirror.md` gained 23 lines. The entire merchant-setup content of them is one sub-clause, `README.mirror.md:93-96`:
> "Set `detectInstall: false` to keep the store surface without the polling; the same `LSApplicationQueriesSchemes` entry `isFrakAppInstalled()` already needs is what makes either one work at all."

What that still does not give a merchant:
- **the value.** It never says the entry is `frakwallet` (prod) / `frakwallet-dev` (dev). Those strings exist only in `example/native-ios/README.md:18` and `FrakEnvironment.swift:46-50`.
- **an Info.plist snippet.** None anywhere in either SDK README.
- **Associated Domains / AASA at all.** `grep -n "Associated Domain\|applinks\|aasa\|AASA" sdk/ios/README*.md` → zero matches. F2's second half — share links are ordinary merchant https URLs (`SharingLinkBuilder`), so reaching `.onOpenURL` needs Universal Links on the *merchant's* domain — is completely undocumented.
- **the `.onOpenURL` caveat.** `README.mirror.md:98-107` is still "wire `.onOpenURL`", and still does not say `.onOpenURL` never receives universal links.

So: a merchant who reads the new paragraph learns that *some* plist entry is needed, cannot learn which, and learns nothing about the entitlement that makes the referral loop close. The SDK-side improvement is better than the doc: `DefaultFrakClient.walletSchemeStatus()` (`:369-388`) now reports `.undeclared` distinctly and logs it once — but only above `logLevel` `.none` (see §2.5 leg 2). **Partly closed.**

### P1

**§3.1 R8 never run — STILL OPEN.** `example/native-android/app/build.gradle.kts:29` `isMinifyEnabled = false`. Both consumer rule files still prose-only (`frak-sdk/consumer-rules.pro`, 23 lines; `frak-sdk-ui/consumer-rules.pro`, 10 lines).

**§3.2a null-`clientId` rows 401 — STILL OPEN.** `sdk/ios/Sources/FrakSDK/Tracking/RowSender.swift:17-18` `row.clientId.map { ["x-frak-client-id": $0] } ?? [:]`; Kotlin twin `RowSender.kt:20-21`. Capture still ungated (`EventOutbox.swift:85-91`, `EventOutbox.kt:64-68`).

**§3.2b `.rejected` should `continue`, not `break` — STILL OPEN, both platforms.**
`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/tracking/EventOutbox.kt:201-204`:
```kotlin
is DeliveryOutcome.Rejected -> {
    recordRetry(event, delivered, retried, "the backend rejected it")
    break
}
```
`sdk/ios/Sources/FrakSDK/Tracking/EventOutbox.swift:299-307`, ending `break eventLoop`. Head-of-line blocking on the purchase queue intact.

**§3.2c Android never re-drives the outbox — STILL OPEN.** `grep -n "ProcessLifecycleOwner\|foreground" sdk/android/.../tracking/EventOutbox.kt .../core/DefaultFrakClient.kt` → zero. iOS's counterpart is still the only one (`DefaultFrakClient.swift:129`).

**§3.4 French default locale — STILL OPEN.** `grep -in "locale\|lang" sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift sdk/android/.../ui/SharingPageUrl.kt` → **zero matches**; neither URL builder forwards a locale. `packages/wallet-shared/src/i18n/config.ts:7` `export const fallbackLng = "fr";`. (Note for the record: `FrakLanguage` exists at `FrakConfig.kt:13-18` / `FrakConfig.swift`, but it only reaches `MerchantQuery` (`MerchantQuery.kt:46`, `MerchantQuery.swift:38`), never the sheet URL — so the finding's "the merchant cannot override it" is precisely right.)

**§3.5 `SharingWebViewPool.warm` has no `lent` guard — STILL OPEN.**
`sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift:44-45`:
```swift
func warm(_ url: String) {
    guard !destroyed else { return }
```
Compare `prepare()` at `:34` (`guard !destroyed, pooled == nil`) and `acquire` at `:64` (`guard let reused = pooled, !lent`). Unchanged.

**§3.6 Compose site orphans a live sheet — STILL OPEN.** `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharing.kt:95` — `onDispose { }`, empty.

**§3.7 clock skew — STILL OPEN.** `sdk/android/.../identity/AnonymousIdStore.kt:82` `ts: Long = System.currentTimeMillis() / 1000`; `sdk/ios/Sources/FrakSDK/Identity/AnonymousIdStore.swift:71` `ts: Int64 = Int64(Date().timeIntervalSince1970)`. Raw wall clock, no skew correction.

**§3.8 first half — unused `StateFlow` import — STILL OPEN, and this matters.**
`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:39` `import kotlinx.coroutines.flow.StateFlow`. `grep -c StateFlow` on that file returns **1** — the import is still the only occurrence. Twelve commits and a merge later, on a branch that ran CI, this is still there. Either ktlint's `no-unused-imports` is not running in the `android-sdk` job or the job is not failing the build. **The audit's five-minute check is still unperformed and the "suite is green" claim is still unvalidated.**

**§3.8 second half / `tests-and-coverage` F4 — unit test calls production — STILL OPEN.** `SharingSheetStateTest.kt` changed by 27 lines in `eccb8c2`, and **the `@Before` was not one of them**:
```kotlin
// SharingSheetStateTest.kt:42-46
@Before
fun initializeFrak() {
    // `prepare` only checks Frak.isInitialized; the real client is never used.
    Frak.initialize(context, frakConfig(merchantId = "b7c2e1a4-…"))
}
```
`frakConfig` is `SharingInputFixtures.kt:58` — `FrakConfig.Builder(merchantId).build()` — and `FrakConfig.kt:133` defaults `env = FrakEnvironment.Production`. Still a live HTTPS resolve to `https://backend.frak.id` from a JVM unit test, still no `shutdown()` in `@After`, still no `resetForTesting()` seam. **Someone edited this exact file in this delta and did not fix it** — that is the loudest possible signal that the finding was not read.

**§3.9 first half — `NativeShare.share` can suspend forever — STILL OPEN.** `NativeShare.swift` changed by 6 lines and all of them are the comment above the guard. The guard is byte-identical (`NativeShare.swift:31-32`), there is no watchdog, and the continuation at `:35-47` still has exactly one exit (`completionWithItemsHandler`). The tier-3 path that calls it mid-presentation is unchanged (`SharingSheetModel.swift:633-639` `fallBack` → `settleContent()` → `await NativeShare.share(...)`).

**§3.9 second half — `teardown()` abandons a live session — HALF FIXED.** Leak closed (see CLOSED table). **The merchant report is still never delivered:** `SharingPresentation.swift:266-272` sets `phase = .idle` *before* touching the presentation, never inspects `case .live`, and `dispose()` at `:75-76` sets `model.onOutcome = nil` rather than calling it. F3's own fix sketch asked for "call `current.dispose()` **and report `.dismissed`**"; half of that shipped. A `TabView` switch over a live sheet still silently never calls the merchant's `onResult`.

**§3.10 no ObjC/UIKit surface — STILL OPEN.** `grep -rn "@objc" sdk/ios/Sources/` → zero. The README still does not state the scoping decision; `sdk/ios/README.md:39` describes `FrakSDKUI` as "`.frakSharingSheet` modifier" with no UIKit note, and `README.mirror.md` says nothing.

### §4 — ABI / irreversibility (all ten open)

`frak-sdk/api/frak-sdk.api` is **byte-unchanged** in this delta (`git diff --stat c0a0cec origin/dev -- sdk/android/frak-sdk/api/frak-sdk.api` → empty). Only `frak-sdk-ui.api` moved, and it moved by *adding* public surface.

- **Row 1 (rewards read models publish constructors) — STILL OPEN; the prior citation `:298,313,345,414,435` WAS ALREADY WRONG.** Those lines are `FrakEnvironment.toString`, `FrakError$BackingOff`, `FrakError$Network`, `FrakMetadata.setLang` and `ProductDetails.getSku` respectively — nothing to do with `rewards/`. The *claim* is nonetheless correct; the real anchors are `frak-sdk.api:471` (`BestReward.<init>`), `:485` (`Campaign`), `:503`/`:511`/`:522`/`:531` (`EstimatedReward$Fixed/Percentage/Tiered/Unknown`), `:581`/`:591` (`RewardTier$Amount/Percentage`), `:601` (`TokenAmount`) — **nine public constructors**, one more than `public-api-ergonomics.md`'s own list names. Nothing in `config/`-style `internal constructor` treatment reached them.
- **Row 2 (`rewards.best` shape divergence) — STILL OPEN.** `RewardsApi.kt:36,40` take `RewardRequest`; `RewardsAPI.swift:26-31` take four defaulted params.
- **Row 3 (retry hint ms vs s) — STILL OPEN.** `FrakError.kt:52` `retryAfterMillis: Long` vs `FrakError.swift:11` `case backingOff(retryAfter: TimeInterval)` (seconds).
- **Row 4 (no retryable/fatal axis; `LocalizedError` advertises diagnostics) — STILL OPEN.** `FrakError.swift:58-59` `extension FrakError: LocalizedError { public var errorDescription: String? {`, still emitting e.g. `"Frak is backing off after repeated failures; retry in \(Int(retryAfter * 1000))ms."` (`:66`).
- **Row 5 (`purchase(String,String,String)`) — STILL OPEN.** `frak-sdk.api:80-81`; `TrackingAPI.swift:14` (iOS at least labels them).
- **Row 6 (`FrakContext` has no discriminator / no unknown arm) — STILL OPEN, and `eccb8c2` sharpens the argument against it.** `sdk/android/.../sharing/FrakContext.kt:8-44` — `sealed interface` with exactly `V1`/`V2`, no `Unknown`; `sdk/ios/.../Sharing/FrakContext.swift:2-5` — `public enum` with `case v1`/`case v2`. Meanwhile `eccb8c2` just demonstrated the cost live: adding `SharingResult.WalletOpened` (`SharingResult.kt:49-51`, `frak-sdk-ui.api:75-80`) / `case walletOpened` (`SharingResult.swift:11`) is a **source break for every exhaustive `when`/`switch` a merchant has written**. It is free today because nothing is published. `FrakContext` V3 will not be.
- **Row 7 (`resetAnonymousId()` returns a `Boolean` iOS cannot honour) — STILL OPEN.** `FrakClient.swift:44` / `FrakClient.kt:46`, both `Bool`/`Boolean`.
- **Row 8 (`heightFraction` throws on Android, clamps on iOS) — STILL OPEN, and now stranger.** `FrakSharing.kt:47-57` still `@throws IllegalArgumentException` + `require(...)`. iOS moved the knob into `FrakSharingConfiguration.heightFraction` (`FrakSharingConfiguration.swift:5-6`), a plain `var` whose doc comment says "clamped to `0.3...1.0`" and which performs no validation at the boundary at all — so the divergence is unchanged in behaviour and the iOS type now *documents* a clamp it does not itself apply.
- **Row 9 (equality/`Hashable` split across 8 types) — STILL OPEN; the prior anchors were approximate.** `frak-sdk.api` is unchanged so the split is unchanged, but the cited lines `180,255,604,635,212,280` land on `toString`, a blank line, `getEurAmount`, `setRef`, `getLogSink` and a `}` — they are one-past-the-class-header pointers, not the class headers. Re-anchor by class name, not line. **Made slightly wider by the delta**: `FrakSharingConfiguration` and `FrakInstallPresentation` are new public `Hashable` iOS types (`FrakSharingConfiguration.swift:4,31,45`) with **no Android counterpart of any kind** — `install` and `detectInstall` are iOS-only, so the sheet's public configuration API is now structurally different per platform, which is row 9's problem plus a new parity one.
- **Row 10 (on-disk queue row format) — STILL OPEN.** `EventQueue.swift:5-25` and `EventQueue.kt:13-20`: no tier/priority field, `currentSchemaVersion = 1` unchanged.

### Also unchanged (referenced by the P1 fixes)

**§3.3 backend merge get-or-create — STILL OPEN.** `services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts:227` still returns `"TARGET_NOT_FOUND"`; the "load-bearing accident" comment is still at `:205`. No backend file appears in `git diff --stat c0a0cec origin/dev`.

---

## Commit-message claims that do not survive the diff

Most of these commit messages are accurate about what they did. Two are accurate but *incomplete in a way that matters against the audit*, and one is contradicted by its own file.

1. **`48d7e2c`: "teardown now disposes a still-live presentation instead of leaving its probe running."**
   True as written, and it does close F3's leak — but read against the finding it claims territory it does not hold. F3's fix sketch is "call `current.dispose()` **(and report `.dismissed`)**". `SharingPresentation.swift:266-272` never inspects `case .live(let current) = phase` (it clears `phase` on the line before) and `dispose()` at `:75-76` *nils* `onOutcome`. **The merchant's `onResult` is still never called when the host view goes away mid-sheet.** Anyone reading the log will believe F3 is closed.

2. **`b68f989`: "gated … on the merchant's own `LSApplicationQueriesSchemes`" — true; the implied merchant story is not.**
   `InstallProbe.swift:51` `guard await walletSchemeStatus() == .ok` is real, and `DefaultFrakClient.swift:380-386` logs a genuinely excellent one-time diagnostic naming the missing key. But that log is emitted through `logger.error`, and `FrakLogger.swift:47` is `guard level >= messageLevel`, against a default of `.none` (`FrakConfig.swift:92`) that the merchant quickstart never overrides. **The feature's only misconfiguration signal is silent in the default integration**, which is §2.5 leg 2 compounding a new feature rather than a claim that fails outright.

3. **`0e74a65`: "Both accept `campaignToken`, `providerToken` and `customProductPageId`."** — reverted three commits later by `e79484a` in the same branch. Not a surviving claim; noted only because the merged history reads as if both are true.

4. **`e79484a`: "Tagging `ct = frak-<merchantSlug>` is still worth doing … as something the SDK derives from the resolved merchant."** — not done. `grep -rn "campaignToken\|\"ct\"" sdk/ios/Sources/` finds nothing. Written as intent, so not false, but it is the only App Store attribution the iOS install path could ever have and it is now nobody's ticket.

5. **`sdk/ios/README.md`'s "491 Swift Testing tests"** (changed from 257 in `b68f989`) — **much better, still not a count.** `grep -rc "^\s*@Test" sdk/ios/Tests` gives **498** declarations across **55** `@Suite`s (one of them parametrised with `arguments`, so the executed count is higher still). The prior audit's §6 row on test counts is *largely* closed for iOS by this edit; it is not exact, and `sdk/android/README.md`'s Android figures were not touched.

---

## Status table

| Item | Prior severity | Status now | Current anchor |
|---|---|---|---|
| §2.1 Android implicit-intent proof leak | P0 blocker | **STILL OPEN** (symptom worsened by `eccb8c2`) | `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/AppLauncher.kt:24-30`; `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingSheetState.kt:438-443` |
| §2.1 iOS half (custom-scheme handoff) | P0 blocker | **CHANGED** — universal-link rung added ahead of it; scheme fallback still leaks | `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:378-395`; `AppLink/AppLauncher.swift:33-36`; `AppLink/InstallLinks.swift:33-44` |
| §2.2 `?fmt=` auto-merge, no origin check | P0 | **STILL OPEN** | `sdk/ios/Sources/FrakSDK/Identity/IdentityMerge.swift:8`; `sdk/android/.../identity/IdentityMerge.kt:26`; `DefaultFrakClient.swift:311` |
| §2.3 `DeepLinkHandling.Automatic` misses warm starts | P0 | **STILL OPEN** | `sdk/android/.../applink/DeepLinkObserver.kt:23-29`; default at `core/FrakConfig.kt:135`; zero `setIntent`/`OnNewIntent` in repo |
| §2.4 loaded-but-blank sheet | P0 | **STILL OPEN** | `sdk/ios/Sources/FrakSDKUI/SharingSheetLogic.swift:93`; `SharingSheetModel.swift:46,227-231`; `SharingSheetState.kt:242,265` |
| §2.4 native↔web contract ungated | P0 | **STILL OPEN, WIDENED** (6 new fragment keys) | `sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift:119-142` ↔ `apps/wallet/app/module/install/params/table.ts:37-44` |
| §2.5(1) no artifact / no dep snippet / version drift | P0 | **STILL OPEN** | `sdk/android/README.md` (no `implementation` line); `sdk/ios/README.mirror.md:17` vs `sdk/ios/package.json:3`; `git tag` empty |
| §2.5(2) `logLevel` silent by default | P0 | **STILL OPEN** (now suppresses a new diagnostic) | `core/FrakConfig.kt:139`; `Core/FrakConfig.swift:92`; `Core/FrakLogger.swift:47`; quickstart `README.mirror.md:43-49` |
| §2.5(3) allow-listing undocumented in SDK READMEs | P0 | **STILL OPEN** | only `example/native-android/README.md:5`, `example/native-ios/README.md:5,57` |
| §2.5 add-ons: non-compiling snippet, wrong API table | P0 | **STILL OPEN** | `sdk/ios/README.mirror.md:54` (missing `try`); `sdk/ios/README.md:31-39` (`InteractionTracker` + ~20 internals) |
| §2.6 / `ios-core` F2 `LSApplicationQueriesSchemes` + Associated Domains | P0 / high | **CHANGED — ~30 % closed** (scheme mentioned once, no value, no plist snippet, no AASA) | `sdk/ios/README.mirror.md:93-96`; SDK-side `DefaultFrakClient.swift:369-388`, `AppLink/QueriedSchemes.swift:26-36` |
| §3.1 R8 never run | P1 | **STILL OPEN** | `example/native-android/app/build.gradle.kts:29` |
| §3.2a null-`clientId` row → 401 | P1 | **STILL OPEN** | `sdk/ios/.../Tracking/RowSender.swift:17-18`; `.../tracking/RowSender.kt:20-21` |
| §3.2b `.rejected` → `break` (head-of-line block) | P1 | **STILL OPEN** | `sdk/android/.../tracking/EventOutbox.kt:201-204`; `sdk/ios/.../Tracking/EventOutbox.swift:299-307` |
| §3.2c Android never re-drives the outbox | P1 | **STILL OPEN** | no `ProcessLifecycleOwner`/foreground hook in `EventOutbox.kt` or `core/DefaultFrakClient.kt` |
| §3.3 backend merge get-or-create | P1 | **STILL OPEN** | `services/backend/src/orchestration/identity/AnonymousMergeOrchestrator.ts:205,227` |
| §3.4 French default locale | P1 | **STILL OPEN** | zero locale forwarding in `SharingPageURL.swift` / `SharingPageUrl.kt`; `packages/wallet-shared/src/i18n/config.ts:7` |
| §3.5 `SharingWebViewPool.warm` no `lent` guard | P1 | **STILL OPEN** | `sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift:44-45` (cf. `:34`, `:64`) |
| §3.6 Compose site orphans a live sheet | P1 | **STILL OPEN** | `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharing.kt:95` |
| §3.7 clock skew fails every proof | P1 | **STILL OPEN** | `.../identity/AnonymousIdStore.kt:82`; `.../Identity/AnonymousIdStore.swift:71` |
| §3.8a unused `StateFlow` import (is CI real?) | P1 | **STILL OPEN** | `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:39` (sole occurrence) |
| §3.8b / `tests-and-coverage` F4 unit test hits production | P1 | **STILL OPEN** — file edited in `eccb8c2`, `@Before` untouched | `SharingSheetStateTest.kt:42-46` → `SharingInputFixtures.kt:58` → `core/FrakConfig.kt:133` (`env = Production`) |
| §3.9a `NativeShare.share` can suspend forever | P1 | **STILL OPEN** (comment-only edit) | `sdk/ios/Sources/FrakSDKUI/NativeShare.swift:31-47`; caller `SharingSheetModel.swift:633-639` |
| §3.9b `teardown()` abandons a live session | P1 | **HALF FIXED** by `48d7e2c` — leak closed, `onResult` still never fires | fixed: `SharingPresentation.swift:269` + `:49-51,62`; open: `:266-272`, `:75-76` |
| §3.10 no ObjC/UIKit surface, undocumented | P1 | **STILL OPEN** | zero `@objc` in `sdk/ios/Sources/`; no README note |
| §4.1 rewards read models publish ctors | ABI | **STILL OPEN**; prior line cites **WERE ALREADY WRONG** | `frak-sdk.api:471,485,503,511,522,531,581,591,601` |
| §4.2 `rewards.best` shape divergence | ABI | **STILL OPEN** | `RewardsApi.kt:36,40` vs `RewardsAPI.swift:26-31` |
| §4.3 retry hint ms vs s | ABI | **STILL OPEN** | `core/FrakError.kt:52` vs `Core/FrakError.swift:11` |
| §4.4 no retryable/fatal axis; `LocalizedError` | ABI | **STILL OPEN** | `Core/FrakError.swift:58-59,65-67` |
| §4.5 `purchase(String,String,String)` | ABI | **STILL OPEN** | `frak-sdk.api:80-81`; `TrackingAPI.swift:14` |
| §4.6 `FrakContext` no discriminator / no unknown arm | ABI | **STILL OPEN**; cost demonstrated live by `eccb8c2` | `sharing/FrakContext.kt:8-44`; `Sharing/FrakContext.swift:2-5`; cf. `SharingResult.kt:49-51`, `frak-sdk-ui.api:75-80` |
| §4.7 `resetAnonymousId()` `Boolean` iOS cannot honour | ABI | **STILL OPEN** | `FrakClient.swift:44`; `FrakClient.kt:46` |
| §4.8 `heightFraction` throws vs clamps | ABI | **STILL OPEN**, iOS side now documents a clamp it does not apply | `FrakSharing.kt:47-57` vs `FrakSharingConfiguration.swift:5-6` |
| §4.9 equality/`Hashable` split | ABI | **STILL OPEN, WIDENED**; prior line cites approximate | `frak-sdk.api` unchanged; new iOS-only `FrakSharingConfiguration.swift:4,31,45` |
| §4.10 on-disk queue row format | ABI | **STILL OPEN** | `Tracking/EventQueue.swift:5-25`; `tracking/EventQueue.kt:13-20` |

**Tally:** 16 P0/P1 items → 0 fully closed, 1 half-closed (§3.9b), 2 changed-but-open (§2.1 iOS, §2.6), 13 untouched. 10 ABI rows → 0 closed, 2 widened. 2 prior citations found to have been wrong at the time of writing (§4.1, §4.9).

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Produced exactly one artifact at /tmp/frak-delta/regression-sweep.md covering the assigned scope (11-alpha-audit.md §2 six items, §3 ten items, §4 ten rows, plus ios-core F2 and tests-and-coverage F4), in the requested output shape. No repo files were read-modified; no new discovery outside the assigned sweep beyond the two 'widened' notes explicitly requested by the re-anchoring instruction."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Every status line carries a re-derived path:line anchor at origin/dev plus a quoted fragment where the claim is behavioural (AppLauncher.kt:24-30, DeepLinkObserver.kt:23-29, EventOutbox.kt:201-204, EventOutbox.swift:299-307, SharingWebViewPool.swift:44-45, FrakSharing.kt:95, DefaultFrakClient.kt:39, SharingSheetStateTest.kt:42-46, SharingPresentation.swift:266-272, README.mirror.md:93-96). Two prior citations are explicitly marked WAS ALREADY WRONG with the actual content of the cited lines shown."
    }
  ],
  "changedFiles": [
    "/tmp/frak-delta/regression-sweep.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git diff --stat c0a0cec origin/dev (whole tree, and scoped to sdk/android, sdk/ios/README*, frak-sdk.api)",
      "result": "passed",
      "summary": "50 files / 1998 insertions; sdk/android touched in only 5 files, none under applink/ or tracking/; frak-sdk/api/frak-sdk.api byte-unchanged"
    },
    {
      "command": "git show / git log -1 --format=%B for 0e74a65 beba204 e79484a 2537681 b68f989 eccb8c2 48d7e2c",
      "result": "passed",
      "summary": "commit claims extracted and checked one by one against the diff"
    },
    {
      "command": "grep -rn for setIntent|OnNewIntent|@objc|StateFlow|locale|fallbackLng|LSApplicationQueriesSchemes|applinks across sdk/ and docs",
      "result": "passed",
      "summary": "zero matches for setIntent/OnNewIntent, @objc, locale-in-page-URL, and AASA-in-SDK-README; exactly one StateFlow occurrence in DefaultFrakClient.kt"
    },
    {
      "command": "grep -rc '^\\s*@Test' sdk/ios/Tests ; grep -c '@Suite'",
      "result": "passed",
      "summary": "498 @Test declarations across 55 suites, vs the README's newly-claimed 491"
    },
    {
      "command": "no build/test toolchain invoked (JDK / Android SDK / Swift unavailable per constraints)",
      "result": "not-run",
      "summary": "verification is source-read only, as mandated"
    }
  ],
  "validationOutput": [
    "16 P0/P1 items: 0 fully closed, 1 half-closed (§3.9b teardown leak, 48d7e2c), 2 changed-but-open (§2.1 iOS universal-link rung, §2.6 README), 13 untouched.",
    "10 §4 ABI rows: 0 closed, 2 widened by the delta (row 6 cost demonstrated by eccb8c2's new SharingResult case; row 9 widened by the iOS-only FrakSharingConfiguration).",
    "2 prior audit citations found to have been wrong at time of writing: §4 row 1's frak-sdk.api:298,313,345,414,435 and §4 row 9's :180,255,604,635,212,280.",
    "Loudest single result: sdk/android/frak-sdk-ui/src/test/.../SharingSheetStateTest.kt was edited by eccb8c2 (27 lines) and its production-hitting @Before at :42-46 was left untouched; and DefaultFrakClient.kt:39's unused StateFlow import survived 12 commits of CI."
  ],
  "residualRisks": [
    "No toolchain: the ktlint question (§3.8a) still cannot be answered definitively — I can prove the unused import is present and sole, not that the job is red or green.",
    "Robolectric cross-class leakage in §3.8b (F4's second half) remains unverifiable without a JVM; only the Production-env half is proven by reading.",
    "The iOS universal-link rung's real-world reliability (AASA fetch timing on a cold install, per-domain user opt-out) cannot be exercised without a device; I graded it 'mitigated, not closed' on that basis.",
    "Line anchors were re-derived at origin/dev f1dc693 and will drift on the next commit."
  ],
  "noStagedFiles": true,
  "diffSummary": "One new file written under /tmp: /tmp/frak-delta/regression-sweep.md. The repo worktree at /home/dev/wallet-audit was not modified (read-only sweep: git show/diff/log, grep, sed, find only).",
  "reviewFindings": [
    "blocker: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/AppLauncher.kt:24-30 - §2.1 install-proof leak untouched, and eccb8c2 now reports SharingResult.WalletOpened on the hijacked path (SharingSheetState.kt:438-443), turning an invisible hijack into an affirmatively-confirmed one.",
    "blocker: sdk/android/frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/SharingSheetStateTest.kt:42-46 - the production-backend @Before survived a 27-line edit to that very file in eccb8c2.",
    "high: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:39 - unused StateFlow import survived 12 commits through CI; the 'suite is green' claim is still unvalidated.",
    "high: sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:266-272 - 48d7e2c's commit message implies teardown is fixed; the merchant's onResult is still never called (dispose() nils onOutcome at :75-76).",
    "medium: sdk/ios/README.mirror.md:93-96 - the only LSApplicationQueriesSchemes mention gives no value and no Associated Domains; §2.6/ios-core F2 is ~30% closed, and its new diagnostic is silenced by the default logLevel (.none, Core/FrakConfig.swift:92)."
  ],
  "manualNotes": "Two things worth escalating beyond the table. (1) The prior audit's own citations for §4 rows 1 and 9 do not point at the code they describe — the claims hold but the anchors were wrong at c0a0cec, which means anyone verifying §4 by line number concludes 'not found' and marks it closed. Worth correcting in 11-alpha-audit.md before it is used as a checklist. (2) I chased and disproved one plausible new bug: InstallLinks.universalLink puts the proof in '#p=' while InstallLinks.deepLink's own doc comment (InstallLinks.swift:8-9) says the fragment is dropped by the wallet's router. The wallet does in fact read '#p=' (apps/wallet/app/utils/deepLink.ts:122-127, buildParams at :167), so there is no bug — but the SDK's deepLink doc comment is now misleading about the wallet's actual capability and reads as if the fragment carrier is unusable."
}
```
