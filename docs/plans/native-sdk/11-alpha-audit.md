# Native SDK — first-alpha audit

**Date:** 2026-08-13 · **Tree:** `origin/dev` @ `c0a0cec` · **Method:** 13 parallel read-only audits, no toolchain available (no JDK, no Android SDK, no Swift) — every claim is source-read and cited `path:line`. 191 findings; per-area reports in [`audit-2026-08-13/`](./audit-2026-08-13/).

This document supersedes nothing. It sits next to [`06-open-findings.md`](./06-open-findings.md) and, in §6, challenges it.

---

## 1. Verdict

**Do not ship the alpha this week. Ship it in ~2 weeks, after §2.**

The engineering is genuinely good — better than most first-party SDKs at v0. The proof-of-possession wire format is byte-identical across TypeScript, Kotlin, Swift *and* the backend verifier (independently re-derived from first principles by one auditor). The durable outbox's reconcile/row-id/hold machinery is careful. The HTTP clients are bounded on every axis. The ABI gate is real, hand-rolled around an AGP 9 hole, and its dumps are committed and internally consistent. The privacy manifests are thought through rather than copy-pasted.

What is not ready is everything that only executes **on a device, in a merchant's app, against a store artifact**. That is exactly the set nobody has run, and it is where all four blockers live. Three of the four are cheap.

The single most important structural fact: **the iOS sharing sheet had its first device/simulator QA in the last 24 hours (`0c978b1`, `5a50e20`, `ade62d1`, `78c96b8`) and that pass found six real defects, several of them "the sheet is visibly broken" class.** The Android sheet has had *no* equivalent pass. There is no reason to expect a different defect rate. Budget for it.

| Axis | State |
|---|---|
| Correctness (core) | Strong. Two silent-loss paths (§2.3, §3.2) and a clock assumption (§3.7). |
| Correctness (sharing sheet) | Weak on both platforms, for the same reason: the window/host layer has no test that constructs it, and only iOS has been on a device. |
| Security | One blocker (§2.1), one high (§2.2). Both are trust-boundary design, not crypto. The crypto is fine. |
| UX | Unmeasured. Locale is broken by default (§3.4), accessibility is absent, and the "loaded but blank" path has no exit (§2.4). |
| Merchant setup | **The weakest axis.** A merchant cannot obtain either artifact, gets silence by default, and the one mandatory onboarding step is documented in the wrong file (§2.5). |
| Build / release | Plumbing is ahead of the register's own account of it, but nothing minified or published has ever been built or consumed (§3.1). |
| Docs accuracy | `06-open-findings.md` is right about code and wrong about numbers, coverage and three "closed" rows (§6). |

---

## 2. P0 — blocks the alpha

Five items. Ordered by *(damage × likelihood) ÷ cost*.

### 2.1 Android leaks the install proof to any app that claims `frakwallet://` — **security, trivial fix**

`AppLauncher.open()` (`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/AppLauncher.kt:24-30`) fires a bare implicit intent:

```kotlin
Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(FLAG_ACTIVITY_NEW_TASK)
```

The URL it carries is `frakwallet://install?m=<merchantId>&a=<anonymousId>&p=<installProof>` (`DefaultFrakClient.kt:319-331`, `InstallLinks.kt:22-25`). That proof is a **30-day bearer credential** the backend accepts as authentication for that anonymous id (`services/backend/src/api/user/identity/ensure.ts:104-119`, `IdentityProofService.ts:24`).

Any app on the device declaring an `<intent-filter>` for scheme `frakwallet` receives it. No root, no permission, no prompt beyond installing the app. It can then bind the victim's identity — and every reward accrued to it — to a wallet the attacker controls. Worse, because `startActivity` succeeds, the SDK reports `OpenAppResult.OpenedApp` and never falls through to the store, so the hijack is invisible.

`settings.env.walletPackageId` is *already in scope* on the line above, and `<queries><package android:name="id.frak.wallet"/>` is already in the manifest.

> **Fix:** `intent.setPackage(walletPackageId)`; on `ActivityNotFoundException`, retry without the package only for the store URL. One line. **Complexity: trivial.**
> iOS is the same shape (`AppLauncher.swift:22-26` → `UIApplication.shared.open`) and *cannot* be fixed this way — iOS offers no bundle-id targeting for custom schemes. Move the iOS handoff to a Universal Link on `wallet.frak.id` (the `/install` page already exists as the fallback). **Complexity: medium.**

*Register status: NEW. §4 closed "the WebView starting arbitrary activities (3.1)"; this is the SDK core launching one.*

### 2.2 Inbound `?fmt=` merge is auto-executed with no origin check — **security, small fix**

The SDK signs and executes an attacker-supplied merge token arriving on any link, with no origin validation and no user interaction. This is 2.1 from the other direction: identity capture by link. See `audit-2026-08-13/security-privacy.md` F2 for the full chain.

> **Fix:** bind the merge token to an origin the SDK can verify, or require a user-visible confirmation. **Complexity: medium.** If it cannot be fixed in the alpha window, **disable `?fmt=` handling in the alpha** — the README already says the flow is unsupported until `ROLLOUT-STEP-3`.

### 2.3 `DeepLinkHandling.Automatic` — the default — misses every warm-start referral link

`DeepLinkObserver.consume()` reads `activity.intent` (`applink/DeepLinkObserver.kt:23-29`). Android does **not** update `getIntent()` on `onNewIntent`; the host must call `setIntent()`. So on a `singleTask`/`singleTop` activity — what every app that handles deep links uses — the observer re-reads the stale *launch* intent, sees its own `HANDLED_EXTRA`, and returns.

The KDoc at `DeepLinkObserver.kt:8-11` asserts the opposite. `sdk/android/README.md` never mentions `setIntent`. **The project's own harness gets it wrong** (`example/native-android/.../MainActivity.kt:237-242`, on a `singleTask` activity), which is precisely why "inbound deep links have run nowhere" has hidden it.

Cold start works. A manual test tries cold start first. Every referral that lands on an already-running app is lost, silently, with no log.

> **Fix:** register `OnNewIntentProvider.addOnNewIntentListener` (available on any `ComponentActivity`) in `onActivityCreated`, keeping the current read as fallback; document `setIntent(intent)` for non-androidx hosts; fix the harness. **Complexity: small.**

### 2.4 A wallet page that loads but never renders leaves the sheet blank forever

`onPageFinished`/`didFinish` sets `pageLoaded`, which cancels the 5 s load deadline *and* lifts the skeleton after 400 ms. A 200-OK HTML whose JS never boots — a chunk 404 during a rolling deploy, a parse error on a pre-Chrome-107 WebView, any throw during module eval — produces an empty sheet with no timeout, no error, no host notification, and it **bypasses the native-share fallback that exists for exactly this**. The only outcome the merchant ever sees is `Dismissed`, when the user gives up and swipes.

This matters more than it looks because of its sibling: **the whole native↔web runtime contract (~15 query params, 7 fragment keys, 8 action strings, one `<scheme>://result` shape) is what a *frozen store binary* depends on, and it is the only surface in the programme with no gate.** Kotlin has a ratified `.api` dump enforced in CI. The web contract has hand-copied literals in `search.test.ts` and a paragraph in `06` saying a human checked it. `sdkVersion` is sent by both SDKs and read as telemetry only. A three-letter rename in `apps/wallet` bricks every shipped binary, silently.

> **Fix (alpha):** require an app-level readiness signal (the page already posts host results — add a `ready` action), not `pageFinished`, to lift the skeleton and cancel the deadline; on deadline expiry fall through to the native share sheet. **Complexity: small.**
> **Fix (structural, start now):** generate the param/action table from one source into TS + Kotlin + Swift, and add a contract test that fails the wallet build when a shipped SDK version's params stop being read. **Complexity: medium.**

### 2.5 A merchant cannot integrate this, and would get silence if they did

Three compounding facts:

1. **No artifact.** Android has no publish path exercised and **no dependency snippet anywhere in `sdk/android/README.md`**. The iOS mirror README tells merchants to pin `0.1.0-alpha.1` against a tree that says `0.0.1`, and zero tags exist. Time-to-first-track is formally infinite without a Frak engineer in the room.
2. **Silence by default.** `logLevel` defaults to `FrakLogLevel.NONE` on both platforms (`core/FrakConfig.kt:139`, `Core/FrakConfig.swift:92`) and the iOS merchant quickstart never sets it. Every carefully-written diagnostic — including `"FrakConfig has neither a merchantId nor a packageId"` and the `FrakEnvironment.Custom` rejection — is dropped on the floor.
3. **The one mandatory onboarding step is in the wrong file.** That Frak must allow-list the merchant's package/bundle id against the merchant id appears **only** in `example/native-{android,ios}/README.md`, never in an SDK README. Skip it and every call fails `MerchantResolutionFailed` — while `tracking.purchase` still returns `Success`.

Add: the iOS quickstart snippet **does not compile** (missing `try`); the iOS README's "Public API surface" table lists ~20 `internal` types as public and one (`InteractionTracker`) that no longer exists; the Android README lists `FrakLogger` as public when it is `internal` and absent from the ratified dump.

> **Fix:** a real merchant README per platform — dependency snippet, allow-listing step, `logLevel(.debug)` in the quickstart, the manifest/Info.plist checklist (§2.6), and a compiling snippet. **Complexity: small, but it is a day of someone's undivided attention and it is the single highest-leverage day available.**

### 2.6 (bundled into 2.5) The Info.plist / manifest steps the SDK cannot do for the merchant

`sdk/ios/README.mirror.md:75-84` is the entire inbound-link section and says only "wire `.onOpenURL`". Missing: `LSApplicationQueriesSchemes` (without it `isFrakAppInstalled()` is permanently false and the console fills with `canOpenURL: failed`), Associated Domains + AASA (without it the https share links this SDK *generates* open Safari, and no arrival is ever tracked), and the fact that `.onOpenURL` **does not receive universal links at all**. `02-sdk-design.md:123-125` already ruled this a required documented step. The harness declares it; the docs do not.

---

## 3. P1 — fix inside the alpha window, before a second merchant

Ranked. Each is real, evidenced, and none blocks the first design-partner install.

### 3.1 Nothing in this repo has ever run R8 — **build-release, high**

Both `consumer-rules.pro` files are empty and assert in prose that nothing is reflective. That is false: `SharingHost.kt:461` does `ViewModelProvider(activity)[SharingViewModel::class.java]`, which is reflective instantiation. (androidx-lifecycle ships its own keep rule, so this probably survives — *probably* is the problem.) The one harness that could prove it sets `isMinifyEnabled = false` (`example/native-android/app/build.gradle.kts:29`). My Moulinex ships R8 full mode.
> **Fix:** flip the harness to `isMinifyEnabled = true` + full mode and run it. One afternoon. Whatever it finds is a field crash you didn't ship.

### 3.2 Two silent event-loss paths, one per platform, both on the revenue path

- **Android:** nothing ever re-drives the outbox. Three drivers exist, all enqueue-triggered, plus one at `init`. No timer, no foreground hook, no connectivity callback. iOS has a `willEnterForeground` hook; Android has none. A purchase tracked in a tunnel sits in `frak-events.jsonl` until the process restarts — or 14 days pass and it is dropped. (`tracking/EventOutbox.kt:69,86,111`, `core/DefaultFrakClient.kt:163,169`)
- **iOS (and Android):** a row captured with `clientId == nil` — device not yet unlocked after reboot, or one keystore failure — is *uploaded anyway*, the backend answers 401 (`sdkIdentity.ts:140-144`), the drain classifies 401 as `.rejected` and **`break`s**, so every good event behind it waits three passes before the orphans are discarded. `MergeSender` already does the right thing for the same input, so the policy is inconsistent within one layer.
> **Fix:** foreground + backoff-expiry flush on Android; treat a nil `clientId` as `.hold` (the mechanism exists for a missing merchantId) and stamp the id at drain time. **Complexity: small each.**

### 3.3 Android reports `Shared` — and bills a signed `sharing` interaction — when the chooser merely *opened*

`NativeShare.share()` returns `startActivity(...).isSuccess` (`frak-sdk-ui/.../NativeShare.kt:26`). Open the chooser, press Back, repeat: each raise attributes a share. iOS is now the stricter of the two (`78c96b8` made it require a non-nil `activityType`), so **the same user action pays out differently per platform**, and the Android side is a user-controlled loop. `EXTRA_CHOSEN_COMPONENT` via an `IntentSender` has been available since API 22; minSdk is 24.
> **Fix:** `Intent.createChooser(send, title, pendingIntent.intentSender)` + a receiver. **Complexity: small.** This is an economics bug, not a cosmetics bug.

### 3.4 Every non-`en`/`fr` device gets a **French** sharing sheet, and the merchant cannot override it

Neither `SharingPageUrl.kt` nor `SharingPageURL.swift` forwards a locale (grep: zero matches), and `fallbackLng` is `"fr"` (`packages/wallet-shared/src/i18n/config.test.ts:27`). A German user of a French appliance brand's app gets a French sheet. There is no theming and no localisation knob at all — the entire sheet API is `heightFraction`.
> **Fix:** forward `Locale.getDefault()` / `Locale.preferredLanguages` as a param and read it page-side. **Complexity: trivial.**

### 3.5 iOS `SharingWebViewPool.warm(_:)` has no `lent` guard

`warmView` checks `lent`; `prepare()` checks `pooled == nil`; `warm(_:)` checks **only `destroyed`** (`SharingWebViewPool.swift:44-58`). A warm-up task that finishes *after* a tap rebinds and re-navigates the web view the live sheet is holding. That is the **first share of every app session** — the exact path a merchant demo takes. Result: ~5 s of pulsing skeleton, then the raw OS chooser.
> **Fix:** `guard !lent` in `warm`. **Complexity: trivial.** Ships with a device pass, not without one.

### 3.6 The Compose build site orphans a live Android sheet

`FrakSharing.Builder.build()`'s `DisposableEffect` has an empty `onDispose` (`frak-sdk-ui/.../FrakSharing.kt:95`) while the dialog is owned by an Activity-scoped `SharingHost`. Navigate away with Compose Navigation and the sheet stays on screen over the new destination; `onResult` fires into a dead composition. `07` §2.1's bug (a torn-down sheet never reporting) was traded for a stuck one.

### 3.7 `merge/execute` 404s on a fresh install — the `?fmt=` flow is dead on arrival

`POST /user/identity/merge/execute` returns `TARGET_NOT_FOUND` unless the target anonymous id already has an identity-graph node. Native enqueues the merge *before* anything creates one, and never calls `/identity/ensure`, which is what creates it on web. On a fresh install — the exact case `?fmt=` exists for — it is rejected, retried 3×, dropped. Referral arrival still lands; the wallet↔app identity link does not.
> Combined with 2.2, the honest alpha answer is probably: **turn `?fmt=` off and say so.**

### 3.8 Clock assumptions: a device 61 s fast fails every proof

Proof timestamps are raw wall-clock. The `frak-merge-v1` window is ±2 min against an unsynchronised device clock, and a rejection is not retryable. On a device with a drifted clock, nothing works and nothing says why.

### 3.9 Android CI should be red right now, and one unit test calls production

- `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:39` imports `kotlinx.coroutines.flow.StateFlow`; there is no other occurrence in the file, not even in KDoc. ktlint's `no-unused-imports` is standard and not disabled in `.editorconfig`. `apps.yaml`'s `android-sdk` job runs `lint` as its first step. **Either CI is red on `dev` or the lint step is not doing what everyone believes it is.** Check this first — it is five minutes and it invalidates or confirms every "the suite is green" claim in `06`.
- `SharingSheetStateTest.kt:42-46` calls `Frak.initialize(context, FrakConfig.Builder(uuid).build())` in `@Before`. That defaults to `FrakEnvironment.Production` and `Frak.initialize` starts a real config resolve — **a live HTTPS GET to `https://backend.frak.id` from a JVM unit test, every CI run** — with no `shutdown()` in `@After` (Android has no reset seam), leaking a `SupervisorJob`, lifecycle callbacks and a queue file into the four other Robolectric classes in the module.
> **Fix:** point the fixture at a loopback `FrakEnvironment.Custom` (already allowlisted) and add the `Frak.resetForTesting()` seam `T2` has been asking for.

### 3.10 iOS: `NativeShare.share` can suspend forever, and `SharingPresenter.teardown()` abandons a live session

`78c96b8` fixed two real bugs and, in doing so, deleted the only escape hatch for a refused presentation without replacing it — and the tier-3 path calls it while the sheet is mid-presentation, which is exactly when UIKit refuses. Separately, `teardown()` does no `dispose` and no `onResult`: live sheet stranded on the skeleton, `WKWebView` leaked.

### 3.11 UIKit/ObjC merchants cannot use `FrakSDKUI` at all

The only public entry point is a SwiftUI `ViewModifier`, and **no public declaration in the package is `@objc`**. Large retail apps are frequently UIKit-and-ObjC. This is a scoping decision, not a bug — but it must be a *stated* one, in the README, before a merchant discovers it in week two.

---

## 4. ABI / irreversibility — decide before the first published artifact

These are cheap today and expensive-to-impossible after `id.frak.sdk:core:0.1.0` exists. Rank them above everything in §3 that isn't a P0, because §3 can be fixed in a patch and these cannot.

| # | Item | Why now |
|---|---|---|
| 1 | **Reward read models still publish their constructors** into `frak-sdk.api` (`:298,313,345,414,435`) | A3/D7 applied `internal` constructors to `config/` and `sharing/` and **never reached `rewards/`**. Any new backend reward field is then a merchant-breaking change forever. The register says this policy completed. It did not. |
| 2 | `rewards.best` takes a `RewardRequest` on Android and four defaulted params on iOS | The two SDKs are not the same API on the hottest read path. Pick one now. (register 9.15, still open) |
| 3 | Retry hint is **milliseconds on Android, seconds on iOS** (`FrakError.BackingOff` vs `.backingOff`) | A unit divergence in a public error payload. Free to fix now. |
| 4 | No retryable/fatal axis on `FrakError`, and iOS's `LocalizedError` conformance advertises raw diagnostics as user-facing | Merchants will show these strings to users. |
| 5 | `tracking.purchase(String, String, String)` — three unlabeled Strings on the revenue path, frozen at `frak-sdk.api:82` | Trivially mis-ordered, permanently. |
| 6 | `FrakContext` is a versioned public hierarchy with no discriminator and no unknown arm, **on both platforms** | V3 will be a consumer break. A2 fixed this for `FrakError`/`SharingResult`/`Interaction` and stopped. |
| 7 | `resetAnonymousId()`'s `Boolean` is a documented cross-platform contract iOS cannot honour (returns `true` while the delete can silently fail) | Either make it honest or make it `Void`. |
| 8 | `heightFraction` **throws on Android, clamps on iOS** | Same input, different program. |
| 9 | Equality/`Hashable` split across 8 types (wider than register 9.9 records) | Adding equality later is a behaviour change with an unchanged descriptor — i.e. invisible to the ABI gate. |

---

## 5. P2 / P3 — the long tail

Full detail in the per-area reports. Themes only:

- **Performance.** Android re-reads and re-parses the whole queue file on every `track()`; no drain coalescing (iOS has it). A warm `WebView` per Activity, warmed eagerly, never released under memory pressure. The eager-JS budget measures under half of a cold share's bytes; on 3G the sheet is lost entirely.
- **Accessibility.** Neither sheet announces itself. TalkBack reads the hidden page behind the Android skeleton. Nothing is stated about Dynamic Type, RTL, or the iOS 15 layout branch (which is visibly wrong, and iOS 15 is the declared floor).
- **Observability, for the merchant.** No correlation id, no delivery signal, no queue-depth accessor, no debug mode. "Did my event arrive?" is unanswerable, and `Success` is returned for events that will never be delivered.
- **Observability, for Frak.** The SDK version header is logged and nothing else — no kill switch, and Android and iOS are indistinguishable on the wire. For a fleet of *frozen binaries*, that is the thing you will wish you had.
- **Testability, for the merchant.** `FrakClient` is a `final` class behind a singleton. There is no fake, no protocol, no staging mode. A merchant cannot unit-test their own integration.
- **Parity drift with the web SDK.** `FrakContextManager.update()` re-serialises the merchant's whole query (`%20`→`+`, `~`→`%7E`, IDN punycoding) where both native ports deliberately do not — so a link built in the app and one built by the same merchant's website byte-differ, and nothing would notice. Plus ≥8 named input divergences across the three hand-ported `queryParams`/`mergeAttribution` implementations, with no shared corpus. `golden-sharing-links.json` remains the highest-leverage un-built artifact in the programme.
- **Android `UrlQuery.kt` has zero direct test coverage** while iOS has `URLQueryTests.swift` — and it is the file carrying register 9.2 *plus* an unfiled second bug: Kotlin's `toIntOrNull(16)` accepts a sign, so `%-f` decodes to byte `0xF1` on Android and stays literal on iOS.

---

## 6. `06-open-findings.md` — challenged

The register's **code-level** claims hold up remarkably well. Every load-bearing "Closed" row that can be checked by reading source is genuinely closed: the ABI dumps are committed and consistent (`PercentEncoding` and both `@InternalFrakApi` version constants really are absent; exactly one synthetic `<init>` survives, on `FrakError`), no public declaration in either Android module carries a default argument, the `SharingResult.Kind`/`FrakError.Kind` wire strings match byte-for-byte across platforms, the backup-rules files and their manifest pointer are gone, and the drain-time foreign-merchant check exists on both platforms. The proof envelope is three-way byte-identical — **verified independently**, including the Kotlin-hex-parse vs Swift-`UUID(uuidString:)` question, which is confirmed identical for uppercase input too.

Its **numbers, coverage claims and three "closed" rows** do not hold.

| Claim | Reality |
|---|---|
| `checkDexSizeBudget` is part of the green `check`; `09` §5b reports it "was run and was red at **321 KB**" | **The task does not exist and never has.** `git log -S` finds no commit. `frak.sdk.dexBudgetKb` is in no `gradle.properties`. This is the one place the register reports an *executed measurement* that provably did not happen — and it contaminates the credibility of every other "verified this pass" line. Cited in 5 documents including `sdk/AGENTS.md:66`. |
| "iOS **396** tests in 42 suites"; "Android **451** (321 + 130)" | **473 in 51 suites**, and **514**. Both were already wrong at the register's own last commit. "A real count off the test XML this pass" is not what happened. |
| 9.1 **Closed** | Its fix (`AttributionLedger`, `abandonGrace`, `selfUntilSettled`) was **reverted**; none of those identifiers exist in the tree. The revert is buried mid-paragraph inside a §4 "Closed" bullet. Both platforms knowingly report `.dismissed` over a share that happened. |
| 9.16 **Closed** | The mechanism it describes (`pendingLaunch`/`pendingReports`) is **absent**; the presenter was redesigned instead, with no revert note at all. |
| 9.13 cites an `AtomicBoolean` fix as the thing that has no regression test | **There is no atomic anywhere in `frak-sdk-ui`.** |
| 9.14 "branch-only" | The branch is on `dev`. The defect is live at `SharingHost.kt:157-161`. A real merchant callback is dropped. |
| 8.2's "1,847 lines with zero coverage" and its per-file figures | **2,083 lines**; five of six per-file figures are wrong. It also cites `AttributionLedgerTests` as the proof that 9.1 is covered — that suite does not exist. |
| §3.7's "303 lines (478 raw)" | 325 / 507. |
| A7's "eighteen twins for fifteen members" | Seventeen for seventeen. |
| README §Status: "iOS has had no device or simulator pass at all" | **False since yesterday.** Four commits are explicitly device/simulator QA, with measurements on an iPhone 15 and an iOS 26 simulator. `03-sharing-and-install.md:250` also claims a simulator XCUITest pass while no XCUITest target exists in the repo. |
| A6 / `AGENTS.md` "publishing is broken by Dokka" | Fixed in code; the compass files still say it is broken. |
| 1.2b "dex budget is now part of CI" | One third false (see row 1). |
| "`@InternalFrakApi`'s first and so far only use" | Three sites on Android, two on iOS. |

**And one class of problem the register's prose actively hides:** three rows are marked *closed* or *accepted with rationale* while the thing they describe is absent from the tree (9.1, 9.16, 9.13's atomic). A reader auditing by grep would conclude the register is unreliable; a reader auditing by reading would conclude the opposite. Both are half right, and that is the worst possible state for a document whose entire purpose is to be the thing you trust instead of re-reading the code.

> **Recommendation:** freeze `06` as a historical register, and move the live list to a table with a column that says *how the row was last verified* — `read` / `executed` / `on-device` / `asserted`. Almost every wrong claim above is an `asserted` masquerading as an `executed`.

---

## 7. What I would actually do

**Week 1 — the gate.**
1. Run `bun run --cwd sdk/android lint` (5 min). Resolve §3.9's unused import either way. *This tells you whether CI means anything.*
2. `setPackage()` on the Android handoff (§2.1). One line, one test.
3. Disable `?fmt=` for the alpha (§2.2 + §3.7), and say so in the README.
4. `OnNewIntentProvider` for deep links + fix the harness (§2.3).
5. Locale param (§3.4). Trivial, and it is the first thing a French appliance brand's German user sees.
6. Point `SharingSheetStateTest` at loopback (§3.9). Stop calling production from CI.
7. Flip the harness to R8 full mode and fix what falls out (§3.1).

**Week 2 — the two things only a device can tell you.**
8. **A full Android sharing-sheet device pass**, run the way the iOS one was. Budget for six defects; iOS found six. Do this before anything cosmetic.
9. The readiness-signal fix for the blank sheet (§2.4), verified on that pass.
10. The merchant README day (§2.5/§2.6) — dependency snippet, allow-listing, `logLevel`, manifest checklist, a snippet that compiles.

**Before you cut the tag.**
11. Decide §4 items 1–5. They are the only irreversible ones on the list.
12. Tag `0.1.0-alpha.1` on both platforms *at the same version*, and make one external consumer build against the published artifact — not the composite/path dependency the harnesses use, which masks exactly the failures publishing introduces.

**Deliberately deferred, with a note in the README rather than a fix.** UIKit/ObjC support; theming; the merchant test seam; accessibility beyond "it does not crash"; `golden-sharing-links.json`. All real, none of them the reason an alpha fails.

---

## 8. Where the evidence is

| Report | Findings | Worst |
|---|---|---|
| [`android-core.md`](./audit-2026-08-13/android-core.md) | 13 | warm-start deep links; outbox never re-driven |
| [`ios-core.md`](./audit-2026-08-13/ios-core.md) | 13 | nil-clientId rows 401 and block the queue; README omits Info.plist steps |
| [`android-sharing-sheet.md`](./audit-2026-08-13/android-sharing-sheet.md) | 17 | Compose site orphans a live sheet; `Shared` on chooser *open* |
| [`ios-sharing-sheet.md`](./audit-2026-08-13/ios-sharing-sheet.md) | 14 | `warm()` hijacks the live sheet's web view |
| [`backend-contract.md`](./audit-2026-08-13/backend-contract.md) | 12 | `merge/execute` 404s on fresh install; ROLLOUT-STEP-3 sequencing |
| [`wallet-web-surface.md`](./audit-2026-08-13/wallet-web-surface.md) | 13 | loaded-but-blank; the frozen-binary contract has no gate |
| [`security-privacy.md`](./audit-2026-08-13/security-privacy.md) | 15 | implicit-intent proof leak; auto-executed `?fmt=` |
| [`parity-and-web-contract.md`](./audit-2026-08-13/parity-and-web-contract.md) | 13 | web/native links byte-differ; ≥8 named divergences |
| [`merchant-dx.md`](./audit-2026-08-13/merchant-dx.md) | 19 | no artifact, no logs, allow-listing undocumented |
| [`build-release-ci.md`](./audit-2026-08-13/build-release-ci.md) | 14 | R8 never run; iOS tag pushed before any build |
| [`public-api-ergonomics.md`](./audit-2026-08-13/public-api-ergonomics.md) | 16 | the §4 irreversibility list |
| [`tests-and-coverage.md`](./audit-2026-08-13/tests-and-coverage.md) | 18 | a unit test calls production; the façade has zero coverage |
| [`register-challenge.md`](./audit-2026-08-13/register-challenge.md) | 14 | `checkDexSizeBudget` does not exist |

**Not verifiable here:** anything needing a compiler, an emulator, a simulator or a network. No JDK, no Android SDK, no Swift toolchain was available. Every claim above is source-read. The three that would most change this report if executed: the ktlint run (§3.9), an R8 build (§3.1), and an Android device pass on the sheet (§7.8).
