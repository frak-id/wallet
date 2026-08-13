# Sharing sheet — rendering, correctness and API-surface audit

Audit of `sdk/android/frak-sdk-ui` (13 files, ~2 400 lines) against the Compose Material3 **1.4.0**
sources the build actually resolves, Chromium's `android_webview` draw-functor ABI, and three
open-source analogues (Shopify `checkout-sheet-kit-android`, Stripe `stripe-android`,
Chromium's own `TabBottomSheet`).

Everything in §1 and §2 was verified against source, not inferred from documentation. Where a
claim is a mechanism-level inference rather than a measurement it says so. No device trace backs
the *magnitude* of any of it — see §5.

| Section | Content |
|---|---|
| [§1](#1-rendering-performance) | Why the sheet janks. Four stacked causes, all verified, plus §1.7 on why it *looks* worse than it is |
| [§2](#2-correctness) | Four defects the tests structurally cannot catch, plus §2.6 and §2.7 on tier 3 firing over pages that were fine |
| [§3](#3-public-api-surface) | The Compose-only entry point, and the Stripe-shaped replacement |
| [§4](#4-what-the-analogues-do) | Shopify / Stripe / Chromium, and what is worth stealing |
| [§5](#5-what-was-implemented) | What landed, what could not, and two things the audit missed |
| [§6](#6-what-is-not-verified) | Honest gaps |

---

## 1. Rendering performance

### 1.0 The sheet does not resize the web view

The reported symptom was "dragging the sheet resizes the WebView and it is laggy". It does not
resize it. `FrakSharingSheet` sizes the content with `fillMaxHeight(clampSharingHeightFraction(…))`
— a constant for the sheet's lifetime — and moves it with a translation. The web view's measured
size never changes, so:

- `AwContents::OnSizeChanged` never fires,
- Blink never reflows,
- the page's `100dvh` never recomputes,
- no `resize` event is dispatched.

The page is in fact model-citizen quiet about viewport changes: `packages/wallet-shared/src/sharing/**`
contains **no** `ResizeObserver`, **no** `window.addEventListener("resize", …)` and **no**
`visualViewport` use. Height is pure CSS `100dvh` (`svh`/`lvh` are unused).

That matters because it invalidates the entire "freeze the WebView during the animation" family of
fixes — `onPause()`, `pauseTimers()`, CSS `content-visibility`, pausing rAF over the bridge. None
of them touch the code paths that are actually costing frames. The cost is all on the Android
compositing and layout side, and there are four separate contributors.

### 1.1 The web view is inside two nested rounded clips

`ModalBottomSheet` renders its content through `Surface(shape = BottomSheetDefaults.ExpandedShape)`,
and `Surface` ends its modifier chain with **`.clip(shape)`**:

```kotlin
// material3 1.4.0 — Surface.kt:456-475
private fun Modifier.surface(shape: Shape, …) =
    this.then(…)
        .background(color = backgroundColor, shape = shape)
        .clip(shape)
```

`FrakSharingSheet` then adds a second one inside it:

```kotlin
.offset { IntOffset(0, dragOffset.value.roundToInt()) }
.clip(BottomSheetDefaults.ExpandedShape)      // ← second rounded clip
```

A `WebView` does not draw through `View.onDraw`. It draws through the `AwDrawFn` GPU functor,
whose public ABI carries a **rectangular** clip and nothing else:

```c
// frameworks/base/native/webview/plat_support/draw_fn.h — AwDrawFn_DrawGLParams
int clip_left;
int clip_top;
int clip_right;
int clip_bottom;   // "current clip rect in surface coordinates … updated during View animations"
```

There is no round-rect and no path field. When the canvas clip at draw time is not a plain rect,
HWUI cannot pass it down. `GLFunctorDrawable::onDraw` shows exactly what it does instead — the
clip is read back as an `SkRegion`, and a complex one takes the stencil branch:

```cpp
// libs/hwui/pipeline/skia/GLFunctorDrawable.cpp
canvas->temporary_internal_getRgnClip(&clipRegion);
…
// apply a simple clip with a scissor or a complex clip with a stencil
if (CC_UNLIKELY(clipRegion.isComplex())) {
    glClear(GL_STENCIL_BUFFER_BIT);
    directContext->resetContext(kStencil_GrGLBackendState | kRenderTarget_GrGLBackendState);
    SkAndroidFrameworkUtils::clipWithStencil(tmpCanvas);
    directContext->flushAndSubmit();   // a full flush, per functor draw
    glEnable(GL_STENCIL_TEST);
} else {
    glEnable(GL_SCISSOR_TEST);         // the rect case: free
    setScissor(info.height, clipRegion.getBounds());
}
```

plus a second `glClear(GL_STENCIL_BUFFER_BIT)` after the functor returns. The sheet pays that
twice, at full sheet size, on every frame that redraws. (The related AOSP fix *"Bind correct FBO
when drawing a WebView into a layer"* — bugs 79619253 / 80443556 / 80477645 — is the offscreen half
of the same story.)

**This is the whole answer to "is there a native way, like on iOS?": there is not.**
`View.setClipToOutline` with a round-rect `Outline`, `Modifier.clip(RoundedCornerShape)`,
`CardView`, a `BlendMode.Clear` punch-out — every one of them ends at a non-rect `SkRegion` around
the same functor and takes the same branch. `clipToOutline` in particular is *not* a fast path; it
is the same clip spelled differently. The asymmetry with iOS is structural rather than an API gap:
a `WKWebView` is a real `CALayer` in the system compositor, so `layer.cornerRadius` +
`maskedCorners` is composited for free, while an Android `WebView` is not a layer at all.

The existing comment in `FrakSharingSheet` is the tell:

> `// The WebView is a rectangle; without this it squares off the sheet's top corners.`

`Surface`'s own clip *should* have rounded those corners. It did not — because the functor
ignored the non-rect clip. The second clip treated the symptom with a more expensive instance of
the same cause.

**Fix.** Stop asking the native canvas to round a functor. Give the sheet a rectangular clip, make
the web view transparent, and let Blink paint its own rounded top corners:

| Layer | Change |
|---|---|
| `FrakSharingSheet` | `shape = RectangleShape` on `ModalBottomSheet`, drop the inner `.clip(…)` |
| `createSharingWebView` | `setBackgroundColor(TRANSPARENT)` so the corners cut through to the scrim |
| `SharingHostStyle` | inject the radius as CSS custom properties, scoped to the wallet origin |
| `apps/wallet` / `wallet-shared` | consume them from `containerChromeless` and the `body` rule |

Trade-off accepted: a non-opaque web view forfeits some of Blink's opaque-surface optimisations.
That is a fixed, small cost against a per-frame full-surface stencil pass.

#### 1.1a How the radius reaches the page — a query param was the wrong transport

The first implementation sent `?cornerRadius=28` on the `/sharing` URL. **That was wrong, and it
shipped with a live regression.** A query parameter is addressed to a *route*, and the sheet has
more than one: pressing the page's install CTA navigates the same web view to `/install`, which
never received the parameter and squared its corners off halfway through the flow. The same commit
also had to copy the value byte-identically into `SharingPageUrl.warm`, because the warm URL is
compared against the session URL to decide whether a fragment activation is legal — so a cosmetic
value silently gained the power to force a full page load.

Worse, `/sharing` and `/install` did not even agree on what "a native host" *was*: `/sharing` read
`embed`, `/install` inferred one from the mere presence of `returnScheme`. Two markers, two routes,
one web view.

A document-start script is addressed to an *origin*:

```kotlin
WebViewCompat.addDocumentStartJavaScript(view, script, setOf(walletOrigin))
```

Registered once in `createSharingWebView`, it runs before any page script on every wallet-origin
document that view ever loads. The contract is two CSS custom properties, declared in
`SharingHostStyle` and consumed in `packages/design-system/src/hostSheet.ts`:

| Property | Consumer | Fallback (= the web appearance) |
|---|---|---|
| `--frak-host-top-radius` | `containerChromeless`, in `wallet-shared` and in `install.css.ts` | `0px` |
| `--frak-host-surface` | the `body` rule in `defaults.css.ts` | the normal surface colour |

Both are needed together: a `body` background propagates to the document canvas, which no
`border-radius` clips, so a radius without a transparent surface rounds nothing.

What this removed, beyond the `/install` regression:

- the `cornerRadius` param, its `clampedInt(0, 48)` codec, and the whole `nativeOnly` gate in
  `parseSharingSearch` — a URL cannot forge a CSS custom property, so there is nothing left to
  gate;
- `useHostCornerRadius`, a route hook that assigned `document.documentElement.style` and
  `document.body.style` at runtime purely to outrank `defaults.css.ts`. The `body` rule now names
  the host's property as its own fallback, so the host never enters a specificity fight;
- `cornerRadius` from `SharingPageUrl.build`/`.warm`, and with it the "must match or activation
  falls back to a full load" invariant;
- `SharingChrome.cornerRadius` and `chromeRadiusStyle` — no part of how the sheet looks reaches
  the page through props any more.

And `/install` now reads `embed=native`, decoded by the same `decodeHostEmbed` as `/sharing`, so
the two cannot drift again. Both native SDKs append it to the hosted install page URL.

**Cost, stated honestly.** A new `androidx.webkit` dependency on `:frak-sdk-ui` (AndroidX, so
inside the module's stated dependency policy, and `implementation` so it stays off merchants'
compile classpath). The feature needs WebView ≥ M96 and degrades to square corners on an opaque
surface below it. And the sheet's rendered state is no longer reproducible by pasting its URL into
a desktop browser — the corners are now invisible in the URL, which is a real debugging loss the
param did not have.

#### 1.1b The web side had a latent cascade bug that made the radius land nowhere above 768px

Found while landing §1.1a, and it would have made the whole change a no-op on an Android tablet.

`containerChromeless` and `container` are two independent single-class selectors on the same
element (`clsx(styles.container, chromeless && containerChromeless)`). At equal specificity the
winner is whichever rule the bundler emitted last, and it emits `sharingPage.css`'s
`tabletContainerMedia` block *after* `shared.css`'s. Confirmed by reading the emitted bundle rather
than the source: `containerChromeless`'s tablet rule landed at byte 77989, `sharingPage.css`'s at
80435. Above the breakpoint the card treatment won and the chromeless variant did nothing.

**Provenance: `504c7e026`, the commit that introduced `containerChromeless` — not the corner-radius
work, which never touched `shared.css.ts`** (`git show 77cf3e464 --stat -- .../shared.css.ts` is
empty). It has been inert above 768px in every build since. That was invisible while the variant
only cancelled things back to their defaults; it becomes fatal the moment the host's radius has to
win, because a tablet-width sheet then paints a centred, drop-shadowed, all-four-corners card
floating inside it.

Two fixes, both in `shared.css.ts`:

- `&&` on both `containerChromeless` and the new `overlayChromeless`, doubling the class so the
  override does not depend on emission order.
- The tablet block now cancels the **whole** card treatment. It previously cancelled three of
  `tabletContainerMedia`'s six properties; `height: auto`, `maxHeight: 90dvh` and `margin: auto`
  were left standing, so even with specificity fixed the sharing screen would float as a card
  while `/install` — which has no tablet rule at all — stayed full-bleed. The same mid-flow jump
  §1.1a exists to remove, one breakpoint up.

`overlayChromeless` is new for a related reason: the tablet `overlay` backdrop is
`rgba(0, 0, 0, 0.4)`, and with the container full-bleed and opaque it is visible *only* through the
rounded corners — tinting them 40% black instead of showing the host's own scrim.

**No test can catch a repeat.** jsdom does not evaluate custom properties or media queries from
stylesheets, so nothing in the suite resolves a computed radius. This was found by building the
wallet and reading the emitted CSS, and that is currently the only way to find it.

### 1.2 M3 1.4.0 scales the sheet — and therefore the functor — during the open animation, and there is no way to stop it

The sheet's spring is under-damped, and Material3 compensates for the overshoot by scaling:

```kotlin
// ModalBottomSheet.kt:354 (on the Surface) and :377 (on the content Column)
.verticalScaleUp(sheetState)
…
.verticalScaleDown(sheetState)

// BottomSheetScaffold.kt:470
internal fun Modifier.verticalScaleUp(state: SheetState) = graphicsLayer {
    val overflow = if (offset < anchor) anchor - offset else 0f
    scaleY = if (overflow > 0f) (size.height + overflow) / size.height else 1f
    …
}
```

For every frame the spring overshoots, the web view's functor output is drawn under a `scaleY != 1`
transform — resampled, and visibly blurred, at exactly the moment the user is watching the sheet
arrive.

**Not fixable from the call site.** `anchoredDraggableMotion` is not a `ModalBottomSheet` parameter;
it is read from the ambient motion scheme and pushed onto the state by the component itself:

```kotlin
// ModalBottomSheet.kt:140-149
val anchoredDraggableMotion: FiniteAnimationSpec<Float> = MotionSchemeKeyTokens.DefaultSpatial.value()
SideEffect { sheetState.anchoredDraggableMotionSpec = anchoredDraggableMotion }
```

and every lever on that is `internal` in 1.4.0 — `interface MotionScheme`, `MotionScheme.standard()`,
`MotionScheme.expressive()`, `MaterialTheme.LocalMotionScheme`, and the `MaterialTheme(motionScheme =
…)` overload. Writing `sheetState.anchoredDraggableMotionSpec` from outside loses to the component's
own `SideEffect` on the next composition.

Mitigating factor: the default scheme is `standard()`, not `expressive()` — `dampingRatio = 0.9f`,
`stiffness = 700f` (`StandardMotionTokens`). So the overshoot is small and lasts a handful of frames,
rather than the full expressive bounce. It goes away with the View-based sheet in §3.3 step B, which
is where it is tracked alongside §1.3.

### 1.3 `ModalBottomSheet`'s own animation re-lays-out the web view every frame — not fixable from outside

> **Update.** §1.2 and §1.3 are both `ModalBottomSheet`'s, and both close in
> `08-sharing-sheet-api.md` step A, which drops `ModalBottomSheet` entirely: a `ComponentDialog`
> host cannot contain it without stacking two platform windows. "Not fixable" was true of the call
> site and false of the sheet.

```kotlin
// material3 1.4.0 — internal/AnchoredDraggable.kt:838, DraggableAnchorsNode.measure
withMotionFrameOfReferencePlacement {
    placeable.place(xOffset.roundToInt(), yOffset.roundToInt())   // place(), not placeWithLayer()
}
```

Plain `place()`. Combined with
`.consumeWindowInsets(WindowInsets(top = sheetState.offset.toInt()…))`, which reads the animating
offset during the layout phase, every frame of the show/hide animation re-runs Compose placement →
`AndroidViewHolder`'s `layoutAccordingTo` → `WebView.layout()`.

`sheetGesturesEnabled = false` does not help: it only removes the `draggable` and `nestedScroll`
modifiers, not `draggableAnchors`. There is no way to opt out from the call site.

**Not fixed in this pass.** It goes away with the View-based sheet in §3, which is where it is
tracked. Same-size `layout()` does not force a Blink re-raster (`AwContents::OnSizeChanged` is
size-gated), so this is a Compose-side traversal cost, additive rather than dominant.

### 1.4 The hand-rolled drag re-runs placement too

`Modifier.offset { … }` (the lambda overload) places into a layer, so the *draw* is a cheap layer
translate — but the lambda is read during **placement**, so `invalidatePlacement()` still fires
every frame and `WebView.layout()` still runs. A draw-phase-only read skips the layout phase
entirely:

```diff
- .offset { IntOffset(0, dragOffset.value.roundToInt()) }
+ .graphicsLayer { translationY = dragOffset.value }
```

Same pixels, one less phase. `onSizeChanged` stays — it fires once, not per frame.

### 1.5 The warm pooled web view is never paused

`SharingWebViewPool.warm()` boots the real merchant page and then leaves it in the foreground state
for as long as the merchant's share surface is composed — a fully booted React app behind a screen
nobody is looking at.

Shopify does the opposite: `CheckoutWebView.cacheableCheckoutView()` calls `onPause()` on the
preloaded instance the moment its load finishes.

**Be precise about what that buys, because it is less than the name suggests.** Android documents
`onPause()` as "a best-effort attempt to pause any processing that can be paused safely, such as
animations and geolocation", and says explicitly that **it does not pause JavaScript**. So the
page's timers and its `requestAnimationFrame` loop keep running; what stops is native-side drawing
and compositing for a view nobody is showing. `pauseTimers()` is the API that would stop the JS
half, and it must not be used — it is process-global and would reach the merchant's own web views.

**Fix.** `onPause()` once the warm document reports ready; `onResume()` in `acquire()`. Kept because
it is free, it is what the closest production analogue does, and it cannot make anything worse — not
because the CPU delta has been measured. It has not.

### 1.6 Techniques that are folklore for a web view

| Technique | Verdict |
|---|---|
| `setLayerType(LAYER_TYPE_HARDWARE)` before animating | **Does not work for `WebView`.** The functor path bypasses `View`-level hardware-layer caching. Documented native `LayerCache` crashes on 5.0+. Chromium's own docs warn against touching WebView's layer type |
| `onPause()` / `pauseTimers()` during a drag | Pauses *content* processing. Irrelevant to the embedder draw/layout path. Correct for an idle warm view (§1.5), wrong for a drag |
| `CompositingStrategy.Offscreen` | Forces the offscreen buffer §1.1 is trying to avoid. Actively worse |
| `setRendererPriorityPolicy` | OOM-killer policy, not frame cost |
| `SurfaceView`-mode `WebView` | Not a public API. Does not exist |
| `View.setRenderEffect`, `setPictureListener`, `WebViewRenderProcessClient` | No production SDK or Chromium-internal source found using any of them for animation smoothing. Unproven |

The one real escape hatch, if §1.1–§1.5 are not enough: snapshot the web view to a `Bitmap` on
drag start (`PixelCopy` / `view.draw(canvas)`), render the bitmap during the drag, swap the live
view back on settle. A bitmap round-clips for free and translates as a pure GPU blit. It is the
2013-era idiom and it still works, at the cost of a capture and a possible one-frame swap flash.
Deferred — measure §1.1–§1.5 first.

### 1.7 A finished warm document is not a painted one

Found from a merchant report — "the sheet opens the modal and the web view at once, and the
skeleton never shows anymore". Both halves are the same line:

```kotlin
// SharingSheetState, as of a32a16132
var pageVisible: Boolean by mutableStateOf(activationBaseUrl != null)
```

`activationBaseUrl` is `handle.loadedBaseUrl?.takeIf { handle.documentReady }`, and `warm()` runs
on composition-enter, so by tap time it is essentially always non-null. The skeleton was therefore
never composed on any real open — `skeletonAlpha` starts at `0f` and `SharingSheetSkeleton` is
dropped from composition before the first frame.

The premise was that a warm view is already showing the page. It is not. **The pooled `WebView` is
never in a view hierarchy while it warms**: `SharingWebViewPool.newHandle()` constructs it and
nothing ever `addView`s it — the only attach is `AndroidView(factory = { handle.view })` at sheet
composition. So while warm it is unmeasured (0×0, hence a 0 Blink viewport and a `100dvh` of
zero), detached (renderer hidden, no compositor frames, no raster) and, since §1.5, explicitly
`onPause()`d. `documentReady` means `onPageFinished` fired: DNS, TLS, the bundle, V8, React's boot
and both merchant-keyed queries are banked — which is the win `a32a16132` measured — and nothing
has been laid out or drawn.

So the sheet opened declaring "nothing to cover" over a transparent, blank web view, for the whole
tap-to-paint window. `a32a16132`'s own trace sizes that window: **~540 ms** tap to `page reported
ready`. Half a second of empty sheet, which is exactly what the report describes.

The web side was already written to the opposite contract, and says so:

```ts
// apps/wallet/app/module/sharing/host/useHostBridge.ts
// Two frames, so the host drops its loading skeleton once the page has really painted.
// Skipped while warming: nothing is on screen yet.
```

`state=live` arrives by fragment → `warm` flips false → the effect re-runs → `action=ready` is
sent. The host had simply stopped waiting for it on the warm path.

**Fix.** `pageVisible` starts `false` unconditionally, on both platforms. `activationBaseUrl` keeps
its real job — choosing a fragment activation over a full load — and `onPageAction(Ready)`, which
already calls `onPageReady()` + `onPageVisible()`, uncovers the page, bounded by
`SKELETON_GRACE_MILLIS` (and, until §2.6 deleted it, `SKELETON_MAX_HOLD_MILLIS`). Real latency is unchanged; perceived latency
drops to the entry animation, because the skeleton is pure Compose and paints on frame 1.

iOS carried the identical line (`SharingSheetModel.swift`) on the identical premise, and
`06-open-findings.md` row 9.5 had already established that its pooled `WKWebView` is never in a
hierarchy until a sheet presents it. Fixed the same way.

**What this does not fix, and why it was not attempted here.** Warming still banks no rendering.
Pre-sizing the detached view (`measure`/`layout`) does not help on its own: a detached view's
renderer is hidden, so Blink does not run the lifecycle and there is no early layout to bank.
Genuinely warming raster means keeping the view attached *and* visible, which is the per-frame cost
§1.5 went out of its way to remove, for a page nobody is looking at. That trade needs a device
trace (`adb shell setprop log.tag.FrakSharing DEBUG`) before it is worth making.

---

## 2. Correctness

Four defects, none of which the current test suite can catch.

### 2.1 A sheet torn down by composition disposal never reports a result

`SharingPresentation.dispose()` does `state.release()` + `pool.release(handle)` and never calls
`onFinished`. Every *explicit* exit funnels through `SharingSheetState.finish()`, which does
report — but rotation, a nav-graph pop, or any parent composable leaving composition removes
`FrakSharingSheet` without one, and the merchant's `onResult` is **silently never invoked**.

`finish()`'s own doc claims "reports once"; the code only enforces that on the happy paths. A
merchant holding a "sharing in progress" flag keyed off `onResult` hangs forever.

**Fix.** Report `Dismissed` from teardown when nothing terminal has happened. One change; it also
closes the rotation hole and the `prepare()` hole in §2.4.

### 2.2 The 1.5 s budget does not bound what it claims to

`awaitLoadDeadline` races `contentSettled`. If the deadline fires while `session == null`,
`onLoadDeadline()` only sets `deadlineExpired = true` and returns — the actual fallback runs when
`build()` completes, from inside `prepare()`'s own `when`. If any of `buildSharingLink`,
`anonymousId`, `resolveConfig` **hangs** rather than throws, `contentSettled` never completes and
nothing is ever reported. `SKELETON_MAX_HOLD_MILLIS` (2.5 s) still lifts the skeleton, exposing a
blank transparent sheet indefinitely. (That timer is gone as of §2.6; the hole it punched is why.)

So the "1.5 s tap-to-content budget" the whole warm-pool architecture is built around is only an
upper bound on page load *given a build that completes*.

**Fix.** Give `build()` its own `withTimeoutOrNull`, independent of the page-load deadline.

### 2.3 `Frak.shutdown()` while a sheet is open can crash the host app

`build()` carefully catches `FrakError` around `resolveConfig()` and `bestReward()`. Its siblings
do not: `track()` (from `share()`, `copy()`, `fallBackOrFail()`), `installPageUrl()` and
`openFrakApp()` are unguarded and run inside `scope.launch { }` with no `CoroutineExceptionHandler`.
`Frak.client`'s getter throws `FrakError.NotInitialized()` once `shutdown()` has nulled the
instance, so:

> user taps Share → chooser opens → host app calls `Frak.shutdown()` (logout, account switch) →
> chooser returns → `track()` throws → uncaught → process death.

Which directly contradicts the "idempotent and safe" contract `Frak.shutdown()` advertises.

**Fix.** Same `try/catch (FrakError)` the file already uses three lines up, plus a
`CoroutineExceptionHandler` on the sheet's scope as a backstop.

### 2.4 Non-`@Volatile` latches crossing `Dispatchers.Default` ↔ `Main.immediate`

`workContext` defaults to `Dispatchers.Default` in production; `share()`, `copy()`,
`onPageAction()`, `dismiss()` and `fail()` run on `Main.immediate`. These are read and written
from both, as plain `var`s with no synchronisation:

`finished`, `fallbackFired`, `sessionLoaded`, `prepareStarted`, `deadlineExpired`,
`shareInFlight`, `copyInFlight`, `showingInstallPage`.

`loadSessionUrl()` is the clearest case — an unsynchronised check-then-act reachable from
`attach()` (Main, via `SharingPresentation.start`) and from the tail of `prepare()`'s background
coroutine:

```kotlin
if (sessionLoaded) return
…
sessionLoaded = true
```

The comments assert "at most once". The Java memory model does not.

**Why the tests cannot catch this:** every test injects `EmptyCoroutineContext` for `workContext`,
which forces all work onto one `TestScope` virtual scheduler. A `Dispatchers.Default` race is
structurally unreachable from there.

**Fix.** Collapse the latches into `AtomicBoolean`/`AtomicReference` compare-and-set, which turns
"fires once" from a comment into a property of the type. `session`/`failure`/`pageLoaded`/
`pageVisible` stay as Compose snapshot state — those genuinely are cross-thread safe.
`resolved`/`contentSettled` stay as `CompletableDeferred`; they encode distinct semantics and are
already correct.

`SharingWebViewClient`'s own flags (`settled`, `retryCount`, `ladderUrl`, `retryPending`,
`pendingRetry`, `navigationFailed`, `navigationOwnedByBinding`) are **not** part of this: every
call site is a `WebViewClient` callback or a main-looper `Runnable`, both of which Android
delivers on the main thread. Genuinely single-threaded.

### 2.5 Not changed, deliberately

- **The security model.** Component-wise origin pinning; the `isForMainFrame` gate placed *before*
  the `returnScheme` comparison, so a sub-frame cannot forge a result; no `addJavascriptInterface`
  anywhere; `onReceivedSslError` correctly not overridden. Shopify uses a JS bridge; the
  scheme-navigation channel here is strictly better. This is the strongest part of the module.
- **The warm/activation navigation logic.** `SharingSession.navigation` correctly handles the
  page-router-rewrites-its-own-URL trap, pinned by regression tests naming the original device
  trace.
- **The pool's teardown ordering.** Declining to destroy a lent view and deferring to `release()`
  is careful, not accidental.
- **Rewriting `SharingSheetState` wholesale.** The sequencing is well-reasoned and well-tested. The
  defects above are narrow and fixable in place.

### 2.6 Tier 3 fired over pages that were merely still loading

Reported from device use: with a working connection, the sheet would sometimes open on the
skeleton for a moment and then raise the native chooser. Three causes, all pulling the same way.

**The budget was sized for the fastest path and applied to the slowest.**
`PAGE_LOAD_DEADLINE_MILLIS` was 1500 ms, timed from the tap, covering build + navigation + load +
first paint. Against this file's own device numbers:

| path | measured | old budget |
|---|---|---|
| warm + fragment activation | ~540 ms (`a32a16132`) | 1500 ms |
| full load, warm cache and live renderer | 555-757 ms + build (`03`) | 1500 ms |
| cold warm-document load | 1780 ms (`03`) | 1500 ms |

And the fast path is not the usual one — `03-sharing-and-install.md` says so outright: activation
needs a *finished* warm document, and "warming is usually still in flight at tap, so this is the
common case, not the edge". A tap during the warm load takes `stopLoading()` plus a full load,
which loses that race about as often as it wins. Reopening the sheet is the reliable reproduction:
`release()` re-warms with a full navigation, so the pool is mid-load again. Now **5000 ms** — sized
against the retry ladder below, and against the fact that tier 3 is not a failure but a *worse*
flow, so waiting a little for the real one is worth more than firing early.

**The retry was not one.** A main-frame failure got exactly one retry, immediate, pinned to
`LOAD_CACHE_ONLY`. On a page never cached that fails in microseconds, so one transient error was a
straight line to the chooser. Replaced by a two-rung ladder — network at +300 ms, then cache-only
at +900 ms — with `ERROR_HOST_LOOKUP` / `ERROR_CONNECT` (and their `NSURLError` twins) skipping
straight to the cache rung and taking it undelayed, since dialling a dead radio again only spends
the budget. Both rungs fit inside the 5 s ceiling with room for the attempts themselves. The
backoff is posted to the main looper, not `View.postDelayed` — same detached-view trap as the
navigation (`03`) — and a rebind cancels a pending retry, or a closed session would navigate the
view the pool has already taken back.

**The skeleton's max-hold made it look worse.** `SKELETON_MAX_HOLD_MILLIS` (2.5 s) sat between the
old deadline and the new one, and since §1.1 made the web view transparent, lifting the skeleton
off an unpainted page shows the scrim through a hole rather than a loading page. Deleted rather
than retuned. What replaces it is evidence: `SKELETON_GRACE_MILLIS` still covers a *finished*
document that produced no paint callback, and any page action other than `Error` now sets
`pageVisible` — a user cannot drive a document that is not on screen. A page that never paints at
all is ended by the load deadline, which is the only escape hatch that was ever needed.

Mirrored on iOS, which carried all three verbatim.

**Two things the 5 s does not mean.** `SharingSessionBuilder.BUILD_DEADLINE_MILLIS` is still 8 s and
is deliberately independent (§2.2): a build that degrades rather than throwing is bounded by *that*
number, not this one, so the true worst case from tap to some outcome is the max of the two, not 5 s.
And the ladder's rungs belong to a *document*, not to a session — `ladderUrl` resets the count when
the session navigates itself somewhere new — so a sheet that recovers the sharing page on a retry
and then fails on the install page still gets a full budget for the second document.

**Four defects the first cut of this shipped**, all caught by review before merge and worth recording
because three of them are invisible until teardown: the retry `Runnable` was not cancelled by
`SharingWebViewHandle.destroy()`, which the pool reaches without rebinding (a dead pool releasing a
lent view, or destroying a warm one) — `loadUrl` after `WebView.destroy()` takes the merchant's
process down, and on iOS the same shape is a stray load by an object ARC keeps alive; the binding
setter did not unpin `WebSettings.cacheMode`, so a session torn down mid cache-only rung left the
pool's own re-warm pinned to the cache (structurally impossible on iOS, where the policy is
per-`URLRequest`); the ladder was scoped to the binding rather than the document; and iOS's
`Task.isCancelled` guard sat inside the `delay > 0` branch, so the undelayed unreachable rung — the
one most likely to race a rebind — ignored cancellation entirely. Each is pinned by a test on
Android; none is reachable by a test on iOS, for the reason in the next paragraph.

**iOS cannot test any of this today.** `SharingWebView.swift` is wrapped top to bottom in
`#if canImport(UIKit)`, which is false on the macOS SwiftPM host the suite actually runs on, so the
ladder does not even compile there. `SharingSheetLogic.swift` was deliberately kept outside that
gate for exactly this reason. Reaching the ladder needs either a simulator destination in CI, or the
rung-selection logic hoisted into a `WKWebView`-free type the way `sharingDecision` already is.

### 2.7 Tier 3 fired over a page that was already loaded (the activation path had no host signal)

**Reported from the harness, and the one the user actually saw.** Kill the app, tap the first share
button: correct. Close it, tap a second product: the sheet opens, shows its skeleton, then closes
and raises the OS chooser — sometimes. Same for a third. Reopen any of them afterwards and all
three are fine, for good.

The self-healing is the tell, and it is the *warm* page being cached rather than the sharing page.
The first tap lands while the pool's warm load is still in flight, so `documentReady` is false and
the session does a **full load** — which produces `onPageFinished`, which settles the tap-to-content
budget. It cannot time out. Every later tap lands on a warm page that is now in the HTTP cache, so
the re-warm `release()` kicks off finishes before the user's next tap, `documentReady` is true, and
the session takes the **activation** path instead.

And a fragment change is same-document: no `onPageStarted`, no `onPageFinished`, no `didFinish`.
`SharingWebViewClient` says *nothing at all* on that path. The only signal that could settle the
budget was the page's own `action=ready`, which `useHostBridge.ts` emits from inside two nested
`requestAnimationFrame`s — and rAF does not run in a WebView that is producing no frames. The
pooled view is detached (`loadSessionUrl` says so in its own comment) and freshly `onResume`d from
the `onPause` §1.5 added; frames only start once Compose has attached it and the sheet's window has
drawn, which on a cold start is the slowest that will ever be. Miss the 5 s ceiling and tier 3 fires
over a document that was loaded and ready the whole time.

`03-sharing-and-install.md` predicted this in writing — "without this the *fastest* path is the one
that times out on the load deadline and falls back to the native chooser over a perfectly good
page" — and then left the page's rAF as the sole thing standing between the sheet and that outcome.
One dropped message, no backstop.

**Fixed** by having the activation supply the two signals the engine will not, in
`SharingSheetState.navigateNow` (and `SharingSheetModel.navigateNow`):

- **The budget is settled at the activation itself.** An activation only happens on a *finished*
  document — that is precisely what `documentReady` gates — so tap-to-content is already met by
  construction. Waiting for the page to confirm what the host already knows is what created the
  window. Tier 3 now cannot fire over a page the SDK put there itself.
- **Paint stays evidence-based**, because §1.7's finding still holds: a pooled view has never
  rastered, so uncovering it on the strength of the document alone shows the scrim through a hole.
  Android gets a real `postVisualStateCallback` on the activation, the same primitive the load path
  already trusts. iOS has no equivalent, so it falls back to the `SKELETON_GRACE_MILLIS` timer that
  settling the budget unlocks — a weaker guarantee, and the second thing on this page that only
  Android can do properly.

The `ready` action is untouched and still does both jobs when it arrives; it is simply no longer the
only thing that can. Pinned by `an activated page is not abandoned to tier 3 when ready never
arrives`, verified by mutation.

**Not yet confirmed on the device that reported it.** The reasoning is from the code and from
`03`'s own note, not from a trace: `adb shell setprop log.tag.FrakSharing DEBUG` prints
`launch (warm view, ACTIVATING)` versus `launch (COLD view)` per tap, which is the discriminator.

---

## 3. Public API surface

Not implemented in this pass — recorded so the work in §1/§2 is done in the shape that survives it.

### 3.1 XML / View-based merchant apps cannot use this SDK at all

Every public entry point is `@Composable`:

| Symbol | Problem |
|---|---|
| `rememberFrakSharingLauncher(…)` | `@Composable` |
| `FrakSharingLauncher.active` / `.presentation` | `mutableStateOf` |
| `FrakSharingSheet` | `internal @Composable`, only hostable by the above |

A merchant on an XML codebase must add `androidx.compose.ui`, the Compose compiler plugin, a
`ComposeView` in their layout and a `setContent {}` block — to open a share sheet. `frak-sdk-ui`
also `implementation`s compose-ui + foundation + material3, and nothing watches what that costs —
the dex budget that would have was retired in `32836c217`, and it never saw transitive deps anyway.

**iOS has the identical gap**: `View.frakSharingSheet(…)` is a SwiftUI `ViewModifier`; UIKit apps
are equally locked out.

### 3.2 The target shape — Stripe `PaymentSheet`

One `Builder`, three build sites, one object model. Stripe has already **deprecated** the free
`rememberPaymentSheet()` function in favour of it:

```kotlin
public class FrakSharing internal constructor(…) {
    public fun interface ResultCallback {          // SAM — Java-friendly
        public fun onResult(result: SharingResult)
    }

    public class Builder(private val callback: ResultCallback) {
        public fun heightFraction(fraction: Float): Builder
        public fun build(activity: ComponentActivity): FrakSharing   // XML / Java
        public fun build(fragment: Fragment): FrakSharing
        @Composable public fun build(): FrakSharing                  // Compose sugar
    }

    public fun present(request: SharingRequest)
}
```

Stripe's implementation *is* Compose internally, but the public contract boundary is a plain
Activity + `ActivityResultContract`, so Java, XML and Compose callers see identical types, and the
launcher registration — not a `remember{}` — is what survives configuration change and process
death.

### 3.3 Sequencing

| Step | Work | Buys |
|---|---|---|
| A | `FrakSharing.Builder` + a `ComponentDialog`-hosted `ComposeView` View path, same artifact | Unblocks XML/Java merchants. `ComponentDialog`, **not** raw `Dialog` — Compose needs `ViewTreeLifecycleOwner`/`ViewTreeSavedStateRegistryOwner` |
| B | Reimplement the sheet in plain Views; publish `id.frak:frak-sdk-ui-compose` as sugar | Removes Compose from the base artifact, and kills §1.3, the `AndroidView` interop cost and the Dialog-in-Dialog outright |
| C | UIKit `FrakSharingPresenter.present(from:)` on iOS | Closes the same gap there |

Most of `ModalBottomSheet` is already unused: `sheetGesturesEnabled = false`, `dragHandle = null`,
`containerColor = Transparent`, hand-rolled drag, hand-rolled dismiss thresholds, hand-rolled grab
strip. Step B is plausibly *less* code than what is there now.

### 3.4 Smaller API issues, to fold into the same pass

| Issue | Why |
|---|---|
| `public const val HEIGHT_FRACTION` | `const` inlines into merchant bytecode. A merchant referencing it freezes at their compile-time value forever, even after a version bump — for a value explicitly documented as tunable |
| No `@JvmStatic` / `@JvmOverloads`, lambda callbacks | Java callers cannot use the API idiomatically |
| `heightFraction` clamped and NaN-defaulted in silence | A merchant who computes it wrong gets a working-looking sheet at the wrong size, with no diagnostic |
| "Hoist per screen, not per row" documented only in **`internal`** KDoc | Merchants cannot see it. Per-row hoisting in a `LazyColumn` means one warm web view **and one config round-trip per visible row** — a thundering herd against our own backend |
| No "is a reward available" helper | Every integration re-derives the "should I show a Share CTA" question from `rewards.best`. `example/native-android` already does it by hand |
| Eight individually injected suspend lambdas on `SharingSheetState` | A single narrow `internal interface` is the same seam with one line instead of eight |

---

## 4. What the analogues do

| | Hosting | Drag / resize | Warm-up | Bridge |
|---|---|---|---|---|
| **Shopify** `checkout-sheet-kit-android` | `androidx.activity.ComponentDialog`, `MATCH_PARENT`/`WRAP_CONTENT`, transparent background. No `BottomSheetBehavior`, no Compose | **None.** The web view is `MATCH_PARENT`/`MATCH_PARENT` at construction and never re-laid-out | Static cache keyed by URL, 5-minute TTL, `onPause()` while idle, retained across dismiss | `addJavascriptInterface` |
| **Chromium** `TabBottomSheet` | Native | `ThinWebView` height **fixed**; a bottom *inset* is driven as the sheet offset changes | — | — |
| **Stripe** `stripe-android` | Internal Activity; moved `PaymentSheet` off Compose `ModalBottomSheet` onto a View-based `StripeBottomSheetLayout` (PR #8442) | — | — | — |
| **Plaid** | Abandoned in-process web views for new integrations (Hosted Link / Custom Tabs) | — | — | — |

Three things worth taking:

1. **Don't resize, don't relayout** — Chromium's own sheet fixes the web view's height and drives
   an inset. §1.0 says we already do this by accident; §1.3/§1.4 are the remaining leaks.
2. **`onPause()` the warm instance** — §1.5, taken directly from Shopify.
3. **A View-based sheet** — Stripe moved *away* from Compose `ModalBottomSheet` for its most
   performance-sensitive surface, and Shopify never used a draggable sheet for a checkout web view
   at all. §3.3 step B.

One thing worth *not* taking: Shopify's `addJavascriptInterface` bridge. The scheme-navigation
channel here is a smaller attack surface.

---

## 5. What was implemented

§1 and §2 are done. §3 is deliberately not — it is a rewrite, and it should land on a sheet whose
rendering and reporting are already right rather than drag the current defects into a new shape.

| Finding | Status | Where |
|---|---|---|
| §1.1 double rounded clip | **Fixed.** `shape = RectangleShape`, inner `.clip()` gone, web view `setBackgroundColor(TRANSPARENT)`, page rounds itself from CSS custom properties injected by `SharingHostStyle` at document start (§1.1a; the `cornerRadius` query param it replaced regressed `/install`) | `FrakSharingSheet`, `SharingWebView`, `SharingPageUrl`, `SharingSheetState`, `SharingWarmup`, `apps/wallet` `/sharing`, `SharingPage`, `PostShareConfirmation` |
| §1.2 scale during entry | **Not fixable from the call site**, but closed by deleting the call site: `08-sharing-sheet-api.md` §3 drops `ModalBottomSheet` in its step A, and `verticalScaleUp`/`Down` go with it | — |
| §1.3 placement per frame from `draggableAnchors` | Same — `AnchoredDraggable` is `ModalBottomSheet`'s, and goes with it in `08` step A. Sooner than §3.3 assumed, because hosting the sheet in a `ComponentDialog` *requires* dropping it rather than merely benefiting from it | — |
| §1.4 `offset {}` re-runs placement | **Fixed.** `graphicsLayer { translationY }` | `FrakSharingSheet` |
| §1.5 warm view never paused | **Fixed.** `SharingWebViewHandle.pause`/`resume`, applied on warm document-finished and undone in `acquire` | `SharingWebView`, `SharingWebViewPool` |
| §2.1 teardown never reports | **Fixed.** `SharingSheetState.abandon()`, called unconditionally from `SharingPresentation.dispose()` | `SharingSheetState`, `SharingPresentation` |
| §2.2 unbounded `build()` | **Fixed.** `buildWithinBudget` with an 8s liveness ceiling, separate from the 1.5s tier-3 UX budget | `SharingSheetState` |
| §2.3 `Frak.shutdown()` crash | **Fixed.** `guarded { }` around `track`/`installPageUrl`/`openFrakApp`, and `prepare`'s catch-all now reports instead of rethrowing | `SharingSheetState` |
| §2.4 non-`@Volatile` latches | **Fixed.** `AtomicBoolean` compare-and-set for the eight once-flags, `AtomicReference.updateAndGet` for `best`, `@Volatile` for `webView`/`deadlineExpired`/`showingInstallPage` | `SharingSheetState` |

Four things found while implementing or in the round-2 review, none of them in the original audit:

1. **`prepare()`'s catch-all rethrew.** It set `failure` and then `throw unexpected` — inside a
   `scope.launch` with no handler. So the "records a failure instead of leaving a spinner forever"
   comment described a path that crashed the merchant's process on the way. §2.3's blast radius was
   larger than reported: not just the three unguarded calls, but anything `build()` could throw,
   including a `FrakError` from `buildSharingLink` or `anonymousId` after `Frak.shutdown()`.
2. **Making the web view transparent broke the renderer-crash path.** `onPageUnavailable` returns
   without doing anything when the page has already painted — deliberately, since raising the
   tier-3 chooser over content the user is reading is worse than the crash. That was safe while the
   web view painted opaque white. With a transparent view, a `RectangleShape` sheet and a
   transparent container it would have left a see-through hole with a grab pill floating in it.
   Fixed with `SharingSheetState.contentLost` and an opaque, correctly-rounded `Surface` in the
   sheet. This is the sharp edge of §1.1: the transparency is load-bearing, so every path that used
   to rely on the web view painting *something* has to be re-checked.
3. **`abandon()` could report a dismissal over an outcome that had not landed yet.** `share`,
   `copy`, the install handoff and the tier-3 fallback all run on the *launcher's* scope so a
   chooser outlives the sheet that raised it. A dismissal reported into that window wins `finish`'s
   compare-and-set, and the real outcome is then **dropped** rather than out-ranked — the losing
   `finish` returns before it can `record`. Fixed with an `attributionsInFlight` counter: `abandon`
   defers, and whichever attribution finishes last reports, by which point `best` holds the truth.
   §2.1's fix created this; it is the cost of reporting from teardown at all.
4. **`SharingSheetState.resolved` was dead.** A `CompletableDeferred` completed in two places and
   awaited nowhere, in main or in test. Removed.

One claim was walked back rather than fixed: `WebView.onPause()` does **not** stop JavaScript.
Android documents it as "a best-effort attempt to pause any processing that can be paused safely,
such as animations and geolocation" and says explicitly that it does not pause JS — so the page's
timers and `requestAnimationFrame` loop keep running, and what stops is native-side drawing and
compositing for an off-screen view. §1.5 is kept because it is free, it is what Shopify does, and it
cannot make anything worse — but the size of the win is unmeasured and the KDoc now says so.

Tests: 91 → 104 in `frak-sdk-ui`, plus the web side's own. New coverage for the corner-radius param
on both the session and warm URLs (they must agree or activation silently degrades to a full load),
the three `abandon()` cases plus the deferral race, a hung build reporting on its own budget, a
refused client call mid-share and mid-install, the renderer-crash opacity flag, and the
pause/resume cycle across warm → acquire → release → re-warm. §2.4 remains untestable from this
harness for the reason stated there.

One behaviour change worth calling out for anyone reading a diff: a session with no link to share
(`MerchantResolutionFailed`) now reports `Failed` from `prepare()` directly instead of setting
`failure` and waiting for the sheet's `LaunchedEffect(state.failure)` to notice. Same outcome, one
frame earlier, and no longer conditional on a composable being alive to observe it.

---

## 6. What is not verified

- **No frame-timing measurement.** Every impact estimate in §1 is mechanism-based. §1.1 is expected
  to dominate because the functor ABI is provably rect-only and the AOSP FBO commit exists — but
  that is an inference, not a Perfetto trace. Take a before/after trace per change.
- **§1.1's fix has not run on a device.** Nor has the sharing sheet as a whole — one Android device
  pass has ever run, and it did not cover the sheet (`README.md`, `06-open-findings.md`).
- **The transparent-web-view trade-off is unquantified.** Losing Blink's opaque-surface path has a
  cost; it is assumed smaller than a per-frame stencil pass, not measured against it.
- **No head-to-head** Compose `ModalBottomSheet` + `AndroidView` vs. plain-View
  `ComponentDialog` benchmark exists anywhere in public. §3.3 step B rests on Stripe's
  architectural choice plus converging jank reports, not on a number.
- **§2.4 has no regression test** and cannot get one from the current harness. Reproducing a
  `Dispatchers.Default` race deterministically needs a different seam than `workContext`.
