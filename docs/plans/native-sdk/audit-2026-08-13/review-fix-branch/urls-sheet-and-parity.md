# URL handling · sharing sheet · cross-platform parity — review of `review/alpha-fixes` (`f1dc693..d88272d`)

Read-only review. Every claim below is from the branch tree (`git show review/alpha-fixes:<path>`),
plus three things I could actually execute here: Node's `URLSearchParams`/`URL` (the web reference the
native fixes now claim to mirror), `bun scripts/check-comments.ts` against a `git archive` of the
branch, and `nginx.conf`. No JDK/Swift, so Kotlin/Swift behaviour is read, not run.

## Verdict

The riskiest change in the branch — `+` → space in `percentDecode` — is **correct**, and I verified
it against the real reference rather than the commit message: `URLSearchParams` form-decodes `+` for
query *and* fragment, the native decoders are single-pass but algorithmically equivalent to the
WHATWG two-pass order, `fCtx` is base64url (`-_`, `Base64Url.kt:8`) and `fmt` is a JWT
(`AnonymousMergeService.ts:38`), so neither can carry a literal `+`; and native never decodes a
fragment at all. Exact-case-wins and the `%-1`/`%+1` hole are genuinely closed on both platforms and
pinned by new tests on both. `SharingLinkBuilder.build`'s http(s) gate is symmetric — but it returns
a bare `null` that **contradicts the published `buildLink` contract on both platforms** and surfaces
to the merchant as "no anonymous id or merchant", which is a lie.

The sheet work is real: the buffered-result fix is correct under double recreation *and* closes a
second case the audit missed. But it is uniformly the cheap half of each finding, and one change is
a net regression: the new `ComponentCallbacks2` destroys the warm WebView at `TRIM_MEMORY_UI_HIDDEN`
— every home-press — and **nothing ever re-warms it**, so the pool silently switches off for the rest
of the process. Three fixes landed on one platform only, opening new parity gaps.

Structurally nothing changed: parity F1 (web re-serialises the whole query) and F2 (no
`golden-sharing-links.json`) are untouched, so this branch's own three-way agreement is still pinned
by hand-mirrored literals in two suites and by nothing shared. `12-alpha-audit-response.md`'s
"Everything **medium / low / nit** was fixed here" is false for the parity report: F5, F7, F9, F10,
F12, F13 are untouched and unlisted in its own "deliberately not fixed" table.

## Fixes that land

- parity F4 (exact-case wins) — Kotlin `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/net/UrlQuery.kt:25-30`, Swift `sdk/ios/Sources/FrakSDK/Net/URLQuery.swift:49-54`; matches `sdk/core/src/utils/url/queryParams.ts:28-37`, pinned `UrlQueryTest.kt:26-30` / `URLQueryTests.swift:25-29` / `queryParams.test.ts:43`.
- parity F3 / register 9.2 (Android truncates non-ASCII to one byte) — now iterates UTF-8 bytes, `UrlQuery.kt:103-131`; pinned `UrlQueryTest.kt:49-57`.
- parity F2 row `%+1`/`%-1` (Kotlin `toIntOrNull(16)` accepted a sign) — two-nibble parse, `UrlQuery.kt:134-142` via `Hex.nibble` (`Hex.kt:44`, made non-private); pinned `UrlQueryTest.kt:37-42`.
- `+` → space, matching `URLSearchParams` — `UrlQuery.kt:120-123`, `URLQuery.swift:99-101`; pinned `UrlQueryTest.kt:44-47`, `URLQueryTests.swift:37-41`.
- android-sharing-sheet F6 / register 9.14 (buffered result dropped across double recreation) — `SharingHost.kt:173-184`; correct, see analysis in *Verified-OK*.
- android-sharing-sheet F11 (nothing insets status bar / cutout at `heightFraction(1f)`) — `FrakSharingSheet.kt:145`.
- android-sharing-sheet F10 (chooser + outbound links launched from app context in a new task) — `SharingSheetState.kt:47,284,437,460-463`, `NativeShare.kt:32`, `SharingHost.kt:317`.
- android-sharing-sheet F12 (zero JS diagnostics) — `SharingWebView.kt:188-191,222,236-243`, gated on the host app's `FLAG_DEBUGGABLE` (the right gate — it is a process-global switch).
- android-sharing-sheet F16 (`copy()` runs once per session) — `SharingSheetState.kt:308-314` (`finally`).
- ios-sharing-sheet F8 (`share()` has no `fellBack` guard) — `SharingSheetModel.swift:200,220`.
- ios-sharing-sheet F13 (pasteboard not `localOnly`) — `NativeShare.swift:55-58`.
- ios-sharing-sheet F3 second half (teardown reports nothing) — `FrakSharingSheet.swift:61-66`; the `dispose()` half was already on `dev` at `f1dc693` (`SharingPresentation.swift:272`), see *Audit claims this branch proves wrong*.
- ios-sharing-sheet F7 partial — pooled view built with a real frame (`SharingWebView.swift:130,154-160`), `isInspectable` in DEBUG (`:141-146`).
- ios-sharing-sheet F9 partial — `.accessibilityAddTraits(.isModal)` (`FrakSharingSheet.swift:136-137`).
- Retry ladder's cache-only rung removed on both platforms — `SharingWebView.kt:437-450`, `SharingWebView.swift:283-296`. The premise checks out: `apps/wallet/nginx.conf:138-149` serves `/sharing` `no-store, no-cache`, so the rung could never answer.
- Return-scheme ASCII filter — `SharingPageUrl.kt:17-20`, pinned `SharingPageUrlTest.kt:26-32`. (Defensive only; see *Audit claims this branch proves wrong*.)
- parity F6 half — `sdk/core/src/context/mergeAttribution.ts:36-40`, `sdk/core/src/types/rpc/displaySharingPage.ts:50-58`.
- One-arrival-per-link claim, identical on both platforms — `DefaultFrakClient.kt:279-283` / `DefaultFrakClient.swift:340-346`, both correctly placed *after* the merge and *after* the self/foreign-merchant guard.

## Fixes that DO NOT fully land

### P1. parity F1 + F2 — the whole reason the three ports drift is untouched; this branch's own fixes are pinned by hand-mirrored literals

- **Claimed in**: 96024ee ("matching `sdk/core/src/utils/url/queryParams.ts`"), `12-alpha-audit-response.md` §2.
- **Reality**: `git ls-tree -r review/alpha-fixes | grep golden` → `golden-context.json`, `golden-proofs.json`, `golden-rewards.json`. **No `golden-sharing-links.json`.** `sdk/core/src/context/frakContext.ts:168-172` still round-trips through `URLSearchParams`/`URL.toString()`; executed here: `new URL("https://acme.example/p?note=hello%20world&tilde=a~b&size=XL")` + `searchParams.set("fCtx",…)` → `https://acme.example/p?note=hello+world&tilde=a%7Eb&size=XL&fCtx=AAAA`. Native emits the merchant's bytes unchanged (`UrlQuery.kt:57-66`, `URLQuery.swift:72-82`).
- **What is still broken**: web and native still emit byte-different share links for identical input (`%20`→`+`, `~`→`%7E`, IDN punycoding, path re-encoding). And the *new* three-way rules landed here — exact-case-wins, `+`→space, byte-wise decode — are asserted independently in `UrlQueryTest.kt`, `URLQueryTests.swift` and `queryParams.test.ts`, with no shared corpus and no compiler link. `UrlQueryTest.kt:7` even claims "Mirrors `URLQueryTests.swift`; the two decoders must agree byte for byte" while the Swift file pins neither `%-1`/`%+f`/`% 1` nor `名%20x`, and neither pins the empty-value or relative-URL rows of F2's table.
- **Residual severity**: high (unchanged from the audit).
- **What to do**: `sdk/core/src/context/fixtures/golden-sharing-links.json` in the `golden-context.json` shape (base URL + context + attribution → exact output string, plus a decode read-back table including `+`, `%2B`, `%-1`, `?fctx=&fCtx=`, `?a=`), consumed by `GoldenFixtures.kt` / `GoldenFixtures.swift` / a TS test. That is the only thing that makes the fixes in this branch stay true.

### P2. parity F5 — base64url strictness divergence, medium, untouched and not declared

- **Claimed in**: `12-alpha-audit-response.md` §2: "Everything **medium / low / nit** was fixed here".
- **Reality**: `sdk/core/src/utils/compression/b64.ts`, `sdk/android/.../core/Base64Url.kt`, `sdk/ios/.../Core/Base64URL.swift` are all byte-identical to `f1dc693` (`git diff f1dc693 review/alpha-fixes -- sdk/core` touches only `mergeAttribution.ts` and `displaySharingPage.ts`). F5 is not in the response doc's "deliberately not fixed" table either.
- **What is still broken**: a one-character mutation of a 50/55-char `fCtx` still resolves on web (`atob` ignores leftover bits) and returns `null` on both native SDKs (`Base64Url.kt:73`, `Base64URL.swift:31`) → an unattributed arrival on native for a link the web page attributes fine. Same for re-added `=` padding or `-`/`_`→`+`/`/`. Note the `+`→space change does *not* alter this (space is rejected exactly as `+` was).
- **Same silent omission**: parity F7 (low), F9 (low, Swift `build` has no `confirmed:`), F10 (low, `--frak-host-*`), F12 (nit, `fmt` case tolerance), F13 (nit, iOS store link ignores `.development`) — all untouched, none in the "not fixed" table.
- **Residual severity**: medium (F5); the rest low/nit but the *claim* is the defect.
- **What to do**: pick a side on F5 and add a `golden-context.json` rejection vector for it; correct §2 of `12-alpha-audit-response.md` to list the six parity rows it did not touch.

### P3. android-sharing-sheet F8 — the release half landed, the "don't warm eagerly" half did not, and the release half regressed (see N1)

- **Claimed in**: 96024ee "releases its warm WebView under memory pressure".
- **Reality**: `SharingWebViewPool.trim()` at `SharingWebViewPool.kt:146-152` (correctly `guard`ed on `lent`/`destroyed`), wired at `SharingHost.kt:490-503`. The audit's other half — "gate the Compose auto-warm behind an explicit opt-in or a reward-available check" — is untouched: `FrakSharing.kt:99` is still an unconditional `LaunchedEffect(sharing) { sharing.warm() }`, still a real `/sharing?state=warm` page load per screen entry, still inflating `sharing_page_preloaded`.
- **Residual severity**: medium, and see **N1** — the release half is currently worse than nothing.
- **What to do**: gate `warm()`; and re-warm on `ON_START` (N1).

### P4. android-sharing-sheet F7 — the pane title is null for exactly the window the audit complained about

- **Claimed in**: 96024ee "announces a pane title and hides the covered page from TalkBack".
- **Reality**: `FrakSharingSheet.kt:151` — `state.session?.shareTitle?.let { paneTitle = it }`. `session` is only set once `SharingSessionBuilder.build` returns (`SharingSessionBuilder.kt:90-95`, `shareTitle = merchant.displayName`), i.e. after the identity read *and* `resolveConfig()`. The audit's scenario is "a TalkBack user opens the sheet and hears nothing" *while the skeleton is up* — which is precisely when `session` is null. On the tier-3/no-page path `shareTitle` is explicitly `null` (`SharingSessionBuilder.kt:79`).
- **What is still broken**: no announcement during the load; no announcement at all when config resolve fails. The `clearAndSetSemantics {}` half (`FrakSharingSheet.kt:163-168`) does land and is a fair substitute for `invisibleToUser()`.
- **Residual severity**: low-medium.
- **What to do**: set `paneTitle` from `request` (the merchant already supplied a title path) or from `appName` at launch, not from the resolved session.

### P5. android-sharing-sheet F9 — `present()` now logs, but the API is still internally inconsistent

- **Claimed in**: 96024ee "logs every `present()` it ignores".
- **Reality**: `SharingHost.kt:273-286` adds a `Log.w`. The audit's actual ask — "consider reporting `Failed(FrakError.…)` instead so the merchant's one callback is still the single source of truth" — is not done. `Refuse` still reports `AlreadyPresenting`; `Ignore` still reports nothing.
- **Residual severity**: low. A merchant with a release build and no logcat still gets absolute silence.
- **What to do**: report a `SharingResult.Failed` on the `Ignore` arm, or document the arm in `FrakSharing`'s KDoc as "no callback by design".

### P6. `SharingLinkBuilder.build` rejecting non-http(s) — symmetric, but silent and contradicts the published contract

- **Claimed in**: 96024ee "`SharingLinkBuilder.build` rejects a non-http(s) base URL".
- **Reality**: **returns null**, both platforms, no throw, no log — `SharingLinkBuilder.kt:22,42-44` and `SharingLinkBuilder.swift:22-27,50-53` (`isWebUrl`/`isWebURL`, both prefix+case-insensitive, behaviourally identical). That null flows into `DefaultFrakClient.kt:224` / `DefaultFrakClient.swift:275` and out of the **public** `SharingApi.buildLink`, whose merchant-facing doc says verbatim: *"@return null **only** when there is nothing to link to"* (`SharingApi.kt:15-18`, `SharingAPI.swift:9-11`). Through the sheet it is worse: `SharingSessionBuilder.kt:62-65` maps the null to `FrakError.MerchantResolutionFailed("no anonymous id or merchant to build a sharing link from")` — the wrong cause, shown to the merchant.
- **What is still broken**: behaviour change for an existing caller (`request.link = "myapp://product/1"` built a link at `f1dc693`, returns null now) with a wrong error and no test on either platform (`SharingLinkBuilderTest.kt` / `SharingLinkBuilderTests.swift` are unchanged in this branch).
- **Residual severity**: medium (DX / merchant-facing contract).
- **What to do**: throw `FrakError.InvalidArgument`-shaped ("share base URL must be http(s), got `myapp://…`"), or at minimum update both `buildLink` docs and add one test per platform.

### P7. parity F6 — half the phantom-defaults doc is fixed, the other half is the one a porter would read

- **Claimed in**: 96024ee (implicitly, via the two doc edits) and register §3.7's "Stale spec in the TS reference" bullet.
- **Reality**: `sdk/core/src/context/frakContext.ts:109-116` is unchanged and still says *"V2 contexts expose the merchantId (`m`) and, when anonymous, the clientId (`c`), which feed `utm_campaign` and `ref` respectively"* on a function whose signature is `resolveAttributionValues(overrides: AttributionParams)` — it takes no context and cannot do this (`:120-128`). `:105` still calls `DEFAULT_ATTRIBUTION_SOURCE` the "Default utm_source / **via** value"; `via` never receives it.
- **Residual severity**: low, but this is the exact doc block a fourth port would be written from.
- **What to do**: two-line edit in `frakContext.ts`.

### P8. ios-sharing-sheet F7 / F9 — the free halves only

- **Claimed in**: 96024ee (iOS list).
- **Reality**: F7's `WKWebsiteDataStore.default()` (persistent, shared with the merchant's own web views), the absent app-bound-domains note and the absent memory-pressure release are all untouched — `SharingWebViewPool.swift` is not in the diff, and there is no `didReceiveMemoryWarningNotification` observer anywhere in `sdk/ios` (grep: 0 hits). F9's "the sheet announces nothing while loading" and "the content-lost surface is a silent blank" are untouched; only `.isModal` landed.
- **Residual severity**: medium (F7's shared data store is also a security-report item).
- **What to do**: `.nonPersistent()` or an explicit decision recorded; a `NotificationCenter` observer mirroring Android's new `trim()` (see N4).

### P9. §3.5 and §3.9 of the audit response — the two highs in my area were not touched at all, and one of them has a live Android twin

- **Claimed in**: `12-alpha-audit-response.md` §1 lists both as "confirmed, not fixed" — so this is disclosed, not hidden.
- **Reality**: iOS `SharingWebViewPool.warm(_:)` still has no `guard !lent` (`SharingWebViewPool.swift`, unchanged). `NativeShare.share` still has no escape hatch (`NativeShare.swift:12-45`, only `copy` changed). **Android has the same missing guard** — `SharingWebViewPool.kt:32-52`: `if (destroyed) return` … `pooled ?: newHandle()`, no `lent` check — and the branch demonstrably knew about `lent`, because the *new* `trim()` two functions below checks it (`:147`). The response doc files §3.5 as "iOS" only.
- **Residual severity**: high (both), and the Android half is unfiled.
- **What to do**: `if (lent) { warmUrl = url; return }` in `SharingWebViewPool.kt:32` at the same time as the Swift one-liner.

### P10. The register was corrected for numbers but not for the rows this branch's own code commit closed

- **Claimed in**: d88272d, "correct the register … against the tree".
- **Reality**: `docs/plans/native-sdk/06-open-findings.md:49` still carries row **9.2** as open, describing `char.code` truncation that `UrlQuery.kt:103-131` no longer does. `:116` still lists 9.2 as one of §3.7's "three concrete instances of drift". `:117`'s "Stale spec in the TS reference" bullet is half-stale now (see P7). Row 9.11 (`:115`) is correctly still open.
- **Residual severity**: low, but it is the same class of staleness the docs commit exists to fix.

## NEW defects introduced

### N1. The warm WebView is destroyed on every home-press and never rebuilt — the pool silently switches off for the rest of the process

- **Severity**: medium
- **Axis**: performance / UX
- **Complexity**: trivial (<1h)
- **Introduced by**: 96024ee, `SharingHost.kt:490-503` + `SharingWebViewPool.kt:146-152`
- **Evidence**:
  - `SharingHost.kt:492-495` — `onTrimMemory(level)`: `if (level < ComponentCallbacks2.TRIM_MEMORY_UI_HIDDEN) return` … `pool?.trim()`. `TRIM_MEMORY_UI_HIDDEN` (20) is not a memory-pressure signal at all — it is delivered whenever the app's UI goes to background.
  - `SharingWebViewPool.kt:146-152` — `trim()` nulls `pooled` **and `warmUrl`**, and destroys the handle.
  - Nothing re-warms. `SharingHost` is a `DefaultLifecycleObserver` (`:90`) and overrides only `onDestroy` (`:445`) — no `onStart`/`onResume`. The only caller is `FrakSharing.kt:99` `LaunchedEffect(sharing) { sharing.warm() }`, keyed on a `remember`ed `sharing`, so it does not re-run when the Activity comes back without recomposition. `warmRequested` stays `true` (`SharingHost.kt:110`) but is only re-driven from `attach()` (`:187`), which is skipped for the same Activity instance.
- **What actually happens**: user opens the merchant's product screen (WebView warms, page preloads), presses Home, comes back, taps Share. The sheet now boots a fresh `WebView` **and** does a cold `/sharing` load inside the sheet's 5 s load deadline — on a slow network that is the tier-3 raw-chooser path the whole pool exists to avoid. Every subsequent share in that process is cold too. The KDoc at `:487-488` asserts "the next `warm` rebuilds it"; there is no next `warm`.
- **Secondary, opposite-direction**: the `level < TRIM_MEMORY_UI_HIDDEN` guard also *skips* `TRIM_MEMORY_RUNNING_LOW` (10) and `TRIM_MEMORY_RUNNING_CRITICAL` (15) — the foreground pressure signals, and the ones the audit's fix sketch named ("`TRIM_MEMORY_UI_HIDDEN`/`RUNNING_LOW`"). On targets that still deliver them the warm renderer is held exactly when the process is closest to being killed. `onLowMemory()` (`:500-502`) covers only the extreme.
- **Fix sketch**: override `onStart(owner)` in `SharingHost` to `if (warmRequested) warm()`, so a trimmed pool re-warms on the next foreground; and change the guard to `if (level < TRIM_MEMORY_RUNNING_LOW) return` so foreground pressure is honoured too.

### N2. Android's `share()`/`copy()` still have no post-fallback guard — the iOS-only fix opened a parity gap on a defect Android shares

- **Severity**: medium
- **Axis**: parity / correctness
- **Complexity**: trivial (<1h)
- **Introduced by**: 96024ee (iOS half only), `SharingSheetModel.swift:200,220`
- **Evidence**: Android has the identical state — `SharingSheetState.kt:112` `private var fellBack = false`, set in `fallBack` (`:433-434`) — and `share()` (`:281`) / `copy()` (`:303`) guard on `claim(...)` only. `fallBack` itself is reachable from `onLoadDeadline` (`:273`) while the page is still loading, and raises a chooser at `:437`.
- **What actually happens**: the 5 s deadline fires, `fallBack` raises the tier-3 chooser and suspends in `track()`; the page finishes loading in the same window and the user taps Share on it; `share()` raises a **second** chooser and calls `track()` a second time — two attributed, reward-bearing `sharing` interactions for one intent. This is ios-sharing-sheet F8 verbatim, on the platform that ships first.
- **Fix sketch**: `if (fellBack || outcome.isFinished) return` at the top of `SharingSheetState.share()` and `copy()`.

### N3. `EXTRA_SUBJECT` on Android only — an emailed share now differs between the two platforms

- **Severity**: low
- **Axis**: parity / UX
- **Complexity**: small (<1d)
- **Introduced by**: 96024ee, `NativeShare.kt:24-27`
- **Evidence**: Android's send intent now carries both `EXTRA_TITLE` and `EXTRA_SUBJECT`. iOS `NativeShare.share` (`NativeShare.swift:12-45`) passes a `SharedLink(link:title:)` activity item; nothing implements `activityViewController(_:subjectForActivityType:)`, so a Mail share from iOS still arrives blank-subject. `12-alpha-audit-response.md` files android-sharing-sheet F5 as "not fixed / EXTRA_SUBJECT was the free half" and does not mention that the free half is Android-only.
- **Fix sketch**: `SharedLink` already conforms to `UIActivityItemSource`; add `subjectForActivityType` returning `title`.

### N4. Memory-pressure release on Android only

- **Severity**: low
- **Axis**: parity / performance
- **Complexity**: small (<1d)
- **Introduced by**: 96024ee, `SharingHost.kt:490-503`
- **Evidence**: Android now releases the warm view under trim; iOS has no `didReceiveMemoryWarningNotification`/`ProcessInfo` observer anywhere (`git grep -n "didReceiveMemoryWarning\|memoryWarning" review/alpha-fixes -- sdk/ios` → 0 hits; the only "jetsam" hits are *recovery* from a killed content process, `SharingWebView.swift:461`, `SharingWebViewPool.swift:46`). ios-sharing-sheet F7 named this and it was not addressed. The direction of the gap has flipped: the audit said "iOS got a jetsam clear, Android got nothing"; now Android has a trim path and iOS has none.
- **Fix sketch**: mirror `trim()` behind `UIApplication.didReceiveMemoryWarningNotification` in `SharingPresenter` — with N1's re-warm, or it inherits N1.

### N5. `.onDisappear { finish() }` can report a spurious `.dismissed` and then relaunch the same session

- **Severity**: low (disclosed risk, not a confirmed defect)
- **Axis**: correctness
- **Complexity**: trivial
- **Introduced by**: 96024ee, `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:61-66`
- **Evidence**: `.onDisappear` fires on the *modified content*, not the sheet. SwiftUI fires it on a `NavigationStack`/`NavigationView` push of the presenting screen. `finish()` (`:104-109`) then reports `best ?? .dismissed` through the merchant's `onResult` and `presenter.finish` disposes the live session (`SharingPresentation.swift:254-262`) — but it does **not** set `isPresented = false`. On pop, `.onAppear { if isPresented { launch() } }` (`:60`) starts a second session for the same tap, which will report again.
- **What actually happens**: one user share intent, two `onResult` calls; the first is `.dismissed` for a sheet the user never dismissed. Merchant analytics double-count and an `isSharing` flag can be cleared while the sheet is still on screen.
- **Note**: the branch author already flags this in `12-alpha-audit-response.md` §3 item 2 as "the one change in this branch that could plausibly misfire" and asks for a device run. Recording it here as a defect, not a surprise.
- **Fix sketch**: gate on a real teardown — only `finish()` from `.onDisappear` when `presenter.presentation == nil` or when the sheet was never presented; and set `isPresented = false` alongside, so the `onAppear` relaunch cannot fire.

### N6. `WindowInsets.safeDrawing` pulls the IME inset into the sheet

- **Severity**: nit
- **Axis**: UX
- **Complexity**: trivial
- **Introduced by**: 96024ee, `FrakSharingSheet.kt:145`
- **Evidence**: `safeDrawing` is `systemBars ∪ displayCutout ∪ ime`; the previous `navigationBars` was not. The dialog is `setDecorFitsSystemWindows(false)` (`SharingSheetDialog.kt:64-68`), so nothing else resizes for the IME and the Compose padding is what applies. No text input exists on today's `/sharing`, so this is latent.
- **Fix sketch**: `WindowInsets.systemBars.union(WindowInsets.displayCutout)` if the hosted page is ever expected to raise a keyboard and manage its own viewport.

## Audit claims this branch proves wrong

- **`checkDexSizeBudget` never existed** — wrong, as the task said. `32836c217` removed it deliberately; `06-open-findings.md`'s 1.2b row on the branch documents the measured rationale. The audit's `git log -S` was run in a shallow clone.
- **parity F9: "`returnScheme` sanitisation round-trips … always matches the wallet regex"** — technically wrong on Android at `f1dc693` (`Character.isDigit` accepts Devanagari `१२३`), but the audit's *conclusion* was right and this branch's fix is unreachable in practice: the only input is `context.packageName` (`SharingSheetState.kt:98`, `SharingWebViewPool.kt:163`), and Android package names are ASCII by manifest grammar. 96024ee's framing ("a Devanagari digit would survive here and be rejected there, dropping every callback") overstates it — it is defensive hardening, not a live bug. iOS already had `$0.isASCII` (`SharingPageURL.swift:24`), so this is a parity fix, not a defect fix.
- **ios-sharing-sheet F3: "`teardown()` … no `dispose`"** — already false at the review base. `SharingPresentation.swift:272` on `f1dc693` calls `presentation?.dispose()`; it landed in `48d7e2c69`, which is between the audit's `c0a0cec` and base `f1dc693`. Only the "no `onResult`" half of F3 was live, and that is what this branch fixed.
- **ios-sharing-sheet F1's register note: "Android has the same missing guard … so this is a cross-platform defect"** — correct, and still correct after this branch. `12-alpha-audit-response.md`'s §3.5 row files it as iOS-only ("`guard !lent` in `warm`. One line"), which drops the Android half.
- **parity F2's `%+1` row: "TS → `%+1`"** — wrong. Executed here: `new URL("https://x/p?d=%+f").searchParams.get("d")` → `"% f"`, because the WHATWG parser replaces `+` with `0x20` *before* percent-decoding. The branch's Kotlin test pins `"% f"` (`UrlQueryTest.kt:40`), i.e. it matches the real reference and not the audit's table. The audit's `%-1` row (`"%-1"`) is right.
- **`12-alpha-audit-response.md` §2: "Everything medium/low/nit was fixed here"** — false for the parity report (F5 medium, F7/F9/F10 low, F12/F13 nit) and for android-sharing-sheet F17 (medium, "no test constructing the host layer" — the branch changed `SharingHost.kt` substantially and added no test for it).

## Verified-OK

- **`+` → space is safe for `fCtx`.** `Base64Url.kt:8` and `Base64URL.swift`'s alphabet are `A-Za-z0-9-_`; `FrakContextCodec.compress` is the only producer. No `+` can occur in a well-formed value, and a mangled one (`-`/`_`→`+`/`/`) was rejected before the change and is rejected after it.
- **`+` → space is safe for `fmt`.** The token is a JWT — `AnonymousMergeService.ts:38` `JwtContext.anonymousMerge.sign(...)` — i.e. base64url, no `+`.
- **`+` → space is safe for everything else the SDK decodes.** The only `get`/`value(for:)` call sites on the branch are `fCtx` (`DefaultFrakClient.kt:283`, `SharingLinkBuilder.kt:46`, `DeepLinkObserver.kt:55`, and the Swift twins) and `fmt` (`IdentityMerge.kt:37`, `IdentityMerge.swift:20`). `fillIfAbsent` (`UrlQuery.kt:38-46`) calls `get` for utm keys but only null-checks it, so a merchant's `utm_content=a+b` is never read as data on either side of the change.
- **Fragment-borne values are not affected, and would be safe if they were.** Native `UrlQuery.parse`/`URLQuery.parse` split the fragment off as an opaque string (`UrlQuery.kt:76-78`, `URLQuery.swift:19-25`) and never decode it. Independently, the wallet reads its own fragments with `URLSearchParams` (`apps/wallet/app/module/sharing/params/fragment.ts:13`, `apps/wallet/app/utils/deepLink.ts:126`), which form-decodes `+` too — so the web side is consistent either way. The native *write* side encodes `+` as `%2B` and space as `%20` (`PercentEncoding.kt:19`, `PercentEncoding.swift:6-8`), so the round trip is lossless.
- **The single-pass decoder is equivalent to the WHATWG two-pass order.** `%2B` → `+` on both (no re-mapping of a decoded `+`), a raw `+` → space on both; I could not construct a diverging input. Executed reference table (Node): `a=spring+sale`→`"spring sale"`, `b=%2B`→`"+"`, `c=%-1`→`"%-1"`, `d=%+f`→`"% f"`, `e=%20%C3%A9`→`" é"`, `g=caf%C3%A9`→`"café"`, `h=a%2Bb%40x.com`→`"a+b@x.com"` — all match what the two native decoders now produce by inspection.
- **`?fCtx=…&fctx=…` both present**: all three return the exact-case value. Executed: `new URL("…?fctx=stale&fCtx=real").searchParams.get("fCtx")` → `"real"`; `UrlQuery.kt:27` / `URLQuery.swift:51` do the same, and the write path still deletes every casing first (`UrlQuery.kt:34`, `URLQuery.swift:57`), so no duplicate survives a `set`.
- **The `%-1` hole is genuinely closed on Android.** `hexByte` (`UrlQuery.kt:135-142`) goes through `Hex.nibble`, which is a `when (char)` over `'0'..'9'`/`'a'..'f'`/`'A'..'F'` (`Hex.kt:44-51`) — no sign, no `toIntOrNull`. iOS was already correct (`Hex.nibble(UInt8)`), unchanged. The `index + 2 < count` bound is correct on both (last read index is `count-1`).
- **The buffered-result fix is correct under double Activity recreation.** `SharingHost.kt:178-183`: post → `if (cleared || this.activity !== activity) return` → `pendingResult ?: return` → clear → deliver. A1 destroyed with a buffered result, A2 attaches (post #1 captures A2), A2 destroyed, A3 attaches (post #2 captures A3): post #1 sees `this.activity === A3 ≠ A2` and returns **without clearing**; post #2 delivers. It also closes the case the audit did not name — two `attach()` calls on the *same* Activity now schedule two posts of which only the first delivers, because the buffer is re-read inside the lambda.
- **Cache-only rung removal is justified.** `apps/wallet/nginx.conf:138-149` — `/sharing` is `no-store, no-cache, must-revalidate, max-age=0`, `etag off`. The rung provably could not answer. The behaviour change (an `ERROR_HOST_LOOKUP`/`ERROR_CONNECT` now goes straight to tier 3 rather than spending one 0 ms cache attempt) is a net win, and the removal is symmetric (`SharingWebView.kt:437-450` / `SharingWebView.swift:283-296`) with the same two 300/900 ms delays.
- **Arrival-claim placement is identical on both platforms** and correctly sits after the merge and after the self/foreign guard (`DefaultFrakClient.kt:266-283`, `DefaultFrakClient.swift:321-346`), keyed on the same value (the decoded `fCtx`).
- **Comment budget is green on the branch.** `bun scripts/check-comments.ts` against a `git archive` of `review/alpha-fixes` at the four default native roots: `✅ comment budget clean across 269 files (97 baselined finding(s) left to pay down)` — down from the 101 the compass records, so nothing in this branch regressed it.
- **`clearAndSetSemantics` and `paneTitle` are imported** (`FrakSharingSheet.kt:38,40`), `UTType` is imported for the new `localOnly` pasteboard write (`NativeShare.swift:4`) — no obvious compile break in the changed files I could not build.

## Residual risks I could not settle here

- No Kotlin/Swift compiler or emulator: correctness of the two decoders is by inspection, and the `.onDisappear` behaviour (N5) genuinely needs a device.
- `bunx vitest` cannot run in this checkout (`@frak-labs/test-foundation` not installed), so `queryParams.test.ts` was read, not executed; the reference semantics it encodes were executed directly against Node's `URLSearchParams` instead.
- Whether `TRIM_MEMORY_RUNNING_*` is still delivered at the SDK's `targetSdk` (Android 14 filtered some levels) — N1's secondary point is target-dependent; its primary point (no re-warm) is not.
