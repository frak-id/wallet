# iOS sharing sheet audit — `sdk/ios/Sources/FrakSDKUI`

Worktree: `/home/dev/wallet-audit` @ `c0a0cec` (detached, read-only). No toolchain; every claim below is read from source.

## Summary

Not alpha-ready as a *merchant-presentable* surface, though the pure logic underneath it is in good shape. The state machine that decides tiers, retries and reclaim is careful, well-factored and (for the ~380 lines that escape `#if canImport(UIKit)`) genuinely tested. Everything that touches UIKit/WebKit — 2,160 of the module's 2,539 lines — has never executed anywhere: CI cross-compiles it at the simulator triple and then runs `swift test` on the **macOS host**, where `canImport(UIKit)` is false, so `SharingSheetModel`, `SharingPresenter`, `SharingWebViewPool`, `SharingWebView`, `NativeShare` and `StoreOverlay` are compiled-and-discarded in the test binary (`sdk/ios/scripts/run.sh:73-83`, `.github/workflows/apps.yaml:200-207`).

The single worst thing: **`SharingWebViewPool.warm(_:)` has no `lent` guard** (`SharingWebViewPool.swift:37-52`), so the warm-up task finishing *after* a tap rebinds and re-navigates the web view the live sheet is holding. That is not an edge case — it is the first share of every app session, the exact path a merchant demo takes. The user gets 5 s of pulsing skeleton and then the raw OS chooser.

Close behind: `NativeShare.share` can suspend forever (`NativeShare.swift:38-58`). Commit `78c96b8` fixed two real bugs and, in doing so, deleted the only escape hatch for a refused presentation without replacing it — and the tier-3 path calls it while the sheet is mid-presentation, which is precisely when UIKit refuses.

Also: UIKit merchants cannot present this at all (the only public entry point is a SwiftUI `ViewModifier`), the iOS 15 layout branch — iOS 15 being the declared floor — is visibly wrong, and `isInspectable` is never set, so the first person to bring this up on a device cannot open Web Inspector on the page they are debugging.

Register accuracy: `06-open-findings.md` §4/9.1 and `07-sharing-sheet-audit.md` §"iOS gets two seams" describe `AttributionLedger`, `attributions.begin()`, `pendingLaunch`, `pendingReports`, `abandonGrace` and `selfUntilSettled`. **None of those identifiers exist in the tree.** Every per-file line count in 8.2 and 07 is wrong. `03-sharing-and-install.md:250` claims a simulator XCUITest pass; no XCUITest target exists in the repo.

---

## Findings

### F1. `SharingWebViewPool.warm(_:)` has no `lent` guard: the warm-up hijacks the live sheet's web view

- **Severity**: high
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift:37-52` — the only guards are `destroyed` and an unchanged URL:
    ```swift
    func warm(_ url: String) {
        guard !destroyed else { return }
        if pooled?.rendererGone == true { warmURL = nil }
        guard warmURL != url, let target = URL(string: url) else { return }
        warmURL = url
        …
        let view = pooled ?? makeView()
        pooled = view
        view.bind(warmBinding(view, trace: trace))   // ← severs the live sheet's binding
        view.load(target, baseURL: url)              // ← navigates the live sheet away
    }
    ```
  - `sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift:82-99` — `acquire` sets `lent = true` but leaves `pooled` pointing at the lent view, so `pooled` is non-nil and `warm` picks it up.
  - `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:196-227` — `SharingPresenter.warm()` calls `poolIfPossible()?.prepare()` **before** two network awaits (`client.anonymousId`, `client.config.resolve()`) and only then `poolIfPossible()?.warm(...)`. The pooled view therefore exists and is lendable for the entire duration of those awaits.
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:44` — `.task { await presenter.warm() }`; the window opens the moment the merchant's screen appears.
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:471-475` — `loadSessionURL` is one-shot (`guard !sessionLoaded`), so the session never re-navigates and cannot recover.
- **What actually happens**: user opens the merchant screen and taps Share before the identity mint + `config.resolve` round trips finish (a cold start, i.e. the *first* share of every app session). `acquire` lends the pooled view, the session URL is loaded, then `warm()` resumes and rebinds the same view to `warmBinding` (`sid=warm`) and loads the warm URL over the top. The model's `onPageReady`/`onAction`/`onLoadFailed` callbacks are now wired to the pool, not to the sheet: `model.page` stays `.loading`, the skeleton never lifts, every button on the page is dead, and at 5 s the load deadline fires tier 3 and the raw `UIActivityViewController` appears over the skeleton. Nothing the merchant designed for is shown.
- **Fix sketch**: `guard !lent` at the top of `warm(_:)` (record the URL for the next `release` re-warm instead), or have `SharingPresenter.warm()` re-check `pool.hasWarmView` after each await before calling `warm`.
- **Register status**: NEW. Android has the same missing guard (`sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingWebViewPool.kt:32-39` — `if (destroyed) return` … `pooled ?: newHandle()`, no `lent` check), so this is a cross-platform defect, not an iOS port slip.

### F2. `NativeShare.share` can suspend forever; commit 78c96b8 removed the only escape hatch and the tier-3 path is the case that needs it

- **Severity**: high
- **Axis**: correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/NativeShare.swift:38-58`:
    ```swift
    guard presenter.presentedViewController == nil, presenter.viewIfLoaded?.window != nil
    else { return false }
    let latch = ResumeLatch()
    return await withCheckedContinuation { continuation in
        controller.completionWithItemsHandler = { … }
        presenter.present(controller, animated: true)
    }
    ```
    There is no path out of the continuation other than `completionWithItemsHandler` firing.
  - `git show 78c96b8` deleted the post-present fallback (`if controller.presentingViewController == nil, latch.claim() { continuation.resume(returning: false) }`) and its own message concedes the residue: *"A presentation accepted and torn down before the handler fires still leaks; that needs a device to reproduce."* The replacement guard covers "presenter is already presenting" and "presenter is out of the window hierarchy" — it does **not** cover "presenter is itself mid-presentation", which UIKit also refuses.
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:395-408` (`prepare`) → `case .nativeShare(let session): await fallBack(to: session)`. `prepare` runs from `SharingPresentation.start`'s `Task` (`SharingPresentation.swift:127`), i.e. it can resolve *during the sheet's present-and-animate*.
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:130` — `build` returns a **no-page** session whenever `resolveConfig()` throws (`SharingSheetModel.swift:531-541`), and `buildWithRetry` does not retry that (it is not a throw). `sharingDecision` then answers `.nativeShare` immediately (`SharingSheetLogic.swift:96-106`).
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:566-576` — `fallBack` calls `settleContent()` first, cancelling the 5 s deadline. Nothing else can fire afterwards.
- **What actually happens**: with the config resolve failing or backing off (a backend blip, a bad merchant id, an expired backoff window), the user taps Share, the sheet animates in, `fallBack` runs mid-animation, `topViewController()` returns the still-transitioning sheet host, both guards pass, `present` is silently refused by UIKit, the completion handler never fires, and `await` never returns. The deadline is already cancelled. **The sheet sits on a pulsing skeleton forever**; the only exit is the user swiping it away, which reports `.dismissed`. The `CheckedContinuation` leaks with a runtime warning. The same shape wedges the `.share` action permanently, since `claimed` is only cleared on the `false` return (`SharingSheetModel.swift:295-299`).
- **Fix sketch**: race the continuation against a watchdog (`Task.sleep` + `latch.claim()`), or defer `present` to `transitionCoordinator?.animate(alongsideTransition:completion:)` / the next runloop turn and re-assert presentability there.
- **Register status**: overstated in `06-open-findings.md` §4 (the commit is filed as a fix; it is a net improvement but leaves a *wider* hang than the code it replaced, because tier-3 now calls into it during presentation). CONTRADICTS the implication in `78c96b8`'s message that the remaining leak "needs a device to reproduce" — the tier-3-during-presentation path is reachable by reading alone.

### F3. `SharingPresenter.teardown()` abandons a live session: no `dispose`, no `onResult`, live sheet stranded on the skeleton, WKWebView leaked

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:255-266`:
    ```swift
    func teardown() {
        phase = .idle
        presentation?.reclaimWebView()   // no-op: guarded on `disposed`, which is still false
        presentation = nil               // ← @Published; the live sheet re-renders
        pool?.destroy()
        pool = nil
    }
    ```
    `dispose()` is never called, so `disposed` stays false, `reclaimWebView()`'s `guard disposed, !reclaimed` (`SharingPresentation.swift:53`) short-circuits, and `pool.destroy()` bails on `guard !lent` (`SharingWebViewPool.swift:140`).
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:52` — `.onDisappear { presenter.teardown() }` on the merchant's own content view.
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:104-106` — the sheet body renders `SharingSheetSkeleton()` whenever `presenter.presentation` is nil.
  - `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:242-252` — `finish` returns immediately on `case .idle`, so `onDismiss`'s later `finish()` reports nothing.
- **What actually happens**: anything that removes the host view while the sheet is up (a `TabView` switch, a programmatic `NavigationStack` pop, a deep-link-driven route change, a `List` row recycling if a merchant ignores the "hoist to a screen-level view" doc) instantly swaps the user's rendered sharing page for the pulsing skeleton, and the merchant's `onResult` is never called for that presentation at all. The `WKWebView` and its two content processes are leaked for the process lifetime: nothing reaches `release` or `destroy` after this.
- **Fix sketch**: in `teardown`, if `case .live(let current) = phase`, call `current.dispose()` (and report `.dismissed`) before clearing `presentation`/`pool`.
- **Register status**: NEW.

### F4. UIKit merchants cannot present the sheet; the public surface is three symbols and one of them is a SwiftUI modifier

- **Severity**: high
- **Axis**: merchant-setup / DX
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - The entire public surface of `FrakSDKUI` is `View.frakSharingSheet(isPresented:request:heightFraction:onResult:)` (`FrakSharingSheet.swift:16-33`), `SharingResult`/`SharingResult.Kind` (`SharingResult.swift:4,16`) and `FrakSharingDefaults` (`SharingSheetLogic.swift:245`). Verified by `rg '^\s*public ' sdk/ios/Sources/FrakSDKUI/` — six hits, no more.
  - `SharingPresenter`, `SharingPresentation`, `SharingSheetModel`, `NativeShare` are all `internal` (`SharingPresentation.swift:11,143`, `SharingSheetModel.swift:15`, `NativeShare.swift:8`), so there is no lower-level door either.
  - `docs/plans/native-sdk/07-sharing-sheet-audit.md:635` already says so ("iOS has the identical gap … UIKit apps are equally locked out"); `docs/plans/native-sdk/08-sharing-sheet-api.md:327,454` sketches `FrakSharingPresenter.present(_:from:)` as step **D**, i.e. last.
  - `sdk/ios/README.md` has no UIKit integration snippet; nothing in the repo shows a `UIHostingController` bridge.
- **What actually happens**: the first merchant (My Moulinex, `com.groupeseb.moulinex.food`) has to invent the bridge themselves — a zero-size `UIHostingController` child added to their view controller, kept in the hierarchy so the sheet has something to present from, with a `Binding<Bool>` plumbed out of SwiftUI by hand. Get the hosting controller's frame or lifetime wrong and `topViewController()` (`NativeShare.swift:87-97`) walks somewhere else and the OS chooser refuses to present (see F2). Nothing documents any of this.
- **Fix sketch**: ship `@MainActor public final class FrakSharingPresenter { public func present(_ request: SharingRequest, from: UIViewController, onResult:) }` wrapping the existing `SharingPresenter` + a `UIHostingController`; reimplement `.frakSharingSheet` on top of it (08 §D).
- **Register status**: confirms `07-sharing-sheet-audit.md` §3.1 / `08-sharing-sheet-api.md` step D. Escalating: for a first alpha whose only merchant is a large consumer app, "step D" is the wrong ordering.

### F5. iOS 15 is the declared floor and its layout branch is visibly wrong

- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/ios/Package.swift:12` — `.iOS(.v15)`.
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:189-201`:
    ```swift
    if #available(iOS 16.0, *) {
        content.presentationDetents([.fraction(fraction)]).presentationDragIndicator(.visible)
    } else {
        GeometryReader { proxy in content.frame(height: proxy.size.height * fraction) }
    }
    ```
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:167-175` — `presentationBackground(.clear)` is `iOS 16.4+` only, so on iOS 15/16.0–16.3 the sheet keeps its opaque system background.
  - `sdk/ios/Sources/FrakSDKUI/SharingWebView.swift:64-65` — `view.isOpaque = false; view.backgroundColor = .clear`.
- **What actually happens**: on iOS 15 the `.sheet` is presented full-height (no detents exist), the content is squeezed to 85 % of that height and pinned to the top by `GeometryReader`'s `.topLeading` alignment, leaving a ~15 % band of bare system-background at the bottom of the sheet, no grabber, and a transparent web view compositing onto that background. Nobody has ever looked at this; there is no iOS-15 branch in any test or harness.
- **Fix sketch**: either raise the floor to `.iOS(.v16)` and delete both fallback branches, or wrap the iOS 15 content in a bottom-aligned container with an opaque background.
- **Register status**: NEW.

### F6. `StoreOverlay.present()` reports success it cannot observe; the install handoff silently does nothing on Simulator and on Apple Silicon Macs

- **Severity**: medium
- **Axis**: correctness / UX
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/StoreOverlay.swift:22-38` — the only failure it reports is "no foreground scene" (or Catalyst). `SKOverlay(configuration:).present(in:)` returns `Void`; no `SKOverlayDelegate` is set, so `overlay(_:didFailToPresentWithError:)` is never observed.
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:352-360`:
    ```swift
    if await isFrakAppInstalled(), await openFrakApp() == .openedApp { return }
    if !storeOverlay.present() { _ = await openFrakApp() }
    ```
    The `openFrakApp` fallback is gated on `present()`'s return value.
  - `#if targetEnvironment(macCatalyst)` (`StoreOverlay.swift:26`) does not cover "iOS app running unmodified on Apple Silicon macOS", where `SKOverlay` also does not present.
- **What actually happens**: on the Simulator — the only place this will be exercised before alpha — `SKOverlay` never appears, `present()` returns `true`, and tapping "Get the app" on the sharing page does literally nothing, with no fallback. Same on an iPad app running on a Mac. The first bring-up will read this as "the install handoff is broken" and hunt in the wrong place.
- **Fix sketch**: set an `SKOverlayDelegate` and fall back to `openFrakApp()` on `didFailToPresentWithError`; add a bounded "did the overlay actually appear" timer for the delegate-silent case.
- **Register status**: NEW.

### F7. `WKWebViewConfiguration`: persistent shared data store, no app-bound-domains note, no `isInspectable`, no memory-pressure handling

- **Severity**: medium
- **Axis**: security / merchant-setup / DX
- **Complexity to fix**: small (<1d)
- **Evidence**: the whole configuration is five lines — `sdk/ios/Sources/FrakSDKUI/SharingWebView.swift:55-58,62-72`:
  ```swift
  let configuration = WKWebViewConfiguration()
  configuration.websiteDataStore = .default()          // persistent, and app-global
  configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
  …
  view.allowsLinkPreview = false
  view.allowsBackForwardNavigationGestures = false
  view.isOpaque = false; view.backgroundColor = .clear
  view.navigationDelegate = self
  view.scrollView.contentInsetAdjustmentBehavior = .never
  view.scrollView.bounces = false
  ```
  Four separate gaps:
  1. **`.default()` is the app-wide store.** Cookies, localStorage and IndexedDB written by `wallet.frak.id` are shared with every other `WKWebView`/`SFSafariViewController`-adjacent surface in the merchant app, persist across launches, and are never cleared. Nothing in `FrakSDKUI` reads `TrackingConsent` (`rg TrackingConsent sdk/ios/Sources/FrakSDKUI` → zero hits), so **withdrawing consent leaves the wallet page's stored state on disk** — the FrakSDKUI privacy manifest (`PrivacyInfo.xcprivacy`) declares the `clientId` in the URL but says nothing about persisted web storage.
  2. **`limitsNavigationsToAppBoundDomains` is never mentioned** and neither is `WKAppBoundDomains`. A merchant whose `Info.plist` declares `WKAppBoundDomains` (common in apps doing in-app auth) silently restricts **every** `WKWebView` in the process to that list, so `wallet.frak.id` fails to load and the sheet degrades to tier 3 on every share, permanently. No doc, README or plan file warns about this.
  3. **`isInspectable` is never set** (iOS 16.4+ defaults to `false`), so Safari Web Inspector cannot attach to the hosted page. For a surface that has never run anywhere, this is the debugging tool the first bring-up needs most.
  4. **No memory handling.** The pool holds one `WKWebView` (two processes) for the whole life of the merchant screen with no `UIApplication.didReceiveMemoryWarningNotification` release and no `didEnterBackground` teardown; the only tear-down path is `teardown()`, which F3 shows can also fail to run.
- **What actually happens**: (1) a privacy story the manifest does not cover and consent withdrawal does not honour; (2) a whole class of merchant app for which the sheet never works and there is no diagnostic; (3) a device bring-up with no inspector; (4) an idle merchant screen holding two WebKit processes under memory pressure.
- **Fix sketch**: `#if DEBUG view.isInspectable = true #endif`; document the `WKAppBoundDomains` interaction in `sdk/ios/README.md`; decide `.nonPersistent()` vs `.default()` explicitly and, if persistent, wire `WKWebsiteDataStore.default().removeData` into the consent-withdrawal path.
- **Register status**: NEW (S11 covers the `clientId`-in-URL half only, `06-open-findings.md:41`; the persisted-store and app-bound-domain halves are unfiled).

### F8. `SharingSheetModel.share()` has no `fellBack` guard: two choosers, two attributed `sharing` interactions

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:280-300` — `share()` guards on `session` and `claim(.share)` only.
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:566-576` — `fallBack` guards on `fellBack`, but `share()` does not consult it.
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:334-338` — `onPageAction` calls `settleContent()` (cancels the deadline) *synchronously*, but only after the deadline `Task` may already have entered `onDeadline` → `Task { await fallBack(to:) }` (`SharingSheetModel.swift:550-561`).
  - `sdk/ios/Sources/FrakSDKUI/NativeShare.swift:38-39` — the presenter check is `presenter.presentedViewController == nil` on the *deepest* presented VC, which is the first `UIActivityViewController`; it presents nothing, so the guard passes and a second chooser is stacked.
- **What actually happens**: a Share tap landing in the same runloop turn as the 5 s deadline raises two OS choosers; each completed one calls `trackSharing()` (`SharingSheetModel.swift:578-580`), billing two reward-bearing `sharing` interactions for one share. Narrow, but the register's §4 entry claims this family was closed by settling the budget in `onPageAction` — it closed the *common* case, not this one.
- **Fix sketch**: `guard !fellBack, !closed else { return }` at the top of `share()` and `copy()`.
- **Register status**: overstated in `06-open-findings.md:161` ("fixed on both platforms by settling the tap-to-content budget at the top of `onPageAction`").

### F9. Accessibility: the sheet announces nothing while loading, and the content-lost surface is a silent blank

- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - Only two accessibility modifiers exist in the whole module, both `accessibilityHidden(true)`: `SharingSheetSkeleton.swift:57` and `FrakSharingSheet.swift:239` (the grab strip).
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:249-253` — `ContentLostSurface` is `Color(.systemBackground)` with no label, no trait, no announcement.
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:229-241` — the grab strip is a 44 pt hit-testable `Color.clear` stacked **over** the web view under `.ignoresSafeArea()`, so it swallows every touch in the top 44 pt of the page.
  - Android does provide a semantics `dismiss` action for its equivalent (`sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharingSheet.kt:145-151`); iOS relies entirely on the system sheet's escape gesture.
  - Dynamic Type: the skeleton uses hard point sizes (28/92/108/48, `SharingSheetSkeleton.swift:22-46`) and the sheet is a fixed `.fraction(0.85)` detent that does not grow for accessibility text sizes.
- **What actually happens**: a VoiceOver user opening the sheet hears nothing for the whole load (skeleton is hidden, web view has no content yet), and after a renderer crash hears nothing at all — an empty modal with no stated purpose. Sighted users lose any tap in the top 44 pt of the page; today that band is the merchant header row (`chrome: { mode: "none" }` when embedded, `apps/wallet/app/module/sharing/component/SharingView.tsx:113`), so nothing interactive is lost — but that is a wallet-side detail the SDK does not control.
- **Fix sketch**: `.accessibilityElement(children: .contain).accessibilityLabel(…)` + `accessibilityAddTraits(.isModal)` on the sheet root; give `ContentLostSurface` a label and post an `.announcement`; keep the skeleton announced as "Loading".
- **Register status**: NEW.

### F10. The register describes a launch queue that does not exist, and every line count in it is wrong

- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `docs/plans/native-sdk/06-open-findings.md:152` (§4, finding 9.1) describes `AttributionLedger`, `attributions.begin()`, `SharingSheetModel.abandon(onSettled:)`, `SharingPresentation.abandonGrace`, `selfUntilSettled`, `pendingLaunch`, `pendingReports`. `rg 'AttributionLedger|pendingLaunch|pendingReports|abandonGrace|selfUntilSettled|attributions|disposing' sdk/ios/` returns **zero matches**. (The entry does say "REVERTED in the first-QA pass" mid-paragraph, ~900 words in — after ~500 words describing the mechanism in the present tense and citing line numbers for it.) The current mechanism is `SharingPresenter.Phase { idle, live, reported }` (`SharingPresentation.swift:145-153`).
  - `docs/plans/native-sdk/06-open-findings.md:100` (8.2) claims "1,847 lines with zero executed coverage, **re-counted against the current tree**" with per-file figures `SharingSheetModel.swift (624)`, `SharingWebView.swift (379)`, `SharingWebViewPool.swift (152)`, `SharingPresentation.swift (318)`, `FrakSharingSheet.swift (248)`, `NativeShare.swift (126)`. Actual: 612, **507**, 165, 279, 254, 131 — total **1,948** for those six, plus `StoreOverlay.swift` (57) and `SharingSheetSkeleton.swift` (78), so **2,083** UIKit-gated lines of source, or 2,160 counting the `#if` shells. `SharingWebView` is out by 128 lines.
  - `docs/plans/native-sdk/07-sharing-sheet-audit.md:459-461` — "`SharingSheetModel` is 645 lines … 2,052 of `FrakSDKUI`'s 2,438 lines". Actual module total is 2,539.
  - `docs/plans/native-sdk/03-sharing-and-install.md:250` — "**One simulator pass has now run**, on the dismissal flows only (iOS 26, XCUITest driving tap-outside / drag-down / reopen against the harness)." `rg 'XCUI' example/native-ios .github/workflows` finds nothing; there is no UI-test target in `example/native-ios/project.yml`. This directly contradicts `06-open-findings.md:22` (T3: "iOS has none") and `AGENTS.md` ("iOS has had no device or simulator pass").
- **What actually happens**: a reviewer asked to audit "the launch queue (`launched`/`disposing`/`pendingLaunch`/`pendingReports`)" spends their budget looking for code that was deleted. The claimed simulator pass is load-bearing evidence for the dismissal flows and appears to be unreproducible.
- **Fix sketch**: rewrite 9.1 to describe the shipped `Phase` machine; recount 8.2 mechanically; delete or evidence the 03 XCUITest claim.
- **Register status**: CONTRADICTS `06-open-findings.md` 9.1 (mechanism absent), 8.2 (counts wrong), and `03-sharing-and-install.md:250` vs T3.

### F11. 9.5 is correct about the pool, and stops one step short of the consequence

- **Severity**: low
- **Axis**: correctness / docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - Verified true: `SharingWebViewPool` never calls `addSubview` (`SharingWebViewPool.swift`, whole file — only `removeFromSuperview` at :95, :112, :121, :142). `SharingWebView.init` builds `WKWebView(frame: .zero, …)` and never parents it (`SharingWebView.swift:60`). The only insertion is `SharingWebViewContainer.makeUIView` (`SharingWebView.swift:479-481`), reached only from `PresentedSharingSession` (`FrakSharingSheet.swift:130-133`), i.e. a presented sheet. **9.5's factual claim holds.**
  - The consequence 9.5 does not draw: a `WKWebView` with no window and a `.zero` frame is also laid out at 0×0 and does not paint, so the page's `requestAnimationFrame`-gated `ready` ping (`apps/wallet/app/module/sharing/host/useHostBridge.ts:20-31`) cannot fire while warm. The SDK already relies on this (`SharingSheetModel.swift:44-47`, `.documentReady` "a warm page starts here even though its document is complete"), and the wallet page suppresses `ready` while `warm` anyway. But it means the warm document performs its entire first layout at viewport 0×0, and every `innerWidth`/`matchMedia`/container-query decision the React page makes at mount is made against that. Whether the page re-lays-out correctly when the sheet gives it a real size is exactly the sort of thing only a simulator answers.
- **What actually happens**: possibly nothing; possibly a first frame laid out for a 0-width viewport that flashes before reflow. Unknowable without a run.
- **Fix sketch**: give the pooled view a plausible frame (`UIScreen.main.bounds`-ish) at construction so the warm layout is not degenerate; add it to the simulator checklist.
- **Register status**: confirms 9.5's core claim; adds an untracked consequence.

### F12. `.onChange` ordering against `presenter.pendingRequest` is undefined-by-construction

- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:40-42` — `presenter.pendingRequest = request` is assigned as a side effect of `body`, and `launch()` (`FrakSharingSheet.swift:71-83`) reads it back from a closure that fires from `.onChange(of: isPresented)` (`:60`). The comment at `:40-41` and `SharingPresentation.swift:155-157` both explain *why* the value is not captured, but the correctness of the read depends on SwiftUI evaluating `body` before dispatching the `onChange` action, which is not a documented guarantee. The deprecated one-parameter `onChange(of:perform:)` is used (`:60`), not the iOS 17 two-parameter form.
- **What actually happens**: if the ordering ever flips (or a merchant mutates `request` from somewhere SwiftUI coalesces differently), a share is launched with the previous request — wrong products, wrong link, wrong attribution. The harness pattern (`example/native-ios/Sources/FrakExampleiOSApp/FrakExampleApp.swift:241-245`) sets request and `isPresented` in the same turn, which is the exact case this depends on.
- **Fix sketch**: pass the request through the binding (`Binding<SharingRequest?>`), or `.task(id: isPresented)`-free explicit `launch(request)` from a merchant-called method, so nothing depends on body/onChange interleaving.
- **Register status**: NEW.

### F13. `NativeShare.copy` writes the share link to the pasteboard with no `localOnly`, unlike the install code

- **Severity**: nit
- **Axis**: security
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/ios/Sources/FrakSDKUI/NativeShare.swift:62-64` — `UIPasteboard.general.string = link`, versus `copyInstallCode`'s `[.localOnly: true]` at `:76`. The share link carries the user's referral identity (`fCtx`).
- **What actually happens**: the referral link syncs via Universal Clipboard to the user's Mac/iPad and sits there indefinitely; the code path two functions down deliberately prevents exactly that for a lower-value secret.
- **Fix sketch**: `UIPasteboard.general.setItems([[UTType.url.identifier: url]], options: [.localOnly: true])`.
- **Register status**: NEW.

### F14. Is this presentable to a merchant at alpha, and the shortest path to confidence

- **Severity**: high
- **Axis**: tests
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - `sdk/ios/scripts/run.sh:73-83` (`do_test`) — compiles at `arm64-apple-ios15.0-simulator`, then `swift test` **with no flags**, i.e. on the macOS host.
  - `.github/workflows/apps.yaml:174-176` — "Compile-verified only, not executed on a simulator".
  - Consequence: `canImport(UIKit)` is false in the executed binary, so `FrakSharingSheet.swift:1`, `NativeShare.swift:1`, `SharingPresentation.swift:1`, `SharingSheetModel.swift:1`, `SharingSheetSkeleton.swift:1`, `SharingWebView.swift:1`, `SharingWebViewPool.swift:1`, `StoreOverlay.swift:1` all compile to nothing. The four `FrakSDKUITests` suites (`SharingSheetLogicTests.swift`, `SharingPageURLTests.swift`, `SharingReclaimTests.swift`, `SharingResultTests.swift`) test only the ungated helpers.
  - Of the fourteen findings above, **F1, F2, F3, F6, F8 are all in that dead zone** and none of them is reachable by any existing test.
- **What actually happens**: shipping this to My Moulinex means the merchant's QA is the first execution of ~2,100 lines. F1 alone makes the *first share of every session* look broken.
- **Fix sketch (shortest path to confidence, in order)**:
  1. Add an XCUITest/unit target in `example/native-ios/project.yml` running on a simulator — this is the only thing that turns F1/F2/F3/F6 from reading into evidence, and it also settles `03:250`'s unbacked claim. Half a day of project plumbing.
  2. Before that lands, fix F1 (`guard !lent`) and F2 (watchdog on `NativeShare.share`) by inspection — both are ≤5-line changes and both are certain.
  3. Extract the `SharingPresenter.Phase` machine and `SharingSheetModel`'s tier/claim sequencing into `SharingSheetLogic.swift` (the `sharingDecision` precedent) so the ordering is host-testable; 8.2 already prescribes this and it is still the right call for the parts that do not need WebKit.
  4. Set `isInspectable` in DEBUG (F7) before anyone touches a device.
- **Register status**: confirms `06-open-findings.md` 8.2 and T3; corrects their counts (F10) and their claim that the launch queue is the thing to extract (it no longer exists).

---

## Verified-OK

- **Report-once contract holds on the paths I could trace.** `SharingPresenter.finish` (`SharingPresentation.swift:242-252`) plus the `onlyIfUnpresented` split (`FrakSharingSheet.swift:57-64, 87-92`) correctly handles: binding true at first render, merchant flipping the binding false mid-sheet, sheet self-closing via `onClose`, and the `.reported` (pool refused) path. `onDismiss` after a `.idle` phase is a no-op. No double `onResult` found. `best`/`significance` upgrade logic (`SharingResult.swift:39-49`) is sound and `.installStarted` is deliberately reported at the tap so nothing can outrank it later (`SharingSheetModel.swift:342-350`).
- **iPad popover is anchored.** `NativeShare.swift:19-26` sets `sourceView`, a centred zero-size `sourceRect` and `permittedArrowDirections = []`. **No iPad crash.** (This is the one thing the brief flagged as a likely hard crash; it is not.)
- **`sharingChooserCompleted`** (`SharingSheetLogic.swift:145-148`) is a correct, well-tested predicate; `ResumeLatch` (`NativeShare.swift:106-119`) genuinely prevents the double-resume trap for extensions that fire twice.
- **Navigation policy is tight.** No `WKUserContentController`/`WKScriptMessageHandler` anywhere — no JS bridge to attack. Sub-frames cannot reach the return scheme (`SharingWebView.swift:307-311`), cross-origin sub-frames are cancelled (`:313`), `targetFrame == nil` (`window.open`) is re-issued in the main frame only when same-origin (`:319-323`), `sid` is checked against the binding before any action is dispatched (`:328-341`), and `isSameOrigin` compares scheme/host/port componentwise rather than by prefix (`:151-157`). `warmSessionId = "warm"` (`SharingPageURL.swift:9`) cannot be attributed to a real sheet.
- **`webViewWebContentProcessDidTerminate` is implemented** (`SharingWebView.swift:456-466`) and correctly clears `documentReady` *before* the `settled` guard, sets `rendererGone`, and cancels a booked retry; the pool clears `warmURL` on `rendererGone` (`SharingWebViewPool.swift:41`) so `warm(sameURL)` cannot short-circuit forever.
- **HTTP-error handling**: `decidePolicyFor navigationResponse` inspects the main-frame status code and routes 4xx/5xx into the retry ladder while suppressing the error document's `didFinish` (`SharingWebView.swift:406-424`, `:428-433`). Cancellations (`NSURLErrorCancelled`, `WebKitErrorDomain` 102) are filtered (`:246-253`).
- **Retry-ladder bookkeeping** (`SharingWebView.swift:186-232`) correctly resets per-document (`ladderURL`), guards duplicate failure callbacks (`retryPending`), ignores failures from a navigation not owned by the current binding (`navigationOwnedByBinding`), and cancels a booked retry on `bind`/`destroy`.
- **`sharingReclaim`** (`SharingSheetLogic.swift:181-190`) and its five tests are correct and match `SharingWebView.navigate(.activate:)`'s deliberate refusal to touch `loadedBaseURL`.
- **`sharingPageJSONNumber`** (`SharingSheetLogic.swift:225-234`) correctly reproduces `JSON.stringify`'s number formatting including `-0`; `clampedSharingHeightFraction` handles NaN.
- **Wire contract matches the wallet.** Every `HostResultAction` in `apps/wallet/app/module/sharing/host/bridge.ts:2-11` has an arm in `SharingPageAction.from` (`SharingWebView.swift:26-46`); `returnScheme(bundleId:)` (`SharingPageURL.swift:16-24`) produces exactly `^frak-[a-z0-9._-]{1,60}$` as `sanitizeReturnScheme` requires; `warmFragment`'s explicit `state=warm` is required because `SHARING_PARAMS.state.fragmentDefault === "live"` (`apps/wallet/app/module/sharing/params/table.ts:96-100`).
- **Swift 6 concurrency**: `@MainActor` on all five stateful types; the two `@unchecked Sendable` boxes (`ResumeLatch`, `SharingTrace.PreviousMark`) are `NSLock`-guarded; `build`/`seededReward` are `nonisolated` with `@Sendable` injected closures. CI cross-compiles this under `.swiftLanguageMode(.v6)` at the iOS triple, so it is genuinely checked. No data race found.
- **Dark mode / safe area**: `Color(.systemBackground)`/`Color(.secondarySystemBackground)` adapt; `contentInsetAdjustmentBehavior = .never` plus `.ignoresSafeArea()` is the correct pairing given the page insets its own footer from `env(safe-area-inset-bottom)`.

## Could not verify

- Whether SwiftUI actually evaluates `ViewModifier.body` before dispatching `onChange` actions (F12) — needs a run.
- Whether `UIActivityViewController.present` is in fact refused during the sheet's presentation transition (F2). The failure mode is documented UIKit behaviour, but the exact window is timing-dependent and unmeasurable here. The *absence of any escape from the continuation* is not in doubt.
- Whether `presentationDetents` have any visible effect on iPad regular-width form sheets, i.e. whether `heightFraction` is a silent no-op there.
- Whether the pooled 0×0 warm layout reflows cleanly when the sheet gives the view a real size (F11).
- Stage Manager / multi-scene: `topViewController()` (`NativeShare.swift:88-92`) and `StoreOverlay.foregroundScene()` (`StoreOverlay.swift:51-55`) both take `.first { $0.activationState == .foregroundActive }`, which is ambiguous with two foreground windows. Whether the chooser lands in the wrong window needs an iPad.
- Behaviour under a real jetsam (F7 item 4) — reasoned, not observed.
- Whether App Store review objects to `SKOverlay` for a *third-party* app's listing raised from an SDK's web page. The overlay is user-initiated and dismissible, which is the stated requirement, but nobody has submitted with it.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "14 findings written to /tmp/frak-audit/ios-sharing-sheet.md, each with severity, axis, complexity, path:line evidence, concrete failure mode, fix sketch and register status; plus a Verified-OK section with ~14 cited coverage bullets and a Could-not-verify section."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "rg/grep/find/sed over sdk/ios/Sources/FrakSDKUI, Tests/FrakSDKUITests, sdk/android/frak-sdk-ui, apps/wallet/app/module/sharing, docs/plans/native-sdk, .github/workflows/apps.yaml",
      "result": "passed",
      "summary": "Read-only static audit; no repo file modified."
    },
    {
      "command": "git show 78c96b8 --stat && git show 78c96b8",
      "result": "passed",
      "summary": "Confirmed the commit removed the post-present continuation escape hatch without replacing it (basis of F2)."
    },
    {
      "command": "rg 'AttributionLedger|pendingLaunch|pendingReports|abandonGrace|selfUntilSettled|attributions|disposing' sdk/ios/",
      "result": "passed",
      "summary": "Zero matches — the launch queue the register and the brief describe does not exist in this tree (F10)."
    },
    {
      "command": "wc -l sdk/ios/Sources/FrakSDKUI/*.swift",
      "result": "passed",
      "summary": "2539 total; contradicts every per-file count in 06 §8.2 and 07 (F10)."
    }
  ],
  "validationOutput": [
    "No compilation or test execution possible (no Swift toolchain, per task constraints). All findings derived by reading source.",
    "SharingWebViewPool.warm(_:) confirmed to lack a `lent` guard at SharingWebViewPool.swift:37-52; Android twin SharingWebViewPool.kt:32-39 has the same gap.",
    "NativeShare.share confirmed to have no path out of withCheckedContinuation other than completionWithItemsHandler (NativeShare.swift:38-58).",
    "SharingPresenter.teardown confirmed not to call dispose(), so reclaimWebView()/pool.destroy() both short-circuit (SharingPresentation.swift:255-266 vs :53 and SharingWebViewPool.swift:140).",
    "iPad popover anchoring confirmed PRESENT at NativeShare.swift:19-26 — the suspected hard crash does not exist.",
    "Register 9.5's claim (warm pooled WKWebView never enters a view hierarchy) confirmed true by exhaustive addSubview/makeUIView search."
  ],
  "residualRisks": [
    "F2's exact timing window (UIKit refusing a present during an in-flight sheet transition) is reasoned from documented behaviour, not measured; the unbounded continuation itself is certain regardless.",
    "iPad/Stage Manager multi-scene behaviour of topViewController() and StoreOverlay.foregroundScene() is unverifiable without hardware.",
    "Whether presentationDetents affect an iPad form sheet — i.e. whether heightFraction is a silent no-op on iPad — is unverified.",
    "The 0x0 warm-layout consequence (F11) may be benign; only a simulator run settles it.",
    "Roughly 2,100 lines of this module have never executed anywhere, so any of the Verified-OK bullets that depend on runtime WebKit/UIKit behaviour are read-verified only."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository files changed. One artifact written outside the repo: /tmp/frak-audit/ios-sharing-sheet.md.",
  "reviewFindings": [
    "high: sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift:37-52 - warm(_:) has no `lent` guard; a warm-up resuming after a tap rebinds and re-navigates the live sheet's WKWebView, killing the page's callbacks. Hits the first share of every app session.",
    "high: sdk/ios/Sources/FrakSDKUI/NativeShare.swift:38-58 - no escape from withCheckedContinuation if present() is refused; commit 78c96b8 deleted the only fallback. The tier-3 path calls this mid-presentation and wedges the sheet on the skeleton permanently.",
    "high: sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:16-33 - the only public entry point is a SwiftUI ViewModifier; a UIKit merchant (likely the first one) cannot present the sheet and has no documented bridge.",
    "high: sdk/ios/scripts/run.sh:73-83 + .github/workflows/apps.yaml:174-176 - ~2,100 UIKit-gated lines have zero executed coverage anywhere; 5 of the findings here sit in that dead zone.",
    "medium: sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:255-266 - teardown() abandons a live session: no dispose, merchant onResult never fires, live sheet reverts to the skeleton, WKWebView leaked.",
    "medium: sdk/ios/Package.swift:12 + FrakSharingSheet.swift:189-201 - iOS 15 is the declared floor and its no-detents layout branch leaves a blank band and no grabber.",
    "medium: sdk/ios/Sources/FrakSDKUI/StoreOverlay.swift:22-38 - present() reports success it cannot observe; on Simulator and Apple Silicon Macs the install handoff silently does nothing with no fallback.",
    "medium: sdk/ios/Sources/FrakSDKUI/SharingWebView.swift:55-58 - persistent app-global WKWebsiteDataStore never cleared on consent withdrawal; no WKAppBoundDomains guidance; isInspectable never set; no memory-pressure handling.",
    "medium: sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:280-300 - share() has no fellBack guard, so a tap racing the deadline can raise two choosers and bill two sharing interactions.",
    "medium: sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:239,249-253 - no VoiceOver announcement during load or after content loss; grab strip swallows the top 44pt of the page.",
    "medium: docs/plans/native-sdk/06-open-findings.md:100,152 and 03-sharing-and-install.md:250 - register describes AttributionLedger/pendingLaunch/pendingReports/abandonGrace (absent from the tree), every per-file line count is stale, and a simulator XCUITest pass is claimed with no target in the repo.",
    "low: docs/plans/native-sdk/06-open-findings.md:27 - register 9.5's factual claim VERIFIED CORRECT (warm pooled WKWebView never enters a view hierarchy); it stops short of the 0x0-warm-layout consequence.",
    "low: sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:40-42,60 - launch() reads presenter.pendingRequest set as a body side effect; correctness depends on undocumented body-vs-onChange ordering.",
    "nit: sdk/ios/Sources/FrakSDKUI/NativeShare.swift:62-64 - share link written to the pasteboard without .localOnly, unlike the install code two functions below.",
    "no blocker filed: the suspected iPad UIActivityViewController popover crash does NOT exist - sourceView/sourceRect/permittedArrowDirections are all set at NativeShare.swift:19-26."
  ],
  "manualNotes": "Two corrections to the brief's own premises. (1) The 'launch queue (launched/disposing/pendingLaunch/pendingReports)' does not exist at c0a0cec — it was reverted; the shipped mechanism is SharingPresenter.Phase{idle,live,reported} at SharingPresentation.swift:145-153. (2) The iPad popover is correctly anchored, so there is no hard crash there. The two things I would fix before letting any merchant near this are F1 (five-line guard) and F2 (watchdog), both of which are certain by reading and neither of which any test can currently catch."
}
```
