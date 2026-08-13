# Audit — `sdk/android/frak-sdk-ui` (Android sharing sheet)

Worktree `/home/dev/wallet-audit` @ `c0a0cec`. Read-only, no toolchain: every claim below is from reading
code. Line numbers are 1-based against the files as committed.

## Summary

Not alpha-ready, but not far off structurally: the state machine (`SharingSheetState`,
`SharingWebViewClient`, `SharingWebViewPool`) is genuinely careful, well-factored and well-tested, and the
WebView hardening is the strongest part of the module. What is not ready is everything *around* it — the
window/host layer that only ever runs on a device, which has ~0 test coverage and, per the plan docs, has
never been through a full device pass.

The single worst thing: **the Compose build site orphans a live sheet.** `FrakSharing.Builder.build()`'s
`DisposableEffect` has an empty `onDispose` (`FrakSharing.kt:95`) while the dialog is owned by an
Activity-scoped `SharingHost`. Navigate away in Compose Navigation with the sheet open and the sheet stays
on screen over the new destination, and its `onResult` fires into a composition that no longer exists. The
previous bug (§2.1 of `07`: a torn-down sheet never reported) was traded for a stuck one, and nothing in the
register notices.

Close behind: two live crash paths in the merchant's process (`Frak.client` read outside every guard), a
Compose+material3 dependency imposed on every merchant for five symbols against a "256 KB dex" budget whose
enforcing gate **does not exist anywhere in the repo**, and `SharingResult.Shared` + a signed, billable
`sharing` interaction being emitted on chooser *open* in a loop the user controls.

Register accuracy: 9.14 is real and I re-anchored it. 9.13's "AtomicBoolean fix" is **fabricated** — there is
no atomic anywhere in the module. 1.2b's "dex size budget is now in CI" is **false**.

---

## Findings

### F1. The Compose build site orphans a live sheet on navigation

- **Severity**: high
- **Axis**: correctness / UX
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharing.kt:92-96`
    ```kotlin
    DisposableEffect(host, stable) {
        host.attach(activity, stable)
        onDispose { }
    }
    ```
  - The dialog is owned by `SharingHost`, which lives in an Activity-scoped `ViewModelStore`
    (`SharingHost.kt:459-467` `of()`), and its only teardown triggers are Activity `onDestroy`
    (`SharingHost.kt:410`) and `onOwnerCleared` (`SharingHost.kt:436`). Neither fires on a composable
    leaving composition.
  - `SharingHost.attach` will not re-point the callback at a newly composed screen while a session is live:
    `SharingHost.kt:150` `if (this.callback == null) this.callback = callback`.
- **What actually happens**: user taps Share on a product screen, sheet opens, user presses back on the
  *app's* nav graph (or a deep link / push notification routes elsewhere) — the `NavHost` swaps destination,
  the `FrakSharing` composable leaves composition, and the Frak sheet is still there, floating over the new
  screen, with no owner. When it finally reports, `rememberUpdatedState`'s last value is a lambda captured by
  a destroyed screen (`FrakSharing.kt:89-91`), so the merchant's `onResult` mutates dead state. A merchant
  keeping an `isSharing` flag in a screen ViewModel never sees it cleared.
- **Fix sketch**: give `SharingHost` a `detach(activity, callback)` and call it from `onDispose`; it should
  drop the callback if it is the one being detached and `requestExit()` the live session (or at minimum
  report `Dismissed`). Add the symmetric call to `build(activity)`'s doc as an `onDestroy` requirement.
- **Register status**: NEW. `07` §2.1 diagnosed the inverse bug and the fix over-rotated; `08` §9.10 lists
  "a nav-graph pop" nowhere.

---

### F2. Two unguarded `Frak.client` reads crash the merchant's process after `Frak.shutdown()`

- **Severity**: high
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `SharingWarmup.kt:11-13` — the initialization check and the client read are two statements:
    ```kotlin
    if (!Frak.isInitialized) return null
    val client = Frak.client          // outside the try below
    ```
    `Frak.client` throws (`sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/Frak.kt:157-158`:
    `get() = session?.client ?: throw FrakError.NotInitialized()`), and `FrakError : Exception`
    (`core/FrakError.kt:8-12`). The try/catch starts at `SharingWarmup.kt:19` and catches `FrakError`.
  - The caller is a bare `scope.launch` with no `CoroutineExceptionHandler`: `SharingHost.kt:192-193`, on
    `CoroutineScope(SupervisorJob() + MainThreadDispatcher)` (`SharingHost.kt:100`). With
    `kotlinx-coroutines-android` deliberately off the classpath (`frak-sdk/build.gradle.kts:14`,
    `08` §9.3) there is no `AndroidExceptionPreHandler` either — it goes straight to the thread's
    uncaught handler.
  - `SharingSheetState.kt:435-451` — `openExternally` → `isWalletStoreListing` →
    `dependencies.environment()` → `Frak.client.environment` (`SharingDependencies.kt:70`), **not**
    inside `guarded { }`. This runs synchronously inside `SharingWebViewClient.shouldOverrideUrlLoading`
    (`SharingWebView.kt:322`), i.e. inside a native WebView callback.
  - Same shape, third site: `SharingHost.poolOrNull()` at `SharingHost.kt:227-234` checks
    `Frak.isInitialized` then reads `Frak.client.environment.wallet`; it is called unprotected from
    `present()` (`SharingHost.kt:273`), so the throw escapes a public `@MainThread` method into the
    merchant's click handler.
- **What actually happens**: merchant calls `Frak.shutdown()` on logout/account switch (documented as
  "idempotent, with no restart contract", `DefaultFrakClient.kt:134-142`). Any concurrently-warming screen,
  or any tap on an outbound link in the open sheet, throws `FrakError.NotInitialized` with nothing between
  it and `Thread.uncaughtExceptionHandler`. Process death, during a share.
- **Fix sketch**: use `Frak.clientOrNull` (already exists, `Frak.kt:162-163`) at all three sites; wrap
  `SharingHost`'s `scope` in a `CoroutineExceptionHandler` that logs; route `dependencies.environment()`
  through the existing `guarded {}` helper.
- **Register status**: NEW as to these three sites. `07` §2.3 called out exactly this class and its fix
  landed only for `track`/`installPageUrl`/`openFrakApp` (`SharingSheetState.kt:466-474` `guarded`); the
  warm path, the `environment()` read and `poolOrNull` were missed, and §2.3 is listed as closed.

---

### F3. Compose + material3 are imposed on every merchant, and the dex budget that was meant to catch it does not exist

- **Severity**: high
- **Axis**: build-release
- **Complexity to fix**: medium (few days) for the material3 removal; structural for the Compose split
- **Evidence**:
  - `sdk/android/frak-sdk-ui/build.gradle.kts:48-51` — `compose.ui`, `compose.foundation`,
    `compose.material3` as `implementation`, plus the Compose compiler plugin (`:3`, `:15`).
  - material3 is used for **five symbols total**, all cosmetic:
    `BottomSheetDefaults.DragHandle()` / `BottomSheetDefaults.ContainerColor`
    (`FrakSharingSheet.kt:239,164`, `SharingSheetSkeleton.kt:56`), `Surface`
    (`FrakSharingSheet.kt:161`, `SharingSheetSkeleton.kt:51`),
    `MaterialTheme.colorScheme.surfaceVariant` (`SharingSheetSkeleton.kt:112`) and
    `MaterialTheme(colorScheme = lightColorScheme())` (`SharingHost.kt:337`).
  - The stated budget: `docs/plans/native-sdk/02-sdk-design.md:26` — *"Budget: 256 KB of dex per platform,
    enforced on Android (`frak.sdk.dexBudgetKb` / …)"*.
  - **That property and that task do not exist.** `rg -i dex sdk/android` returns only unrelated
    `lastIndex`/`index` matches; there is no `checkDexSizeBudget` anywhere in the tree, and
    `sdk/android/gradle.properties` has no `frak.sdk.dexBudgetKb`. `.github/workflows/apps.yaml:155-168`
    runs `lint`, `build`, `test`, `apiCheck`, `check` — none of which can be enforcing a budget that has no
    task.
- **What actually happens**: My Moulinex — a Views/XML app, which is the entire stated motivation for the
  Builder API (`07` §3.1) — adds `id.frak.sdk:ui` and pulls the Compose runtime, `ui`, `ui-graphics`,
  `ui-text`, `foundation` and `material3` into an app that has no Compose. Realistically that is on the
  order of 1.5–2.5 MB of APK after R8 (I cannot measure it here; I am stating the commonly-observed cost of
  a first Compose dependency, and I flag it as an estimate). Nobody will notice, because nothing measures it
  and the docs assert a gate that isn't there.
- **Fix sketch**: delete the material3 dependency — a rounded `Box` replaces `DragHandle()`, two `Color`
  constants replace the defaults, `foundation`'s `Surface`-equivalent is a `Box(background)`. Then either
  build the real transitive dex gate or delete the budget claim from `02` and `06`.
- **Register status**: CONTRADICTS `06-open-findings.md:26` (1.2b: *"That makes Android Lint, the dex size
  budget and the version-drift check part of CI for the first time"* — the dex budget is not in CI because it
  does not exist) and overstated in `08` §7.6 (*"`checkDexSizeBudget` dexes only the module's own
  `classes.jar`"* — describes a task that is not in the tree). Confirms the direction of `08` step C.

---

### F4. `Shared` is reported — and a signed `sharing` interaction billed — when the chooser merely *opened*, in a user-controlled loop

- **Severity**: high
- **Axis**: correctness / security
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `NativeShare.kt:24-25` — the only success signal is `startActivity` not throwing:
    ```kotlin
    val chooser = Intent.createChooser(send, title).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return runCatching { context.startActivity(chooser) }.isSuccess
    ```
    No `createChooser(target, title, IntentSender)` (API 22+), so `EXTRA_CHOSEN_COMPONENT` is never
    requested and the SDK cannot know a target was picked, let alone that a message was sent.
  - `SharingSheetState.kt:278-286` — on that boolean: `track()` then `confirm(SharingResult.Shared(link))`.
  - The per-session dedup is a plain set (`SharingSheetState.kt:262,271`) and `shareAgain` clears it
    outright: `SharingSheetState.kt:323-327` `claimed.clear()`.
  - Tier 3 does the same on the offline path: `SharingSheetState.kt:425-427`.
- **What actually happens**: (a) the merchant's `onResult` receives `Shared` for every user who opened the
  chooser and hit back — the metric they will build their campaign on is wrong by the chooser abandonment
  rate, which is not small; (b) share → cancel chooser → "Share again" → share → cancel … emits one signed
  `Interaction.sharing()` per iteration, each with a fresh idempotency key (`EventOutbox.kt:67`), so nothing
  downstream dedupes them. Whether that costs the merchant money depends on their campaign shape, which I
  did not verify — but it is an unbounded, un-rate-limited, client-driven signed-event source.
- **Fix sketch**: use `Intent.createChooser(send, title, pendingIntent.intentSender)` and gate `track()` +
  `Shared` on the `EXTRA_CHOSEN_COMPONENT` broadcast, falling back to today's behaviour below API 22;
  independently, do not let `shareAgain` clear the `Share` claim more than N times per session.
- **Register status**: NEW. The behaviour is deliberate and commented (`SharingSheetState.kt:282-284`), but
  nothing in `06`/`07`/`08` weighs it as an outcome-accuracy or abuse issue.

---

### F5. The native share payload is a bare URL — no localized text, no preview image, no subject

- **Severity**: medium
- **Axis**: parity / UX
- **Complexity to fix**: medium (needs a page→host payload)
- **Evidence**:
  - `NativeShare.kt:18-23` — `EXTRA_TEXT = link` and `EXTRA_TITLE = title`, where `title` is the merchant's
    display name (`SharingSessionBuilder.kt:95` `shareTitle = appName`). No `EXTRA_SUBJECT`, no `ClipData`
    thumbnail, no `imageUrl`.
  - The web/Tauri equivalent shares three fields:
    `packages/wallet-shared/src/sharing/hooks/useSharingPageController.ts:231-238`
    ```ts
    useShareLink(sharingLink, {
        title: t("sharing.title"),
        text: t("sharing.text"),
        imageUrl: merchant.logoUrl,   // rich preview header on native
    }, …)
    ```
    and `packages/wallet-shared/src/sharing/hooks/useShareLink.ts:26-38` documents that the native layer
    uses those to *"populate `EXTRA_TITLE` + a FileProvider-backed `ClipData` thumbnail on Android 10+ so the
    chooser shows a branded preview tile."*
  - Structurally the SDK cannot do better today: the page hands the share back as a bare
    `frak-<pkg>://result?sid=…&action=share` navigation with no payload
    (`SharingWebView.kt:329-341`, `apps/wallet/app/module/sharing/component/SharingView.tsx:124`).
- **What actually happens**: a My Moulinex user shares from the app and their friend receives a naked
  `https://…?fCtx=…` URL with no message and no preview card, where the same user sharing from the Frak
  wallet app gets a translated message plus a branded tile. This is the visible product surface of the whole
  feature.
- **Fix sketch**: add `text`/`title`/`imageUrl` query params to the `action=share` result URL from
  `SharingView`, and put them on `EXTRA_TEXT`/`EXTRA_SUBJECT` + a `ClipData` preview in `NativeShare.share`.
- **Register status**: NEW.

---

### F6. Buffered-result replay drops a real outcome across a double Activity recreation (9.14, re-anchored)

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `SharingHost.kt:157-161`
  ```kotlin
  pendingResult?.let { pending ->
      pendingResult = null
      mainHandler.post { if (!cleared && this.activity === activity) callback.onResult(pending) }
  }
  ```
  The buffer is cleared before the post, and the post no-ops if a newer Activity has attached.
- **What actually happens**: exactly as 9.14 describes — `recreate(); recreate()` (or a fast
  rotate-back-rotate, or a locale + theme change landing in one turnaround) inside one main-loop turn drops a
  real `Shared`/`InstallStarted` permanently. Merchant's `isSharing` flag hangs.
- **Fix sketch**: clear `pendingResult` inside the posted lambda, only on the branch that actually delivers.
- **Register status**: **confirms 9.14**, with a corrected anchor. The register cites
  `SharingHost.kt:242-247` "(branch)"; on `dev` the code is at `157-161`. It is not branch-only any more —
  it is shipped.

---

### F7. TalkBack reads the hidden page behind the loading skeleton; the sheet never announces itself

- **Severity**: medium
- **Axis**: UX/DX (accessibility)
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `FrakSharingSheet.kt:155` `AndroidView(… factory = { handle.view })` and `:175-177`
    `SharingSheetSkeleton(Modifier.graphicsLayer { alpha = skeletonAlpha })`. The skeleton is a sibling drawn
    *over* the WebView, not a replacement: `SharingSheetSkeleton.kt:51-98` sets no semantics at all, and the
    `AndroidView` is never `Modifier.clearAndSetSemantics {}`-ed or `invisibleToUser`-ed while covered.
  - No `paneTitle` anywhere: `grep paneTitle` over the module returns nothing; `08` §9.5 records this as
    deliberate ("it needs a localised string and this module ships no resources").
- **What actually happens**: a TalkBack user opens the sheet and hears nothing (no pane-title announcement
  for a modal window); swiping then walks the WebView's accessibility tree — the wallet page's headings and
  buttons — while the sighted user is still looking at a grey shimmer, and the announced buttons do not
  correspond to anything tappable yet. When the skeleton fades the tree changes under them.
- **Fix sketch**: `Modifier.semantics { paneTitle = <merchant display name, already in `SharingSession`> }`
  on the sheet container (no `res/` needed — it is a runtime string), and
  `.semantics { invisibleToUser() }` on the `AndroidView` while `!state.pageVisible`.
- **Register status**: NEW; `08` §9.5's "pane title is not replaced" is recorded but not costed.

---

### F8. A warm `WebView` per Activity, warmed eagerly, never released under memory pressure

- **Severity**: medium
- **Axis**: performance
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `SharingHost` is per-Activity (`SharingHost.kt:459-467`, keyed off `ViewModelProvider(activity)`), and
    each owns its own `SharingWebViewPool` (`SharingHost.kt:227-235`).
  - The Compose build site warms unconditionally on composition-enter: `FrakSharing.kt:98`
    `LaunchedEffect(sharing) { sharing.warm() }` — no visibility or reward-availability gate.
  - `warm()` does a real network page load of `/sharing?…&state=warm` (`SharingWebViewPool.kt:41-58`,
    `SharingPageUrl.kt:65-85`), which the page reports as `sharing_page_preloaded`.
  - `grep -rn "onTrimMemory\|ComponentCallbacks2\|onLowMemory" sdk/android/frak-sdk-ui` → **no matches.**
    The only release paths are `onOwnerCleared` (`SharingHost.kt:436-448`) and `pool.release`.
- **What actually happens**: a merchant with a share affordance on a product-detail screen boots a WebView
  (and its own renderer process, tens of MB) plus a full page load *every time that screen is opened*, for
  every user, whether or not they ever tap Share — and every one of those inflates
  `sharing_page_preloaded`. Two such Activities on the back stack hold two live WebViews. Under memory
  pressure nothing is given back, so the merchant's own process is a more attractive LMK target.
  iOS got a jetsam clear in the same defect pass (`06-open-findings.md:159-164`); Android got nothing.
- **Fix sketch**: register a `ComponentCallbacks2` on the application in `SharingHost` and
  `pool.destroy()` at `TRIM_MEMORY_UI_HIDDEN`/`RUNNING_LOW` when not `lent`; and gate the Compose auto-warm
  behind an explicit opt-in or a "reward available" check.
- **Register status**: NEW.

---

### F9. `present()` can be a total no-op with no callback and no log

- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `SharingHost.kt:257-268` + `SharingHost.kt:481-491`
  ```kotlin
  hostDestroyed || hostUnavailable || !lifecycleStarted -> SharingPresentDecision.Ignore
  ```
  and the `Ignore` arm at `SharingHost.kt:262-264` is a bare `return`. `Refuse` reports
  `AlreadyPresenting` (`:266-269`); `Ignore` reports nothing and logs nothing. There is no `Log.w` anywhere
  in `SharingHost.kt` (the module's only logging is `SharingHostStyle.kt:41,54`).
- **What actually happens**: a merchant calls `present()` from a slightly-too-early lifecycle point (a
  `LaunchedEffect` racing `onStart`, a callback resuming while the Activity is stopped behind a permission
  dialog, a deep-link handler in `onNewIntent`) and gets absolute silence — no sheet, no error, no logcat
  line. This is the first thing they will file a support ticket about, and the API is internally inconsistent:
  one class of misuse reports, the other vanishes.
- **Fix sketch**: `Log.w(TAG, "present() ignored: <reason>")` on every `Ignore` arm; consider reporting
  `Failed(FrakError.…)` instead so the merchant's one callback is still the single source of truth.
- **Register status**: NEW.

---

### F10. The chooser and every outbound link are launched from the application context in a new task

- **Severity**: medium
- **Axis**: UX
- **Complexity to fix**: small (<1d)
- **Evidence**: `SharingHost.kt:286` passes `appContext` into `SharingPresentation.start(...)`, which becomes
  `SharingSheetState.context` (`SharingSheetState.kt:42`, `SharingPresentation.kt:83`). That context is what
  starts activities: `NativeShare.kt:24-25` and `SharingSheetState.kt:444-445`, both with
  `FLAG_ACTIVITY_NEW_TASK` — which is mandatory precisely *because* it is not an Activity context.
- **What actually happens**: the Sharesheet and any external link open as a separate task rather than on top
  of the merchant's task. Back-stack behaviour after the user finishes in WhatsApp/Chrome becomes
  OEM-dependent, and on several launchers the user lands on Home rather than back in the merchant app. The
  host already has the Activity (`SharingHost.kt:88`) — this is avoidable, not inherent.
- **Fix sketch**: hand `SharingSheetState` an `() -> Context?` that prefers the attached Activity and falls
  back to `appContext`; drop `NEW_TASK` when an Activity is available.
- **Register status**: NEW.

---

### F11. `heightFraction(1.0f)` is allowed but nothing insets the status bar or display cutout

- **Severity**: medium
- **Axis**: UX
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - Max fraction is `1.0f` (`FrakSharingDefaults.kt:20`, validated at `FrakSharing.kt:52-58`).
  - The dialog spans the display and opts out of decor fitting on API 30+
    (`SharingSheetDialog.kt:46`, `:64-68`).
  - The only inset applied is the navigation bar: `FrakSharingSheet.kt:143`
    `.windowInsetsPadding(WindowInsets.navigationBars)`. No `statusBars`, no `displayCutout`,
    no `safeDrawing`.
- **What actually happens**: at `heightFraction(1.0f)` the grab handle and the page's header render *under*
  the status bar and, on a device with a punch-hole in landscape, under the cutout. In landscape with
  3-button navigation the `navigationBars` inset is horizontal, so the sheet gets a side gutter but its
  bottom CTA row goes back under the gesture area on gesture-nav devices only by luck. `08` §9.10 records
  insets as "found on the first device pass, fixed" — that pass evidently ran at the default 0.85 in portrait.
- **Fix sketch**: use `WindowInsets.safeDrawing` (or `systemBars.union(displayCutout)`) instead of
  `navigationBars`, keeping it inside the `graphicsLayer` as today.
- **Register status**: overstated in `08` §9.10 (insets marked struck-through/fixed; only the portrait
  navigation-bar case is).

---

### F12. Zero JavaScript diagnostics: no `WebChromeClient`, no `setWebContentsDebuggingEnabled`

- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `createSharingWebView` (`SharingWebView.kt:185-220`) sets `webViewClient` at `:212` and
  never sets a `WebChromeClient`; `grep -n "WebChromeClient\|setWebContentsDebuggingEnabled"` over the
  module returns nothing.
- **What actually happens**: this is the one MVP surface with no device evidence at all
  (`06-open-findings.md:159`). When it renders blank on a merchant's device — the single most likely alpha
  outcome — there is nothing in logcat: no `console.error` from the page, no JS exception, no load progress,
  and DevTools inspection is off. The SDK's own signal is a 5 s timeout followed by a native chooser
  (`SharingPresentation.kt:59`), which is indistinguishable from "the page took too long".
- **Fix sketch**: a minimal `WebChromeClient` forwarding `onConsoleMessage` to the core logger at
  `FrakLogLevel.DEBUG`, and `WebView.setWebContentsDebuggingEnabled(true)` when the merchant's log level is
  DEBUG.
- **Register status**: NEW.

---

### F13. The register documents an `AtomicBoolean` fix that does not exist

- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `06-open-findings.md:105` (9.13): *"`SharingSheetStateTest.kt:67` injects `EmptyCoroutineContext` for
    `workContext` … so the `AtomicBoolean` fix that replaced eight unsynchronised booleans has no regression
    test and cannot get one (`SharingSheetState.kt:215` says so in-source; `07` §2.4)."*
  - `grep -rn "Atomic\|@Volatile" sdk/android/frak-sdk-ui/src/` → **no matches** (exit 1).
  - `SharingSheetState.kt:215` is `// while warm — so uncovering it on the strength of the document alone
    shows a hole.` — a comment about visual-state callbacks, nothing to do with concurrency.
  - What actually landed is thread-confinement, not atomics: `SharingSheetState.kt:14-20` KDoc, `:48`
    `workContext = Dispatchers.Default`, `:124` `stateContext = scope.coroutineContext.minusKey(Job)`, and
    the two hops at `:141` and `:167` (`withContext(stateContext) { … }`). Having read it, I believe the
    confinement is sound — every mutation of `prepareStarted`/`navigated`/`deadlineExpired`/`fellBack`/
    `showingInstallPage`/`claimed` reaches the main looper.
- **What actually happens**: a reader auditing concurrency trusts a register row naming a mechanism that
  isn't there, and stops looking. It also makes 9.13's "structurally blind harness" argument rest on a
  non-existent artefact.
- **Fix sketch**: rewrite the 9.13 clause to describe the confinement design and re-anchor it, or delete it.
- **Register status**: **CONTRADICTS 9.13** (the named mechanism and the cited line are both wrong; the
  underlying `07` §2.4 concern is nonetheless resolved, by a different design).

---

### F14. After a rotation, a live session can report to the *other* `FrakSharing`'s callback

- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**: `SharingHost.kt:148-153`
  ```kotlin
  val resumed = live
  if (resumed?.presentation != null) {
      if (this.callback == null) this.callback = callback
  ```
  `onDestroy` nulls the callback on a configuration change (`SharingHost.kt:415`), so after a rotation the
  first `attach()` to run wins — and `attach()` is driven by `Builder.build(...)` order in `onCreate`
  (`FrakSharing.kt:77`), not by which instance presented.
- **What actually happens**: a screen with two share entry points ("share this product" / "share my cart")
  built with two `FrakSharing` instances and two distinct callbacks: rotate mid-sheet and the result is
  delivered to whichever was constructed first. The KDoc promises instances "share a warm web view and a
  single one-sheet-at-a-time guard" (`FrakSharing.kt:19-20`) — it does not warn that they also share a
  callback slot.
- **Fix sketch**: key the buffered/live callback to the `FrakSharing` instance that called `present()`, or
  document one-instance-per-Activity and `check()` it.
- **Register status**: NEW.

---

### F15. Chrome is pinned light while the hosted page is free to go dark

- **Severity**: low
- **Axis**: UX
- **Complexity to fix**: small (<1d)
- **Evidence**: `SharingHost.kt:335-338` pins `MaterialTheme(colorScheme = lightColorScheme())`; the
  skeleton reads `BottomSheetDefaults.ContainerColor` and `MaterialTheme.colorScheme.surfaceVariant` from
  that (`SharingSheetSkeleton.kt:56,112`). The WebView is transparent (`SharingWebView.kt:206`) and nothing
  sets `WebSettingsCompat.setAlgorithmicDarkeningAllowed` or otherwise pins the page's colour scheme — an
  Android WebView still reports the system dark mode to `prefers-color-scheme`.
- **What actually happens**: on a device in dark mode, the sheet opens on a white skeleton and cross-fades
  (`FrakSharingSheet.kt:170-177`) into whatever the wallet page decides, potentially dark. Nobody has run
  this. The injected `--frak-host-surface: transparent` (`SharingHostStyle.kt:27`) means there is no
  fallback surface behind the page either.
- **Fix sketch**: decide one way — either force the page light (add a `theme=light` param, matching the
  pinned chrome) or make the skeleton follow the system scheme.
- **Register status**: NEW.

---

### F16. `copy()` can only ever run once per session, silently

- **Severity**: nit
- **Axis**: UX
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `SharingSheetState.kt:296-303` claims `Copy` and never releases it (contrast `share()`'s
  `claimed.remove` at `:280` and install's at `:403`); only `shareAgain` clears
  (`SharingSheetState.kt:325`). The page's footer stays enabled by design (`SharingSheetState.kt:258-260`).
- **What actually happens**: the user taps Copy twice (a normal thing to do if they think the first tap
  missed); the second tap writes nothing to the clipboard and produces no host-side feedback.
- **Fix sketch**: release the `Copy` claim in the coroutine's `finally`.
- **Register status**: NEW.

---

### F17. The entire host/window layer has no test constructing it

- **Severity**: medium
- **Axis**: tests
- **Complexity to fix**: structural (needs an instrumented tier)
- **Evidence**: `grep -rn "SharingHost(\|SharingPresentation\|createSharingSheetDialog\|FrakSharingSheet\|NativeShare"` over
  `sdk/android/frak-sdk-ui/src/test/` matches only `SharingSheetStateTest.kt` (for `NativeShare`'s call
  sites) and two KDoc references. `SharingHost.kt` (512 lines), `SharingPresentation.kt`,
  `SharingSheetDialog.kt`, `FrakSharingSheet.kt` and `NativeShare.kt` have **zero** executed coverage —
  which is precisely where F1, F2, F6, F9, F10, F11 and F14 all live.
- **Fix sketch**: a Robolectric test that drives `ActivityController` through `create → present →
  recreate → recreate → destroy` against a `SharingHost` would catch F6 and F14 without a device.
- **Register status**: **confirms 8.2**'s recurring-on-Android paragraph, verbatim and verified.

---

## Verified-OK

- **WebView hardening is genuinely good** (`SharingWebView.kt:191-212`): JS on (required), DOM storage on,
  `allowFileAccess=false`, `allowContentAccess=false`, `MIXED_CONTENT_NEVER_ALLOW`,
  multiple windows off, `javaScriptCanOpenWindowsAutomatically=false`, geolocation off, third-party cookies
  off, no `addJavascriptInterface` anywhere in the module (`consumer-rules.pro:8-10` states the invariant).
  `allowUniversalAccessFromFileURLs`/`allowFileAccessFromFileURLs` are left at their platform defaults
  (false since API 16) and are moot with file access off. `onReceivedSslError` is correctly **not**
  overridden, so the default cancel stands.
- **Origin pinning is component-wise, not prefix-based** (`SharingWebView.kt:344-347`) and the
  `isForMainFrame` gate precedes the return-scheme check (`SharingWebView.kt:319-324`), so a sub-frame
  cannot forge a result — with tests for both (`SharingWebViewClientTest.kt`: "a lookalike host is not the
  wallet origin", "a sub-frame cannot forge a page result").
- **`onRenderProcessGone` returns `true`** (`SharingWebView.kt:463`) and marks the handle terminally dead;
  the pool refuses to lend or re-warm it (`SharingWebViewPool.kt:100-113`). Tested.
- **The retry ladder / cache-only rung / `LOAD_DEFAULT` un-pinning** is careful and covered by 30 tests.
- **`MutableContextWrapper` leak discipline**: base swapped to the Activity in `attach` (`SharingHost.kt:143`)
  and back to the application context in `onDestroy` (`SharingHost.kt:427`). Pinned by
  `SharingWebViewContextTest`.
- **Lifecycle-observer ordering is (accidentally) correct**: `SharingHost` registers its `ON_DESTROY`
  observer in `attach` (`SharingHost.kt:144`), i.e. after `ComponentActivity`'s constructor-registered one,
  and `LifecycleRegistry` dispatches downward events in reverse-insertion order — so `SharingHost.onDestroy`
  runs *before* the framework clears the `ViewModelStore`, which is what the `onDestroy`/`onOwnerCleared`
  split depends on. Undocumented and fragile, but correct today.
- **RTL**: direction-aware throughout — `padding(start=, end=)` (`SharingSheetSkeleton.kt:63`),
  `RoundedCornerShape(topStart, topEnd)` (`FrakSharingDefaults.kt:32-33`).
- **`MainThreadDispatcher`** (`SharingHost.kt:499-512`) correctly handles `handler.post` returning false, and
  the reason for hand-rolling it (`kotlinx-coroutines-android` absent) is real — verified in
  `frak-sdk/build.gradle.kts:14` and `libs.versions.toml`.
- **Java call-site fixture is a good idea and correct** (`src/test/java/…/JavaCallSiteFixture.java`); the
  `.api` dump confirms `ResultCallback` is a SAM interface, `heightFraction` chains, and
  `FrakSharingDefaults.getHEIGHT_FRACTION()` is a static getter rather than an inlined constant.
- **`heightFraction` misuse is double-guarded**: `require` at the Builder (`FrakSharing.kt:52-58`, NaN
  handled) and `clampSharingHeightFraction` internally (`FrakSharingDefaults.kt:40-46`).
- **`build(activity)` before `onCreate` fails loudly** with a real message (`FrakSharing.kt:71-75`) instead
  of AndroidX's generic one.
- **`present()` twice / two instances** → `AlreadyPresenting`, guard lives with the session not the Activity
  (`SharingHost.kt:257-269`, `SharingPresentDecisionTest`).
- **`SharingHostStyle`** feature-detects `DOCUMENT_START_SCRIPT`, logs on both degradation paths, catches the
  origin-rule throw, and the injected script is int-interpolated only — no injection surface
  (`SharingHostStyle.kt:25-56`).
- **Install-code clipboard** is marked `EXTRA_IS_SENSITIVE` on API 33+ (`NativeShare.kt:50-55`).
- **`openExternally` scheme allow-list** rejects `intent:`/vendor schemes (`SharingSheetState.kt:439`).
- **The `SharingSheetState` concurrency model** is sound by confinement (see F13) — I traced every mutation.

## Could not verify

- Actual APK/dex cost of the Compose dependency (no toolchain). F3's 1.5–2.5 MB is an estimate, flagged as
  such; the missing gate is verified fact, the number is not.
- Whether an unbounded stream of `sharing` interactions (F4) actually costs the merchant money — that
  depends on campaign configuration in `services/backend`, which I did not audit.
- Whether the wallet `/sharing` page needs any cookie or `localStorage` state in the native embed. If it
  does, note that the SDK shares the app-global WebView cookie jar and storage with the merchant's own
  WebViews (`SharingWebView.kt:210` can only scope *third-party* cookies), so a merchant calling
  `CookieManager.removeAllCookies()` or `WebStorage.deleteAllData()` on logout would silently wipe it. There
  is no isolation mechanism available on Android and no warning in the docs.
- Predictive-back behaviour on Android 15/16: `ComponentDialog` registers with `OnBackInvokedDispatcher`, so
  back works, but the callback implements only `handleOnBackPressed` (`SharingSheetDialog.kt:34-38`) — no
  progress animation. I could not confirm what Android 16's mandatory predictive back does to a
  `Theme_Translucent_NoTitleBar` child window.
- Whether disposing a composition from inside its own effect coroutine (the `exit()` → `state.dismiss()` →
  `dialog.dismiss()` → `disposeComposition()` chain, `FrakSharingSheet.kt:205-214` →
  `SharingHost.kt:383-407`) is actually safe. `08` §9.10 says "believed safe rather than known to be"; I
  cannot improve on that without running it.
- Status-bar icon contrast over the 32% scrim for a host app using `windowLightStatusBar` (dark icons).
  `SharingSheetDialog.kt:53-55` assumes light icons; I could not judge the result without a device.

---

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "17 findings ranked worst-first, each with path:line evidence, severity, axis, fix sketch and register status; written to /tmp/frak-audit/android-sharing-sheet.md. Includes 3 register contradictions (9.13 AtomicBoolean fabrication, 1.2b dex-budget-in-CI, 08 §9.10 insets) and 1 confirmation with corrected anchors (9.14 at SharingHost.kt:157-161, not 242-247)."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "grep -rn \"Atomic|@Volatile\" sdk/android/frak-sdk-ui/src/",
      "result": "passed",
      "summary": "no matches (exit 1) — disproves register 9.13's AtomicBoolean claim"
    },
    {
      "command": "grep -rni dex sdk/android",
      "result": "passed",
      "summary": "no dex-budget task or frak.sdk.dexBudgetKb property exists anywhere in sdk/android"
    },
    {
      "command": "grep -rn \"SharingHost(|SharingPresentation|createSharingSheetDialog|FrakSharingSheet|NativeShare\" sdk/android/frak-sdk-ui/src/test/",
      "result": "passed",
      "summary": "host/window layer has zero constructing tests — confirms register 8.2"
    },
    {
      "command": "grep -rn \"onTrimMemory|ComponentCallbacks2|onLowMemory\" sdk/android/frak-sdk-ui",
      "result": "passed",
      "summary": "no memory-pressure release for the pooled WebView (iOS has one)"
    },
    {
      "command": "grep -rn \"WebChromeClient|setWebContentsDebuggingEnabled|addJavascriptInterface\" sdk/android/frak-sdk-ui",
      "result": "passed",
      "summary": "no JS bridge (good), and no console/debug diagnostics at all (bad)"
    }
  ],
  "validationOutput": [
    "No compilation or test execution possible: no JDK, no Android SDK, no Gradle daemon in this environment. All verification is by source reading, as instructed.",
    "Every finding cites file:line against the worktree at commit c0a0cec."
  ],
  "residualRisks": [
    "F3's APK/dex cost figure (1.5-2.5 MB) is an unmeasured estimate; the absence of the enforcing gate is verified fact, the magnitude is not.",
    "F4's financial impact depends on services/backend campaign configuration, which was outside this area's scope.",
    "Compose-in-a-Dialog behaviours (predictive back on Android 16, self-disposing composition, ComposeView re-attach) cannot be settled without a device or emulator tier.",
    "I did not audit sdk/android/frak-sdk (core), apps/wallet's /sharing page, or the iOS twin; cross-cutting claims about them are flagged as unverified."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository files were modified. Only /tmp/frak-audit/android-sharing-sheet.md was written.",
  "reviewFindings": [
    "high: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharing.kt:95 - empty onDispose leaves a live sheet on screen after the Compose screen navigates away; onResult fires into a dead composition",
    "high: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingWarmup.kt:13 + SharingSheetState.kt:451 + SharingHost.kt:232 - unguarded Frak.client reads throw FrakError.NotInitialized into a scope with no CoroutineExceptionHandler / into a WebView callback, killing the merchant process after Frak.shutdown()",
    "high: sdk/android/frak-sdk-ui/build.gradle.kts:48-51 - Compose runtime + material3 imposed on every merchant for 5 symbols, against a 256 KB dex budget (docs/plans/native-sdk/02-sdk-design.md:26) whose enforcing task does not exist in the repo",
    "high: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/NativeShare.kt:24 + SharingSheetState.kt:278-286,323-327 - SharingResult.Shared and a signed sharing interaction are emitted on chooser open, loopable without limit via shareAgain; EXTRA_CHOSEN_COMPONENT never requested",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:157-161 - buffered-result replay clears before delivering (register 9.14, confirmed, re-anchored from the stale 242-247)",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharingSheet.kt:155,175 - TalkBack traverses the hidden WebView behind the skeleton; no paneTitle announcement for the modal",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:227 + FrakSharing.kt:98 - one eagerly-warmed WebView per Activity with no onTrimMemory release",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:262 - present() Ignore path is silent: no callback, no log",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:286 + NativeShare.kt:24 - chooser and external links launched from the application context with FLAG_ACTIVITY_NEW_TASK despite an Activity being available",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharingSheet.kt:143 - only navigationBars insets applied; heightFraction(1.0f) renders under the status bar and display cutout",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingWebView.kt:185-220 - no WebChromeClient and no setWebContentsDebuggingEnabled, so a blank sheet is undiagnosable in logcat",
    "medium: docs/plans/native-sdk/06-open-findings.md:105 - register 9.13 describes an AtomicBoolean fix that does not exist and cites SharingSheetState.kt:215, which is an unrelated comment",
    "medium: sdk/android/frak-sdk-ui/src/test/ - SharingHost, SharingPresentation, SharingSheetDialog, FrakSharingSheet and NativeShare have zero constructing tests (confirms register 8.2)",
    "medium: packages/wallet-shared/src/sharing/hooks/useSharingPageController.ts:231-238 vs NativeShare.kt:18-23 - native share sends a bare URL where web/Tauri sends localized title+text+preview image",
    "low: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:150 - after rotation a live session can report to the other FrakSharing instance's callback",
    "low: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:337 - chrome pinned to lightColorScheme while the hosted page is free to honour prefers-color-scheme: dark",
    "nit: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingSheetState.kt:296-303 - the Copy claim is never released, so a second copy tap is a silent no-op"
  ],
  "manualNotes": "Three register rows are wrong and should be corrected before anyone else uses 06-open-findings.md as a map: (1) 9.13's AtomicBoolean mechanism does not exist — the real fix was thread confinement via SharingSheetState.kt:124's stateContext, and it looks correct; (2) 1.2b claims the dex size budget entered CI, but no dex task or frak.sdk.dexBudgetKb property exists anywhere in the tree, so 02-sdk-design.md:26's 256 KB budget is entirely unenforced; (3) 08 §9.9 says an unconstructable WebView is reported as FrakError.Decoding — the code reports FrakError.InternalFailure (SharingHost.kt:290-296). 9.14 is real and still shipped, at SharingHost.kt:157-161 rather than the branch anchor 242-247. The cheapest high-value fixes are F2 (swap three Frak.client reads for Frak.clientOrNull, under an hour) and F12 (a WebChromeClient forwarding console messages), which together make the first device pass diagnosable instead of a coin flip."
}
```
