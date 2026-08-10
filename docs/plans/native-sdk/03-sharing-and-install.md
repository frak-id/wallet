# Native SDK — the sharing sheet and the install handoff

The one surface that needs a web view, the channel between it and native code, and what
happens after a share. Implemented on both platforms; none of it has run on a device yet.

## 1. The flow

```
merchant surface (product page / post-purchase / event)
 → "Share and earn {REWARD}"          ← copy + reward from the SDK, {REWARD} pre-substituted
 → sheet opens
    ┌──────────────────────────────┐
    │             ▂▂▂              │  ← NATIVE: a drag handle, over the page
    │  hosted /sharing?native=1    │  ← reward card, products, how-it-works, FAQ
    │  [ Share ]        [ Copy ]   │  ← the PAGE's own footer, performed natively
    └──────────────────────────────┘
 → user shares → page navigates `<scheme>://result?action=share`
 → SDK raises the real OS chooser, then fires `Interaction.sharing()` (after it, see §3)
 → SDK reloads the page with &confirmed=1                    ← load-bearing, see below
 → page shows PostShareConfirmation: "create your wallet to get your rewards"
 → Install CTA → <scheme>://result?action=install → back to native
      ├─ Frak app installed → frakwallet://install?m=&a= → linked, no code, no store
      └─ not installed      → /install in the SAME web view (§3)
```

Two things silently kill the funnel:

1. `&confirmed=1` must fire for a share and must NOT be sent for a copy. Only the SDK knows
   whether an OS chooser came up, so `PostShareConfirmation` needs the reload to render; a
   copy has already toasted and moved on, and reloading would tear that down mid-toast.
2. The SDK owns all sharing tracking. `apps/wallet/app/routes/sharing.tsx` wires only
   `onSuccess`, never `onShared` — the route itself never emits `create_referral_link`.

The sharing page is hosted, not re-implemented natively, to stay in sync with the other
web/Tauri consumers. The public API returns a `SharingResult` and never leaks the web view,
so going native later is a non-breaking internal change.

### Lifecycle contract

| Situation | Behaviour |
|---|---|
| Re-entrancy | second call while one is active → `alreadyPresenting`. Never queue, never silently cancel |
| Terminal result | shared *then* install-clicked *then* dismissed → most significant event wins (install > shared/copied > dismissed) |
| Dismiss mid-load | cancel the load, return dismissed. Queued interactions unaffected |
| Web view fails to load | tier-3 fallback: native share sheet with the locally-built link. Never show a broken sheet |
| Rotation | Android: the session, the pooled web view and the attribution scope are retained on the hosting Activity's `ViewModelStore` and re-attached to a fresh dialog; the web view is never re-created and nothing is reported. **Not** `SavedStateHandle`, as this row said until `08-sharing-sheet-api.md` §5.2: that buys survival across *process death*, which is undeliverable for a WebView-backed sheet — the pool, the warm document and the session are all gone with the process, so a restored sheet would pay the full cold load the warm pool exists to avoid. A plain `ViewModel` buys survival across *configuration change*, which is the case this row was written about |
| Process death | the continuation is gone. Android can kill the host while the OS chooser is up; tracking is best-effort |

### Presentation (Android)

Two rules, both learned from the device pass that followed the chromeless redesign.

**Gesture ownership is explicit.** The sheet presents with `sheetGesturesEnabled = false`.
M3 makes the whole sheet draggable, which put it in a permanent race with the web view for
every vertical drag, and no heuristic on the native side can settle it: the hosted page
scrolls an inner `height: 100dvh; overflow-y: auto; overscroll-behavior: contain` container,
so the WebView's own scroll offset never moves, `canScrollVertically` is always false, and
nested scroll never reaches Compose. So the page gets every gesture that lands on it, and the
sheet is dragged only from `SharingSheetGrabStrip` — a 44dp Compose hit target stacked above
the `AndroidView`, which the web view therefore never sees. Dragging translates the content
(the container is transparent, so that *is* the sheet) and releases past a distance or
velocity threshold into a dismiss.

This has been tried the other way and it does not work. The theory was that moving the page to
document scroll would let the two sides arbitrate by themselves — `AndroidViewHolder` is a
`NestedScrollingParent3` — and the strip could go. Document scroll was implemented, the strip
deleted, and on device the sheet took every downward drag and the page could not be scrolled back
up at all. The wallet-side change was reverted.

The reason is that **`android.webkit.WebView` does not implement `NestedScrollingChild`**. There is
no flag for it; `View.isNestedScrollingEnabled` gates a dispatch the WebView never makes. Making
that route work needs a `WebView` subclass implementing `NestedScrollingChild3` over
`NestedScrollingChildHelper` and dispatching from `onTouchEvent`. Until someone writes and
device-tests that, the grab strip is the mechanism, not a workaround for a missing CSS change.

**The warm web view is the real one.** `preloadSharing` used to warm a throwaway view for
DNS/TLS/engine only; the sheet still booted a fresh WebView at tap time and — worse — did not
create it until `buildLink`/`resolveConfig` had resolved, then swapped the spinner for a blank
white WebView for the whole page load. `SharingWebViewPool` now lends the warmed view to the
sheet and takes it back on close, and `SharingSheetSkeleton` is stacked *over* the view until
first paint (`postVisualStateCallback`, not `onPageFinished`, which for a React app is still a
blank frame). A pooled view is bound to a session by `SharingWebViewHandle.bind`; the client
ignores callbacks from a navigation started under a previous binding, which is what keeps a
warm load completing after tap from cancelling the tier-3 deadline.

**The session starts at the tap, not at the sheet.** `SharingPresentation.start` runs inside
`FrakSharingLauncher.launch`, on the merchant's click handler, while Main is still idle: it takes
the pooled view, attaches it, starts the build off-thread (`Dispatchers.Default`) and issues the
navigation itself. Only then does `active` change and the sheet compose. `FrakSharingSheet` is
purely presentational — it creates nothing and owns nothing but teardown.

That shape is forced by measurement, not taste. Opening a `ModalBottomSheet` builds a real Dialog
with its own Window and surface, and the pooled view attaches in the same frames, so Main is
occupied for ~300ms. Anything sequenced inside that composition queues behind it: the session
build lost 203-430ms waiting for a `LaunchedEffect` body to be dispatched on the frame clock, and
once that was fixed the *navigation* lost 230-427ms in the same place. Two traps here:

- `View.post` is wrong for the navigation. The pooled view is deliberately detached at that
  moment, and `View.post` on a detached view parks the runnable in the view's own run queue until
  it is attached to a window — which puts the load right back behind the sheet. Use
  `Handler(Looper.getMainLooper())`.
- Nothing may acquire the view or start the build from inside a `remember` block. A discarded
  composition attempt would strand a lent view for the life of the process.

Device numbers before fragment activation, one session, warm document 1780ms: tap-to-first-paint
555/672/757ms after the first open, against 716-1119ms before. The session build is 3-5ms of it.
What remained was the document load and React boot contending with the sheet's own composition —
both consequences of navigating a second time.

**The second navigation is now a fragment.** The pool warms the *real* merchant page
(`SharingPageUrl.warm`: real `merchantId` and `clientId`, plus `preload=1`), so the bundle,
i18n and both merchant-keyed queries are done before the tap. What is left is per-tap — link,
products, seeded headline, session id — and that arrives as a location fragment
(`SharingPageUrl.activationFragment`), which the browser resolves same-document: no request, no
remount, no React boot. The page merges it over its query params in `useActivationParams`.

Four things hold this together, and each one is a bug if dropped:

- `preload=1` makes the warm page report `sharing_page_preloaded` instead of
  `sharing_page_viewed`. That event is the sharing funnel's denominator; warming every merchant
  surface into it would silently deflate every downstream rate. The activation fragment clears
  the flag, and clearing it is what emits the real view.
- Activation only happens on a *finished* warm document (`SharingWebViewHandle.documentReady`).
  A fragment change starts no request, so hanging one off a half-loaded page strands it forever.
  Warming is usually still in flight at tap, so this is the common case, not the edge.
- `SharingSession.warmBaseUrl` is rebuilt from the same resolved config as `pageUrl` and compared
  against what the view actually shows. A pool warmed for another merchant must not be activated
  on top of.
- `action=ready` settles the tier-3 deadline, not just the skeleton. A same-document navigation
  is not guaranteed to produce an `onPageFinished`, which is otherwise the only thing that
  settles it — without this the *fastest* path is the one that times out on the load deadline and
  falls back to the native chooser over a perfectly good page. It is also the paint signal that
  drops the skeleton on that path; see `07` §2.6 for why there is no timer behind it any more.
- The fragment is hung off `WebView.getUrl()`, **not** off the URL we warmed with. The page's
  router normalises its own search params on load (`native=1` becomes `native=true`, an absent
  `confirmed` becomes `confirmed=false`), so the document has moved before anyone taps. The
  first device trace of this read `ACTIVATING` and then spent 695ms on `document finished`,
  because a fragment on a URL that is not the committed one is a full cross-document navigation.
  That mismatch is also the long-standing second `document finished` in every trace since
  preloading landed.

Only keys the fragment actually carries are parsed, on both sides. The result is spread over the
warm URL's params, so a key present-and-undefined would erase the merchant config value beneath
it rather than leave it alone.

`SharingTrace` records these milestones. It is off unless the tag is enabled:
`adb shell setprop log.tag.FrakSharing DEBUG` then `adb logcat -s FrakSharing`. `launch (warm
view, ACTIVATING)` is the line that says the fast path was taken.

### Presentation (iOS)

The latency half of the Android section above is ported; the gesture half is not. What follows
is only what differs, because the shapes are otherwise deliberately identical — `SharingPageURL.
warm`/`activationFragment`, `SharingWebViewPool`, `SharingPresentation`, `SharingSheetSkeleton`
and `SharingTrace` all exist on both platforms with the same names and the same milestone
strings, so one set of eyes can read either trace.

**"The tap" is the `isPresented` change.** A merchant flips a `Binding<Bool>` rather than calling
a method, so `SharingPresenter.launch` runs from `.onChange(of: isPresented)` — the update that
sets the flag, before SwiftUI has begun building the sheet's hosting controller. `launch` is
idempotent and the sheet's own `onAppear` calls it too, so if that ordering ever fails the
session still starts, one frame later, which is exactly the pre-change behaviour.

**Disposal is not `.onDisappear`, and not the `isPresented` change either.** `.onDisappear` also
fires when a `UIActivityViewController` covers the sheet, and handing the pooled view back
mid-share would take the confirmation screen away from a live session and lend a view that session
still drives to the next sheet. The pre-existing `release()` had the same hazard for the web view
alone; this closes it. The `isPresented` change is no better for a sheet that *did* appear: it
fires the moment the flag flips, which for an SDK-driven close is before the dismissal animation,
and `SharingWebViewPool.release` immediately reloads the returned view to the warm URL — visibly,
on a view still animating away. So a presented sheet is disposed from `onDismiss`, which SwiftUI
calls after the animation; a session that reported a terminal outcome before any sheet appeared
gets no `onDismiss` at all and is disposed from the `isPresented` change. `wasPresented` is what
tells the two apart. Android reaches the same conclusion from the other end — its grab-strip
dismiss animates off screen *before* reporting, for the same reason.

**Disposal also severs the session.** `dispose` cancels the build task and clears the model's
`onOutcome`/`onClose` before releasing anything. `release()` deliberately does not mark the model
closed — an in-flight `share` outlives the sheet that started it — so a build still suspended for
a dismissed sheet will run its failure path to completion; those closures write the presenter's
`best` and flip its `isPresented`, which by then may belong to the *next* session. Without the
severing, a slow build from a sheet the user already dismissed could report its failure as the
next sheet's outcome, or dismiss that next sheet outright. Android is guarded differently and only
partly, by `FrakSharingLauncher.finish`'s `active == null` check.

**`action=ready` is the only paint signal.** WebKit exposes no public equivalent of
`postVisualStateCallback`, so where Android has a heuristic plus the page's own `ready`, iOS has
only `ready`, bounded by the same skeleton grace/max-hold timers. This makes `ready` load-bearing
on iOS in a way it merely is on Android — without it the skeleton would lift on a timer over a
blank web view.

**The fragment activation is `WKWebView.load(URLRequest)`, same as Android's `loadUrl`.** A URL
differing from the committed document only in its fragment takes WebKit's fragment-navigation
branch (`FrameLoader::loadWithDocumentLoader` → `shouldPerformFragmentNavigation`), which is
same-document and fires `hashchange`. It is emphatically *not* `evaluateJavaScript`: the SDK has
no JavaScript channel in either direction and this does not open one. The consequence is that
WebKit fires **no `didFinish`** for it — which is the same conclusion Android reached from the
other side, and the reason `ready` settles the tier-3 deadline rather than only the skeleton.

**The build is `nonisolated`, not on a chosen dispatcher.** Android's `Dispatchers.Default` was
answering a Compose-specific pathology: `rememberCoroutineScope` dispatches on the frame clock,
which at sheet-open is busy for 203-430ms. iOS's main-actor executor is drained by the run loop
rather than by a frame callback, so that number has no iOS twin and is unmeasured here. The build
is still kept off the main actor, because there is no reason to put network and keystore work on
it to find out.

**No device or simulator pass has run on any of this**, so every number in the Android section
above is Android's. `swift build` at the iOS-simulator triple and the host-run suites are the
only evidence; `SharingWebViewPool`, `SharingSheetModel` and `SharingWebView` are behind
`#if canImport(UIKit)` and therefore compile-checked only, never executed. The logic that could
be pulled out from under that wall — `SharingPageURL.warm`/`activationFragment` and
`SharingSession.navigation` — is tested on the host.

#### Gestures on iOS: not ported, and why

Android's `sheetGesturesEnabled = false` plus grab strip is deliberately **not** mirrored. The
provoking condition does transfer: the page is an `AppShell`, `height: 100dvh; overflow: hidden`
around an inner `overflow-y: auto; overscroll-behavior-y: contain` scroller, so the `WKWebView`'s
own `scrollView` never scrolls either. But the arbitration does not: WebKit gives that inner
container a real nested `UIScrollView` in its scrolling tree, and `UISheetPresentationController`
coordinates with scroll views in a way Compose's `ModalBottomSheet` does not. Whether iOS has the
same fight is therefore an open question, not a known defect.

Turning the system dismissal off in favour of a hand-rolled `DragGesture` on a platform with no
device pass trades an unknown for a worse failure mode — a user stuck in a sheet whose only exit
is a strip that was never tested. This is a device-pass item: drag the sheet by the page body and
by the grabber, and scroll the page's inner container both ways. If the sheet wins drags that
belong to the page, the Android mechanism (explicit ownership + a grab strip) is the answer, and
it should be reached for then rather than now.

`SharingTrace` records the iOS milestones through the unified log, which drops `.debug` unless
the subsystem is turned up:

```
xcrun simctl spawn booted log config --mode "level:debug" --subsystem id.frak.sdk
xcrun simctl spawn booted log stream --predicate 'subsystem == "id.frak.sdk"'
```


## 2. The web view ↔ native channel

Inbound is query parameters. `SharingPageURL.build` assembles `/sharing?native=1&…` with
`merchantId`, `clientId`, `returnScheme`, `sid`, the SDK version and optional context
(`appName`, `logoUrl`, `link`, `products`, `r`), and `SharingPageURL.warm` assembles the
merchant-keyed half of that plus `preload=1` for a view nobody has opened yet.

How a state change is delivered depends on where the view already is, and both platforms decide
it in one place (`SharingSession.navigation`). On a view that is not on this session's warm page
— preloading off, the warm-up unfinished, or the sheet since moved to the install page — every
change is a full navigation to a rebuilt URL: `confirm()` with `&confirmed=1`, `shareAgain`
without it, `copy` nothing, and a failed install page recovers to `&confirmed=1`. On a view that
*is* on its warm page, the same changes are a location fragment
(`SharingPageURL.activationFragment`), which both engines resolve same-document: no request, no
remount, no React boot. The page merges the fragment over its query params in
`useActivationParams` and omits absent keys on both sides, so an activation cannot erase a
merchant config value it has nothing to say about.

Outbound is an intercepted navigation: the page calls
`window.location.assign("<returnScheme>://result?action=…&sid=…")` and the SDK catches it in
the navigation policy and stops it — `decisionHandler(.cancel)` on iOS, `return true` from
`shouldOverrideUrlLoading` on Android. Actions: `install`, `dismiss`, `shareAgain`, `code`,
`error`, `share`, `copy`, `ready`. `share`/`copy` are asks, not reports — the page draws both
buttons and the host performs them, since `navigator.share` does not exist in an Android WebView
and a share's interaction has to be signed by the SDK keypair; both are repeatable within one
page load, so `sendHostResult` exempts them from its dedupe. `ready` is progress rather than an
outcome — the page saying it has painted — and is repeatable for a different reason: one warmed
page is reused across many sheets, each with its own skeleton waiting to be dropped.

There is no JavaScript bridge on either platform, deliberately.

Known issues:

- `sentActions`, a module-global `Set` in `buildHostResultUrl.ts`, exists because outbound
  navigations are fire-and-forget and carry no correlation; keyed by `action + value` so a
  regenerated code still reaches the host. Cancelled navigations surface as
  `NSURLErrorCancelled` / WebKit error 102, so the SDK carries an `isCancellation()` filter
  to avoid reading those as a failed load.

Do not add a bridge yet — `addWebMessageListener` (Android) and `WKScriptMessageHandler`
(iOS) both need hand-rolled origin checks; never `addJavascriptInterface` (no origin
control). Migrate when the outbound channel needs more than one value beyond `action`/`sid`,
or the page needs a reply.

### Hardening rules

- Frame-scoped: the sub-frame check runs above the `returnScheme` branch on both platforms,
  pinned by `SharingWebViewClientTest`. No OS scheme/intent registration — interception is
  in-process, ahead of any OS routing.
- Pin navigation to the wallet origin; open external links in the system browser, `http(s)` only.
- Disable file access and universal access from file URLs; block mixed content.
- No `WKUIDelegate` / `WebChromeClient`, so `window.open` cannot escape either.
- Known contradiction: iOS sets `websiteDataStore = .default()` for tier-2 offline retry;
  Android disables third-party cookies and has no per-WebView store. One of the two should change.

`action=code` carrying a capability value is safe only because the return-scheme branch
always cancels (including sub-frames), the sub-frame guard runs above the dispatch, and
`openExternally` is http(s)-only — relax any of those and `action=code` has to go with it.
The code is handed over from a gesture, never an effect. Accepted residual: a crafted
`/install?returnScheme=frak-com.evil` in a real browser yields a code bound to attacker-
supplied `m`/`a`, from an endpoint that is unauthenticated anyway — no victim secret leaks.

## 3. The install handoff

The anonymous id is derived from a key in the Secure Enclave / AndroidKeyStore and cannot be
re-derived by a different app, so it has to be carried across the install boundary.

| Platform | Mechanism | Determinism |
|---|---|---|
| Android | Play Store URL carrying an install referrer with `m`, `a` and the proof | deterministic — survives the store round trip exactly |
| iOS | install code + pasteboard + `SKOverlay` | user-mediated, deterministic when used |

iOS has no install referrer and fingerprinting-based alternatives were rejected, so the
handoff is user-mediated instead — no fingerprinting, no ATT prompt, one interaction.

### Target flow

```
returnToHost("install")
  ├─ HOST mints the proof NOW            signProof(.install, merchantId)
  ├─ HOST loads <wallet>/install?m=&a=#p=<proof> in the SAME web view
  │    └─ InstallCodeView: reward, code, download button
  │         ├─ on Copy or Download (a gesture, never an effect) the page hands the code
  │         │    back: returnToHost("code", value, exp) → HOST writes the pasteboard
  │         └─ download
  │              ├─ iOS: HOST intercepts → SKOverlay → installs in place
  │              └─ Android: Play URL with referrer (leaves the app; nothing is lost)
  └─ the sheet STAYS OPEN throughout
```

`returnToHost` stays because the page has no signing key — it reports intent, the host
decides. The sheet reaches a proof through one member, `installPageUrl` /
`installPageURL(returnScheme:sessionId:)`; proof minting stays `internal`. Minted at the
install tap, not at sheet preparation: most sheets never reach the install step, a Secure
Enclave signature can fail and must not block a sharing sheet, and the proof's `ts` is what
the backend's 30-day window measures from.

### iOS specifics

- `SKOverlay`, presented on the sheet's `UIWindowScene`, installs in place and replaces
  `isFrakAppInstalled()` for this flow (which stays public for other callers).
  `SKStoreProductViewController` is rejected: it fails presenting alongside an already-up
  `UISheetPresentationController`.
- Never read the pasteboard (raises an OS banner/permission alert since iOS 16); writing
  triggers nothing. It carries the code, not a URL — the code surfaces in the QuickType bar
  and tapping the suggestion is the consent with no prompt. The write sets `.expirationDate`
  and `.localOnly` (the latter blocks Universal Clipboard sync). QuickType is best-effort,
  not a contract — manual entry of the visible code is the real floor.
- The code is generated by the page (`useGenerateInstallCode`) and handed back; the SDK's only
  job is the pasteboard write. `staleTime: Infinity` on the code query — a refetch has no
  upsert and would leave the page showing one code while the pasteboard holds another.

### Android specifics

No `SKOverlay` equivalent — Play always foregrounds the Play app, which does not matter
because the referrer carries `m`/`a`/proof deterministically. The clipboard write is a
fallback, not load-bearing; the SDK emits the referrer only, with no read-back.

### The proof path through `apps/wallet`

`/install` resolves the proof fragment first, then search param, so existing links stay
byte-identical. Rule: emit the fragment wherever the URL could be copied, shared or logged;
the query param only for handoffs that provably cannot carry one.

### Tracking is recorded on success, not on intent

| Entry point | Correct behaviour |
|---|---|
| `share()` | after the chooser, gated on the result |
| tier-3 `fallBack()` | after, gated on the result |
| `copy()` | before — unchanged, a copy has no completion to wait for |

Android caveat: `NativeShare.share` returns whether the chooser launched, not whether the
share completed — telling them apart needs `ActivityResultLauncher`, a public API change.
Gate on the returned flag on both platforms; Android's is optimistic until that lands.

## 4. Status

Landed on both platforms: the probe gate deleted from `openFrakApp`; the tracking correction
above; the router's `p` forwarding and fragment-first resolution; the in-sheet `/install`
navigation with `SKOverlay` on iOS and the referrer URL on Android; the `code` action with
the pasteboard write.

None of it has run on a device. Test coverage is the web half, Android's JVM suites, and — since
the fragment-activation port — the iOS logic that could be lifted out from behind
`#if canImport(UIKit)` (`SharingPageURL`, `SharingSession.navigation`, `sharingDecision`); the iOS
sheet, pool and web view are still compile-checked only. Known defects, including the uncancelled
load deadline raising a second chooser and the missing install in-flight guard, are tracked in
[`06-open-findings.md`](./06-open-findings.md).

Open questions:

1. `SKOverlay` vs `SKStoreProductViewController` — SKOverlay is lighter and installs in place
   but has no styling control. Current design assumes SKOverlay.
2. Should `installStarted` become a tracked interaction rather than only a merchant callback?
   Today it notifies and records nothing.
3. Ordering against the identity-proof rollout: iOS emitted no proof until this landed, so the
   enforcement flip must not ship before a store binary carrying it. Needs an owner.
4. Sharing performance targets (p75 < 400 ms, p95 < 1 s, fallback to native share > 1.5 s)
   were set for Chrome Custom Tabs and have not been re-measured on the WebView path; that
   measurement gates whether the sharing screen goes native. **The fallback half of that target is
   now knowingly out of date**: the deadline shipped at 1.5 s and fired over pages that were merely
   still loading, so it is 5 s until someone measures the WebView path properly (`07` §2.6).
