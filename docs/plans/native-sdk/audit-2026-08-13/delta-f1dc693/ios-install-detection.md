# Delta review — iOS post-install detection + App Store surface machinery

Range: `c0a0cec..origin/dev` (f1dc693). Worktree `/home/dev/wallet-audit`, read-only, no Swift toolchain — every claim below is read from source.

## Verdict on the delta

Better in shape, worse in exposure. The delta fixes two real things by inspection: `SharingPresenter.teardown()` now calls `dispose()` (`SharingPresentation.swift:272`), which closes the *leak half* of prior finding **ios-sharing-sheet F3**, and the default store surface moves from a fire-and-forget `SKOverlay` to `SKStoreProductViewController`, which actually observes whether it loaded and falls back when it does not — that is the first half of prior **F6**. Against that, the delta adds **330 lines of new UIKit-gated machinery that no test executes anywhere** (`InstallProbe` 110, `StoreProductPageInvite` 114, `StoreOverlayInvite` 67, `StoreInvite` 39), and `InstallProbeTests.swift:8-11` says so in its own doc comment. The probe is a repeating poll with no ceiling, and I found a **third leak** the "close two probe leaks" commit did not close (`stop()` never invalidates `generation`, so a `start()` suspended across teardown restarts the probe on a dead model) plus a **poll-chain fan-out** (`scheduleNextPoll` overwrites `poll` without cancelling it, and the foreground observer calls into it). Neither of the two iOS P1s the prior audit called certain-by-reading — `SharingWebViewPool.warm` missing `guard !lent`, `NativeShare.share` suspending forever — was touched. Net: for an alpha whose first execution is the merchant's QA, this delta increases the amount of never-run code on the install path by roughly a third while leaving the two five-line certainties open.

## Prior findings CLOSED by these commits

| Prior finding | Status | Proof |
|---|---|---|
| **ios-sharing-sheet F3** — `teardown()` abandons a live session: no `dispose`, WKWebView leaked | **Leak half closed** (report half open, see below) | `48d7e2c` adds `presentation?.dispose()` at `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:272`, before `reclaimWebView()`. `dispose()` sets `disposed = true` (`SharingPresentation.swift:62`), so `reclaimWebView`'s `guard disposed, !reclaimed` (`:44`) now passes → `pool.release(webView)` → `lent = false` (`SharingWebViewPool.swift:102`) → `pool.destroy()`'s `guard !lent` (`:135`) passes and the view is destroyed. The two WebKit processes are no longer leaked for the process lifetime. |
| **ios-sharing-sheet F6** — `StoreOverlay.present()` reports success it cannot observe; install handoff silently does nothing on Simulator | **Closed on the new default path only** | `0e74a65` makes `FrakSharingDefaults.install = .storeProductPage` (`SharingSheetLogic.swift:248`). `StoreProductPageInvite.present()` awaits `loadProduct` and returns its real answer (`StoreProductPageInvite.swift:33`), and `SharingSheetModel.openExternally` falls back to `openFrakApp()` on false (`SharingSheetModel.swift:367-368`). On Simulator the load fails, `present()` answers false, and the App Store URL is opened instead of nothing happening. **Not closed on `.overlay`** — see N6. |
| **ios-core F7** — `README.md:86-87` "Not implemented: … the install-code + pasteboard + `SKStoreProductViewController` handoff" | Closed | `48d7e2c`/`b68f989` rewrite `sdk/ios/README.md:80-83`; the stale sentence is gone and the test count moves 257 → 491. |
| **ios-core F2** — `LSApplicationQueriesSchemes` invisible to the merchant | **Partially** | `b68f989` adds `QueriedSchemes` (`sdk/ios/Sources/FrakSDK/AppLink/QueriedSchemes.swift:1-49`) and a one-shot diagnostic at `DefaultFrakClient.swift:384-392`; `README.mirror.md:92-95` now names the key. But it is a passing mention, not the checklist F2 asked for, and the diagnostic is unreachable by default — see N8. |

## Prior findings NOT closed, or made worse

- **ios-sharing-sheet F1 — `SharingWebViewPool.warm(_:)` has no `lent` guard.** Untouched: `git diff --stat c0a0cec origin/dev -- sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift` is empty; `SharingWebViewPool.swift:43-58` still reads `guard !destroyed` … `let view = pooled ?? makeView()` with no `lent` check. Still the first share of every app session.
- **ios-sharing-sheet F2 — `NativeShare.share` can suspend forever.** The only change in the whole delta is a comment reword (`NativeShare.swift:29-30`, `git diff … NativeShare.swift` = 2 insertions, 4 deletions). `NativeShare.swift:36-50` still has no exit from `withCheckedContinuation` other than `completionWithItemsHandler`.
- **ios-sharing-sheet F3 — the *report* half.** `teardown()` still sets `phase = .idle` **before** disposing (`SharingPresentation.swift:268,272`), so a later `finish()` hits `case .idle: return` (`:249-250`) and the merchant's `onResult` is never called for that presentation; `presentation = nil` (`:276`) still swaps the rendered page for `SharingSheetSkeleton` (`FrakSharingSheet.swift:104-106`). Only the resource leak was closed.
- **ios-sharing-sheet F13 — share link on the pasteboard without `.localOnly`.** `NativeShare.swift:57` is still `UIPasteboard.general.string = link`, two functions above `copyInstallCode`'s `[.localOnly: true]` (`:65`).
- **ios-sharing-sheet F14 — the dead zone.** Made materially worse: the delta adds 330 UIKit-gated lines to it, and `sdk/ios/Tests/FrakSDKUITests/InstallProbeTests.swift:8-11` concedes "*not executed by either `swift test` stage*". See N7.
- **ios-core F7 — `sdk/ios/README.md:154` "No CI builds either native SDK."** still contradicts `README.md:89-92` in the same file; `README.md:55` still names `InteractionTracker`; `README.md:45-58` is still titled "Public API surface" while listing internal types. The delta touched this file twice and fixed neither.
- **ios-sharing-sheet F5 (iOS 15 layout), F7 (`isInspectable`, `WKAppBoundDomains`), F8 (`share()` has no `fellBack` guard), F9 (accessibility), F12 (`onChange` ordering)** — all untouched.

---

## NEW findings introduced by these commits

### N1. `InstallProbe.stop()` does not invalidate `generation`, so a `start()` suspended across teardown restarts the probe on a released model — the third leak

- **Severity**: high
- **Axis**: correctness / performance
- **Complexity to fix**: trivial
- **Introduced by**: b68f989, incompletely fixed by 48d7e2c
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/InstallProbe.swift:47-59`:
    ```swift
    func start(sessionId: String, onDetected: @escaping (TimeInterval) -> Void) async -> Bool {
        stop()
        generation &+= 1
        let generation = generation
        guard await walletSchemeStatus() == .ok, generation == self.generation else { return false }
        self.sessionId = sessionId
        …
        scheduleForeground(sessionId: sessionId)
        scheduleNextPoll(sessionId: sessionId, startedAt: startedAt)
    ```
  - `InstallProbe.swift:61-71` — `stop()` cancels `poll`, removes `foregroundObserver`, nils `sessionId`/`startedAt`/`onDetected`. It **never touches `generation`**.
  - `walletSchemeStatus()` is a hop onto the `DefaultFrakClient` actor (`InstallProbe.swift:31-33` → `AppLinkAPI.swift:24-27` → `DefaultFrakClient.swift:373`), i.e. a genuine suspension behind whatever else that actor is doing.
  - `SharingSheetModel.release()` calls `installProbe?.stop()` (`SharingSheetModel.swift:182`) and is reached from `SharingPresentation.dispose()` (`SharingPresentation.swift:67`), i.e. from the user swiping the sheet away.
- **What actually happens**: the user taps Install, `installProbeURL` awaits `installProbe.start(...)` (`SharingSheetModel.swift:462`), and swipes the sheet down while that `await` is suspended. `release()` → `stop()` tears everything down but leaves `generation == 1`. `start` then resumes, its guard `1 == self.generation` **passes**, and it re-installs the `willEnterForeground` observer and re-arms the poll on a model that has already been disposed. `stop()` will never be called again — `release()` has run. The probe now calls `canOpenURL` every 1 s, then 2 s, then every 5 s, plus once per app foreground, for as long as the `SharingSheetModel` is alive; and because `SharingPresenter.finish` deliberately does **not** clear `presentation` (`SharingPresentation.swift:255-258`, and its doc at `:222-225`), the model stays alive for the whole life of the merchant's screen. Detection can never fire (`didDetectInstall` guards on `showingInstallPage`/`webView`, `SharingSheetModel.swift:481`), so this is pure battery burn plus a permanently registered NotificationCenter observer. The commit message's own framing — "a generation token closes the async gap in `InstallProbe.start`" — covers only the start-vs-start race, not the far more likely start-vs-stop one.
- **Fix sketch**: bump `generation` inside `stop()` (and have `start` capture *after* `stop()`), so any suspended `start` loses. Two lines. Add `deinit { … }` cannot help here — `stop()` is `@MainActor` and the observer must be removed explicitly.

### N2. The foreground observer forks an extra, uncancellable poll chain every time the app returns to foreground

- **Severity**: high
- **Axis**: performance / correctness
- **Complexity to fix**: trivial
- **Introduced by**: b68f989
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/InstallProbe.swift:83-90`:
    ```swift
    private func scheduleNextPoll(sessionId: String, startedAt: TimeInterval) {
        let delay = InstallProbeSchedule.interval(elapsed: now() - startedAt)
        poll = Task { [weak self] in            // ← previous `poll` dropped, never cancelled
    ```
  - `InstallProbe.swift:73-81` — the `willEnterForegroundNotification` observer calls `check(sessionId:)` directly; `check` does not cancel the in-flight `poll` (`:94-105`) and, when the wallet is still absent, calls `scheduleNextPoll` (`:100`), overwriting `poll` while the previous sleep is still pending.
  - `stop()` cancels only the single `poll` reference (`InstallProbe.swift:62`).
- **What actually happens**: every background→foreground cycle while the probe is running adds one permanent extra poll chain. Three trips out of the app (check a message, open the App Store app from an `SKOverlay`, take a call) and the SDK is calling `canOpenURL` four times per interval instead of once. Worse, the guard those orphan chains die on is `self.sessionId == sessionId` (`:95`, `:98`) — and the id passed in is the **model's own `sessionId`, constant for the model's whole life** (`SharingSheetModel.swift:462`). So any `stop()` followed by a second `start()` on the same model (the `onPageUnavailable` → `.shareAgain` → second Install-tap path, `SharingSheetModel.swift:246,320`) resurrects every orphaned chain at once, and `stop()` can only ever cancel the newest one. Combined with N1 the poll rate is unbounded from below by nothing at all.
- **Fix sketch**: `poll?.cancel()` at the top of `scheduleNextPoll`; make the guard a monotonic `generation` rather than the model's constant `sessionId`.

### N3. `dismiss()` during an in-flight `present()` is a no-op, so the App Store page appears seconds after the sheet is gone, on a window nothing owns

- **Severity**: medium
- **Axis**: correctness / UX
- **Complexity to fix**: small
- **Introduced by**: beba204
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/StoreProductPageInvite.swift:28-38` — `self.window` is assigned only *after* `await load(controller)` and the scene lookup:
    ```swift
    guard window == nil, loading == nil else { return true }
    …
    guard await load(controller) else { return false }
    guard let scene = StoreInvites.foregroundScene() else { return false }
    let window = hostWindow(in: scene)
    self.window = window
    window.rootViewController?.present(controller, animated: true)
    ```
  - `StoreProductPageInvite.swift:43-44` — `dismiss()` is `guard let window, let root = window.rootViewController else { return }`, i.e. a pure no-op while `window` is still nil.
  - `SharingSheetModel.release()` calls `storeInvite.dismiss()` (`SharingSheetModel.swift:186`), and `openExternally`'s `Task` captures `self` strongly (`SharingSheetModel.swift:357-369`), so the in-flight `present()` survives the teardown that was meant to cancel it.
  - The window is `windowLevel = .normal + 1`, `isHidden = false` (`StoreProductPageInvite.swift:73-75`).
- **What actually happens**: the user taps the install page's store CTA, then swipes the sharing sheet away before the (up to 5 s) `loadProduct` returns. `release()` → `dismiss()` does nothing. The load lands, a new `UIWindow` one level above everything is created, and a full-screen App Store product page for Frak Wallet appears over the merchant's app with no relation to any user gesture. There is no owner left that will dismiss it; the user must find StoreKit's own Cancel. On a `foregroundScene()` miss the outcome is milder but still wrong: `present()` answers false and `openFrakApp()` runs against a disposed session.
- **Fix sketch**: track a `cancelled` flag set by `dismiss()`; re-check it after the `load` await and after the scene lookup, and drop the controller instead of presenting.

### N4. A previous load's 5 s deadline settles the *next* load's continuation, so a second store tap within 5 s reports failure

- **Severity**: medium
- **Axis**: correctness
- **Complexity to fix**: trivial
- **Introduced by**: beba204
- **Evidence**: `sdk/ios/Sources/FrakSDKUI/StoreProductPageInvite.swift:84-101`:
  ```swift
  await withCheckedContinuation { continuation in
      loading = continuation
      controller.loadProduct(withParameters: parameters()) { … }
      Task { @MainActor [weak self] in
          try? await Task.sleep(nanoseconds: UInt64(Self.loadDeadline * 1_000_000_000))
          self?.settleLoad(false)          // ← never cancelled when the load wins
      }
  }
  ```
  `settleLoad` resumes whatever is in `loading` at the time (`:99-103`); it does not check that the continuation it is resuming is the one its own load created.
- **What actually happens**: load #1 succeeds at t=1 s and the page is presented. Its orphan deadline is still asleep. The user closes the page (`productViewControllerDidFinish` → `dismiss()` → `window = nil`, `:59-60,43-46`) and taps the store CTA again at t=3 s. Load #2 sets `loading`; at t=5 s load #1's deadline fires `settleLoad(false)` and resumes load #2's continuation with `false`. `present()` answers false, `openExternally` runs `openFrakApp()` (`SharingSheetModel.swift:368`) — and if the wallet is not installed that ends in `launcher.open(appStoreURL)` (`DefaultFrakClient.swift:425`), which throws the user out of the merchant's app to the App Store app, exactly the outcome the product page exists to avoid. Then load #2's real completion arrives and `settleLoad` no-ops, so the second page never appears either.
- **Fix sketch**: hold the deadline `Task` in a property and `cancel()` it in `settleLoad`; or tag each load with a token and compare in `settleLoad`.

### N5. The probe has no ceiling, and nothing about the store surface bounds it — the shipped code and the plan disagree about what does

- **Severity**: medium
- **Axis**: performance / docs-accuracy
- **Complexity to fix**: small
- **Introduced by**: b68f989
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/InstallProbeSchedule.swift:4-5`: "*No ceiling — `InstallProbe.stop()` is the bound.*"
  - `docs/plans/native-sdk/03-sharing-and-install.md` (added by ec0f7c6/5e67088): "*No hard ceiling: **the store surface being dismissed is the bound**, which is also the moment the detector stops being able to do anything useful.*" — but the same document, twelve lines earlier, states the opposite: "*under model ownership the poll is still running when the product page closes*". Nothing in `InstallProbe` or `StoreInvite` connects `dismiss()` to `stop()`; the only `stop()` call sites are `SharingSheetModel.swift:182,246,320` and `InstallProbe.swift:104`.
  - The probe is started at the *install-page load*, not at the store surface (`SharingSheetModel.swift:458-465`, reached from `onPageAction(.install)` at `:303`), so it also runs for a user who taps Install, reads the code and never opens the store at all.
  - `InstallProbe.swift:31-33` — the default `canOpenWallet` is `(try? Frak.client)?.appLink.isFrakAppInstalled()`. After `Frak.shutdown()` that throws forever, so the probe polls indefinitely and can never succeed.
- **What actually happens**: a user who taps Install and leaves the sheet open — reading the code, waiting on a slow download, or simply distracted — gets a `canOpenURL` LaunchServices round trip on the main actor every 5 s for as long as the sheet is up, with no upper bound, and (via N1/N2) potentially long after it is not. The plan's safety argument is entirely about the ~50-*scheme* cap, which is not the cost being incurred.
- **Fix sketch**: add a wall-clock ceiling (the plan's own 120 s knee is the natural place to stop, or ~10 min) and stop on `UIApplication.didEnterBackgroundNotification` rather than only re-checking on foreground; reconcile the two contradictory sentences in `03`.

### N6. `StoreOverlayInvite` reproduces prior F6 verbatim, and the probe now runs against a surface that may never have drawn

- **Severity**: medium
- **Axis**: correctness / UX
- **Complexity to fix**: small
- **Introduced by**: 0e74a65 (carried over from the deleted `StoreOverlay.swift`)
- **Evidence**: `sdk/ios/Sources/FrakSDKUI/StoreOverlayInvite.swift:28-32`:
  ```swift
  guard !isPresented else { return true }
  guard let scene = StoreInvites.foregroundScene() else { return false }
  SKOverlay(configuration: configuration()).present(in: scene)
  isPresented = true
  return true
  ```
  No `SKOverlayDelegate` anywhere in the module (`rg SKOverlayDelegate sdk/ios` → zero hits), so `overlay(_:didFailToPresentWithError:)` is never observed; `#if targetEnvironment(macCatalyst)` (`:25`) still does not cover an iOS app running unmodified on Apple Silicon. This is byte-for-byte the code prior finding F6 was filed against (`git show c0a0cec:sdk/ios/Sources/FrakSDKUI/StoreOverlay.swift:26-38`).
- **What actually happens**: a merchant who selects `.overlay` on Simulator (the only place this will run before alpha) gets `present() == true`, no banner, no `openFrakApp()` fallback — **and now** an `InstallProbe` polling `canOpenURL` every 1–5 s against a store surface that never appeared, plus a `via=overlay` value written into the wallet's `install_detected` telemetry that would be a lie if it ever fired. The delta demoted this path from default to opt-in, which mitigates the blast radius, but did not fix it.
- **Fix sketch**: set an `SKOverlayDelegate`, answer false from `didFailToPresentWithError`, and treat "no `didPresent` within ~1 s" as a failure for the fallback decision.

### N7. 330 of the 399 new lines cannot execute, the one suite written for them says so, and the field that already shipped inert still has no test

- **Severity**: medium
- **Axis**: tests
- **Complexity to fix**: medium
- **Introduced by**: b68f989, 48d7e2c
- **Evidence**:
  - `InstallProbe.swift:1`, `StoreInvite.swift:1`, `StoreOverlayInvite.swift:1`, `StoreProductPageInvite.swift:1` are all `#if canImport(UIKit)` — 330 of the 399 new-file lines. `sdk/ios/scripts/run.sh:73-83` runs `swift test` on the macOS host, where that is false.
  - `sdk/ios/Tests/FrakSDKUITests/InstallProbeTests.swift:1` is `#if canImport(UIKit)` too, and `:8-11` states: "*Type-checked against the iOS simulator SDK; **not executed by either `swift test` stage***".
  - `sdk/ios/Tests/FrakSDKUITests/FrakSharingConfigurationTests.swift:6-19` asserts the `install` and `heightFraction` defaults — and **not** `detectInstall`, the exact field 48d7e2c had to rescue from being dead storage. A one-line `#expect(FrakSharingConfiguration().detectInstall == FrakSharingDefaults.detectInstall)` would run on the host today.
  - The only manual harness, `example/native-ios/.../FrakExampleApp.swift:673-698`, adds an `InstallRouteCard` for `install` but **no toggle for `detectInstall`**, so a device pass cannot exercise the opt-out or observe `probe=disabled` either.
  - `sdk/ios/README.md:80` claims coverage by "491 Swift Testing tests" without distinguishing the ones that cannot run.
- **What actually happens**: the guarantee 48d7e2c substitutes for a test — "*`detectInstall` now has no default anywhere between the modifier and the model, so dropping it is a compile error*" — is real but narrow: it protects one parameter on one call chain, and the sibling parameter added by the same feature still has a default (see N11). Everything else about the probe, both invites and the window trick is verified by reading only.
- **Fix sketch**: add the `detectInstall` default assertion and a `probe=disabled` end-to-end assertion at the `SharingPageURL` level (both host-runnable today); add the simulator test stage `03` already lists as the missing piece.

### N8. The `LSApplicationQueriesSchemes` diagnostic is silent at the default log level, and the "warn once" guard covers the wrong statement

- **Severity**: medium
- **Axis**: merchant-setup / DX
- **Complexity to fix**: small
- **Introduced by**: b68f989
- **Evidence**:
  - `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:384-392` — the undeclared-scheme diagnostic is `logger.error(...)`, guarded by `loggedUndeclaredScheme`.
  - `Core/FrakConfig.swift:92` — `logLevel: FrakLogLevel = .none`; `Core/FrakLogger.swift:46` — `guard level >= messageLevel, messageLevel != .none else { return }`. At the default, nothing is emitted through either the `os.Logger` or a sink.
  - `DefaultFrakClient.swift:376-382` — the `isAtCap` **warn is not guarded by `loggedUndeclaredScheme` at all**, and `walletSchemeStatus()` is called on *every* `isFrakAppInstalled()` (`:365`), which is *every probe tick* (`InstallProbe.swift:31-33`). The comment justifying the flag (`DefaultFrakClient.swift:26-28`, "*an unattended install detector polling every second would otherwise flood the merchant's console*") describes precisely the statement it does not protect.
  - `sdk/ios/README.mirror.md:92-95` mentions the key only in passing ("*the same `LSApplicationQueriesSchemes` entry `isFrakAppInstalled()` already needs*") — it never names `frakwallet` / `frakwallet-dev`, never shows the plist snippet, and there is still no integration checklist. Prior **ios-core F2** asked for exactly that.
- **What actually happens**: the merchant integrates per `README.mirror.md`, omits the plist key (nothing tells them what to add), `walletSchemeStatus()` answers `.undeclared`, the probe silently never starts, `isFrakAppInstalled()` is permanently false — and the diagnostic that exists to explain this is discarded before it reaches a sink. Meanwhile a merchant with ≥50 declared schemes who *did* turn logging on gets one warn line per poll tick, i.e. one per second for the first 30 s.
- **Fix sketch**: move the `isAtCap` warn behind the same once-per-process flag; emit the undeclared diagnostic through the `os.Logger` unconditionally in DEBUG (or at least document that `logLevel` must be raised to see it); add the plist snippet + both scheme names to `README.mirror.md`.

### N9. A lost `start()` race mislabels a correctly configured merchant as `probe=undeclared`

- **Severity**: low
- **Axis**: correctness (telemetry)
- **Complexity to fix**: trivial
- **Introduced by**: 48d7e2c
- **Evidence**: `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:462-465`:
  ```swift
  let started = await installProbe.start(sessionId: sessionId) { … }
  return probedInstallURL(page, sessionId: sessionId, probe: started ? .ok : .undeclared)
  ```
  `start` also answers false on the generation guard (`InstallProbe.swift:51`) and — after the N1 fix — will answer false on a stop-race, neither of which is an undeclared scheme. The wallet decodes this straight into telemetry: `apps/wallet/app/module/install/component/InstallView.tsx:275-284` fires `install_probe_unavailable` with `reason: probe`, and `params/table.ts:41` restricts the value set to `ok|disabled|undeclared` with no "unknown".
- **What actually happens**: a race reads out as a merchant misconfiguration in the one dashboard built to tell those two apart — which is the stated reason the `reason` field exists at all (`03-sharing-and-install.md`: "*without it a flat `install_detected` line reads as a defect rather than as a configuration*").
- **Fix sketch**: give `start` a tri-state return (or return the `ProbeStatus` it already computed) so "declared but not started" is its own value.

### N10. The detection payload is silently dropped when the web view has no committed URL

- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: trivial
- **Introduced by**: b68f989
- **Evidence**: `SharingSheetModel.swift:494` — `navigateNow(webView, .activate(fragment: fragment, fullURL: installProofURL))`, where `installProofURL` is the *pre-detection* URL (`:472`, carrying only `#p=…&sid=…&probe=ok`). `SharingWebView.swift:189-198`: when `fragmentTarget` is nil (no committed URL) `navigate` falls back to `load(fullURL)` — i.e. it loads the install page **without** `installed=1`, `dt` or `via`.
- **What actually happens**: detection fires while the install page's own load is still provisional (a slow network — the very case where a store install has time to finish first), the fallback loads the plain install page, the user sees the un-updated "get the code" screen with no indication the wallet is installed, and `install_detected` never fires.
- **Fix sketch**: build the fallback URL from `installProofURL` with the detected fragment substituted, not the original one.

### N11. `install:` still defaults inside the model's init — the exact defect 48d7e2c says it structurally removed

- **Severity**: low
- **Axis**: correctness
- **Complexity to fix**: trivial
- **Introduced by**: 0e74a65, not addressed by 48d7e2c
- **Evidence**: `sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:105-107`:
  ```swift
  install: FrakInstallPresentation = FrakSharingDefaults.install,
  // No default: a defaulted merchant opt-out is one that silently stops being threaded.
  detectInstall: Bool,
  ```
- **What actually happens**: `detectInstall` is now compile-protected; `install` — added in the same feature, threaded down the same three hops (`FrakSharingSheet.swift:86` → `SharingPresentation.swift:203,227` → `:105`) — is not. Drop the `install:` argument at any hop and every merchant silently gets `.storeProductPage`, which is exactly how `detectInstall` shipped inert.
- **Fix sketch**: delete the default on `install:` too. One line.

### N12. Public non-frozen enums keep growing cases; `frakSharingSheet(heightFraction:)` was removed with no deprecated overload

- **Severity**: low
- **Axis**: ABI / DX
- **Complexity to fix**: small
- **Introduced by**: 0e74a65 (signature), b68f989 (`.walletOpened`)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:13-22` — the `heightFraction:` parameter is gone, replaced by `configuration:`; no deprecated shim exists (`rg 'available.*deprecated' sdk/ios/Sources` → zero hits).
  - `SharingResult.swift:11` adds `case walletOpened` to a public enum; the harness had to grow an arm for it (`example/native-ios/.../FrakExampleApp.swift:285-286`), which is what a merchant's exhaustive `switch` does too.
  - `FrakSharingConfiguration.swift:31-37` — `FrakInstallPresentation` is a second public enum with associated values on the same surface, with the same property.
- **What actually happens**: every merchant who wrote an exhaustive `switch result` fails to compile on upgrade, and every merchant who passed `heightFraction:` fails to compile on upgrade. Pre-alpha this is free; it is worth deciding *now* whether these are frozen, since the versioning story is "a merchant's binary freezes at store submission" (`AGENTS.md`) and there is no Android-style ABI gate on iOS.
- **Fix sketch**: keep `SharingResult` a `struct` + `Kind` (the `Kind` enum already exists at `SharingResult.swift:17-25`) so future outcomes are additive, or document the "exhaustive switch will break" contract in `README.mirror.md`. Ship a deprecated `heightFraction:` overload for one release.

### N13. `topViewController()` uses `keyWindow`, so a tier-3 chooser raised while the store page is up presents underneath it

- **Severity**: nit
- **Axis**: UX
- **Complexity to fix**: small
- **Introduced by**: beba204
- **Evidence**: `NativeShare.swift:74` — `guard var top = scene?.keyWindow?.rootViewController`. `StoreProductPageInvite.hostWindow` deliberately never makes its window key (`StoreProductPageInvite.swift:64-66,73-75`, "*Never made key*"), and sits at `.normal + 1`.
- **What actually happens**: any `NativeShare.share`/tier-3 fallback that fires while the product page is up presents its `UIActivityViewController` from the app's main window, i.e. visually behind a full-screen store page — and `NativeShare.share` then waits on a completion handler for a chooser the user cannot see or dismiss (compounding prior F2).
- **Fix sketch**: walk the highest-level visible window in the foreground scene, not `keyWindow`.

---

## Commit-message claims that do not survive the diff

1. **48d7e2c: "close two probe leaks" / "a generation token closes the async gap in `InstallProbe.start` where a second start orphaned a poll `Task` and a `NotificationCenter` observer."**
   Half survives. The start-vs-start race is genuinely closed (`InstallProbe.swift:49-51`). But `stop()` never bumps `generation` (`InstallProbe.swift:61-71`), so the far more reachable start-vs-**stop** race leaves exactly the orphaned poll `Task` and `NotificationCenter` observer the message claims to have closed — see N1. And a third orphan mechanism it does not mention is right below it: `scheduleNextPoll` overwrites `poll` without cancelling (`InstallProbe.swift:85`), so the foreground observer forks a chain per foreground event (N2).

2. **48d7e2c: "The parameter now has no default between the modifier and the model, making a dropped hop a compile error."**
   True of `detectInstall` only. `install:` — added by the same feature, threaded through the same three hops — still carries `= FrakSharingDefaults.install` at `SharingSheetModel.swift:105`. The structural guarantee covers one of the two new parameters (N11).

3. **beba204: "stop the store page taking the sharing sheet down with it."**
   The mechanism is sound — the page is presented from a `UIWindow` the sheet does not own (`StoreProductPageInvite.swift:64-76`), and nothing touches the sheet's host. But the fix is unverified in the same sense as everything else here: `StoreProductPageInvite.swift:1` is `#if canImport(UIKit)` and no test executes it. It also introduces two new lifetime bugs of its own (N3, N4) and a presentation-ordering one (N13). The message's "Two device passes were spent on this" is the only device evidence in the delta and is not reproducible from the repo.

4. **b68f989 / `03-sharing-and-install.md`: "No hard ceiling: the store surface being dismissed is the bound."**
   False as shipped. No code path connects `StoreInvite.dismiss()` to `InstallProbe.stop()`; the only bounds are `SharingSheetModel.release()`, `onPageUnavailable` and `.shareAgain` (`SharingSheetModel.swift:182,246,320`). `InstallProbeSchedule.swift:4-5` states the correct bound ("`InstallProbe.stop()` is the bound") and the plan document contradicts both itself and the schedule file within twelve lines (N5).

5. **`03-sharing-and-install.md`: "Undeclared also deserves a debug-build warning, since it is the case the merchant did not choose."**
   Shipped as `logger.error` at `DefaultFrakClient.swift:386` with no DEBUG special-casing, and `FrakConfig.logLevel` defaults to `.none` (`Core/FrakConfig.swift:92`), which `FrakLogger.log` drops at `Core/FrakLogger.swift:46`. The default-configured merchant — the one who forgot the plist key — is the one who cannot see it (N8).

6. **`03-sharing-and-install.md`: "`release()` → `stop()`, **before** `storeInvite.dismiss()`" (the detector-lifetime table).**
   This one *does* survive: `SharingSheetModel.swift:182` precedes `:186`. Noted because it is the only row of that table the code implements exactly as written — the "`didDetectInstall()` → one-shot" row is also correct (`InstallProbe.swift:104` calls `stop()` after `onDetected`).

7. **`sdk/ios/README.md:80` (updated twice in this delta): "The table above is implemented and covered by 491 Swift Testing tests."**
   The count moved 257 → 490 → 491 across the delta, but the new install-detection machinery contributes four tests (`InstallProbeTests.swift`) that the file itself documents as never executed, and `README.md:154` still says "No CI builds either native SDK." two lines-of-argument away from `README.md:89-92`, which says it does.

---

## Answers to the specific questions in the brief

- **What is the probe polling?** `Frak.client.appLink.isFrakAppInstalled()` (`InstallProbe.swift:31-33`) → `walletSchemeStatus()` + `UIApplication.canOpenURL("<walletScheme>://")` (`DefaultFrakClient.swift:364-366`). **How often:** 1 s for the first 30 s, 2 s to 120 s, 5 s thereafter (`InstallProbeSchedule.swift:6-9`), plus one immediate check per app foreground. **For how long:** unbounded (N5). **Who cancels it:** only `SharingSheetModel` — `release()`, `onPageUnavailable`, `.shareAgain`, and the probe itself on detection. Not `shutdown()`, not backgrounding, not the store surface closing.
- **Backgrounding**: the sleeping `Task` is frozen with the process and resumes on wake; the foreground notification adds an immediate check *and* an orphan chain (N2). **Sheet dismissal mid-probe**: covered by `release()` — unless a `start()` is suspended at that moment (N1). **Second sheet**: a new model gets a new `InstallProbe` (`SharingSheetModel.swift:142`); the old one is stopped via `dispose()`. **`shutdown()`**: nothing stops the probe; `try? Frak.client` starts failing, so it polls forever and can never succeed.
- **Swift 6 / data races**: no data race found. `InstallProbe`, `StoreInvite`, both invites and the model are all `@MainActor`; injected closures are `@Sendable`; the `loadProduct` completion correctly hops (`StoreProductPageInvite.swift:88-90`) and `productViewControllerDidFinish` is `nonisolated` with a `Task { @MainActor }` hop (`:59-60`). No retain cycle: the probe's `onDetected` captures the model weakly (`SharingSheetModel.swift:462`), poll tasks and the notification block capture `[weak self]`. The defects are lifetime/cancellation ones, not isolation ones.
- **`FrakSharingConfiguration` shape**: good — `Sendable, Hashable`, `var` properties, defaults sourced from `FrakSharingDefaults`, and `Overlay` is a struct precisely so a later knob is additive (`FrakSharingConfiguration.swift:44-46`). It does not duplicate `FrakConfig` and does not need a Builder (Swift default arguments cover it; Android's Builder exists for Java interop, which iOS has none of). The forward-compat weak point is the enum, not the struct (N12).
- **`QueriedSchemes` vs ios-core F2**: it *detects* the missing entry rather than just reading it, and warns — but the warning is unreachable at the default log level and the README still has no checklist (N8). Half-closed.
- **Prior F6**: fixed on the new default path, reproduced verbatim on `.overlay` (N6).
- **Prior iOS P1s as side effects**: F1 (`warm` lent guard) — **not touched**. F2 (`NativeShare.share` suspending) — **not touched** (comment reword only), and N13 gives it a new way to happen. F3 (`teardown` abandoning a session) — **leak half closed** by 48d7e2c, report half still open.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Review-only task, no repo files touched. Single artifact written to the runtime-authoritative path /tmp/frak-delta/ios-install-detection.md, scoped to the assigned area (iOS post-install detection + App Store surface machinery) with the required sections: verdict, prior findings closed, prior findings not closed, 13 new findings ranked worst-first with severity/axis/complexity/introducing-sha/evidence/failure/fix, and a commit-claims section."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Every finding cites path:line with a quoted excerpt read from the tree (e.g. InstallProbe.swift:47-59, :61-71, :83-90; StoreProductPageInvite.swift:28-38, :43-44, :84-101; StoreOverlayInvite.swift:28-32; DefaultFrakClient.swift:364-392; SharingPresentation.swift:268-276; SharingSheetModel.swift:105-107, :182-186, :458-494; FrakLogger.swift:46 + FrakConfig.swift:92; InstallProbeTests.swift:8-11). Closures of prior findings are proven by the mechanism, not the commit message (dispose->disposed->reclaimWebView->pool.release clears lent->destroy succeeds)."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git log --oneline c0a0cec..origin/dev; git diff --stat c0a0cec origin/dev",
      "result": "passed",
      "summary": "12 commits, 50 files, 1998 insertions / 131 deletions confirmed."
    },
    {
      "command": "git show 48d7e2c | cat; git show beba204 | cat",
      "result": "passed",
      "summary": "Verified the 'two probe leaks' claim against the diff: generation guard covers start-vs-start only; teardown->dispose confirmed. Verified the store-page-window rework."
    },
    {
      "command": "git diff c0a0cec origin/dev -- sdk/ios/Sources/FrakSDKUI/SharingWebViewPool.swift sdk/ios/Sources/FrakSDKUI/NativeShare.swift",
      "result": "passed",
      "summary": "Pool untouched (prior F1 open); NativeShare +2/-4, comment reword only (prior F2 open)."
    },
    {
      "command": "read of InstallProbe/InstallProbeSchedule/StoreInvite/StoreOverlayInvite/StoreProductPageInvite/FrakSharingConfiguration/SharingPageURL/SharingSheetModel/SharingPresentation/QueriedSchemes/DefaultFrakClient + all new tests + apps/wallet install params",
      "result": "passed",
      "summary": "Full read of every new/changed Swift file in the area plus the wallet-side fragment contract it writes to."
    },
    {
      "command": "grep -rn 'SKOverlayDelegate|topViewController|apple-app-site-association' sdk/ios services/backend infra",
      "result": "passed",
      "summary": "No SKOverlayDelegate anywhere (F6 reproduced); topViewController still keyWindow-based; wallet AASA serves paths ['/*'] so the new universal-link rung is covered."
    },
    {
      "command": "swift build / swift test",
      "result": "not-run",
      "summary": "No Swift toolchain, per the task's hard constraints. All findings are read from source."
    }
  ],
  "validationOutput": [
    "InstallProbe.stop() (InstallProbe.swift:61-71) confirmed not to touch `generation`, which start() (:49-51) compares after its await -> a start suspended across release() restarts the probe on a disposed model (N1).",
    "scheduleNextPoll (InstallProbe.swift:85) confirmed to assign `poll` without cancelling the previous Task, and the willEnterForeground observer (:73-81) routes into check -> scheduleNextPoll, so each foreground event adds one uncancellable chain (N2).",
    "StoreProductPageInvite.dismiss() (:43-44) confirmed to be a no-op while `window` is nil, which is the entire duration of the awaited load in present() (:28-38) -> ghost store page after sheet teardown (N3).",
    "StoreProductPageInvite load deadline Task (:91-93) confirmed never cancelled and settleLoad (:99-103) confirmed not to check continuation identity -> cross-talk (N4).",
    "StoreOverlayInvite.present() (:28-32) confirmed identical in substance to c0a0cec's StoreOverlay.present() -> prior F6 reproduced on the .overlay path (N6).",
    "FrakConfig.logLevel default .none (FrakConfig.swift:92) + FrakLogger.log guard (FrakLogger.swift:46) confirmed to drop the new LSApplicationQueriesSchemes diagnostic (DefaultFrakClient.swift:384-392); the isAtCap warn (:376-382) confirmed outside the once-per-process flag (N8).",
    "teardown -> dispose (SharingPresentation.swift:272) traced through disposed/reclaimWebView (:44) -> pool.release -> lent=false (SharingWebViewPool.swift:102) -> destroy's guard (:135): prior F3's WKWebView leak is genuinely closed; phase=.idle set before dispose (:268) means onResult is still never reported.",
    "InstallProbeTests.swift:1,8-11 confirmed #if canImport(UIKit) and self-documented as never executed; FrakSharingConfigurationTests confirmed to omit any detectInstall assertion.",
    "Wallet-side contract cross-checked: INSTALL_PARAMS (apps/wallet/app/module/install/params/table.ts:36-43) accepts exactly the keys installDetectedFragment emits (p/sid/probe/installed/dt/via)."
  ],
  "residualRisks": [
    "Nothing in this area executes anywhere: 330 of the 399 new lines are behind #if canImport(UIKit) and CI's swift test stage runs on the macOS host. Every N-finding except N7/N9/N11/N12 is read-verified only.",
    "The exact reachability window of N1 (a start() suspended on the DefaultFrakClient actor hop across a user swipe) is reasoned from the actor's known workload, not measured. The missing generation invalidation in stop() is certain regardless.",
    "N3/N4 depend on UIKit/StoreKit presentation timing that only a device settles; the lifetime holes themselves are unambiguous from the code.",
    "Whether SKStoreProductViewController presents correctly from a non-key UIWindow at .normal+1, and whether it behaves on iPad, is unverifiable here — the commit claims two device passes, which the repo cannot corroborate.",
    "Whether canOpenURL flips promptly after an in-place SKOverlay/SKStoreProductViewController install (the premise of the whole feature) has never been observed anywhere in this repo.",
    "N12's source-break claim assumes merchants write exhaustive switches over SharingResult; the harness does, which is the only evidence available."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository files changed. One artifact written outside the repo: /tmp/frak-delta/ios-install-detection.md.",
  "reviewFindings": [
    "high: sdk/ios/Sources/FrakSDKUI/InstallProbe.swift:61-71 - stop() does not invalidate `generation`, so a start() suspended across release() re-arms the poll and the foreground observer on a disposed model; nothing can stop it again and it runs for the life of the merchant's screen. The third leak 48d7e2c did not close.",
    "high: sdk/ios/Sources/FrakSDKUI/InstallProbe.swift:85 - scheduleNextPoll overwrites `poll` without cancelling it, and the willEnterForeground observer routes into it, so each background/foreground cycle adds a permanent extra poll chain; stop() can cancel only the newest, and a stop->start on the same (constant) sessionId resurrects all the orphans.",
    "medium: sdk/ios/Sources/FrakSDKUI/StoreProductPageInvite.swift:28-38,43-44 - dismiss() is a no-op while a present() is awaiting its load, so an App Store product page can appear seconds after the sheet was dismissed, on a window at .normal+1 that nothing owns.",
    "medium: sdk/ios/Sources/FrakSDKUI/StoreProductPageInvite.swift:91-103 - an orphaned 5s load deadline resumes the *next* load's continuation with false; a second store tap within 5s reports failure and kicks the user out to the App Store app.",
    "medium: sdk/ios/Sources/FrakSDKUI/InstallProbeSchedule.swift:4-5 vs docs/plans/native-sdk/03-sharing-and-install.md - the probe has no ceiling, no store-surface bound and no background stop; the plan claims the store surface bounds it and contradicts itself twelve lines later.",
    "medium: sdk/ios/Sources/FrakSDKUI/StoreOverlayInvite.swift:28-32 - prior finding F6 reproduced verbatim on the .overlay path (no SKOverlayDelegate, success reported unobserved), now with a probe polling against a surface that may never have drawn.",
    "medium: sdk/ios/Tests/FrakSDKUITests/InstallProbeTests.swift:8-11 - the only suite for the new machinery documents itself as never executed; 330 of 399 new lines are in the dead zone; FrakSharingConfigurationTests still has no detectInstall assertion and the harness has no toggle for it.",
    "medium: sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:376-392 + Core/FrakConfig.swift:92 - the new LSApplicationQueriesSchemes diagnostic is dropped at the default logLevel .none, and the once-per-process guard protects the error but not the per-tick isAtCap warn; README.mirror.md still has no plist checklist (prior ios-core F2 only half-closed).",
    "low: sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:462-465 - a lost start() race is written to the wire as probe=undeclared, so the wallet fires install_probe_unavailable{reason:undeclared} against a correctly configured merchant.",
    "low: sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:494 + SharingWebView.swift:189-198 - when the view has no committed URL the .activate fallback loads the pre-detection URL, silently dropping installed=1/dt/via.",
    "low: sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:105 - `install:` still carries a default through the same three hops 48d7e2c hardened for detectInstall, so the exact 'shipped inert' failure remains open for the sibling parameter.",
    "low: sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:13-22 and SharingResult.swift:11 - heightFraction: removed with no deprecated overload, and .walletOpened added to a public non-frozen enum; both are source breaks for merchants, on an SDK whose binaries freeze at store submission and which has no iOS ABI gate.",
    "nit: sdk/ios/Sources/FrakSDKUI/NativeShare.swift:74 - topViewController() uses keyWindow, and the store page's window is deliberately never key, so a tier-3 chooser raised while the page is up presents behind it (compounding prior F2's unbounded await).",
    "not closed: SharingWebViewPool.swift:43-58 (prior F1, no lent guard) and NativeShare.swift:36-50 (prior F2, no escape from the continuation) are untouched by all 12 commits."
  ],
  "manualNotes": "Two things the parent should weigh. (1) The single cheapest safety win in this delta is two lines in InstallProbe: bump `generation` inside stop(), and `poll?.cancel()` at the top of scheduleNextPoll. Those close N1 and N2, which are the only findings here that can burn a user's battery after the sheet is gone. (2) The delta's own review evidence is a commit message describing two device passes on the SKStoreProductViewController window trick; nothing in the repo corroborates it, and the new code it produced (N3, N4, N13) is exactly the class of lifetime bug those passes would not have hit. If a simulator/device stage is going to be added before alpha, this area is now the highest-value place to point it: prior F1/F2/F3/F6 plus N1-N4 and N6 all sit in the same never-executed region."
}
```
