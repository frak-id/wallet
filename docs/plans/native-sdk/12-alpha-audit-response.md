# Native SDK — response to the first-alpha audit

**Date:** 2026-08-13 · **Branch:** `fix/native-sdk-alpha-audit` · **Audit:** [`11-alpha-audit.md`](./11-alpha-audit.md) and [`audit-2026-08-13/`](./audit-2026-08-13/) (branch `audit/native-sdk-alpha`, 198 findings)

Split by the audit's own severity tags. **Most** of the medium / low / nit band was fixed here;
§2.1 lists every row in that band that was not, because an earlier draft of this document claimed
the band was closed and that was false. Everything **blocker / high** was verified against the tree
and is reported below rather than changed — those need a decision, a device, or both.

Each fixed row carries how it was verified: **executed** (a test or a command proves it),
**device** (driven on real hardware), or **read** (inspection only). A fix that means "the easy
half, one platform, untested" is worse than an honest "partial", because the next reader reads the
summary and not the diff.

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

## 0. Decisions taken (2026-08-13)

Three of the audit's blocker/high rows are resolved by a decision rather than a patch. Recorded here
because each one changes what the rows below are worth.

**`?fmt=` ships in the alpha.** So §3.3 stops being optional: `merge/execute` 404s on a fresh
install today, and the flow shipping means the get-or-create has to land, with the proof gate, in
the order the audit gives. §2.2 was investigated properly as part of that and **dropped** — see §7.

**§2.1's install-proof leak is not a leak.** The proof is a signature over the anonymous id. Anyone
who intercepts it can verify that this anonymous id produced it; nobody can forge one for an
anonymous id they do not hold the key for. That is the design working, not failing, and the audit
graded it as a secret when it is a public attestation. **Downgraded from blocker.**

One residual worth a sentence, because it is a different failure than the one graded: the proof is
single-use server-side, so a hostile app that claims `frakwallet://` first can *consume* it. That
costs the user their install attribution, silently — `openFrakApp` reports `OpenedApp` either way.
That is an attribution-integrity bug, not a confidentiality one, and `setPackage` still fixes it for
one line. Left to you at that severity.

**`SharingSheetStateTest` hitting production is acceptable.** The backend absorbs the load. Noted so
the next reader does not re-file it: the row stays open in the audit and is closed here by decision.

---

## 1. Blocker / high — verified, not fixed

### Confirmed, and the fix is one line — do these first

| # | Finding | Status | The fix |
|---|---|---|---|
| §2.1 | ~~**Android leaks the install proof**~~ **— downgraded, see §0.** The remaining bug is attribution theft, not disclosure | **Confirmed as behaviour.** `AppLauncher.open()` fires a bare `ACTION_VIEW`; `DefaultFrakClient.openFrakApp()` hands it `frakwallet://install?…&p=<30-day bearer proof>` and reports `OpenedApp` on success, so a hijack is invisible | Split `open()` into `openWallet(url, packageId)` (with `setPackage`) and `openStore(url)`. `settings.env.walletPackageId` is already in scope one line up, `<queries>` is already in the manifest. **iOS cannot be fixed this way** — no bundle-id targeting for custom schemes — so iOS needs the handoff moved to a Universal Link on `wallet.frak.id/install`, which already exists as the fallback |
| §3.5 | **iOS `SharingWebViewPool.warm(_:)` has no `lent` guard** | **Confirmed** by reading; not reproducible without a simulator | `guard !lent` in `warm`. One line |
| §3.8a | **Unused `StateFlow` import, "so ktlint/CI must be red"** | **Half confirmed, and the other half is worse.** The import was genuinely unused — I deleted it in commit 1. But `bun run --cwd sdk/android lint` was **green with it present**: ktlint 1.8.0 as configured does not flag unused imports. So CI is not red, and the gate does not do what four documents assume it does | **Done — rule enabled.** ktlint 1.7 turned `no-unused-imports` **off by default** (too many false positives when auto-removing) and 2.0 deletes it, so it is now opt-in via `ktlint_standard_no-unused-imports = enabled` in both `.editorconfig` files. Surface across the whole tree: **two**, both in tests, both genuine. **iOS has no equivalent and cannot cheaply get one** — `swift-format` ships 43 rules and none of them is unused-import (`OrderedImports` is the closest), and SwiftLint's `unused_import` is an *analyzer* rule needing a compiler log. So the gate exists on Android only, and this document is now the place that says so |
| §3.8b | **A unit test initialises the real SDK against production** | **Confirmed, and accepted** — see §0. **Confirmed.** `SharingSheetStateTest.@Before` calls `Frak.initialize(context, FrakConfig.Builder(uuid).build())`; `frakConfig()` in `SharingInputFixtures.kt:58` sets no environment, so it defaults to `Production` and `initialize` starts a live config resolve to `https://backend.frak.id`. Every CI run and every local `bun run --cwd sdk/android test` does this. No `shutdown()` in `@After` | Point the fixture at `FrakEnvironment.Custom` on loopback (already allowlisted) — two lines — and add the `Frak.resetForTesting()` seam `T2` has been asking for |
| §4.3 | **Retry hint is milliseconds on Android, seconds on iOS** | **Confirmed** (`FrakError.BackingOff(retryAfterMillis)` vs `.backingOff(retryAfter:)`) | Free to fix before the first tag, impossible after |

### Confirmed, needs a decision (not a patch)

| # | Finding | Assessment |
|---|---|---|
| §2.2 | **Inbound `?fmt=` merge is auto-executed with no origin check** | **Behaviour confirmed, severity rejected, recommendation withdrawn — see §7.** The audit's fix ("bind the token to a verifiable origin") cannot be built for the flow that uses this, and the blast radius is bounded by two mechanisms the audit did not account for |
| §2.3 | **`DeepLinkHandling.Automatic` misses every warm-start referral** | **Confirmed by reading**, and I did not fix it because the fix has a shape choice: `OnNewIntentProvider.addOnNewIntentListener` (androidx, correct, but assumes `ComponentActivity`) versus documenting `setIntent()`. I did the documentation half — `sdk/android/README.md` now tells merchants to call `setIntent(intent)` — and left the SDK-side listener to you. The harness's `onNewIntent` still prints a green SUCCESS line for the failing path; **that is the highest-value thing in this whole audit to fix**, because it is what made the defect survive months of device testing |
| §2.4 | **A page that loads but never renders leaves the sheet blank forever** | **Confirmed.** Also confirmed the sibling point: the native↔web contract has no gate. I did not add a `ready` action because it is a wallet-side + SDK-side protocol change on the one surface with a frozen-binary consumer. Note commit 1 removed the retry ladder's dead cache-only rung, so the deadline now has ~900 ms more headroom, which narrows but does not close this |
| §3.1 | **"Nothing in this repo has ever run R8"** | **Refuted, and now closed.** Run on a device 2026-08-13 (see §4). **Refuted before that too:** `32836c217` (2026-08-07) attributed every class through R8's `mapping.txt` in a **minified `example/native-android` release APK** — that measurement is why the dex budget was deleted, and it found the SDK lands as 60 KB of executable code with R8 shaking out 46% of its classes. So R8 has run, once, and the empty `consumer-rules.pro` survived it. What is still true and still worth doing: the harness's *committed* config is `isMinifyEnabled = false` (`app/build.gradle.kts:29`), so no R8 run is reproducible from a clean checkout, and `SharingHost.kt`'s `ViewModelProvider(activity)[SharingViewModel::class.java]` is reflective and was never exercised through a minified sheet |
| §3.2c | **Android never re-drives the outbox** | **Confirmed, and partly mitigated.** Commit 1 fixed §3.2a and §3.2b (stamping and `continue`), so a stalled queue no longer blocks purchases — but there is still no foreground hook, so a purchase tracked in a tunnel waits for the next `track()` or process restart. `ProcessLifecycleOwner` costs a new `androidx.lifecycle-process` dependency on `:frak-sdk`, which is currently dependency-free apart from coroutines. **That is the decision**, not the code |
| §3.3 | **Backend `merge/execute` 404s on a fresh install** | **Confirmed and fixed.** The audit's sequencing warning was predicated on §2.2 being a live escalation; §7 shows it is not, so the get-or-create lands on its own |
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

## 2. Medium / low / nit

Three commits, grouped by surface. Every one of them is green under the repo's own gates:
`bun run format && bun run lint && bun run typecheck && bun run test` (5587 tests),
`bun run --cwd sdk/android check` (536 tests), `bun run --cwd sdk/ios test` (495 tests),
`bun run --cwd sdk/{android,ios} lint`, `bun run lint:comments`, and `apiCheck` with no ABI diff.

1. **`fix(sdk)`** — delivery, identity, URL handling and both sharing sheets.
2. **`fix(backend,wallet)`** — proof window, rate-limit accounting, nginx security headers, i18n.
3. **`docs`** — the register, the compass files, both merchant READMEs, and four CI/tooling gaps.

### 2.1 Not fixed — the honest list

Corrected after review. Three items were announced as "both platforms" and are **Android-only**;
six parity rows were in scope and went unmentioned.

| Row | State | Why |
|---|---|---|
| parity F5 — base64url strictness: a one-char `fCtx` corruption decodes on web, is dropped on native | **Not fixed** | Native is the stricter one. Loosening it to match web means accepting a payload we know is corrupt; the right direction is tightening web, which is not this branch |
| parity F7 — the only uppercase-UUID vector sits on an op both native suites skip | **Not fixed** | A test-vector gap, not a defect. Belongs with the golden-proof work |
| parity F9 — `/sharing` + `/install` param asymmetry | **Not fixed** | Needs the wallet side to agree on the canonical set first |
| parity F10 — `--frak-host-*` CSS vars are three hand-mirrored literals, and iOS leans on the TS fallbacks | **Not fixed** | The fix is a shared source of truth, which is a build-step change |
| parity F12 — `?fmt=` read case-insensitively on native, case-sensitively on web | **Fixed** (executed) | `getExact`/`exactValue` added on both platforms, with tests. `fCtx` keeps the case-insensitive fallback, which *is* the web behaviour; `fmt` authorises a merge, so it now matches web or not at all |
| parity F13 — the iOS App Store link ignores the environment; Android's Play link does not | **Not fixed, and should not be** | There is exactly one App Store listing (`id6759159306`); no development listing exists to point at. Android's Play URL for `id.frak.wallet.dev` is equally unresolvable. Documented rather than faked |
| `ServerClock` | **Android only** | Announced as a clock fix; iOS still stamps proofs from the device clock. The backend's ±60 s *future* bound is the tight one, and widening the merge window to 10 min bought slack on the past side only — so a fast iOS device still signs proofs the server rejects. This is the largest remaining gap in the band |
| Queue byte cap (`MAX_BYTES`) | **Android only** | iOS has the row cap but no byte budget |
| `resetAnonymousId` awaiting `purge()` | **Fixed on both** (executed) | Was Android-only; iOS detached it in a `Task`, so a caller that reset and then read was told the queue was clear when it was not |

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


1. ~~**Android, one run.**~~ **Done — see §4.**
2. ~~**iOS, one run.**~~ **Done — see §5.**

~~**One thing needs 20 minutes and no device.**~~ Decided: `?fmt=` ships, §3.3 is done, and §2.2 is
withdrawn (§7).


---

## 4. Device run — Android under R8 (2026-08-13)

§3.1 is closed. `example/native-android`'s `release` variant is now `isMinifyEnabled = true` +
`isShrinkResources = true`, debug-signed so `installRelease` works without a keystore, and that
config is **committed** — the point of the finding was that no R8 run was reproducible from a clean
checkout, and a run that is not committed does not fix that.

Built, installed on a physical RMX3511 (Android 16, arm64), and driven through the full harness:
initialize → wallet probe → `config.resolve` → `rewards.best` → track → **sharing sheet** → share →
**install handoff with the wallet uninstalled mid-session**.

**Result: clean.** No `AndroidRuntime` fatal, no `ClassNotFoundException`, `NoSuchMethodError`,
`ClassCastException`, `InstantiationException` or `VerifyError` anywhere in 16 500 lines of logcat.
The process survived the whole session. No `missing_rules.txt` — R8 resolved every reference from
the SDK's own consumer rules, with nothing pasted into the app's `proguard-rules.pro`.

What this actually proves, given it is the first time any of it has run minified:

- **The empty `consumer-rules.pro` is correct.** 254 SDK classes reach R8, 23 are shaken out, and
  the surviving 231 are exactly what the harness touches. The file's own warning against a blanket
  `-keep class id.frak.sdk.** { *; }` is now backed by a measurement instead of an argument.
- **`SharingHost`'s reflective ViewModel lookup survives.** The audit flagged
  `ViewModelProvider(activity)[SharingViewModel::class.java]` as the likeliest R8 casualty. R8
  renamed the class to `g01` and it still instantiated — because a `::class.java` literal is traced,
  not resolved by name. The concern was reasonable and the code was already fine.
- **The sharing sheet ran on a device for the first time, in its hardest configuration.** It loaded,
  rendered, shared, and the WebView pool warmed a second sandboxed renderer for the install page
  after the wallet was removed.

Two unrelated things the run surfaced, neither SDK-caused, both cheap:

- The harness never sets `android:enableOnBackInvokedCallback="true"`, so predictive back is off in
  the one app used to validate back-dismissal of the sheet. Worth setting before trusting any
  gesture-dismiss result.
- `W/Parcel: Expecting binder but got null!` and a burst of `tile memory limits exceeded` from
  Chromium under the sheet. Vendor/WebView noise on this SoC, not ours, but it is the shape of thing
  that would be misread as an SDK bug later, so it is written down here.

**Still not covered by this run:** the two-destination `NavHost` case (§3.6 — the empty `onDispose`
cannot be reached from a single-screen harness), and warm-start deep links (§2.3), which need the
`onNewIntent` path fixed before a device run would mean anything.


---

## 5. Device run — iOS on an iPhone 15 (2026-08-13)

First time any of this has run on iOS hardware. Built and installed with real signing, driven
through: the sheet shared, the sheet dismissed by swipe, **the sheet covered rather than closed**,
copy-and-paste, the install handoff, two consecutive opens, backgrounding with the sheet open, and
landscape.

**Result: clean.** One app process for the whole session — no crash, no restart, no jetsam kill.

The two things this run was for:

- **`.onDisappear` does not misfire.** Commit 1 changed it to report the result *before* tearing the
  session down, and the risk was that `onDisappear` also fires when a view is merely covered. It
  does not produce a spurious `.dismissed`: a share reports a share, a swipe-dismiss reports one
  `dismissed`, and covering the sheet reports nothing and leaves it alive. This was the single most
  likely regression in the branch, and it is not one.
- **`SharingWebViewPool` genuinely reuses its renderer.** Our app spawned exactly **one**
  `WebContent` process (pid 1121) across every open, confirmed by attributing every renderer in the
  log to its parent — the other three belong to `SharingUIService`, i.e. the system share sheet, not
  us. So the missing `lent` guard in `warm(_:)` (§3.5) did not bite here. Still worth adding: this
  proves the happy path, not the race.

**The harness could not rotate, and that was the harness.** `Info.plist` was
`UISupportedInterfaceOrientations` = portrait only, so the sheet's safe-area handling in landscape —
the notch-on-the-side case — was untestable in the one app that drives the SDK. Landscape is now
declared and the case passes. This is the same class of gap as Android's missing
`enableOnBackInvokedCallback`: the harness quietly excluded a case, and nobody could see that the
case had never run.

**Still not covered:** warm-start deep links (§2.3), which need the `onNewIntent`/`onOpenURL` path
settled first, and `SKOverlay` (§3.9/F6), which needs a delegate before "silent" can be told from
"failed".


---

## 6. Second review round — what it found, and what it cost

The audit author reviewed this branch (`b9699a685`, §10 of `11-alpha-audit.md`). Three findings
landed; all three are fixed above or below. Recorded here because two of them are mine.

**The nginx fix was one-sixth applied, and the worst instance was the one I did not touch.**
Reproduced against `nginx:1.29.1-alpine` on the real config, before and after:

```
BEFORE          /            all 6 present
                /index.html  MISSING: X-Frame-Options X-XSS-Protection Referrer-Policy
                             Permissions-Policy Cross-Origin-Opener-Policy
                /sharing     all 6 present     ← what the earlier commit fixed
                /sw.js       MISSING: all 6
                /app.css     MISSING: all 6
AFTER           every route  all 6 present
```

One precision the reviewer's write-up did not have: `/` was always fine, because `location ~ \.html$`
matches the request URI and not the resolved file. It is `/index.html` — the same document, reachable
directly — that shipped framable. The exposure is real and the reasoning about `add_header`
inheritance was exactly right.

The fix is `include /etc/nginx/security-headers.conf` at all seven sites rather than a fifth verbatim
copy. Repetition is what caused this: the previous commit's own comment said "keep in step with the
block above", which is a rule no one can follow across six blocks.

**A regression I introduced: the warm WebView died on every home press.** `TRIM_MEMORY_UI_HIDDEN` is
a lifecycle signal, not memory pressure — it fires whenever the UI backgrounds. Worse, the predicate
was wrong in *both* directions: `level >= TRIM_MEMORY_UI_HIDDEN` also silently ignored
`TRIM_MEMORY_RUNNING_LOW` and `RUNNING_CRITICAL`, which are genuine foreground pressure. Now
`isMemoryPressure(level)`, pinned by four tests naming the exact levels. The reviewer's severity call
was right: `present()` does re-warm, so nothing breaks — every share after a home press was simply
cold, against a 5 s deadline.

**The summary overclaimed.** Fixed in §2.1, which now lists every unfixed row in the declared band
and marks the three "both platforms" claims that were Android-only. This was the same failure the
audit's §6 identifies in the register and that the reviewer committed in §10.1: a summary that is
directionally true and literally false, written at peak confidence.

### Their correction to my correction, accepted

R8 having *run* is not a minified build being *verified to work*. That was fair when written; commit
`55e3f93f0` closes it — the harness now ships `isMinifyEnabled = true`, the config is committed, and
it has been driven on a device (§4).

### The root cause of the dex-budget error, from their side

The audit worktree was a **shallow clone of 11 commits**, so `git log -S` could not see past the
graft point. Every "this never happened" finding was unfalsifiable by construction. Worth recording
as a process rule: *an absence claim requires `git log` on a full clone, and the claim should state
which it ran on.*

### Observed and not fixed

`sdk/ios` test `overallDeadlineSpansRetryBackoff` (suite `HTTPClient`) failed once in six runs, then
passed 5/5 on re-run. It asserts `attempts == 1` with a 50 ms deadline against a 100 ms backoff
floor — a 2× wall-clock margin, on a machine that was concurrently running a Gradle build. Not
fixed: I could not reproduce it and therefore do not know whether it failed with 0 attempts or 2,
and the two point at opposite fixes. Named here so the next person to see it has the context.


---

## 7. §2.2 — behaviour confirmed, recommendation withdrawn

The audit grades the inbound `?fmt=` merge as a blocker and asks for the token to be "bound to a
verifiable origin". After tracing the flow end to end: the behaviour is real, the grade is too high,
and **the recommended fix cannot be built.** Recorded at length because the recommendation is
plausible enough that the next reader will otherwise re-derive it.

### The token is a bearer token by design, not by oversight

The flow that uses `?fmt=` is the in-app-browser escape (`InAppBrowserToast`, `Banner`,
`ExplorerDetail`):

1. The user is inside Instagram's web view with anonymous id **A**.
2. The wallet mints a token bound to source **A** and appends `?fmt=` to the URL.
3. The system browser opens that URL, and a **new** anonymous id **B** is created there.
4. **B** redeems the token; A and B merge.

**B does not exist when the token is minted.** Binding the target at mint time — the obvious fix,
and the one this document previously recommended — is impossible for the only flow that ships this.
The two contexts share no storage; bridging them is the entire purpose. `AnonymousMergeService`
signs `sourceGroupId` / `sourceAnonymousId` and nothing about the target, and that is correct.

Native *could* bind, since `openFrakApp` puts the device's anonymous id on the outbound leg. That
would be a native-only fix to a web-shaped problem, on the platform with zero users.

### The blast radius is bounded by two mechanisms the audit does not mention

- **`WALLET_CONFLICT`.** `IdentityOrchestrator.associate()` refuses a merge between two groups that
  both hold a wallet. Every onboarded user is already protected.
- **Anchor direction.** The attacker only *gains* if the merged group anchors on their wallet, which
  requires the victim to be wallet-less. A victim *with* a wallet and an attacker without one means
  the attacker donates their identity to the victim.
- **Merchant scope.** `sourceMerchantId !== merchantId` is a `MERCHANT_MISMATCH`, so a token buys
  attribution at one merchant, not an account.

So the at-risk population is **tracked-but-not-yet-onboarded users**, and the prize is their future
attribution at a single merchant — the users with the least accrued value. Native exposure today is
zero. The attack is phishing-grade to execute and silent when it lands, which is why it is worth
writing down, but it is attribution theft, not the identity takeover the grade implies.

### What is worth doing, when the backend is next open

Neither is urgent and neither needs the SDK:

1. **Make the token single-use.** It is a stateless JWT, so today it is replayable without limit for
   its whole life. Recording redemption bounds one token to one victim.
2. **Cut the 60-minute TTL.** Redemption happens within seconds in the real flow; 2–5 minutes costs
   nothing and shrinks the window by an order of magnitude.

A confirmation prompt is the only robust answer to a bearer token, and it is a product decision, not
a defect fix. **Do not re-file "bind the token to an origin".**


---

## 8. Second work batch — what landed, and the one thing that did not

### Landed

| Row | What changed |
|---|---|
| **§3.3** | `executeMerge` get-or-creates the target through `IdentityOrchestrator.resolve`, which is race-safe (concurrent redemptions contend on the node's unique constraint and the loser rolls its empty group back). `TARGET_NOT_FOUND` is gone. **`markProofSeen` moved after the resolve** — it is a no-op on a missing node, so latching a brand-new id there silently did nothing. Two tests, one of them asserting the call *order* |
| **§2.3** | `DeepLinkObserver` subscribes to `OnNewIntentProvider` instead of re-reading `activity.intent`, which returns the launch intent forever unless the merchant calls `setIntent`. androidx.core is `compileOnly`, so the POM keeps its zero-runtime-dependency promise and an app without androidx degrades to the old path. Four tests |
| **§2.3 (harness)** | The example app called an inbound link `SUCCESS` in `onNewIntent` while asserting SDK handling it could not observe. It now calls `setIntent` and logs what it can actually see. **This is the lie that let the bug survive months of device testing** |
| **§4.3** | iOS `backingOff(retryAfter:)` → `backingOff(retryAfterSeconds:)`. The real finding was internal: the same enum already had `server(retryAfterSeconds:)`, so iOS disagreed with itself |
| **§3.5** | `SharingWebViewPool.warm` guards `!lent`. Warming a lent view navigates the sheet the user is looking at back to the merchant page |
| **§2.1 residual** | `AppLauncher.open` takes a `packageId`. The wallet handoff is pinned; the store link deliberately is not, since choosing is the point. Test pins both halves |
| **§4 row 1** | The nine reward read-model constructors are out of `frak-sdk.api` — verified as a pure nine-line deletion with nothing else moved. iOS's three initialisers got `@_spi(FrakInternal)` to match |
| **iOS 15 layout** | See below |
| **F15 dark mode** | Not a sheet defect. Confirmed with the wallet team and in the tree: there is no `prefers-color-scheme` anywhere in `/sharing` or `/install` either. The sheet's light chrome matches the page it hosts. Whether the *product* gets dark mode is one decision across three surfaces, not an Android sheet bug |

### iOS 15 stays supported, and now looks right

iOS 15 has no `presentationDetents`, so a `.sheet` there is always full height. The fallback shrank
the **content** to `heightFraction` inside that full-height sheet, leaving the page in the top half
and an opaque band of nothing below — and `presentationBackground(.clear)` is 16.4+, so that band
could not even be made transparent.

Now iOS 15 gets a full-height sheet with the page filling it. Same page, no dead space. Given iOS 15
covers 98.2% of devices against iOS 16's 96.2%, raising the floor to delete the branch was the wrong
trade; the branch just needed to degrade honestly.

### §2.4 — investigated, and deliberately **not** fixed

The gap is real and I can name it exactly: `SharingSheetState.onPageReady()` (document-finished)
calls `settleContent()`, which completes the `contentSettled` deferred that `awaitLoadDeadline`
waits on. `onLoadDeadline()` then returns early on `if (pageLoaded)`. So **a document that finishes
and never paints satisfies the tap-to-content budget**, and the sheet stays blank forever. The
machinery to fix it already exists and is unused for this: `pageVisible`, driven by
`postVisualStateCallback`, which is a genuine paint signal.

I implemented the obvious fix — settle on paint, gate the deadline on `pageVisible` — and **reverted
it**, because it broke this, which is deliberate and documented:

> `an activated page is not abandoned to tier 3 when ready never arrives` — "`ready` rides two
> requestAnimationFrames, and a WebView produces no frames until the sheet has attached it and drawn
> it — so on a cold start this is the path that used to raise the chooser over a page that was
> already there."

So paint-as-the-criterion risks tier-3 firing over a page that is on screen and fine, which is a
worse failure than the one being fixed and is exactly the regression that test was added to catch.
The two candidate designs — a short secondary paint grace after document-finished, or treating an
activated warm document as already painted — both turn on whether `postVisualStateCallback`
reliably fires for a fragment-activated warm document, which I cannot answer without a device.

Left open, with the diagnosis recorded, rather than guessed at. §2.4 was in the review band anyway.
