# What the two device runs establish, and whether `12-alpha-audit-response.md` is accurate

**Reviewer area:** device-run claims (`55e3f93f0`, `6cd61d665`) + full audit of `docs/plans/native-sdk/12-alpha-audit-response.md`
**Refs:** `review/alpha-fixes` = `origin/fix/native-sdk-alpha-audit`, tip `6cd61d665`. Audit doc read from the worktree (`audit/native-sdk-alpha` @ `05e456cf2`); all code/doc citations below are read with `git show review/alpha-fixes:<path>` unless stated.
**Constraints honoured:** no JDK / Android SDK / Swift toolchain, no device. Nothing was executed. Every claim below is source-read + cited, or explicitly marked as an unverifiable run assertion.

---

## 0. Headline

Both commits are honest in tone and both are **less closed than their subject lines say**.

1. `55e3f93f0` commits a real, useful config change. It does **not** create a gate — nothing in CI, no script, and no README builds the minified harness, so the "reproducible from a clean checkout" property depends on a reader knowing an undocumented Gradle invocation. §3.1's narrowed form ("*and no gate keeps it that way*") is **half closed**, not closed.
2. The 46% → 9% correction landed in `sdk/AGENTS.md` only, and the **reconciliation the commit message offers is contradicted by `32836c217`'s own commit message** — both figures were measured against the same app. This is a second compass-number error of exactly the family the audit was penalised for. **46% also still stands, uncorrected, in `12-alpha-audit-response.md:47`** — a file the same commit edited, in the same row.
3. `6cd61d665`'s falsification result is real but **does not touch N5**. The observed "covering" case cannot fire the modifier's `.onDisappear` (it is attached to the *host* content, not the sheet); N5 is about the *host* leaving — `NavigationStack` push / tab switch — and the iOS harness has no `NavigationStack`, no `TabView` and no second screen, so N5 is **structurally unreachable in the app that ran**. N5 is *narrowed by nothing*: it is still open.
4. The `lent` guard is still missing — **on both platforms** (`SharingWebViewPool.swift:44`, `SharingWebViewPool.kt:32`). "One `WebContent` process" is not a detector for the race: a re-navigation of the lent view would *also* show exactly one renderer. The commit's caveat ("proves the happy path, not the race") is right; the causal sentence preceding it is a non sequitur.
5. `12-alpha-audit-response.md` has **both of its internal links dangling on this branch** (`11-alpha-audit.md` and `audit-2026-08-13/` do not exist on `review/alpha-fixes`), one row now falsified by the branch's own commit (`:47`), one quantitative claim contradicted by the diff it cites (`:46`, "~900 ms more headroom"), one row that drops the Android half of a cross-platform finding (`:35`), and the blanket medium/low/nit claim (`:5`) that the audit already refuted — plus more unfixed rows than the audit listed.
6. Five separate places on the branch (incl. two compass files) say **iOS device testing started 2026-08-12**, while `6cd61d665` says "**First iOS hardware run of the SDK**" on 2026-08-13. Neither commit reconciles them.

---

## 1. `55e3f93f0` — what the diff proves vs what only the run asserts

### 1.1 What the diff proves (anyone can re-derive, no device)

| Fact | Evidence |
|---|---|
| `release` is minified and resource-shrunk | `example/native-android/app/build.gradle.kts:29-30` — `isMinifyEnabled = true`, `isShrinkResources = true` |
| `installRelease` needs no keystore | `build.gradle.kts:35-37` — `signingConfig = signingConfigs.getByName("debug")` |
| The proguard file the config references exists and is empty of keep rules | `example/native-android/app/proguard-rules.pro` — comment only, no directives |
| Default optimize rules are in play | `build.gradle.kts:31-34` — `proguard-android-optimize.txt` |
| The compass line was edited | `sdk/AGENTS.md:66`, `AGENTS.md:59` |

**Not in the diff, contrary to the audit's own fix sketch:** the audit asked for `isMinifyEnabled = true` **+ full mode** (`11-alpha-audit.md:141`). `android.enableR8.fullMode` is not set in `example/native-android/gradle.properties` or `build.gradle.kts`. AGP 8+ defaults full mode to `true`, so this is probably fine in effect — but it is defaulted, not declared, and nothing in the tree records that the run used full mode.

### 1.2 What only the run asserts (one-time, unreproducible, no artifact in the tree)

Every one of these is an attestation. Nothing was committed that lets a third party check any of them — no `mapping.txt`, no class list, no logcat excerpt, no APK size record:

- clean logcat / 16 500 lines / no `ClassNotFoundException`, `NoSuchMethodError`, `ClassCastException`, `InstantiationException`, `VerifyError`;
- no `missing_rules.txt`;
- **254 SDK classes reach R8, 23 shaken out, 231 survive**;
- `ViewModelProvider(activity)[SharingViewModel::class.java]` survived, R8 renamed the class to `g01`;
- 1.1 MB APK (`sdk/AGENTS.md:66`);
- "the WebView pool warmed a second sandboxed renderer for the install page" (`12-alpha-audit-response.md:134-135`).

Three of these deserve a note beyond "unverifiable":

- **"the surviving 231 are exactly what the harness touches"** (`12-alpha-audit-response.md:126-128`) overstates. R8 keeps what is *reachable*, plus whatever library/consumer keep rules retain — that is a superset of "what the harness touches". The measurement supports "no blanket keep rule was needed"; it does not support "231 = the touched set".
- **"Measured 2026-08-13 driving the full harness on a device"** (`sdk/AGENTS.md:66`) conflates two things. A class count comes from build-time `mapping.txt` attribution; the device run contributes only "and it did not crash". Fine as prose, misleading as provenance — and provenance is the exact thing the audit's §6/§10.4 asked this team to start recording.
- **"the WebView pool warmed a second sandboxed renderer for the install page"** does not map to any code path I can find. `SharingWebViewPool.kt` holds exactly one `pooled` handle (`:20-34`), has no install-specific entry point, and `acquire` only mints a second handle when the pooled one is `lent` or renderer-gone (`:60-66`). Whatever produced a second renderer, it is not "the pool warming one for the install page".

### 1.3 Is there a gate? No.

- **CI never builds the harness.** `.github/workflows/apps.yaml:36-52` — the `paths-filter` has three filters (`ts`, `android`, `ios`); `ts` is `apps/**`, `packages/**`, `sdk/**` minus native; `android` is `sdk/android/**`; `ios` is `sdk/ios/**`. **`example/**` appears in none of them** — a change to `example/native-android` triggers *zero* jobs. No other workflow references `example/native` (checked all nine in `.github/workflows/`).
- **CI's `assembleRelease` is not this.** `apps.yaml:169-170` runs `bun run --cwd sdk/android build` on a two-library project (`sdk/android/settings.gradle.kts` includes `:frak-sdk`, `:frak-sdk-ui` only). Library `assembleRelease` produces AARs; R8 does not run there. The comment at `apps.yaml:113` is accurate about this.
- **No script builds it.** `example/native-android/scripts/run.sh:79` is `./gradlew assembleDebug`, `:89` is `./gradlew installDebug`; `package.json` exposes `start`/`build`/`logs`/`lint`/`format` — all Debug. `example/native-android/README.md:25` documents only `assembleDebug`, and `:45` says "There is no separate typecheck step — `assembleDebug` is it."
- **The one place that names the command is a compass file** (`sdk/AGENTS.md:66`, `./gradlew :app:assembleRelease`), not the harness's own README.

**Verdict on §3.1.** The audit's narrowed form was two clauses: *(i)* a size attribution is not a verified minified build, and *(ii)* no gate keeps it that way.
- (i) is now **satisfied on trust** — a minified build was executed once, by one person, with no artifact; and satisfied **structurally** in that anyone with a JDK + Android SDK can now run `./gradlew :app:assembleRelease` and get the same binary shape. That is a genuine, real improvement over "the config was not committed".
- (ii) is **not satisfied**. There is a committed config and a manual run; there is no gate. Flipping `isMinifyEnabled` back to `false` tomorrow would be caught by nothing. `12-alpha-audit-response.md:110-113` claims closure on exactly the reproducibility axis and never mentions the gate axis, so the doc closes a finding on one of its two clauses.

**Also left stale by this commit, in the file it edited next door:** `example/native-android/app/proguard-rules.pro:3-4` still reads "Referenced by `app/build.gradle.kts` **even though `isMinifyEnabled = false`**, so the file must exist before minification is ever turned on." Minification is on. This is the first file a merchant reads when copying the harness.

### 1.4 The predictive-back note is probably wrong

`12-alpha-audit-response.md:139-141` says: "The harness never sets `android:enableOnBackInvokedCallback="true"`, so predictive back is off." The manifest indeed does not set it (`example/native-android/app/src/main/AndroidManifest.xml` — zero occurrences). But the harness is `targetSdk = 36` (`build.gradle.kts:17`) and the run was on Android 16. Since Android 15 / API 35, predictive back system animations are **enabled by default for apps targeting 35+**; the manifest flag is the *opt-out* (`false`), not the opt-in, at that target. If that is right, predictive back was **on** during the run and the note is backwards — which matters, because the note is the doc's stated reason to distrust any gesture-dismiss result. I cannot execute anything to confirm; flagging it as a claim to check against the platform docs before it is repeated. Either way the run does not report having driven a back-gesture dismissal, so nothing hangs on it yet.

Asymmetry worth naming: the iOS commit **fixed** its harness gap (Info.plist landscape); the Android commit only **wrote its gap down**. Same class of defect, two different dispositions, one commit apart.

---

## 2. The 46% → 9% correction

### 2.1 Where it landed

| File | State on `review/alpha-fixes` |
|---|---|
| `sdk/AGENTS.md:66` | **Corrected.** Carries the new numbers (254 / 23), the date (2026-08-13), the app (`example/native-android`), the APK size, and `no missing_rules.txt`. This is the only file that carries date + app. |
| `AGENTS.md:59` | **Never contained 46%.** It gained a parenthetical ("the harness's `release` variant is minified so R8 is reproducible"). It carries **no** number, **no** date and **no** app. |

So the task's premise — "verify both now carry the date and the app measured" — is **false as stated**: only `sdk/AGENTS.md` does. Root `AGENTS.md` was not a site of the error and did not gain the measurement.

### 2.2 Where 46% still stands

Whole-repo grep for `46%`, `shak(e|en) out`, `60 KB`, `479 KB` across `*.md`/`*.pro`/`*.kts`:

- **`docs/plans/native-sdk/12-alpha-audit-response.md:47`** — "*it found the SDK lands as 60 KB of executable code with R8 shaking out **46%** of its classes*". Stated in the present tense, with no note that the branch's own run measured 9%. **This is the same row `55e3f93f0` edited**: the commit prepended "Refuted, and now closed" to the row and left the number it says it is correcting sitting in the same sentence.
- `docs/plans/native-sdk/06-open-findings.md:26` and `09-android-api-surface.md:716-717` repeat the 60 KB / 479 KB half of the same measurement (no percentage). Not wrong, but see 2.3 — if the percentage from that run is now disowned, the byte figure from the same run inherits the doubt, and nothing re-measured it.

No other file repeats 46%. (Two grep hits in `apps/business` and `apps/shopify` are unrelated CSS/SVG literals.)

### 2.3 The reconciliation is contradicted by the source it cites

`55e3f93f0`'s message: *"the earlier figure was measured against an app that touched less of the surface. Both are real."*

`32836c217`'s message says: *"attributing every class through R8's `mapping.txt` in a **minified `example/native-android` release APK**"* and *"R8 shakes out 46% of the SDK's classes in a merchant build"*.

**Both measurements were taken against `example/native-android`** — the same single harness app, six days apart. The offered explanation ("a different app") is therefore unsupported by the record. Possible real explanations: the two counted different denominators (classes in the AAR vs classes reaching R8), the harness grew materially between 08-07 and 08-13 (it did gain surface — e.g. `eccb8c2`'s `walletOpened`, but not 4× worth), or one of the two numbers is simply wrong. **The branch does not say which**, and it retains the 60 KB figure from the run whose percentage it just disowned.

This is a compass-file number asserted with more confidence than the evidence allows, in a commit whose stated purpose is fixing a compass-file number asserted with more confidence than the evidence allowed. It should be resolved before either figure is repeated again.

### 2.4 Self-contradiction introduced inside `sdk/AGENTS.md`

- `sdk/AGENTS.md:62`: "Android has been device-tested throughout, iOS since 2026-08-12 — but only against `example/native-{android,ios}`, **in debug**, on one screen. **Nothing has run as a minified release build**, against a multi-destination navigation host, or against a published artifact."
- `sdk/AGENTS.md:66` (edited by this commit): "`example/native-android` now ships `isMinifyEnabled = true` … **Measured 2026-08-13 driving the full harness on a device**."

Four lines apart, in one file, in one commit's blast radius. Same drift in `AGENTS.md:59` ("in a debug build … what only R8 does") and in `docs/plans/native-sdk/06-open-findings.md:25` ("**R8 has never run anywhere**" — already wrong before this branch, per the audit's own §10.1 retraction, and doubly wrong now).

---

## 3. `6cd61d665` — does the code support the reported `.onDisappear` observations, and what happens to N5?

### 3.1 The code

`sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift`, `FrakSharingSheetModifier.body(content:)`:

```
:54   .task { await presenter.warm() }
:60   .onAppear { if isPresented { launch() } }
:63   .onDisappear { finish(); presenter.teardown() }
:72   .onChange(of: isPresented) { presenting in presenting ? launch() : finish(onlyIfUnpresented: true) }
:79   .sheet(isPresented: $isPresented, onDismiss: { finish() }) { … }
```

`finish()` → `presenter.finish { onResult(best ?? .dismissed); best = nil }` (`:104-109`), and `SharingPresenter.finish` (`SharingPresentation.swift:247-263`) reports exactly once per session (`phase` machine: `.idle` returns, `.live`/`.reported` report and go `.idle`).

**The critical structural fact: every one of those modifiers is attached to `content` — the merchant's screen — not to the sheet's content.** The sheet's own view (`FrakSharingSheetContent`) carries only `.onAppear { presenter.onPresented() }` (`:146`).

### 3.2 Are the three reported observations consistent with the code?

| Reported | Consistent? | Why |
|---|---|---|
| a share reports a share | Yes | `best` keeps the most significant outcome (`:94-96`); `onDismiss` → `finish()` reports `best` (`:79`) |
| swipe-dismiss reports exactly one `dismissed` | Yes, and it is the phase machine that guarantees it, not the run | `onChange(false)` fires with `onlyIfUnpresented: true` and returns early because `wasPresented` (`SharingPresentation.swift:255`); then `onDismiss` → `finish()` reports once. A second call finds `.idle` and no-ops (`:249-250`) |
| covering the sheet reports nothing, session stays alive | Yes — **and it is nearly vacuous** | The only `.onDisappear` is on the *host*. Presenting a `UIActivityViewController` over the sheet does not remove the host from the hierarchy, so `:63` cannot fire. A non-fullscreen `.sheet` covering the host does not fire it either — if it did, the sheet would tear its own session down at presentation time and the SDK would never have worked at all. |

So: **all three observations are what the code must do.** The run confirms the code; it does not discriminate between hypotheses, because the case that could have discriminated was not run.

### 3.3 The path that can still misfire — N5

`review-fix-branch/urls-sheet-and-parity.md:173-182` (N5) is explicit: `.onDisappear` fires on the **modified content**, and SwiftUI fires it on a **`NavigationStack`/`NavigationView` push of the presenting screen**. Then:

1. `:63` `finish()` reports `best ?? .dismissed` — a `.dismissed` for a sheet the user never dismissed;
2. `presenter.teardown()` (`SharingPresentation.swift:266-280`) disposes the session, reclaims the web view and destroys the pool;
3. **`isPresented` is never set to `false`** — nothing in `finish` or `teardown` writes the binding;
4. on pop, `:60` `.onAppear { if isPresented { launch() } }` starts a **second** session for the same tap, which reports again.

Other hosts that fire `onDisappear` on the covered/left view and are equally untested: a `TabView` tab switch, a `.fullScreenCover` over the host, and — plausibly — a full-screen UIKit modal presented over the host (which is what `StoreProductPageInvite` raises on the install path).

**The harness cannot reach any of them.** `example/native-ios/Sources/FrakExampleiOSApp/FrakExampleApp.swift` contains **no** `NavigationStack`, `NavigationView`, `TabView` or `fullScreenCover` (grepped across `example/native-ios`); the modifier is attached once, at `:232`, on the single scrolling screen. This is the iOS twin of the audit's Android §3.6 note ("unreachable in the harness, which is single-screen with no `NavHost`") — and the audit made *exactly this ask* for iOS: `12-alpha-audit-response.md`'s own pre-run item 2 said "the sheet, **twice** — once shared, **once navigated away from mid-sheet** … a `NavigationStack` push fires `onDisappear` too."

**Verdict: N5 is neither disproved nor narrowed. It is untouched.** The run falsified a *different*, weaker hypothesis (that a `UIActivityViewController` covering the sheet fires the host's `onDisappear`) which the code makes almost impossible anyway. `12-alpha-audit-response.md:99-100` strikes through item 2 as "Done — see §5" although the specific scenario item 2 named was not performed; §5's bullet at `:164-168` ("This was the single most likely regression in the branch, and it is not one") is the strongest claim in either commit and the least supported.

**Fix status:** N5's own fix sketch (gate the `onDisappear` `finish()` on a real teardown, and set `isPresented = false` alongside) is not applied anywhere in `FrakSharingSheet.swift`.

---

## 4. `SharingWebViewPool` — the `lent` guard and what one renderer proves

### 4.1 The guard is still missing. On both platforms.

`sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift:44-59`:

```
:44  func warm(_ url: String) {
:45      guard !destroyed else { return }        ← the only guard
:49      if pooled?.rendererGone == true { warmURL = nil }
:50      guard warmURL != url, let target = URL(string: url) else { return }
:57      view.bind(warmBinding(view, trace: trace))   ← rebinds a LENT view
:58      view.load(target, baseURL: url)              ← re-navigates it
```

Compare `warmView` (`:24`, checks `lent`) and `prepare()` (`:33-34`, checks `pooled == nil`). Audit §3.5 is verbatim correct and **unfixed**. The consequence if it fires is worse than "a reload": `warmBinding` (`:154-163`) carries only `sessionId: warmSessionId` and `onPageReady`/`onLoadFailed` — so the live session's `onAction` and `onOpenExternal` closures are **severed**, and the sheet's page is replaced with the warm page. That is the "~5 s of pulsing skeleton then the raw OS chooser" the audit predicted.

The trigger is a slow warm vs a fast tap: `SharingPresenter.warm()` (`SharingPresentation.swift:168-198`) awaits `client.anonymousId` (`:179`) and `client.config.resolve()` (`:184`) — two network round trips — *before* calling `pool.warm(...)` at `:187`. The owning `.task` (`FrakSharingSheet.swift:54`) is attached to the host and is **not** cancelled when the sheet presents. Tap during those two awaits → `launch` → `acquire` sets `lent = true` → the awaited `warm` resumes onto the lent view.

**The same hole exists on Android and the response doc does not say so.** `sdk/android/.../SharingWebViewPool.kt:32-54`: `warm(url)` checks `destroyed` (`:33`) and renderer-gone, then `handle.bind(WARM_SESSION_ID binding)` (`:41-51`) and `handle.load(url)` (`:54`) on whatever is pooled — no `lent` check, while `warmHandle` (`:22`) and `acquire` (`:60-66`) both consult `lent`. `12-alpha-audit-response.md:35` files §3.5 as an iOS-only one-liner ("`guard !lent` in `warm`. One line"), dropping the Android half — which the reviewers already flagged (`urls-sheet-and-parity.md:198`) and which neither new commit fixed.

### 4.2 One `WebContent` process does not bear on the race

The commit's chain is: *one renderer observed → the missing `lent` guard did not bite.* That inference does not hold, for a mechanical reason: **the race re-navigates the pooled view; it does not create a second one.** WebKit reuses the same `WebContent` process across navigations of one `WKWebView`. Had the race fired during the run, the process count would still have been **exactly one**. The metric chosen cannot distinguish the failure from the success.

What *does* support "it did not bite" is the rest of the run — the sheet loaded, shared, and reported — i.e. the session binding survived. That is real evidence, and it is evidence of the happy path only: it says the two awaits had completed before the tap on every open, which is precisely the ordinary case. The audit's claim is about the **first share of an app session** on a slow network.

So: the commit's conclusion ("still worth adding; this proves the happy path, not the race") is **correct**; the sentence that reaches it ("The app spawned exactly one `WebContent` process … The missing `lent` guard in `warm(_:)` therefore did not bite") is a non sequitur and should not be cited later as evidence about §3.5. The same wording is in `12-alpha-audit-response.md:169-173`.

*(Adjacent, unfiled, low confidence — for whoever adds the guard: `SharingWebViewPool.swift:92-100`, the `release` early-exit sets `lent = false` even on the `view !== pooled` branch, i.e. releasing an unadopted view clears the flag guarding somebody else's borrowed one. Only reachable with two concurrent sessions on one pool, which the presenter's phase machine makes hard; noting it so it is considered while that file is open.)*

---

## 5. Full audit of `docs/plans/native-sdk/12-alpha-audit-response.md`

### 5.1 Broken links — both of them

`:3` links `[11-alpha-audit.md](./11-alpha-audit.md)` and `[audit-2026-08-13/](./audit-2026-08-13/)`.

`git ls-tree -r review/alpha-fixes -- docs/plans/native-sdk` lists `01`–`09`, `12`, `README.md`. **`11-alpha-audit.md` does not exist on this branch, and neither does `audit-2026-08-13/`** (`git cat-file -e review/alpha-fixes:docs/plans/native-sdk/11-alpha-audit.md` → *"exists on disk, but not in 'review/alpha-fixes'"*; the on-disk copies come from the worktree's `audit/native-sdk-alpha` checkout). They are the **only** two `./`-relative links in the file, and both dangle.

Consequences beyond the links: the whole document addresses "§2.1 / §3.5 / §4 row 1 …" section numbers that have no referent on this branch, and `docs/plans/native-sdk/README.md`'s index (`:13-14`) lists `06`/`07` but neither `11` nor `12`, so `12` is unreachable from the plan index too. Whether this is fixed by merge order or by committing the audit alongside, **as this branch stands the response document cannot be read**.

### 5.2 Row-by-row verification

**Accurate (verified against the tree):**

| Claim | Verified |
|---|---|
| `:34` §2.1 confirmed; `walletPackageId` in scope; `<queries>` already in the SDK manifest | `applink/AppLauncher.kt:26` still a bare `Intent(ACTION_VIEW, …)`; `core/DefaultFrakClient.kt:321-335` uses `settings.env.walletScheme` (so `settings.env` is in scope) and `walletPackageId` exists (`ui/SharingSheetState.kt:470`); `frak-sdk/src/main/AndroidManifest.xml` declares `<queries>` for `id.frak.wallet` / `.dev` |
| `:36` §3.8a — the unused import is gone | `DefaultFrakClient.kt` has no `StateFlow` import; the only remaining one (`config/ConfigStore.kt:13`) is used at `:47` |
| `:37` §3.8b still open, `SharingInputFixtures.kt:58` | `frak-sdk-ui/src/test/.../SharingInputFixtures.kt:58` is `frakConfig(...) = FrakConfig.Builder(merchantId).build()` (no env); `SharingSheetStateTest.kt:42-45` `@Before` calls `Frak.initialize`; no `@After` |
| `:38` §4.3 unit divergence persists | `core/FrakError.kt:51-55` `BackingOff(retryAfterMillis: Long)` vs `FrakError.swift:11` `.backingOff(retryAfter: TimeInterval)` |
| `:50` §3.6 `FrakSharing.kt:96` empty `onDispose` | `frak-sdk-ui/.../FrakSharing.kt:96` is literally `onDispose { }` |
| `:51` §3.7 ServerClock Android-only | `net/ServerClock.kt` exists and is wired (`Frak.kt:90`, `HttpClient.kt:40`, `AnonymousIdStore.kt:46`); no Swift equivalent anywhere in `sdk/ios` |
| `:52` §3.9 second half | `FrakSharingSheet.swift:63-66` reports before teardown; `SharingSheetModel.swift:200,220` `guard !fellBack, !closed` on `share()`/`copy()` |
| `:53` §3.10 no `@objc` | zero `@objc` occurrences in `sdk/ios` |
| `:45` §2.3 README half done | `sdk/android/README.md:40` documents `setIntent(intent)` |
| `:90` build-release F8 half done | `validate-wrappers: true` at `apps.yaml:151` and `release-android-sdk.yml:58` |

**Inaccurate or unsupported:**

1. **`:47` — the §3.1 row is now self-falsifying.** It still ends: "*What is still true and still worth doing: the harness's **committed** config is `isMinifyEnabled = false` (`app/build.gradle.kts:29`)*". On this branch `build.gradle.kts:29` is `isMinifyEnabled = true`. The same commit that made it true prepended "Refuted, and now closed" to the row's head and left its tail contradicting the diff two files away. It also still carries the unretracted 46% (see §2.2).
2. **`:46` §2.4 — "commit 1 removed the retry ladder's dead cache-only rung, so the deadline now has **~900 ms more headroom**".** The diff says otherwise. `96024ee38` changed `RETRY_LADDER` from `[Rung(300, cacheOnly=false), Rung(900, cacheOnly=true)]` to `listOf(300L, 900L)` (`SharingWebView.kt:510`). The 900 ms rung was **converted from cache-only to network, not removed** — the ladder still spends 300 + 900 ms of the deadline. What actually changed is the `unreachable` branch: it used to jump to the cache rung (fired undelayed) and now gives up immediately (`SharingWebView.kt:436-444`), which returns the cost of one doomed cache attempt, not 900 ms. The qualitative claim ("narrows but does not close this") stands; the number does not.
3. **`:35` §3.5 is filed as iOS-only.** Android has the identical hole (§4.1 above). The reviewers said so at `urls-sheet-and-parity.md:198`; the row is unchanged.
4. **`:5` "Everything medium/low/nit was fixed here."** False, and more broadly than the audit's §10.4 records. §10.4 names parity F5/F7/F9/F10/F12/F13 and android-sharing-sheet F7/F8/F9; spot-checking the tree, at least these are also untouched and absent from the "deliberately not fixed" table (`:78-90`):
   - **public-api-ergonomics F6 (medium)** — `heightFraction` still `require`s on Android (`FrakSharing.kt:50-59`, throws `IllegalArgumentException`) and still clamps on iOS (`clampedSharingHeightFraction`, `FrakSharingSheet.swift:143`). Also ABI row 8.
   - **parity F5 (medium)** — base64url strictness; `core/Base64Url.kt` untouched by all three fix commits.
   - **parity F10 (low)** — `--frak-host-*` literals still hand-mirrored (`ui/SharingHostStyle.kt:16,19`).
   - **android-sharing-sheet F17 (medium)** — still no test constructing the host layer, while `SharingHost.kt` gained 69 lines in `96024ee38`.
   The five-report severity census (13 reports, ~198 findings) makes the blanket claim unsustainable on its face: `android-core` alone lists six unfixed mediums, `ios-core` five, `merchant-dx` eight.
5. **`:67-70` the green-gates claim** ("5587 tests", "536 tests", "495 tests", `apiCheck` with no ABI diff) is unverifiable here — no toolchain. Recorded as an attestation, not a finding.
6. **`:99-100`** strike out both "what I would ask for next" items as Done. Item 2's stated scenario (navigate away mid-sheet) was not performed (§3.3 above). Striking it hides the one case that was the reason for asking.
7. **`:182-184`** "**Still not covered:** warm-start deep links … and `SKOverlay` (§3.9/F6)". `§3.9` is `NativeShare`/`teardown`; the `StoreOverlay` finding is `ios-sharing-sheet F6`. Minor mis-citation, but it makes the row unfollowable given the dangling links.

**Not verifiable from the tree (fair, but they are assertions):** `:36`'s "ktlint 1.8.0 as configured does not flag unused imports" (needs a run), everything in §4 and §5 marked in §1.2/§3.2 above, and `:88`'s "commit 1 *added* two more `Log.w` call sites" (the file counts are consistent with it — `SharingHost.kt` 2, `SharingHostStyle.kt` 2, `SharingWebView.kt` 1 — but I cannot attribute them to the commit without the toolchain; the diff does add logging to `SharingHost.kt`).

### 5.3 The two new sections (`§4` lines 108-148, `§5` lines 153-184)

Structurally the best-written part of the document: they separate result from inference and both end with an explicit "still not covered". Corrections needed:

- §4 `:110` "§3.1 is closed" → over-claims by one clause (no gate; see §1.3).
- §4 `:126-128` "the surviving 231 are exactly what the harness touches" → overstated (§1.2).
- §4 `:134-135` "the WebView pool warmed a second sandboxed renderer for the install page" → not supported by `SharingWebViewPool.kt` (§1.2).
- §4 `:139-141` predictive back → likely backwards at `targetSdk = 36` (§1.4).
- §5 `:164-168` "`.onDisappear` does not misfire … the single most likely regression in the branch, and it is not one" → the case that could misfire was not run (§3.3). Should read: *the covered-sheet case does not misfire; the host-disappears case (N5) was untestable in this harness.*
- §5 `:169-173` renderer-count → race inference (§4.2).
- §5 `:175-180` "Landscape is now declared and **the case passes**" → the pass criterion is never stated. On iPhone in landscape (compact height), UIKit presents sheets full-screen and `.presentationDetents([.fraction(...)])` (`FrakSharingSheet.swift:230-233`) is not honoured, so "passes" may mean "did not look broken" rather than "the height contract held". Worth stating what was checked.

### 5.4 Doc drift left across the branch by these two commits

| File:line | Says | Contradicted by |
|---|---|---|
| `sdk/AGENTS.md:62` | "in debug … **Nothing has run as a minified release build**" | `sdk/AGENTS.md:66` (same commit) |
| `AGENTS.md:59` | "always … **in a debug build**, on one screen … what only R8 does" | `55e3f93f0` |
| `docs/plans/native-sdk/06-open-findings.md:25` | "**R8 has never run anywhere**" | `32836c217` *and* `55e3f93f0` |
| `example/native-android/app/proguard-rules.pro:3-4` | "even though `isMinifyEnabled = false`" | `build.gradle.kts:29` |
| `12-alpha-audit-response.md:47` | "committed config is `isMinifyEnabled = false`" ; "46%" | `build.gradle.kts:29` ; the run itself |
| `AGENTS.md:59`, `sdk/AGENTS.md:62`, `06-open-findings.md:25`, `sdk/ios/README.md:97`, `03-sharing-and-install.md:252` | "iOS **since 2026-08-12**" (device testing) | `6cd61d665`: "**First iOS hardware run of the SDK**", 2026-08-13 |

The last row is the one to resolve first: `d88272d98` (this branch, 2026-08-13) is what introduced "iOS since 2026-08-12" into the compass files, and it is also the wording of the team correction the audit adopted at its §0(a). One commit later the same branch says that was the first hardware run. Either the 08-12 testing was simulator (in which case five files and one audit correction need the word "simulator") or `6cd61d665`'s first line is wrong. `6cd61d665` touched no compass file, so nothing records an iOS hardware run at all outside `12-alpha-audit-response.md` §5.

---

## 6. What the two runs still do NOT cover

### 6.1 Named by the commits themselves (accurate)
- Android: the two-destination `NavHost` (§3.6 — `FrakSharing.kt:96`'s empty `onDispose` is unreachable single-screen) and warm-start deep links (§2.3).
- iOS: warm-start deep links (§2.3), `SKOverlay`/`StoreOverlay` success reporting (ios-sharing-sheet F6).

### 6.2 Not named, and not covered
- **N5 / host-disappears on iOS** (§3.3) — `NavigationStack` push, tab switch, `.fullScreenCover`, full-screen UIKit modal over the host. The audit's *literal* ask for the iOS run.
- **The §3.5 race, both platforms** (§4) — fast tap during a slow `anonymousId` + `config.resolve`.
- **The audit §10.3 Android regression** — `TRIM_MEMORY_UI_HIDDEN` trims the pool and nothing re-warms, so *press Home → return → tap Share* is cold forever after. The Android run drove a linear happy path and never backgrounded-and-re-shared; the iOS run backgrounded **with the sheet open**, which is a different case. A known, branch-introduced regression survived a full device run because the run's script did not include the one gesture that reproduces it.
- **iOS 15 / pre-16.4 branches** — `project.yml:10-11` declares an iOS 15 floor; an iPhone 15 exercises only the `#available(iOS 16.0/16.4)` arms (`FrakSharingSheet.swift:213,230`). ios-sharing-sheet F5 ("the iOS 15 layout branch is visibly wrong") remains executed nowhere — and landscape is exactly where it would show.
- **iPad** — no `TARGETED_DEVICE_FAMILY` in `project.yml` (Xcode default includes iPad) and no `UISupportedInterfaceOrientations~ipad`; the Slide Over / Split View case named in `SharingSheetChrome`'s own doc (`FrakSharingSheet.swift:224-226`) is untested.
- **Predictive back on Android** (§1.4) — untested either way, and the doc's explanation of why is probably wrong.
- **§2.1 proof leak** — the Android run's install handoff exercised the *store* arm; a hostile app claiming `frakwallet://` is invisible by construction, so a clean run is not evidence.
- **§2.2 `?fmt=` auto-merge, §3.3 backend fresh-install 404, §3.4 locale, §2.4 blank-page deadline, accessibility (both platforms)** — no execution anywhere.
- **§3.2c** — offline/tunnel capture then foreground re-drive on Android; **§3.7** clock skew (both devices had good clocks).
- **build-release F6** — nothing has consumed a published artifact; both runs used the composite build / path dependency, which is exactly what masks publishing failures.
- **No emulator/simulator/instrumented test exists for any of this** (`apps.yaml:107-220`), so none of the above is covered by CI either.

### 6.3 Structural residue
Neither run left an artifact. There is no committed logcat, no `mapping.txt`, no class list, no screenshot, no `xcresult`, no APK size record — so every number in §4 and §5 of the response doc is a one-time observation that cannot be re-derived by anyone, including the author. That is the same evidentiary standard §10.4 of the audit asked this team to stop using ("say how each row was verified, and by what"). The cheap remedy: commit the R8 attribution script/output under `example/native-android/`, and add `assembleRelease` for the harness to `apps.yaml` behind an `example/**` filter — which would also convert §3.1's second clause from "committed config" into an actual gate.

---

## 7. Corrections to the framing I was given

- "Both now carry the date and the app measured" — **no**: only `sdk/AGENTS.md:66` does; root `AGENTS.md:59` carries neither (§2.1).
- "no OTHER document still repeats 46%" — **one does**: `12-alpha-audit-response.md:47`, the file the same commit edited (§2.2).
- The audit's own error count grows by one in the other direction: `06-open-findings.md:25` ("R8 has never run anywhere") is a **team** document that still repeats the claim the team itself refuted in `d88272d98` — the branch corrected `sdk/AGENTS.md` and left the register row.
