# Native SDK — response to the first-alpha audit

**Date:** 2026-08-13 · **Branch:** `fix/native-sdk-alpha-audit` · **Audit:** [`11-alpha-audit.md`](./11-alpha-audit.md) and [`audit-2026-08-13/`](./audit-2026-08-13/) (branch `audit/native-sdk-alpha`, 198 findings)

Split by the audit's own severity tags. Everything **medium / low / nit** was fixed here, in three
commits. Everything **blocker / high** was verified against the tree and is reported below rather
than changed — those need a decision, a device, or both.

Unlike the audit, this pass had the toolchain: JDK 17, Android SDK, Swift 6.3 / Xcode 26.5, bun.
Every claim below is executed, not read, unless it says otherwise.

**Two of the audit's own headline claims do not survive that.** Both are in its §6 challenge to the
register, and both are the audit being more confident than its evidence allowed:

- *"`checkDexSizeBudget` does not exist and never has — `git log -S` finds no commit."* It existed
  and was deliberately removed in `32836c217` on 2026-08-07, with a measured rationale in the commit
  message. The audit called this "the one place the register reports an *executed measurement* that
  provably did not happen" and said it "contaminates every other verified-this-pass line". The
  measurement happened; the gate was retired afterwards. The register is stale here, not dishonest.
- *"Nothing in this repo has ever run R8."* The same commit ran it — attributing every class through
  `mapping.txt` in a minified `example/native-android` release APK. See §3.1 below for what is left.

Neither refutation makes the audit less useful. It does mean §6's framing — that the register is a
document reporting runs that never occurred — should not be adopted wholesale.

---

## 1. Blocker / high — verified, not fixed

### Confirmed, and the fix is one line — do these first

| # | Finding | Status | The fix |
|---|---|---|---|
| §2.1 | **Android leaks the install proof to any app claiming `frakwallet://`** | **Confirmed.** `AppLauncher.open()` fires a bare `ACTION_VIEW`; `DefaultFrakClient.openFrakApp()` hands it `frakwallet://install?…&p=<30-day bearer proof>` and reports `OpenedApp` on success, so a hijack is invisible | Split `open()` into `openWallet(url, packageId)` (with `setPackage`) and `openStore(url)`. `settings.env.walletPackageId` is already in scope one line up, `<queries>` is already in the manifest. **iOS cannot be fixed this way** — no bundle-id targeting for custom schemes — so iOS needs the handoff moved to a Universal Link on `wallet.frak.id/install`, which already exists as the fallback |
| §3.5 | **iOS `SharingWebViewPool.warm(_:)` has no `lent` guard** | **Confirmed** by reading; not reproducible without a simulator | `guard !lent` in `warm`. One line |
| §3.8a | **Unused `StateFlow` import, "so ktlint/CI must be red"** | **Half confirmed, and the other half is worse.** The import was genuinely unused — I deleted it in commit 1. But `bun run --cwd sdk/android lint` was **green with it present**: ktlint 1.8.0 as configured does not flag unused imports. So CI is not red, and the gate does not do what four documents assume it does | Either accept it and stop citing ktlint as an unused-import gate, or add a rule. Worth 20 minutes: this is the finding that "validates or invalidates every *the suite is green* claim", and the answer is that the suite is green *and* the gate is weaker than advertised |
| §3.8b | **A unit test initialises the real SDK against production** | **Confirmed.** `SharingSheetStateTest.@Before` calls `Frak.initialize(context, FrakConfig.Builder(uuid).build())`; `frakConfig()` in `SharingInputFixtures.kt:58` sets no environment, so it defaults to `Production` and `initialize` starts a live config resolve to `https://backend.frak.id`. Every CI run and every local `bun run --cwd sdk/android test` does this. No `shutdown()` in `@After` | Point the fixture at `FrakEnvironment.Custom` on loopback (already allowlisted) — two lines — and add the `Frak.resetForTesting()` seam `T2` has been asking for |
| §4.3 | **Retry hint is milliseconds on Android, seconds on iOS** | **Confirmed** (`FrakError.BackingOff(retryAfterMillis)` vs `.backingOff(retryAfter:)`) | Free to fix before the first tag, impossible after |

### Confirmed, needs a decision (not a patch)

| # | Finding | Assessment |
|---|---|---|
| §2.2 | **Inbound `?fmt=` merge is auto-executed with no origin check** | **Confirmed.** `handleReferralLink` signs and queues a merge for any token on any inbound link, with no user interaction. Note the interaction the audit flags: `TARGET_NOT_FOUND` is currently limiting the blast radius, so **§3.3 must not land without a proof gate**. Widening the `frak-merge-v1` window to 10 min (commit 2) does not change this — the token still binds the proof. The real options are unchanged: bind the token to a verifiable origin, require a confirmation, or turn `?fmt=` off for the alpha. The README already says the flow is unsupported until `ROLLOUT-STEP-3`, so turning it off costs nothing |
| §2.3 | **`DeepLinkHandling.Automatic` misses every warm-start referral** | **Confirmed by reading**, and I did not fix it because the fix has a shape choice: `OnNewIntentProvider.addOnNewIntentListener` (androidx, correct, but assumes `ComponentActivity`) versus documenting `setIntent()`. I did the documentation half — `sdk/android/README.md` now tells merchants to call `setIntent(intent)` — and left the SDK-side listener to you. The harness's `onNewIntent` still prints a green SUCCESS line for the failing path; **that is the highest-value thing in this whole audit to fix**, because it is what made the defect survive months of device testing |
| §2.4 | **A page that loads but never renders leaves the sheet blank forever** | **Confirmed.** Also confirmed the sibling point: the native↔web contract has no gate. I did not add a `ready` action because it is a wallet-side + SDK-side protocol change on the one surface with a frozen-binary consumer. Note commit 1 removed the retry ladder's dead cache-only rung, so the deadline now has ~900 ms more headroom, which narrows but does not close this |
| §3.1 | **"Nothing in this repo has ever run R8"** | **Refuted.** `32836c217` (2026-08-07) attributed every class through R8's `mapping.txt` in a **minified `example/native-android` release APK** — that measurement is why the dex budget was deleted, and it found the SDK lands as 60 KB of executable code with R8 shaking out 46% of its classes. So R8 has run, once, and the empty `consumer-rules.pro` survived it. What is still true and still worth doing: the harness's *committed* config is `isMinifyEnabled = false` (`app/build.gradle.kts:29`), so no R8 run is reproducible from a clean checkout, and `SharingHost.kt`'s `ViewModelProvider(activity)[SharingViewModel::class.java]` is reflective and was never exercised through a minified sheet |
| §3.2c | **Android never re-drives the outbox** | **Confirmed, and partly mitigated.** Commit 1 fixed §3.2a and §3.2b (stamping and `continue`), so a stalled queue no longer blocks purchases — but there is still no foreground hook, so a purchase tracked in a tunnel waits for the next `track()` or process restart. `ProcessLifecycleOwner` costs a new `androidx.lifecycle-process` dependency on `:frak-sdk`, which is currently dependency-free apart from coroutines. **That is the decision**, not the code |
| §3.3 | **Backend `merge/execute` 404s on a fresh install** | **Confirmed.** I did not implement the proof-gated get-or-create because it is the load-bearing security change in the audit and it must land with §2.2, not before it. The sequencing the audit gives is right, including moving `markProofSeen` after `findGroupByIdentity` |
| §3.6 | **The Compose build site orphans a live sheet** | **Confirmed by reading** — `FrakSharing.kt:96` is a literally empty `onDispose { }` against an Activity-scoped host. Unreachable in the harness. Fixing it blind risks re-introducing `07` §2.1's opposite bug (a torn-down sheet that never reports), so this wants the two-destination `NavHost` harness screen first |
| §3.7 | **Clock assumptions** | **Confirmed, and half fixed.** Commit 1 adds `ServerClock` on Android: proofs are now stamped from the backend's `Date` header. Commit 2 widens `frak-merge-v1` from 2 to 10 minutes server-side, which helps every client. **iOS still stamps from the device clock** — porting `ServerClock` to `HTTPClient`/`AnonymousIdStore` is the remaining half and is mechanical |
| §3.9 | **iOS `NativeShare.share` can suspend forever; `teardown()` abandons a live session** | **Second half fixed** (commit 1: `.onDisappear` now reports before tearing down, and `share()`/`copy()` refuse to run after the tier-3 fallback). **First half not fixed**: restoring an escape hatch for a refused presentation needs the simulator to tell a refusal from a slow presentation |
| §3.10 | **UIKit/ObjC merchants cannot use `FrakSDKUI`** | **Confirmed** — no `@objc` anywhere. This is a scoping decision, and the audit's ask is that it be *stated*. Not stated yet; say it in `README.mirror.md` before a merchant finds out in week two |
| §4 (all) | **The irreversibility list** | Row 1 (reward models keep public constructors) is **deliberate and documented** in `sdk/android/README.md` — a merchant builds one for a `@Preview` or a fake, and `PublicSurfaceTest` pins it. Making them `internal` would also make merchant-dx F10 (no test seam) strictly worse. **This is a decision for you, not a defect**, and it has to be made before the first tag. Same for rows 2, 5, 6, 7, 8, 9 and 10 |

### Confirmed, fixed anyway (cheap, and the fix was unambiguous)

Four `high`-severity findings were closed in passing because the fix was a one-liner with no design
content: the unused `StateFlow` import (§3.8a), §3.2's `.rejected → continue` and null-`clientId`
stamping on **both** platforms, the `?fmt=`/`fCtx` percent-decoding divergence, and
`FrakSharingSheet`'s abandoned session. See commit 1.

---

## 2. Medium / low / nit — fixed

Three commits, grouped by surface. Every one of them is green under the repo's own gates:
`bun run format && bun run lint && bun run typecheck && bun run test` (5587 tests),
`bun run --cwd sdk/android check` (536 tests), `bun run --cwd sdk/ios test` (495 tests),
`bun run --cwd sdk/{android,ios} lint`, `bun run lint:comments`, and `apiCheck` with no ABI diff.

1. **`fix(sdk)`** — delivery, identity, URL handling and both sharing sheets.
2. **`fix(backend,wallet)`** — proof window, rate-limit accounting, nginx security headers, i18n.
3. **`docs`** — the register, the compass files, both merchant READMEs, and four CI/tooling gaps.

### Deliberately not fixed, with reasons

| Finding | Why not |
|---|---|
| android-core F12 — reward models' public constructors | See §4 row 1 above. Documented decision, needs yours |
| ios-core F6 — unbounded peak memory on a response read | The streaming-delegate fix is easy to get subtly wrong (`URLSession.data(for:delegate:)` accumulates internally) and cannot be verified here. The origin is ours, redirects are blocked, both caps still reject the body before a caller sees it |
| ios-sharing-sheet F5 — the iOS 15 layout branch is visibly wrong | Product decision: raise the floor to iOS 16 and delete both fallback branches, or fix the branch |
| ios-sharing-sheet F6 — `StoreOverlay` reports success it cannot observe | Needs an `SKOverlayDelegate` and a device to distinguish "silent" from "failed". Fixing it blind risks double-acting (banner *and* store handoff) |
| ios-sharing-sheet F12 — `.onChange` ordering against `pendingRequest` | Undefined-by-construction, but the refactor changes the public modifier's shape. Low severity, high blast radius |
| android-sharing-sheet F5 — the native share payload is a bare URL | Needs `SharingView` to put `text`/`imageUrl` on the result URL first; cross-surface, and the sheet is the one place with no device evidence. `EXTRA_SUBJECT` was added in commit 1 as the free half |
| android-sharing-sheet F15 — chrome pinned light, page free to go dark | Product decision: does the sheet follow system dark mode or not? |
| security-privacy F5/F6/F9/F11 | Each is a design change (move `clientId` out of the query; clear web-view data on consent withdrawal; defer the eager resolve; StrongBox + key-invalidation recovery). All confirmed, none mechanical |
| security-privacy F13 — `frak-sdk-ui` logs outside the merchant's logger | Needs an `@InternalFrakApi` accessor for the configured `FrakLogger` across the module boundary, i.e. new ABI surface. Note commit 1 *added* two more `Log.w` call sites, so this got marginally worse before it gets better |
| merchant-dx F10/F11/F15 — test seam, theming, install-handoff docs | The audit itself defers these with a README note. Agreed |
| build-release F8 — pin the Gradle distribution checksum | I could not obtain the authentic SHA-256 for `gradle-9.5.0-bin.zip` from this machine, and guessing one bricks every build. Did the other half instead: `validate-wrappers: true` on both workflows |

---

## 3. What I would ask for next

**Two things need a device, and you have both to hand.**


1. **Android, one run:** flip `example/native-android/app/build.gradle.kts` to
   `isMinifyEnabled = true` with R8 full mode, install, and drive initialize → warm → present →
   share → install handoff. R8 has been run against this harness once (`32836c217`), but for a size
   measurement, not through the sharing sheet — and the config was not kept. Whatever falls out is a
   field crash that would otherwise ship. Consider committing the minified variant this time. (§3.1)
2. **iOS, one run:** the sheet, twice — once shared, once navigated away from mid-sheet. Commit 1
   changed `.onDisappear` to report before tearing down, which is the one change in this branch
   that could plausibly misfire (a `NavigationStack` push fires `onDisappear` too). If a push
   produces a spurious `.dismissed`, tell me and I will gate it on a real teardown instead.

**One thing needs 20 minutes and no device:** decide whether `?fmt=` ships in the alpha at all
(§2.2). It gates §3.3, which gates the merge flow working on a fresh install.
