# Native SDK — first-alpha audit

**Date:** 2026-08-13 · **Tree:** `origin/dev` @ `f1dc693` (first pass ran at `c0a0cec`) · **Method:** 13 parallel read-only audits, then 3 more over the delta. No toolchain available (no JDK, no Android SDK, no Swift) — every claim is source-read and cited `path:line`. 191 findings in the first pass, 23 more in the delta; per-area reports in [`audit-2026-08-13/`](./audit-2026-08-13/) and [`audit-2026-08-13/delta-f1dc693/`](./audit-2026-08-13/delta-f1dc693/).

This document supersedes nothing. It sits next to [`06-open-findings.md`](./06-open-findings.md) and, in §6, challenges it.

**Revised five times.** §0 records two team corrections. §9 reviews the 12 commits that landed after the first pass. §10-§11 review the remediation branch across four rounds — including two findings this audit got wrong and now retracts (§10.1, §11.3). **§12 closes it out: the branch merged to `dev` as `a6b739770`, and the regression §11.4 raised was fixed before the merge.**

---

## 0. Corrections from review

Two facts the tree does not record, both of which change rankings:

**(a) Android has been tested on a device since day one.** iOS device testing started 2026-08-12. The audit inferred "no Android device pass" from `README.md` §Status and `06` T3/D2b — that is a **doc-accuracy finding against those files**, not a fact about the process. `README.md` §Status, `06` T3 and `06` D2b all need rewriting; they currently understate Android and (since `0c978b1`) overstate nothing about iOS either.

The correction *sharpens* one finding rather than softening it — see §2.3: the warm-start deep-link defect survived months of device testing because **the harness reproduces it and prints a success message.** What device testing against your own harness structurally cannot catch:

- anything **the harness itself does wrong** (§2.3);
- anything only a **release/minified** build does — R8 has never run anywhere (§3.1);
- anything only a **merchant's app architecture** triggers — the harness is single-screen with no `NavHost`, so §3.6 is unreachable in it.

So "do an Android device pass" is the wrong ask. The right ask is: **run the harness once as a minified release build, and once with a two-destination `NavHost`.**

**(b) Sharing interactions are analytics, not rewards. Purchases are the reward-bearing event.** This demotes every share-attribution finding to a data-comparability concern and promotes everything on the purchase path. Re-ranked throughout; see §3.2, §3.3 and §5's new *reliability tiering* item.

---

## 1. Verdict

**Do not ship the alpha this week. Ship it in ~2 weeks, after §2.**

The engineering is genuinely good — better than most first-party SDKs at v0. The proof-of-possession wire format is byte-identical across TypeScript, Kotlin, Swift *and* the backend verifier (independently re-derived from first principles by one auditor). The durable outbox's reconcile/row-id/hold machinery is careful. The HTTP clients are bounded on every axis. The ABI gate is real, hand-rolled around an AGP 9 hole, and its dumps are committed and internally consistent. The privacy manifests are thought through rather than copy-pasted.

What is not ready is everything that only executes **in a merchant's app, against a minified release build, against a store artifact**. Device testing has been real; it has been device testing of *the harness*, in debug, on one screen. Every P0 below lives in the gap between that and a merchant.

| Axis | State |
|---|---|
| Correctness (core) | Strong. One head-of-line-blocking class that reaches purchases (§3.2), and a clock assumption (§3.7). |
| Correctness (sharing sheet) | Weaker than the core on both platforms — the window/host layer has no test that constructs it, and its failure modes are the ones a harness cannot produce. |
| Security | One blocker (§2.1), one high (§2.2). Both are trust-boundary design, not crypto. The crypto is fine. |
| UX | Locale is broken by default (§3.4), accessibility is absent, and the "loaded but blank" path has no exit (§2.4). |
| Merchant setup | **The weakest axis.** A merchant cannot obtain either artifact, gets silence by default, and the one mandatory onboarding step is documented in the wrong file (§2.5). |
| Build / release | Plumbing is ahead of the register's own account of it, but nothing minified or published has ever been built or consumed (§3.1). |
| Docs accuracy | `06-open-findings.md` is right about code and wrong about numbers, coverage, three "closed" rows and the device-testing status (§6). |

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

### 2.2 ~~Inbound `?fmt=` merge is auto-executed with no origin check~~ — **WITHDRAWN, see §11.3**

The SDK signs and executes an attacker-supplied merge token arriving on any link, with no origin validation and no user interaction. This is 2.1 from the other direction: identity capture by link. Full chain in `audit-2026-08-13/security-privacy.md` F2.

Note the interaction with §3.3: today `TARGET_NOT_FOUND` is accidentally limiting the blast radius. **Do not remove that 404 without adding the proof gate described in §3.3**, or this finding gets materially worse.

> **Withdrawn in §11.3.** The prescribed fix cannot be built for this flow — the redeeming id does not exist when the token is minted — and `WALLET_CONFLICT` bounds the damage to wallet-less users, making this attribution theft rather than identity capture. The audit graded it P0; medium is right. **The residual is real but small, and §11.4 is where the same trust boundary actually needs work.**

### 2.3 `DeepLinkHandling.Automatic` — the default — misses every warm-start referral link

`DeepLinkObserver.consume()` reads `activity.intent` (`applink/DeepLinkObserver.kt:23-29`). Android does **not** update `getIntent()` on `onNewIntent`; the host must call `setIntent()`. So on a `singleTask`/`singleTop` activity — what every app that handles deep links uses — the observer re-reads the stale *launch* intent, sees its own `HANDLED_EXTRA`, and returns. The KDoc at `DeepLinkObserver.kt:8-11` asserts the opposite.

**Why device testing did not catch this.** The harness is `singleTask` (`example/native-android/app/src/main/AndroidManifest.xml:18`), never calls `setIntent(intent)`, and its `onNewIntent` prints a green success line for the failure case:

```kotlin
// MainActivity.kt:237-245
override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    intent.dataString?.let { url -> logInboundIntent(url) }   // no setIntent(intent)
}
/** Automatic mode already dispatched `handleReferral`; calling it again would double-track. */
private fun logInboundIntent(url: String) {
    addLog("Inbound link reached the activity (SDK auto-handles it): $url", LogType.SUCCESS)
}
```

A tester warm-starts a link, reads `SUCCESS`, and moves on. The SDK dispatched nothing. Cold start genuinely works, so every other check passes. **This is the clearest instance in the audit of a harness manufacturing confidence.**

`sdk/android/README.md` never mentions `setIntent`. Every referral landing on an already-running app is lost, silently, with no log.

> **Fix:** register `OnNewIntentProvider.addOnNewIntentListener` (available on any `ComponentActivity`) in `onActivityCreated`, keeping the current read as fallback; document `setIntent(intent)` for non-androidx hosts; **and make the harness assert rather than narrate** — it should log a failure when the SDK did not dispatch. **Complexity: small.**

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

## 3. P1 — fix inside the alpha window

Re-ranked after §0(b): the purchase path is the money path, and everything on it moves up.

### 3.1 ~~Nothing in this repo has ever run R8~~ → No minified build is verified to *work* — **corrected, see §10.1**

**This finding's headline was wrong and is retracted.** R8 *has* run: `32836c217` (2026-08-07) attributed every class through R8's `mapping.txt` in a minified `example/native-android` release APK and measured the SDK at 60 KB of executable code, with 46% of its classes shaken out by the empty `consumer-rules.pro`. The audit missed it because it ran in a **shallow clone** — see §10.1.

What survives, narrowed: that run measured **size**, not behaviour. Nothing has ever *executed* a minified build, `example/native-android/app/build.gradle.kts:29` is still `isMinifyEnabled = false`, and no gate keeps it that way. `SharingHost.kt:461` does `ViewModelProvider(activity)[SharingViewModel::class.java]` — reflective instantiation, probably covered by androidx-lifecycle's own keep rule, never verified at runtime. A size attribution cannot tell you whether `SharingViewModel` still resolves.

> **Fix:** flip the harness to `isMinifyEnabled = true` + full mode and *run the app*, exercising the sheet. One afternoon. **Complexity: small.**

### 3.2 The purchase path can stall behind a row that can never succeed

Two distinct defects that compound. Both reach **purchases**, which per §0(b) is the only reward-bearing event.

**(a) A row captured with `clientId == null` blocks the queue.** `clientId` is stamped at capture from `identity.anonymousId()`, which is nullable — null when the identity store cannot be read (before first unlock after reboot; iOS file protection is `.completeUntilFirstUserAuthentication`) or when key minting fails. Capture is deliberately not gated on it (`EventOutbox.swift:35-37`: gating capture "would drop it entirely"). Then:

1. `clientIdHeaders(row)` **omits** `x-frak-client-id` (`RowSender.swift:17-19`, `RowSender.kt:21-22`);
2. the backend requires it → **401** (`sdkIdentity.ts:140-144`);
3. `classify()` maps 401 → `.rejected` (only 429/5xx are retryable);
4. `.rejected` → failure++ **and `break`** (`EventOutbox.swift:299-307`, `EventOutbox.kt:201-203`).

Consequences, worst last: the design intent is not achieved — the comment says the row "lands unattributed", but the backend *rejects* it, so you pay the disk write and the request for nothing; the 3-failure cap is spent on a request that can never succeed; and, critically, **the queue is FIFO and `break` stops the whole drain**, so one such row at position 1 blocks every good event behind it — including purchases — for three full drain passes. Combined with (c) below, "three drain passes" can mean three app launches.

The tell that this is an oversight rather than a decision: `MergeSender` handles the identical input correctly in the same layer — `MergeSender.kt:25` / `MergeSender.swift:17-20`, with the comment *"drop it rather than spend the failure cap on a request that can't succeed."*

**(b) `.rejected` should `continue`, not `break` — both platforms.** This is the higher-value half. A rejection is a verdict on *that row*; `break` is correct for `.retryable` (the backend is down, stop trying) and wrong for `.rejected`. One word, and it removes head-of-line blocking for **every** future reject-shaped bug, not just this one. Today any single poison row stalls the purchase queue behind it.

**(c) Android never re-drives the outbox.** Three flush drivers exist, all enqueue-triggered, plus one at `init` (`tracking/EventOutbox.kt:69,86,111`, `core/DefaultFrakClient.kt:163,169`). No timer, no foreground hook, no connectivity callback. iOS has `willEnterForegroundNotification` (`DefaultFrakClient.swift:123-132`); Android has nothing. A purchase tracked in a tunnel sits in `frak-events.jsonl` until the process restarts — or 14 days pass and it is dropped.

> **Fix:** (a) return `.hold` on a null `clientId` and **stamp the current id at drain time** — `currentClientId` is already injected into the outbox and the device is unlocked by then, so the event survives *and* gets attributed (`.dropped`, matching `MergeSender`, is the one-line version; `.hold` is strictly better). (b) `.rejected → continue`. (c) mirror iOS's foreground hook via `ProcessLifecycleOwner`, plus a `delay(backoff.remainingMillis)` retry after a `Retryable`. **Complexity: small each.**

### 3.3 The backend merge get-or-create — and the guard it must keep · **shipped WITHOUT the guard, see §11.4**

`POST /user/identity/merge/execute` returns `TARGET_NOT_FOUND` unless the target anonymous id already has an identity-graph node (`AnonymousMergeOrchestrator.ts:219-230`). Native enqueues the merge before anything creates one, and never calls `/identity/ensure`, which is what creates it on web. On a fresh install — the exact case `?fmt=` exists for — it is rejected, retried 3×, dropped.

**Agreed direction: fix it backend-side, do not reorder the queue.** Ordering dependencies between independently-retried durable rows are exactly what you don't want, and native has no `ensure` call by design.

**But there is a load-bearing accident to preserve.** From `AnonymousMergeOrchestrator.ts:204-212`: *"The target node already exists here — `findGroupByIdentity` below hard-fails with TARGET_NOT_FOUND otherwise — so unlike the initiate arm the latch can be written straight away."* And from the `proof` docstring at `:188-191`: *"Required only once this id has ever latched — **unlatched ids, including legacy ones, keep working as merge targets**."*

A freshly auto-created node is by definition unlatched, so proof enforcement is skipped for it. **Naive get-or-create means anyone can name any `anonymousId` as a merge target, have it conjured, and fold it into their own group with no proof** — the 404 is currently an accidental guard against §2.2's attack.

> **Fix:** auto-create the target **only inside the proof-verified branch**:
> ```
> validateToken(mergeToken, merchantId)
>   → findGroupByIdentity(target)
>       ├── found     → existing path unchanged
>       └── not found → require a valid frak-merge-v1 proof for `target`
>                       ├── valid → create node, markProofSeen, associate
>                       └── else  → keep TARGET_NOT_FOUND
> ```
> This costs native nothing (native signs from day one) and is a step *toward* `ROLLOUT-STEP-3`: new ids become proof-mandatory immediately while legacy unlatched ids keep working. Also move `markProofSeen` to after the node exists — today it is written before `findGroupByIdentity`, and that ordering stops being safe the moment the 404 goes away. **Complexity: small.**

### 3.4 Every non-`en`/`fr` device gets a **French** sharing sheet, and the merchant cannot override it

Neither `SharingPageUrl.kt` nor `SharingPageURL.swift` forwards a locale (grep: zero matches), and `fallbackLng` is `"fr"` (`packages/wallet-shared/src/i18n/config.test.ts:27`). A German user of a French appliance brand's app gets a French sheet. There is no theming and no localisation knob at all — the entire sheet API is `heightFraction`.

> **Fix:** forward `Locale.getDefault()` / `Locale.preferredLanguages` as a param and read it page-side. **Complexity: trivial.**

### 3.5 iOS `SharingWebViewPool.warm(_:)` has no `lent` guard

`warmView` checks `lent`; `prepare()` checks `pooled == nil`; `warm(_:)` checks **only `destroyed`** (`SharingWebViewPool.swift:44-58`). A warm-up task finishing *after* a tap rebinds and re-navigates the web view the live sheet is holding — the **first share of every app session**. Result: ~5 s of pulsing skeleton, then the raw OS chooser.

> **Fix:** `guard !lent` in `warm`. **Complexity: trivial.**

### 3.6 The Compose build site orphans a live Android sheet

`FrakSharing.Builder.build()`'s `DisposableEffect` has an empty `onDispose` (`frak-sdk-ui/.../FrakSharing.kt:95`) while the dialog is owned by an Activity-scoped `SharingHost`. Navigate away with Compose Navigation and the sheet stays on screen over the new destination; `onResult` fires into a dead composition. `07` §2.1's bug (a torn-down sheet never reporting) was traded for a stuck one.

**Unreachable in the harness**, which is single-screen with no `NavHost` — see §0(a). Add a two-destination harness screen and this reproduces immediately.

### 3.7 Clock assumptions: a device 61 s fast fails every proof

Proof timestamps are raw wall-clock. The `frak-merge-v1` window is ±2 min against an unsynchronised device clock, and a rejection is not retryable. On a device with a drifted clock, nothing works and nothing says why. Reaches purchases via the proof on the tracking path.

### 3.8 Android CI should be red right now, and one unit test calls production

- `core/DefaultFrakClient.kt:39` imports `kotlinx.coroutines.flow.StateFlow`; there is no other occurrence in the file, not even in KDoc. ktlint's `no-unused-imports` is standard and not disabled in `.editorconfig`. `apps.yaml`'s `android-sdk` job runs `lint` as its first step. **Either CI is red on `dev`, or the lint step is not doing what everyone believes it is.** Five minutes to check, and it validates or invalidates every "the suite is green" claim in `06`.
- `SharingSheetStateTest.kt:42-46` calls `Frak.initialize(context, FrakConfig.Builder(uuid).build())` in `@Before`. That defaults to `FrakEnvironment.Production`, and `Frak.initialize` starts a real config resolve — **a live HTTPS GET to `https://backend.frak.id` from a JVM unit test, every CI run** — with no `shutdown()` in `@After` (Android has no reset seam), leaking a `SupervisorJob`, lifecycle callbacks and a queue file into the four other Robolectric classes in the module.

> **Fix:** point the fixture at a loopback `FrakEnvironment.Custom` (already allowlisted) and add the `Frak.resetForTesting()` seam `T2` has been asking for.

### 3.9 iOS: `NativeShare.share` can suspend forever, and `SharingPresenter.teardown()` abandons a live session

`78c96b8` fixed two real bugs and, in doing so, deleted the only escape hatch for a refused presentation without replacing it — and the tier-3 path calls it while the sheet is mid-presentation, which is exactly when UIKit refuses. Separately, `teardown()` does no `dispose` and no `onResult`: live sheet stranded on the skeleton, `WKWebView` leaked.

### 3.10 ~~UIKit/ObjC merchants cannot use `FrakSDKUI` at all~~ — **CLOSED, see §12.2**

The only public entry point is a SwiftUI `ViewModifier`, and **no public declaration in the package is `@objc`**. Large retail apps are frequently UIKit-and-ObjC. A scoping decision, not a bug — but it must be a *stated* one, in the README, before a merchant finds out in week two.

---

## 4. ABI / irreversibility — decide before the first published artifact

Cheap today, expensive-to-impossible after `id.frak.sdk:core:0.1.0` exists. Rank these above everything in §3 that isn't a P0: §3 can be fixed in a patch, these cannot.

| # | Item | Why now |
|---|---|---|
| 1 | **Reward read models still publish their constructors** into `frak-sdk.api` (`:298,313,345,414,435`) | A3/D7 applied `internal` constructors to `config/` and `sharing/` and **never reached `rewards/`**. Any new backend reward field is then a merchant-breaking change forever. The register says this policy completed. It did not. |
| 2 | `rewards.best` takes a `RewardRequest` on Android and four defaulted params on iOS | The two SDKs are not the same API on the hottest read path. Pick one now. (register 9.15, still open) |
| 3 | Retry hint is **milliseconds on Android, seconds on iOS** (`FrakError.BackingOff` vs `.backingOff`) | A unit divergence in a public error payload. Free to fix now. |
| 4 | No retryable/fatal axis on `FrakError`, and iOS's `LocalizedError` conformance advertises raw diagnostics as user-facing | Merchants will show these strings to users. |
| 5 | `tracking.purchase(String, String, String)` — three unlabeled Strings **on the reward-bearing path**, frozen at `frak-sdk.api:82` | Trivially mis-ordered, permanently. Promoted by §0(b): this is the money call. |
| 6 | `FrakContext` is a versioned public hierarchy with no discriminator and no unknown arm, **on both platforms** — and `SharingResult`, which the register certified as narrowed-and-safe, **grew a sixth arm five days later** | **No longer hypothetical. `eccb8c2` proved it on Frak's own consumer**: adding `SharingResult.WalletOpened` forced a one-line edit to `example/native-android/.../MainActivity.kt:303` to keep the harness's `when` compiling. A merchant who had shipped against a published `0.1.0` gets worse than a compile error — Kotlin lowers an exhaustive `when` with an implicit `else -> throw NoWhenBranchMatchedException()`, so an **already-installed binary crashes at runtime** the first time the SDK hands it the new arm. On iOS the enum is public and non-frozen, so it is a hard source break for every merchant on the next recompile. The `Kind` discriminator did not prevent either; it was never able to. See §9.2. |
| 7 | `resetAnonymousId()`'s `Boolean` is a documented cross-platform contract iOS cannot honour (returns `true` while the delete can silently fail) | Either make it honest or make it `Void`. |
| 8 | `heightFraction` **throws on Android, clamps on iOS** | Same input, different program. |
| 9 | Equality/`Hashable` split across 8 types (wider than register 9.9 records) | Adding equality later is a behaviour change with an unchanged descriptor — invisible to the ABI gate. |
| 10 | **The on-disk queue row format** | New in this revision. See §5's reliability-tiering item: if purchases are ever to get their own failure budget or drain, the row needs to carry a tier. Changing the format after merchants have rows on disk means writing a migration for a file you cannot inspect. |

---

## 5. P2 / P3 — the long tail

### Demoted by §0(b): share attribution is analytics, not economics

**Android reports `Shared` — and records a `sharing` interaction — when the chooser merely *opened*.** `NativeShare.share()` returns `startActivity(...).isSuccess` (`frak-sdk-ui/.../NativeShare.kt:26`). iOS is now the stricter of the two (`78c96b8` requires a non-nil `activityType`).

No longer a rewards bug — but it does not vanish, it changes shape into a **data-comparability** one, and a nastier one than it looks: Android's inflation is a **user-controllable loop** (open chooser, back, repeat). Any funnel or merchant dashboard built on share counts will show Android outperforming iOS for a reason that is not real, and the gap grows with engagement. Same for `06`'s 9.1 (`.dismissed` reported over a real share): an undercount in analytics, not lost rewards.

> **Fix:** `Intent.createChooser(send, title, pendingIntent.intentSender)` + a receiver reading `EXTRA_CHOSEN_COMPONENT` (API 22+; minSdk is 24). **Complexity: small. Priority: P2.**

### New, promoted by §0(b): purchases and analytics share one reliability tier

`PurchaseSender` and `InteractionSender` are peers in one FIFO with one shared 3-failure cap and one shared backoff key. An analytics row can therefore delay, and (until §3.2b) block, a reward-bearing purchase. If purchases are the money path they deserve a different tier: a separate failure budget, a higher retry ceiling, and ideally their own drain.

This is the architectural version of §3.2 and it is **worth deciding before the queue row format freezes on disk** — see §4 row 10. Fixing §3.2b makes it non-urgent; it does not make it wrong.

### Themes

- **Performance.** Android re-reads and re-parses the whole queue file on every `track()`; no drain coalescing (iOS has it). A warm `WebView` per Activity, warmed eagerly, never released under memory pressure. The eager-JS budget measures under half of a cold share's bytes; on 3G the sheet is lost entirely.
- **Accessibility.** Neither sheet announces itself. TalkBack reads the hidden page behind the Android skeleton. Nothing is stated about Dynamic Type, RTL, or the iOS 15 layout branch (which is visibly wrong, and iOS 15 is the declared floor).
- **Observability, for the merchant.** No correlation id, no delivery signal, no queue-depth accessor, no debug mode. "Did my event arrive?" is unanswerable, and `Success` is returned for events that will never be delivered.
- **Observability, for Frak.** The SDK version header is logged and nothing else — no kill switch, and Android and iOS are indistinguishable on the wire. For a fleet of *frozen binaries*, that is the thing you will wish you had.
- **Testability, for the merchant.** `FrakClient` is a `final` class behind a singleton. No fake, no protocol, no staging mode. A merchant cannot unit-test their own integration.
- **Parity drift with the web SDK.** `FrakContextManager.update()` re-serialises the merchant's whole query (`%20`→`+`, `~`→`%7E`, IDN punycoding) where both native ports deliberately do not — a link built in the app and one built by the same merchant's website byte-differ, and nothing would notice. Plus ≥8 named input divergences across the three hand-ported `queryParams`/`mergeAttribution` implementations, with no shared corpus. `golden-sharing-links.json` remains the highest-leverage un-built artifact in the programme.
- **Android `UrlQuery.kt` has zero direct test coverage** while iOS has `URLQueryTests.swift` — and it carries register 9.2 *plus* an unfiled second bug: Kotlin's `toIntOrNull(16)` accepts a sign, so `%-f` decodes to byte `0xF1` on Android and stays literal on iOS.

---

## 6. `06-open-findings.md` — challenged

The register's **code-level** claims hold up remarkably well. Every load-bearing "Closed" row checkable by reading source is genuinely closed: the ABI dumps are committed and consistent (`PercentEncoding` and both `@InternalFrakApi` version constants really are absent; exactly one synthetic `<init>` survives, on `FrakError`), no public declaration in either Android module carries a default argument, the `SharingResult.Kind`/`FrakError.Kind` wire strings match byte-for-byte across platforms, the backup-rules files and their manifest pointer are gone, and the drain-time foreign-merchant check exists on both platforms. The proof envelope is three-way byte-identical — **verified independently**, including the Kotlin-hex-parse vs Swift-`UUID(uuidString:)` question, confirmed identical for uppercase input too.

Its **numbers, coverage claims, three "closed" rows and its device-testing status** do not hold.

| Claim | Reality |
|---|---|
| ~~`checkDexSizeBudget` … does not exist and never has~~ | **RETRACTED — this row was the audit's own worst error.** The task existed and was deliberately removed in `32836c217`, with a measurement behind it. The audit's `git log -S` returned nothing because the audit ran in a **shallow clone**. The register was right; the audit was wrong. See §10.1. What survives is only that six documents still described the gate as *wired* long after it was retired — a stale-doc finding, not a fabricated-measurement one. |
| "iOS **396** tests in 42 suites"; "Android **451** (321 + 130)" | **473 in 51 suites**, and **514**. Both were already wrong at the register's own last commit. "A real count off the test XML this pass" is not what happened. |
| 9.1 **Closed** | Its fix (`AttributionLedger`, `abandonGrace`, `selfUntilSettled`) was **reverted**; none of those identifiers exist in the tree. The revert is buried mid-paragraph inside a §4 "Closed" bullet. |
| 9.16 **Closed** | The mechanism it describes (`pendingLaunch`/`pendingReports`) is **absent**; the presenter was redesigned instead, with no revert note. |
| 9.13 cites an `AtomicBoolean` fix as the thing that has no regression test | **There is no atomic anywhere in `frak-sdk-ui`.** |
| 9.14 "branch-only" | The branch is on `dev`. The defect is live at `SharingHost.kt:157-161`. A real merchant callback is dropped. |
| 8.2's "1,847 lines with zero coverage" and its per-file figures | **2,083 lines**; five of six per-file figures are wrong. It cites `AttributionLedgerTests` as proof 9.1 is covered — that suite does not exist. |
| **T3 / D2b / README §Status: Android's on-device evidence is "one manual pass"** | **False.** Android has been device-tested since day one (§0a). The register understates it, and has done so long enough that the understatement became a planning input. |
| README §Status: "iOS has had no device or simulator pass at all" | **False since `0c978b1`.** `03-sharing-and-install.md:250` also claims a simulator XCUITest pass while no XCUITest target exists in the repo. |
| §3.7's "303 lines (478 raw)" | 325 / 507. |
| A7's "eighteen twins for fifteen members" | Seventeen for seventeen. |
| A6 / `AGENTS.md` "publishing is broken by Dokka" | Fixed in code; the compass files still say it is broken. |
| 1.2b "dex budget is now part of CI" | One third false (see row 1). |
| "`@InternalFrakApi`'s first and so far only use" | Three sites on Android, two on iOS. |

**One class of problem the prose actively hides:** three rows are marked *closed* or *accepted with rationale* while the thing they describe is absent from the tree (9.1, 9.16, 9.13's atomic). A reader auditing by grep concludes the register is unreliable; a reader auditing by reading concludes the opposite. Both are half right, which is the worst possible state for a document whose purpose is to be trusted *instead of* re-reading the code.

**And the mirror-image problem, new in this revision:** the device-testing rows are wrong in the *other* direction — they understate what has been verified. That is not harmless. `T3`, `D2b` and README §Status were read by this audit as fact and produced a wrong recommendation until the team corrected it. A register that undersells is as expensive as one that oversells.

> **Recommendation:** freeze `06` as a historical register and move the live list to a table with a column for *how the row was last verified* — `read` / `executed` / `on-device` / `asserted` — plus a date. Nearly every wrong claim above is an `asserted` masquerading as an `executed`, or an `on-device` never written down.

---

## 7. What I would actually do

**Week 1 — the gate.**
1. Run `bun run --cwd sdk/android lint` (5 min). Resolve §3.8's unused import either way. *This tells you whether CI means anything.*
2. `setPackage()` on the Android handoff (§2.1). One line, one test.
3. `.rejected → continue` on both platforms, plus `.hold` + drain-time id stamping for null `clientId` (§3.2a/b). Smallest change with the largest purchase-path payoff.
4. Backend merge get-or-create, **proof-gated** (§3.3).
5. Decide `?fmt=`: origin check, or off for the alpha (§2.2). Do not remove the 404 before §3.3 lands.
6. `OnNewIntentProvider` for deep links, and **make the harness assert instead of narrate** (§2.3).
7. Android foreground flush hook (§3.2c). Locale param (§3.4). `guard !lent` (§3.5).
8. Point `SharingSheetStateTest` at loopback (§3.8). Stop calling production from CI.

**Week 2 — the two things the harness cannot currently show you.**
9. **Run the harness as a minified release build** (§3.1) and fix what falls out.
10. **Add a two-destination `NavHost` to the harness** and reproduce §3.6.
11. The readiness-signal fix for the blank sheet (§2.4).
12. The merchant README day (§2.5/§2.6) — dependency snippet, allow-listing, `logLevel`, manifest checklist, a snippet that compiles.

**Before you cut the tag.**
13. Decide §4 items 1–5 and 10. Only irreversible ones on the list.
14. Tag `0.1.0-alpha.1` on both platforms *at the same version*, and make one external consumer build against the **published artifact** — not the composite/path dependency the harnesses use, which masks exactly the failures publishing introduces.
15. Correct `06` T3/D2b and README §Status while the facts are fresh (§6).

**Deliberately deferred, with a README note rather than a fix.** UIKit/ObjC support; theming; the merchant test seam; accessibility beyond "it does not crash"; per-tier queue reliability (§5) unless §4 row 10 forces the format decision now; `golden-sharing-links.json`.

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
| [`delta-f1dc693/regression-sweep.md`](./audit-2026-08-13/delta-f1dc693/regression-sweep.md) | status table | 13 of 16 P0+P1 untouched; every Android P0 open |
| [`delta-f1dc693/abi-parity-and-contract.md`](./audit-2026-08-13/delta-f1dc693/abi-parity-and-contract.md) | 10 | the `SharingResult` break; `/install` grew to 10 iOS-only keys |
| [`delta-f1dc693/ios-install-detection.md`](./audit-2026-08-13/delta-f1dc693/ios-install-detection.md) | 13 | a third `InstallProbe` leak; 330 lines that execute nowhere |

**Not verifiable here:** anything needing a compiler, an emulator, a simulator or a network. No JDK, no Android SDK, no Swift toolchain was available; every claim is source-read. The per-area reports in `audit-2026-08-13/` are as their authors wrote them and have **not** been revised for §0 — where one of them says Android has no device coverage, §0(a) overrides it.

The three checks that would most change this report if executed: the ktlint run (§3.8), a minified release build of the harness (§3.1), and a `NavHost` harness screen (§3.6).

---

## 9. Delta review — `c0a0cec` → `f1dc693`

Twelve commits landed after the first pass: an iOS App Store surface rework (`0e74a65`, `beba204`, `e79484a`, `2537681`), iOS post-install detection (`ec0f7c6`, `5e67088`, `b68f989`, `48d7e2c`), `SharingResult.walletOpened` on Android (`eccb8c2`), and the wallet install page's installed-state UI (`3a8da9b`). ~2000 lines. Three read-only reviews in [`delta-f1dc693/`](./audit-2026-08-13/delta-f1dc693/); 23 new findings.

### 9.1 Net verdict

**No worse, and not meaningfully closer to alpha.** Of the 16 P0+P1 items, **one is half-fixed**, **two are partly mitigated**, and **thirteen are untouched — including every Android P0**. Meanwhile the delta added ~330 lines of new UIKit-gated install machinery that **no test executes anywhere** (`InstallProbeTests.swift:8-11` says so in its own doc comment), and grew the ungated `/install` wire contract from 6 keys to 10.

The week-1 list in §7 — `setPackage()`, `.rejected → continue`, `OnNewIntentProvider`, loopback the test, run ktlint — is about a day of work and none of it was started. That is the whole gap between this tree and a shippable alpha, and the delta spent its 2000 lines elsewhere.

**Closed or partly closed:**

| Prior finding | Status | Proof |
|---|---|---|
| `ios-sharing-sheet` F3 — `teardown()` abandons a session, leaks the `WKWebView` | **Leak half closed** | `SharingPresentation.swift:272` now calls `dispose()` (`48d7e2c`). The no-`onResult` half is open. |
| `ios-sharing-sheet` F6 — `StoreOverlay` reports success it cannot observe | **Half closed** | Default surface moved from fire-and-forget `SKOverlay` to `SKStoreProductViewController`, which observes the load and falls back. But `StoreOverlayInvite` **reproduces F6 verbatim** for merchants who pick the overlay. |
| §2.1 iOS half — custom-scheme handoff is hijackable | **Partly mitigated** | `DefaultFrakClient.swift:378-387` puts a universal-link rung *ahead* of the custom scheme. Android's half — the actual blocker — is untouched. |
| §2.6 — `LSApplicationQueriesSchemes` undocumented | **Partly narrowed** | It now appears in `README.mirror.md`. Once, in a sub-clause, **with no value given** and still no Associated Domains guidance. |

**Explicitly re-checked and still open:** §2.1 Android (`AppLauncher.kt` unchanged), §2.2, §2.3, §2.4, §2.5, §3.1, §3.2 (all three parts), §3.3, §3.4, §3.5 (`warm()` still has no `guard !lent`), §3.6, §3.7, §3.8 — **the unused `StateFlow` import is still at `DefaultFrakClient.kt:39` after 12 more commits and a merge to `dev`**, and `SharingSheetStateTest.kt:43-46` still calls `Frak.initialize` with a Production env — §3.9's `NativeShare` half, §3.10, and all ten §4 rows.

### 9.2 `SharingResult` grew a sixth arm — the predicted break, executed

`eccb8c2` adds `WalletOpened` to a public sealed hierarchy on Android and `.walletOpened` to a public enum on iOS, and edits the committed dump (`frak-sdk-ui.api`). Details and consequences are in §4 row 6, which this commit converted from a prediction into a demonstration.

Three things worth keeping:

- **The `Kind` discriminator did not help, and structurally cannot.** `06`'s A2 narrowed `SharingResult` by adding `Kind` so a merchant matching on `.kind` with an `else` survives. True — and irrelevant to a merchant matching on the *hierarchy*, which is the ergonomic thing to do and what Frak's own harness does.
- **The doc comment predicted its own violation.** `SharingResult.swift:17-18`: *"A `switch` over `Kind` with a `default` survives a new case; an exhaustive `switch` over the result does not."* Written, then triggered five days later.
- **Parity is genuinely correct here**: `"walletOpened"` on both sides, same `significance` integer, `Kind` in the same position. The engineering is fine. The *policy* is the finding.

Free today, because nothing is published. That is the entire argument for deciding §4 before the tag rather than after.

### 9.3 New findings worth acting on

Full set in the delta reports. The ones that change plans:

**High — `InstallProbe` has a third leak the "closed two probe leaks" commit did not close.** `stop()` never invalidates `generation`, so a `start()` suspended across teardown restarts the probe on a released model (`delta-f1dc693/ios-install-detection.md` N1). Alongside it: the foreground observer forks an extra, uncancellable poll chain on every foreground (N2), `scheduleNextPoll` overwrites `poll` without cancelling it, and the probe has **no ceiling** — the shipped code and `03-sharing-and-install.md` disagree about what bounds it (N5). A repeating poll with no ceiling inside a sheet is a battery and lifecycle trap, and 330 of the 399 new lines cannot execute anywhere.

**Medium, and a live shipped bug — the "Open the wallet" CTA points at the App Store.** `3a8da9b` tells the user *"Frak is installed — Open Frak & claim €X"* and the anchor navigates to `apps.apple.com/…/id6759159306`. The `onClick` never calls `preventDefault()`, so `ExternalLink` falls through to the default navigation. It works *inside* the iOS sheet only because `SharingSheetModel.swift:353-366` intercepts any App Store link and re-routes it — **by interception, not by intent**. Opened in Safari, in Tauri, or from any future host, an installed user is sent to the store page for the app they already have. The new test asserts the label and the analytics event, never the `href`.

**Medium — `walletOpened` sits at the top of the significance ladder, so it masks a real share.** `record` keeps the max and `finish` reports `best ?: result`, so a user who taps the store link (wallet already installed → `record(WalletOpened)`, sheet stays open) and *then* actually shares gets `.walletOpened` delivered to the merchant. The share — the highest-value event in the sheet — never reaches `onResult`. Rewards are unaffected (the `sharing` interaction still fires, and per §0(b) that path is analytics anyway), but the merchant's own funnel is wrong. `installStarted` already outranked `shared` before this delta, so the class of defect is older; this raises the ceiling and puts a far more reachable event above the share. Ranking a hand-off above a conversion inverts the business value — and the deeper fix is to stop collapsing a session to one arm at all.

**Medium — `dismiss()` during an in-flight `present()` is a no-op**, so the App Store page appears seconds after the sheet is gone, on a window nothing owns (N3); and a previous load's 5 s deadline settles the *next* load's continuation, so a second store tap within 5 s reports failure (N4).

**Medium — the parity gap widened.** iOS gained four public symbols and one replaced modifier signature — `FrakSharingConfiguration`, `FrakInstallPresentation`, `detectInstall`, `FrakSharingDefaults.install` — with no Android twin and no recorded decision. Android gained one arm iOS already had. `frakSharingSheet(heightFraction:)` was **removed with no deprecated overload**. Register 9.15's list is longer than it was.

**Medium — `/install` is now an iOS-shaped page.** The contract grew from 6 keys to 10 (`probe`, `installed`, `dt`, `via`), all iOS-only: Android has no `InstallProbe` and sends none of them. The page cannot tell an Android binary from a broken iOS one. No version signal was added — and unlike `/sharing`, `/install` does not even carry `sdkVersion`. This is §2.4's frozen-binary risk, made bigger by exactly the amount this delta added. Two independent parsers of the same fragment now exist, and `probe=undeclared` conflates a merchant misconfiguration with an internal race (N9).

**Low but telling — the `LSApplicationQueriesSchemes` diagnostic is silent at the default log level**, and its "warn once" guard covers the wrong statement (`delta-f1dc693/ios-install-detection.md` N8). The delta built a detector for the exact misconfiguration §2.6 is about, and then routed its output into `FrakLogLevel.none`. That is §2.5 item 2 compounding: new diagnostics keep being written into a logger that is off by default.

### 9.4 What this changes about the plan

Nothing in §7 is retired; two things are added and one is reordered.

- **§7 item 13 (decide the §4 ABI list) moves up, above the week-2 block.** The delta demonstrated the cost of deferring it, and each further arm added before the tag makes the decision more expensive to reverse.
- **Add:** bound and cancel `InstallProbe` — ceiling, single poll chain, `generation` invalidated in `stop()` — before any of it runs on a device.
- **Add:** fix the install-page CTA `href` and assert it in the test.
- **Note for §5's reliability tiering / §4 row 10:** `significance` collapsing a session to one arm is now actively losing the share event. Worth deciding alongside the queue-tier question, since both are "the SDK decided what mattered and told the merchant one thing."

---

## 10. Review of `fix/native-sdk-alpha-audit`

The branch's **first four** commits, on top of `f1dc693`: `052e44c` (iOS test), `96024ee` (SDK medium/low correctness), `f6ff19a` (backend + wallet), `d88272d` (docs/register corrections) — 88 files, +1427/−377. **§11 covers the eight that followed.** Eight read-only reviews in [`review-fix-branch/`](./audit-2026-08-13/review-fix-branch/).

**Scope is declared and correct:** the branch takes the **medium/low/nit band only** and says so. Every P0 in §2 is deliberately untouched — `AppLauncher.kt` still has no `setPackage`, `DeepLinkObserver` still reads `activity.intent`. Judge it on its own scope, which is what follows.

**Verdict: mergeable for an alpha.** The work is real and mostly correct. The reservations are (a) three fixes announced as "both platforms" that are Android-only, (b) one genuine regression, (c) one pre-existing security bug the branch walked past while fixing its neighbour, and (d) five claims that shipped with no test.

### 10.1 First, the audit was wrong — and this is the important part

`d88272d` corrects two of this audit's claims, and **it is right on both.**

**`checkDexSizeBudget` existed.** It was deliberately removed in `32836c217` (2026-08-07) because it gated *unminified d8 output*: attributing every class through R8's `mapping.txt` in a minified harness APK put the SDK at 60 KB of executable code against the 479 KB the gate watched, with the gate sitting at 318/384 KB. It was wrong in both directions and was retired with a measurement behind it. **R8 has therefore run**, once, in that commit. §3.1 and §6 are corrected above.

**The cause was mine, and it is worth recording as a method failure rather than a detail.** The audit ran in a worktree cut from a **shallow clone — 11 commits**. `git log -S` and `git blame` were blind past the graft point. I noticed the shallow clone early, and then did not propagate that constraint into the agent briefs: they were told "no toolchain", never "no history". So every finding of the form *"this never happened"* was unfalsifiable by construction, and one of them was asserted as fact in the section of the document whose entire subject is *other people asserting things they had not executed*. That is precisely the failure mode §6 accuses the register of, committed by the audit, in the paragraph making the accusation.

Two corrections to the correction, so the record is exact:

- The reviewers confirmed the audit's error more sharply than the branch does: `32ecd20`, the commit the audit named as the string's sole origin, contains **zero occurrences of it**. The audit did not merely miss a commit; its search could not see the repository.
- **R8 having run is not the same as a minified build being verified to work.** That run measured size. `example/native-android/app/build.gradle.kts:29` is still `isMinifyEnabled = false`, nothing executes a minified build, and no gate keeps it that way. §3.1 stands in that narrowed form and is still worth an afternoon.

The rest of `d88272d` — recounted test numbers with the date they were measured, revert notes on 9.1/9.16, the `AtomicBoolean` correction, README fixes — checks out. Residual doc drift is listed in the per-area reports (`06` still lists the dex budget inside `check`; `09` §5b's `321 KB`→`318 KB` rewrite contradicts the commit that produced the measurement).

### 10.2 What genuinely lands

- **`.rejected → continue`** on **both** platforms, each with a test that pins the property. The purchase queue no longer stalls behind a poison row. This was §3.2b, the highest-value item in the band.
- **Drain-time `clientId` stamping + `.hold`**, both platforms, tested. §3.2a closed.
- **`percentDecode` is now byte-based, rejects a signed escape, and maps `+` to space** — and the reviewer *executed* Node's `URLSearchParams` rather than trusting the commit message: the web reference really does form-decode `+`, `fCtx` is base64url (`-_`, no `+`), `fmt` is a JWT, and native never decodes a fragment. **The riskiest change in the branch is correct.** Register 9.2 and the unfiled signed-escape bug are closed on both platforms.
- **`UrlQueryTest.kt` is new (86 lines)** — the zero-coverage gap on the file carrying 9.2 is closed.
- **Exact-case key match wins**, both platforms, matching the TS, tested on both.
- **The unused `StateFlow` import is gone.** §3.8's first half is resolved.
- **nginx headers** on `/sharing` and `/install` — the semantics claim is accurate and all six are re-declared in both blocks.
- **`bindI18nStore: "added"`** genuinely fixes an English device rendering the French fallback. Note this is *not* §3.4: native still forwards no locale at all, so a German device still gets French. §3.4 remains open.
- Backend: the merge window widening, the `sharingTimestamp` bound, the `isDuplicate` comment, and the `ROLLOUT.md` correction all land mechanically.

### 10.3 What does not fully land

**The one I would fix before merge — the nginx fix is one-sixth applied.** `f6ff19a` re-declared the six security headers in the two blocks the audit named. The same `add_header`-inheritance bug is live in four more blocks of the same file, including the nested `location ~ \.html$` inside `location /` (`apps/wallet/nginx.conf:186-193`) that serves **the SPA's own `index.html`**. That block declares four `add_header` directives — including `X-Content-Type-Options`, so the pattern was half-understood — and therefore drops `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` and COOP. **`wallet.frak.id/` is framable by any origin.** That is a bigger exposure than the finding it was fixing: clickjacking on the wallet itself is worth more than on the sharing sheet. Same fix, four more blocks.

**A regression: the warm WebView is destroyed on every home-press and never rebuilt.** `SharingHost.kt:492-495` trims the pool at `TRIM_MEMORY_UI_HIDDEN`, which is not a pressure signal — it fires whenever the UI goes to background. `SharingWebViewPool.trim()` nulls `pooled` *and* `warmUrl`. Nothing re-warms: `SharingHost` overrides only `onCleared` and `onDestroy`, and the sole `warm()` caller is a `LaunchedEffect` keyed on a `remember`ed value. The KDoc asserts "the next `warm` rebuilds it"; there is no next `warm`. So: open a product screen, press Home, come back, tap Share → cold boot inside the 5 s deadline, and **every subsequent share in that process is cold too**. The guard also skips `RUNNING_LOW`/`RUNNING_CRITICAL`, so it holds the renderer during the foreground pressure the audit's own fix sketch named. Fix: `onStart(owner) { if (warmRequested) warm() }`, and lower the guard.

**Three fixes announced as "both platforms" are Android-only:** `ServerClock` (§3.7), the queue byte cap and custom-data bounds, and `resetAnonymousId` awaiting its purge. `12-alpha-audit-response.md:51` is honest about the first; the commit message is not, and the other two are undisclosed. Each opens a new parity gap on a list (register 9.15) the audit already flagged as growing.

**`ServerClock` is half-built,** and it is the highest-risk new component:
- It adopts any `Date` header above a 2025 floor with **no upper bound** — a proxy sending `Date: 2100` skews every proof for the process. The comment claims "only a date that could plausibly be now is trusted"; only one side is checked.
- It is **not persisted**, so every cold start runs on the device clock until the first response — and the 30-day install proof can be minted in that window.
- Its KDoc cites a "2-minute" merge window that **this same branch changed to 10 minutes**.
- Its only test exercises the class in isolation; nothing pins that `HttpClient` feeds it or `signProof` reads it, and `AnonymousIdStore.kt:46` defaults it, so a mis-wire degrades silently to the device clock.
- The backend half widened the **past** side only: `MAX_FUTURE_SKEW_SECONDS = 60` is untouched. The audit's literal headline — *"a device 61 s **fast** fails every proof"* — is unaddressed server-side, and entirely unaddressed on iOS, which got no `ServerClock`. That is the whole population the fix was for.

**The merge-window widening rests on two justifications the code contradicts.** The bound token is a stateless 60-minute JWT with no replay cache, not the single-use short-lived token the message describes; and a queued retry never consumed the window, because the proof is minted per attempt.

**Five claims shipped with no test:** the byte cap, the data bounds, the 20-row checkpoint, the drain coalescing, `resetAnonymousId`'s await, the `merchantId` UUID check, and `claimArrival`. The 20-row checkpoint is a full file read + rewrite, so a long drain now does ~50 of them — a net performance regression against the audit's own F5.

**Smaller, but each real:** `SharingLinkBuilder.build` returns a bare `null` for a non-http(s) base, contradicting the published `buildLink` contract on both platforms and surfacing to the merchant as "no anonymous id or merchant" — a lie. The new rate-limit test does not import the production module and cannot fail if the registration order changes. `sharingTimestamp` is bounded but `referralTimestamp`, the other half of the same `::int` join, is not. `EXTRA_SUBJECT` and the memory-pressure release are Android-only, so an emailed share now differs by platform. A regression assertion was deleted under a commit message reading only "chore: fix ios sdk test".

### 10.4 One process note

`12-alpha-audit-response.md` says *"Everything medium/low/nit was fixed here."* That is not true of the parity report — F5, F7, F9, F10, F12 and F13 are untouched and absent from its own "deliberately not fixed" table — nor of android-sharing-sheet F7/F8/F9, where the cheap half of each landed and the half that was the finding did not.

This is the same failure the audit committed in §10.1 and the register commits throughout: a summary line that is *directionally* true and *literally* false, written at the moment of most confidence. The cheap fix is the one §6 already recommends — say how each row was verified, and by what. A "fixed" that means "the easy half, on one platform, untested" costs more than an honest "partial", because the next person reads the summary and not the diff.

---

## 11. Rounds 3 and 4 — device runs, then the blocker batch

`fix/native-sdk-alpha-audit` grew from 4 commits to 12. Reviews in [`review-fix-branch/`](./audit-2026-08-13/review-fix-branch/) (8 reports). §10 covered the first four; this covers the rest.

### 11.1 Round 3 — the two things I said would most change this report

`55e3f93f0` committed `isMinifyEnabled = true` + `isShrinkResources = true` on the Android harness and drove it on an RMX3511 (Android 16). `6cd61d665` ran the sheet on an iPhone 15 and declared landscape.

**§3.1 is closed.** Not because R8 ran — it already had — but because the config is now committed, so a minified run is reproducible from a clean checkout. 254 SDK classes reach R8, 23 are shaken out, no `missing_rules.txt`, nothing pasted into the app's rules. **And my specific worry was disproved**: `SharingHost`'s `ViewModelProvider(activity)[SharingViewModel::class.java]` survives — R8 renamed the class to `g01` and it still instantiated, because a `::class.java` literal is *traced*, not resolved by name. The call I named as likeliest casualty was already correct. Note there is still no CI gate; a committed config plus one manual run is not the same as enforcement.

The iOS run falsified the change it was built to falsify (`.onDisappear` does not misfire when a view is merely covered) and produced an unlooked-for second result: one `WebContent` process across every open, so §3.5's missing `lent` guard did not bite. The commit is careful to say that proves the happy path, not the race. Correct — and the guard is still worth adding.

**One challenge back, and it lands.** `6cd61d665` builds its closing thesis on "the Android harness never enables predictive back". That is very likely **wrong**: the harness is `targetSdk = 36` (`example/native-android/app/build.gradle.kts:17`), and predictive back is default-on for apps targeting 35+ — `enableOnBackInvokedCallback` became opt-*out*. So predictive back was on during the run, the gesture-dismiss result is more trustworthy than the commit claims, and nobody should "fix" the manifest. The *defect class* is real regardless — the sweep below found seven other instances.

**The highest-value artifact of the whole audit came out of this round.** `6cd61d665` asked for a sweep of both harness manifests for other quietly-excluded cases; [`harness-blind-spots.md`](./audit-2026-08-13/review-fix-branch/harness-blind-spots.md) delivers it: **19 findings currently unreachable by any amount of device testing with the harnesses as committed**, each with the cheapest change that makes it reachable. Highlights: the entire Java `*Async` interop surface — frozen in the ratified ABI dump — has **zero call sites anywhere outside the SDK's own tests**; `setTrackingEnabled`, `resetAnonymousId` and `Frak.shutdown` have zero call sites under `example/`; `heightFraction` is never called; the `@Composable build()` overload has no call site at all, which is a second barrier to §3.6 beyond the missing `NavHost`. And §2.3's harness log still prints `LogType.SUCCESS` for the failure case. That list, worked cheapest-first, is worth more than any further static audit.

### 11.2 Round 4 — what lands

- **§2.1 on Android: complete.** The wallet rung is package-pinned; the store rung deliberately is not (correct — it is a different app); `ActivityNotFoundException` still falls through.
- **§2.3: fixed for the documented path.** `OnNewIntentProvider` is wired, with the `activity.intent` read kept as fallback.
- **§4 row 1: the cleanest work on the branch.** Exactly the nine reward constructors leave `frak-sdk.api`, source annotations match the dump 1:1, nothing else moved. The `!` is real and free — nothing is published.
- **§3.8: answered, and I was right about the mechanism.** `1cdf7aa99` explains it: **ktlint 1.7 disabled `no-unused-imports` by default** (removing a wrongly-flagged import produces non-compiling code), and 2.0 deletes the rule outright. So the gate was green on exactly the thing four documents credited it with. Re-enabled via `.editorconfig`; it immediately found **two more** genuine unused imports. My finding offered a disjunction — "either CI is red or the lint step is not doing what everyone believes" — and the second horn was correct.
- **§10.3 nginx: complete.** All seven `add_header` sites plus the Dockerfile. `wallet.frak.id/` is no longer framable.
- **§10.3 `TRIM_MEMORY`: the guard is right in both directions now, with four tests.**

### 11.3 §2.2 — I was wrong; the withdrawal is accepted

`388b8c5b3` withdraws my §2.2 (`?fmt=` auto-merge, graded P0 "identity capture by link"). **The withdrawal is correct on the part that matters and I accept it.**

My prescribed fix — bind the merge token to a verifiable origin — **cannot be built for the flow that ships `?fmt=`**. It exists for the in-app-browser escape: a token is minted in Instagram's web view bound to source A, the system browser then creates a *new* id B which redeems it. B does not exist at mint time. Binding the target at mint is impossible by construction; the bearer shape *is* the requirement for bridging two contexts that share no storage.

The severity grade was also too high, and the mechanism I missed is real: `WALLET_CONFLICT` (`IdentityOrchestrator.ts:85-91`, two throw sites, regression-tested) refuses a merge between groups holding *different* wallets, so every onboarded user is already protected. The attacker gains only against a wallet-less victim, scoped to one merchant. **Attribution theft, not identity takeover.** Medium is defensible; P0 was not.

Two things the withdrawal over-narrows, worth keeping at medium: past value migrates, not only future attribution; and the victim is silently locked out of ever binding their own wallet to that id.

### 11.4 The one thing to fix before merge — **fixed before the merge, see §12.1**

**`7a673da17` implements §3.3's fresh-install fix without §3.3's guard, and the result is reachable with two unauthenticated POSTs.**

The audit made the guard a precondition: auto-create the target *only* inside the proof-verified branch. What shipped calls `resolve()` unconditionally (`AnonymousMergeOrchestrator.ts:211-221`), outside any proof branch. Combined with two facts already in the tree:

- `enforceLatchedProof` **fails open for any unlatched id** — proof absent, node not latched, allow (`latchedProof.ts:60-73`). A node that has just been conjured is by definition unlatched.
- **`/user/identity/merge/execute` has no authentication at all** — the handler destructures only `{ body }` (`api/user/identity/merge.ts:63-104`), and `/initiate`'s wallet auth is explicitly optional for anonymous callers (`merge.ts:37-40`).

So: POST `/initiate` with any UUID as `sourceAnonymousId` → get a token; POST `/execute` with that token and a victim's `anonymousId` and no proof → the target is created on demand and folded into the attacker's group. No SDK, no link, no victim device, no interaction. Rate-limited at 20/min.

Two qualifications, so the grade is honest. First — **and this cuts against the audit** — the 404 was never *the* guard: `initiateMerge`'s documented auto-create arm has always folded an arbitrary non-existent `sourceAnonymousId` into a caller's group with no proof. This opens a second door to a room that already had one, and my §3.3 blast-radius framing was incomplete. Second, the prize is bounded by exactly the mechanisms §11.3 credits — `WALLET_CONFLICT` plus merchant scope — so it is attribution theft against wallet-less users, and it needs a *known* anonymousId (122 bits, not enumerable; but it leaks via §2.1's intent path and S11's query string).

Net: **not a P0, but a real regression in this batch**, because it removes the one precondition that made the fix safe. The gate costs native nothing — native signs from day one. Also unraised anywhere: this is now **unauthenticated unbounded record creation**, a DB-growth vector independent of the attribution question.

The commit justifies the omission by pointing at §2.2's withdrawal. That is a different finding on a different trust boundary: §2.2 is about a link reaching a victim's device; this needs no device at all.

### 11.5 Partial closes, and the pattern that keeps recurring

Round 4 repeats round 2's shape: the Android half lands, the iOS half is thinner than announced, and the difference is not always disclosed.

- **§2.3** is fixed only for `Frak.initialize` from `Application.onCreate`. The listener is subscribed solely from `onActivityCreated`, so a merchant initialising from an Activity reproduces the original bug **in silence**. And `Frak.shutdown()` leaves stale `onNewIntent` listeners attached, so a re-`initialize` double-tracks.
- **`compileOnly(androidx.core)`** buys a zero-dependency POM but **breaks R8 for exactly the androidx-free merchant the fallback was written for** — the commit's claim that such an app "falls back" is false under minification. This is the first thing the newly-reproducible minified harness should be pointed at.
- **§4 row 1's iOS twin closes 3 of 9**: two of the five iOS reward types are enums whose cases cannot be `@_spi`'d. The response doc calls this "to match"; it is not.
- **§4 row 3** (retry hint ms vs s) was renamed, not unified. **§4 row 2** is still open and this was the commit to do it in.
- **§10.3's `SharingLinkBuilder.build` bare null: skipped entirely and not listed as skipped.** iOS custom-data bounds: skipped and *dropped from* the disclosure table. One commit-message bullet is simply false — `InstallLinks.swift` is untouched by every commit on the branch.
- `12-alpha-audit-response.md`'s §1 table now contradicts its own §8 on five blocker/high rows, and §3.1 still carries both numbers the branch itself disproved (46%, and "R8 has never run" — the latter still live in `06-open-findings.md:25`, the team's own register repeating a claim the team refuted).

This is the same failure §10.4 named and that §6 accuses the register of, now on its third instance. The fix has not changed: record *how* each row was verified — `read` / `executed` / `on-device` / `asserted` — and let "partial" be a legal status. A branch that closes eleven findings honestly reads better than one that claims fourteen.

---

## 12. Merged — `a6b739770`

`fix/native-sdk-alpha-audit` merged to `dev` as `a6b739770`, 17 commits. Four of them landed **after** §11 was written and answer it directly. Re-verified against merged `dev`.

### 12.1 §11.4 was fixed before the merge

`98d424362 fix(backend): require a proof to create the merge target, not just to merge` implements the guard §3.3 asked for and §11.4 said was missing. Creation is now inside the proven branch; a proofless absent target is `TARGET_NOT_FOUND` again and the route re-declares the 404 (`AnonymousMergeOrchestrator.ts:212-241`).

Two things make this the right shape rather than just a revert. It checks the four real callers and costs each of them nothing — both `MergeSender`s hold the row rather than send proofless, so the native fresh-install path is *always* on the proven branch, and `migrateLegacyIdentity` sends no proof but always targets an id that already exists, because having history is why it is being migrated. And it states the two residuals rather than implying them: `initiateMerge`'s auto-create arm has always had the same shape for `sourceAnonymousId` (the pre-existing door, still open, needs its own decision), and an id that *exists* but has never latched is still foldable without a proof — the documented fail-open of the rollout. Those are the same two qualifications §11.4 raised. Nothing is being papered over.

### 12.2 The other three

- **`39090b0ef` — §3.10 closed.** `FrakSharing(presentingFrom:configuration:onResult:)` gives iOS the UIKit entry point Android has had since the start, as a shell over the existing `SharingPresenter`, so both entry points share one session state machine, one pooled `WKWebView` and one result contract. The framing correction is right too: this was never an Objective-C problem, it was a presentation-API one that locked out UIKit apps written in Swift.
- **`1d557772a` — the harness sweep's cheap half.** Every log line that printed green for something the SDK does not promise is now honest: "queued for delivery (enqueue-then-send)" instead of "tracked successfully" (`TrackingApi`'s own KDoc says a purchase succeeds once *durable*, not once delivered), and Android's `SharingResult.Shared` demoted to INFO "chooser opened", because `NativeShare` returns `startActivity().isSuccess` and the same green line meant two different things per platform.
- **`087231df4` — the blind-spot sweep's standout item, executed.** Sixteen `*Async` methods frozen in `frak-sdk.api` with zero call sites outside the SDK's own Kotlin tests; `JavaInterop.java` now compiles and runs them on an RMX3511. **It found three things no Kotlin call site could have produced** — chiefly that `FrakResult.Failure` is `FrakResult<Nothing>`, so Java sees it raw while `Success` stays generic and a Java merchant must write an unchecked cast. That is the sweep's thesis proven in one commit: the finding was not "untested", it was "unreachable", and reaching it produced new findings immediately.
- **`7b4d7e77c`** brings `06-open-findings.md` back in line with the tree, closing 9.2 and 9.4 among others. Its own diagnosis is the honest one: only one of sixteen commits had touched the register, and it was the third.

### 12.3 Where this leaves the alpha

Of §2's six P0s: **2.1 closed on Android** (`AppLauncher.kt:40`, package-pinned), **2.2 withdrawn** (§11.3), **2.3 closed for the documented path** with the `onActivityCreated`-only gap in §11.5 still open, **2.4 diagnosed precisely and deliberately not fixed** (both candidate designs turn on whether `postVisualStateCallback` fires for a fragment-activated warm document — a device question), **2.5/2.6 partly narrowed**. §3.1 and §3.8 are closed; §3.10 is closed.

What still has no owner: the §4 ABI list (rows 2, 3, 6, 7, 8, 9, 10 — free now, impossible after the first tag), §2.4, §3.4's locale, §3.2c's Android outbox re-drive, and the §11.5 partials. The `12-alpha-audit-response.md` internal contradictions listed in §11.5 were partly addressed by `7b4d7e77c`; the rest are doc hygiene, not risk.

**The most valuable thing to do next is not another audit.** It is the rest of [`harness-blind-spots.md`](./audit-2026-08-13/review-fix-branch/harness-blind-spots.md)'s priority list. `087231df4` took one item off it and found three new defects in an afternoon; eighteen remain, each with the cheapest change that makes it reachable. A finding that no harness can reach is not a finding anyone will fix by reading harder.
