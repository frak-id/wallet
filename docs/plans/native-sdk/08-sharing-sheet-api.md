# The sharing sheet's public API — a Stripe-shaped Builder

Follows `07-sharing-sheet-audit.md` §3, which recorded the problem and the target shape but
implemented none of it. That audit fixed how the sheet *renders* and how it *reports*. This one
changes who can *call* it. Two things fall out that were not the goal: the two rendering causes `07`
declared unfixable both close (§3), and the sheet finally survives rotation as
`03-sharing-and-install.md` has promised since the design phase (§5.2).

| Section | Content |
|---|---|
| [1](#1-the-problem-restated-precisely) | The problem, restated precisely |
| [2](#2-the-decision-everything-else-hangs-off-the-hosting-vehicle) | The decision everything else hangs off: the hosting vehicle |
| [3](#3-one-window-not-two) | One window, not two — and what that unlocks |
| [4](#4-the-target-api) | The target API, Android and iOS |
| [5](#5-what-moves-inside) | What moves inside |
| [6](#6-sequencing) | Sequencing |
| [7](#7-risks-and-open-questions) | Risks and open questions |
| [8](#8-what-this-deliberately-does-not-do) | What this deliberately does not do |

---

## 1. The problem, restated precisely

The entire public surface of `frak-sdk-ui` is four symbols:

| Symbol | File | Shape |
|---|---|---|
| `rememberFrakSharingLauncher(heightFraction, onResult)` | `FrakSharingLauncher.kt:60` | `@Composable` |
| `FrakSharingLauncher` / `.launch(request)` | `FrakSharingLauncher.kt:19,29` | constructible only from the above |
| `FrakSharingDefaults.HEIGHT_FRACTION` | `FrakSharingDefaults.kt:12` | `public const val` |
| `SharingResult` + 5 arms | `SharingResult.kt:16-31` | plain classes |

One `@Composable` factory is the only door. A merchant on an XML codebase must adopt the Compose
compiler plugin, add `androidx.compose.ui`, put a `ComposeView` in their layout and write a
`setContent {}` block — to open a share sheet. iOS is identical: `View.frakSharingSheet(…)` is a
SwiftUI `ViewModifier`, and UIKit apps are equally locked out.

**Two facts make this cheap now and expensive later.**

1. **Nothing is published.** Publishing is `publishToMavenLocal` only, the XCFramework task still
   exits 1, and `05-build-and-release.md` §5 gates the first publish on ABI questions Q1–Q3. This is
   not a migration with a deprecation cycle — it is a **replacement**. `rememberFrakSharingLauncher`
   gets deleted, not `@Deprecated`.
2. **It is on the critical path to that publish.** The binary-compatibility validator was wired and
   then removed with the comment *"the public shape isn't frozen. Re-add before first publish"*
   (`frak-publish.gradle.kts:14`). Committing a dump ratifies the shape. This must land **before**
   BCV returns, or we ratify the Compose-only surface and then break it.

A third reason, less obvious: **no test or harness exercises a non-Compose caller.** Both example
apps drive the SDK from inside a Compose/SwiftUI tree. The XML and UIKit paths are not merely
awkward — they are entirely unvalidated.

---

## 2. The decision everything else hangs off: the hosting vehicle

The Builder is the easy half. The hard question is what puts the sheet on screen once the merchant
is no longer supplying a composition to host it in.

### 2.1 What Stripe actually does

Verified from source, not docs. `PaymentSheet.Builder.build(activity)` returns
`PaymentSheet(DefaultPaymentSheetLauncher(activity, resultCallback))`, and that launcher does:

```kotlin
activityResultLauncher = activity.registerForActivityResult(PaymentSheetContract()) {
    callback.onPaymentSheetResult(it)
}
```

`present()` calls `activityResultLauncher.launch(args, options)` with
`ActivityOptionsCompat.makeCustomAnimation(context, FADE_IN, FADE_OUT)`. The contract resolves to a
real `PaymentSheetActivity : BaseSheetActivity : AppCompatActivity`, registered
`android:exported="false"`, which calls `renderEdgeToEdge()` then `setContent { …
ElementsBottomSheetLayout(…) }`. Args and results cross as `Parcelable` through `Intent` extras.

So: **a second Activity.** Not a Dialog.

### 2.2 Why we should not copy it

**A WebView cannot cross that boundary.** Stripe's content is Compose state, `Parcelable`-shaped by
construction. Ours is a `WebView` with a live document, a warm pool, an in-flight coroutine and a
`SharingPresentation` holding all three. None of it parcels. It would have to be handed over through
a process-global slot — at which point the Activity boundary buys nothing and costs an
`ActivityStarter` IPC round trip on the critical path.

**The durability guarantee is one we cannot honour anyway.** The reason to accept that cost is
process-death redelivery. But after process death the pool is gone, the warm document is gone, the
session is gone. The recreated Activity would rebuild from `Parcelable` args and pay a full cold
load — the exact thing the warm-pool design exists to prevent. We would pay for a guarantee we can
only half-deliver.

**`SharingResult` is not `Parcelable`, and making it so is an ABI decision we have not taken.**
`Shared`/`Copied` carry one `String`; `Dismissed`/`InstallStarted` carry nothing. But
`Failed(error: FrakError)` carries `FrakError.Network(cause: Throwable)` and
`FrakError.Decoding(cause: Throwable?)` — arbitrary throwables, `Serializable` at best. Crossing a
Parcel means flattening `cause` or writing a custom `Creator`, i.e. reshaping the error model on
exactly the types `05-build-and-release.md` Q1 is about, before Q1 is answered. Wrong order.

### 2.3 What Shopify does

Shopify's Checkout Sheet Kit is the far closer analogue — a WebView-backed modal sheet with a
preloaded, cached web view:

```kotlin
internal class CheckoutDialog(...) : ComponentDialog(context)
```

No second Activity. A plain `androidx.activity.ComponentDialog` on the caller's existing window:
`setContentView(...)`, `window?.setLayout(MATCH_PARENT, WRAP_CONTENT)`,
`window?.setBackgroundDrawable(TRANSPARENT)`, `onBackPressedDispatcher.addCallback(...)` for
predictive back, then `show()`. The WebView comes from `CheckoutWebView.cacheableCheckoutView(url,
context)` — a cache they recently **scoped to the hosting Activity instance** to stop a WebView
leaking across Activities.

### 2.4 `ComponentDialog` gives Compose what it needs — verified

From `androidx/activity/ComponentDialog.kt` on `androidx-main`:

```kotlin
public open class ComponentDialog(context: Context, @StyleRes themeResId: Int = 0) :
    Dialog(context, themeResId),
    LifecycleOwner, OnBackPressedDispatcherOwner,
    NavigationEventDispatcherOwner, SavedStateRegistryOwner {

    public open fun initializeViewTreeOwners() {
        window!!.decorView.setViewTreeLifecycleOwner(this)
        window!!.decorView.setViewTreeOnBackPressedDispatcherOwner(this)
        window!!.decorView.setViewTreeSavedStateRegistryOwner(this)
        window!!.decorView.setViewTreeNavigationEventDispatcherOwner(this)
    }
}
```

`initializeViewTreeOwners()` runs from **every** `setContentView`/`addContentView` overload, before
attach. `AbstractComposeView` needs `ViewTreeLifecycleOwner` and `ViewTreeSavedStateRegistryOwner`;
both are there. **`ViewModelStoreOwner` is not** — which matters only if the *composed content*
calls `viewModel()`. `FrakSharingSheet` does not, and must not start. §5.2 does put the pool in a
`ViewModel`, but the host resolves that from the owner passed to `build()` directly; it never goes
looking for one through the dialog's view tree.

Two lifecycle details that are easy to get wrong:

- `onStart()` dispatches `ON_RESUME` directly, skipping `ON_START`.
- `onStop()` dispatches `ON_DESTROY` and nulls the registry (re-created lazily on next show). So
  **every `show()` gets a fresh composition**, and nothing cached across presentations may live in
  it. True of the pool today; must stay true.

### 2.5 Decision

> **Adopt Stripe's API shape. Reject Stripe's vehicle. Host in a `ComponentDialog`, as Shopify
> does.**

The Builder, the `ResultCallback`, the three build sites and `present(request)` are what merchants
touch, and that is what we are copying. The Activity is Stripe's implementation detail, driven by a
payment flow's durability needs and a `Parcelable` content model — neither of which we have.

| Given up | Cost |
|---|---|
| Process-death result redelivery | Nil in practice — after process death there is no warm view, no session and no merchant UI to return to |
| Back-stack participation | The sheet is modal and sub-minute; it should not be a destination |
| Independent `windowOptOutEdgeToEdgeEnforcement` on Android 15+ | Real; see §7 |
| Graceful degradation when the host is finishing | Real. `ActivityResultLauncher.launch()` on a finishing caller degrades better than a raw `Dialog.show()`, which throws `BadTokenException`. Addressed explicitly in §5.4 |

---

## 3. One window, not two

**This is the part the first draft of this plan got wrong, and it is the most consequential section
here.**

`FrakSharingSheet` composes `ModalBottomSheet`, and `SharingPresentation.kt:12-13` records what that
costs: *"Opening a `ModalBottomSheet` builds a real Dialog with its own Window and surface, and the
pooled web view is attached and laid out in the same frames — Main is occupied for ~300ms."*

So the naive Step A — put the existing `FrakSharingSheet` in a `ComposeView` inside a
`ComponentDialog` — produces **two stacked platform Windows**: the `ComponentDialog`'s, and
`ModalBottomSheet`'s own inside it. Two scrims, two back-press dispatchers, two IME adjustment
contracts, and two windows competing for TalkBack's notion of the active window. That is strictly
worse than today, and `07` §3.3 had already flagged Dialog-in-Dialog as something only its Step B
resolved.

**So Step A drops `ModalBottomSheet`.** The `ComponentDialog` *is* the window. The composed content
is only the sheet's body.

This is far less work than it sounds, because almost nothing of `ModalBottomSheet` is in use.
Reading `FrakSharingSheet.kt:83-114`, every capability is explicitly switched off:

| Parameter | Value | Why |
|---|---|---|
| `sheetGesturesEnabled` | `false` | Drag is hand-rolled; the page and the grab strip own gestures explicitly |
| `dragHandle` | `null` | Drawn by hand inside the content so it floats over the page |
| `containerColor` | `Transparent` | The page paints the only surface |
| `shape` | `RectangleShape` | `07` §1.1 — the corners moved to CSS |

It is providing exactly three things, and each has a direct replacement on the dialog window:

| Provided by `ModalBottomSheet` | Replacement |
|---|---|
| A Dialog + Window | The `ComponentDialog` itself |
| The scrim | `window.setDimAmount(...)` |
| Slide-up / slide-down animation | The `Animatable` already driving `graphicsLayer { translationY }` for the drag (`07` §1.4) |

### What this unlocks

`07` closed §1.2 and §1.3 as **not fixable**. Both were `ModalBottomSheet`'s:

- **§1.2** — M3 1.4.0 applies `verticalScaleUp`/`verticalScaleDown` to the sheet during the entry
  overshoot, scaling the WebView's draw functor. Unfixable because `MotionScheme`, `standard()` and
  `LocalMotionScheme` are all `internal` in 1.4.0. **Gone with `ModalBottomSheet`.**
- **§1.3** — `DraggableAnchorsNode.measure` uses `placeable.place()` rather than `placeWithLayer()`,
  so the show/hide animation re-runs `WebView.layout()` every frame. Unfixable from outside.
  **Gone with `AnchoredDraggable`.**

And the ~300ms window construction moves **off the critical path**: the `ComponentDialog` is created
at `build()` time, when the merchant wires up their screen. `present()` is then `show()` on an
already-constructed window, not "build a Window and a composition and attach a WebView, now."

That is a materially larger claim than the first draft's "one recomposition removed", and it is
mechanism-inferred, not measured — same caveat as everything in `07` §1.

---

## 4. The target API

### 4.1 Android

```kotlin
public class FrakSharing internal constructor(
    private val host: SharingHost, // internal seam; see §5
) {
    /** SAM-convertible so Java callers can pass a lambda. Always invoked on the main thread. */
    public fun interface ResultCallback {
        @MainThread
        public fun onResult(result: SharingResult)
    }

    public class Builder(private val callback: ResultCallback) {
        /**
         * Share of the screen height the sheet occupies.
         * @throws IllegalArgumentException outside `0.3..1.0`.
         */
        public fun heightFraction(fraction: Float): Builder

        public fun build(activity: ComponentActivity): FrakSharing
        public fun build(fragment: Fragment): FrakSharing
        @Composable public fun build(): FrakSharing
    }

    /**
     * Starts warming the pooled web view and the identity/config reads. Call when a share
     * affordance becomes visible — not at construction. See §5.3; the `@Composable` build site
     * does this for you.
     */
    @MainThread
    public fun warm()

    /** No-op if the host activity is finishing or destroyed. */
    @MainThread
    public fun present(request: SharingRequest)
}
```

Merchant code:

```kotlin
// XML / Java / plain Activity
private val sharing = FrakSharing.Builder(::onShareResult).build(this)   // in onCreate
// …when the share surface becomes visible:
sharing.warm()
sharing.present(request)

// Fragment
private val sharing = FrakSharing.Builder(::onShareResult).build(this)

// Compose — warms on composition-enter, exactly as today
val sharing = remember { FrakSharing.Builder(::onShareResult) }.build()
```

The Compose form is `remember { Builder(...) }.build()` — `build()` is the `@Composable`, not the
`Builder` construction. That matches Stripe's own migration guidance verbatim.

### 4.2 Threading, which is currently undefined and wrong

`SharingSheetState.finish()` (`SharingSheetState.kt:774-782`) calls `onFinished(...)` on whatever
thread reached it. That includes `workContext`, which is `Dispatchers.Default` in production
(`SharingSheetState.kt:145`) — the tier-3 fallback and `prepare()`'s catch-all both report from
there. **So a merchant's `onResult` can already fire off the main thread**, and a callback that
touches a View or Compose state from it will crash.

The Builder is the moment to fix this: `finish()` hops to `Dispatchers.Main.immediate` before
invoking the callback, and `ResultCallback` is annotated `@MainThread`. `present()` and `warm()` are
`@MainThread` on the way in.

### 4.3 The `07` §3.4 papercuts, folded in

| Issue | Resolution |
|---|---|
| `public const val HEIGHT_FRACTION` | Drop `const`. It inlines into merchant bytecode, freezing a value we document as tunable at their compile time forever |
| No `@JvmStatic`/`@JvmOverloads`, lambda callbacks | `fun interface ResultCallback` is SAM-convertible from Java; the Builder needs no `@JvmOverloads` because it has no default arguments **by construction** |
| `heightFraction` clamped and NaN-defaulted silently | `require(fraction in 0.3f..1.0f)`. Fails at the build site with a message, not at present time with a wrong-sized sheet |
| "Hoist per screen, not per row" in `internal` KDoc only | **Dissolved, not documented.** The pool binds to the Activity (§5.2), so building per row shares one pool. The footgun stops existing |
| No reward-availability helper | Core-side, `frak-sdk`. Tracked separately |
| Eight injected suspend lambdas on `SharingSheetState` | Collapse to one `internal interface SharingDependencies`. Not free: `SharingSheetStateTest.kt`'s `newState` helper and every named-lambda call site move with it |

**No `Configuration` class.** Stripe has `PaymentSheet.Configuration`; we should not, yet. A config
class whose constructor carries default arguments is precisely the synthetic-`$default` ABI trap
`05-build-and-release.md` Q1 catalogues across 15 existing types — adding a field later breaks an
already-shipped merchant binary with `NoSuchMethodError`. Builder *methods* are additive with no ABI
break. Revisit when there are five knobs and Q1 has an answer.

### 4.4 iOS

```swift
@MainActor public final class FrakSharingPresenter {
    public init(onResult: @escaping (SharingResult) -> Void)
    public func present(_ request: SharingRequest, from presenter: UIViewController)
}
```

with `View.frakSharingSheet(…)` kept as SwiftUI sugar, reimplemented on top of the presenter rather
than beside it. No `Parcelable`/Activity question exists here — UIKit presentation is already the
substrate SwiftUI's `.sheet` sits on, so this is strictly an extraction. `SharingResult` is already
`public enum … : Sendable`.

---

## 5. What moves inside

### 5.1 Ownership today vs after

| Thing | Owner today | Owner after |
|---|---|---|
| `SharingWebViewPool` | `remember(context, walletOrigin, preload)` in whichever composable called the factory | A `ViewModel` on the host's `ViewModelStore` (§5.2) |
| `WarmSharingData` | `LaunchedEffect` in that composition | Explicit `warm()`; see §5.3 |
| `SharingPresentation` | `mutableStateOf` on the launcher, transferred to the sheet's `DisposableEffect` | The same `ViewModel`; survives rotation, disposed in `onCleared()` |
| `SharingSheetState`'s scope | `rememberCoroutineScope()` of the calling composable — deliberately outliving any one sheet | `viewModelScope`; same intent, and now it outlives rotation too |
| The sheet | `ModalBottomSheet` in the launcher's composition | `ComposeView` in a `ComponentDialog`, no `ModalBottomSheet` (§3) |

Every one of those seams already has the right *intent* — the launcher's scope is deliberately
chosen over the sheet's, for instance. They are pinned to the wrong owner. This is a re-parenting,
not a redesign.

### 5.2 The pool moves to a `ViewModel`, and the sheet survives rotation

**Decided: the sheet survives rotation.** This finally implements what
`03-sharing-and-install.md:46` has promised since the design phase — *"Rotation | Android: state
survives via `SavedStateHandle`; never re-create the web view"* — and which nothing in
`frak-sdk-ui` has ever done (zero matches for `SavedStateHandle` or `rememberSaveable`).

The pool, the `SharingPresentation` and the `SharingSheetState` move into a `ViewModel` on the
`ViewModelStore` of the owner passed to `build()`. That store survives configuration change and is
cleared only when the owner really finishes — which is exactly the lifetime this state wants, and
the first owner in this codebase that has ever matched it.

Three things have to be right, and each is a place this can go wrong.

**1. The web view must not hold a destroyed Activity.** A `WebView` keeps a hard reference to the
`Context` it was constructed with, so a `ViewModel`-retained one leaks the Activity across every
rotation — the bug Shopify's *"scope preloads to activity"* change was fixing, and the reason the
conservative option was tempting. The fix is the standard one: construct the web view over a
`MutableContextWrapper`, whose base is the **application context** whenever the view is pooled or
detached, and swapped to the **current Activity** on attach. The swap points are exactly
`SharingWebViewPool.acquire`/`release`, which already exist and already bracket every attach.

**2. Rotation must not report `Dismissed`.** Today `SharingPresentation.dispose()` calls
`abandon()`, which reports — correct when the screen is genuinely gone, wrong for a rotation. The
two cases split cleanly under a `ViewModel`:

| Event | Action |
|---|---|
| `onDestroy` with `isChangingConfigurations == true` | Detach the web view, dismiss the dialog. **No report.** Session stays live in the `ViewModel` |
| `ViewModel.onCleared()` | The screen is really gone. `dispose()` → `abandon()` → report `Dismissed` |

This is strictly better than what `07` §2.1 shipped: `abandon()` moves from "a composable left the
tree" — which fires on rotation, when nothing was abandoned — to "the `ViewModelStore` was
cleared", which is the real thing it was always trying to detect.

**3. The dialog cannot survive; the session must.** A `ComponentDialog` is bound to a window token
and dies with the Activity. So the recreated Activity re-creates the dialog, and re-attaches the
retained web view to it. The web view instance is never re-created, so the DOM, the JS heap and the
in-flight session survive untouched — which is the substantive half of `03`'s promise. What does
*not* survive is the dialog's composition (§2.4) and with it the drag `Animatable`; the sheet comes
back at its resting position, which is the correct behaviour for a rotation anyway.

Note `03`'s wording says `SavedStateHandle`, and this design does not use one. `SavedStateHandle`
buys survival across **process death**, which §2.2 establishes we cannot deliver for a WebView-backed
sheet at any price. A plain `ViewModel` buys survival across **configuration change**, which is the
case that actually happens and the one the promise was written about. `03` should be amended to say
so precisely rather than left implying more than is achievable.

### 5.3 Warming must not follow construction

Today, `FrakSharingLauncher.kt:69-71`: *"This composable existing is the share surface becoming
visible, which is the earliest honest moment to start warming."* Warming is tied to a **screen**.

Naively re-parenting that to the Activity breaks it. In a single-Activity app — the dominant Compose
architecture, and common in Fragment-based XML apps — `build(activity)` in `onCreate` would warm
**once per process launch**, booting a WebView and doing identity/config round trips on every cold
start whether or not the user ever reaches a share surface. That is a real regression against the
warm-pool's whole rationale, and it would be invisible in the harness (whose only screen has share
buttons).

So construction and warming are separated:

- `build(...)` allocates the host and the dialog. Cheap. No network, no WebView.
- `warm()` starts the pool and the identity/config reads. The merchant calls it when a share
  affordance becomes visible.
- The `@Composable build()` calls `warm()` on composition-enter, so **Compose callers keep today's
  behaviour exactly** and never see the new method.
- `present()` implies `warm()` if it has not happened — correct, just late.

### 5.4 Dialog lifecycle, `BadTokenException` and `WindowLeaked`

A raw `Dialog.show()` on a host whose window token is gone throws `BadTokenException`; a Dialog
outliving its Activity throws `WindowLeaked`. Today's Compose-hosted sheet gets both for free
through composition disposal tied to `ViewTreeLifecycleOwner`. With a `ComponentDialog` it must be
explicit:

- `SharingHost` registers a `DefaultLifecycleObserver` on the owner passed to `build()`.
- `onDestroy` → dismiss the dialog and detach the web view **always**; report and destroy the pool
  **only** from `ViewModel.onCleared()` (§5.2). Conflating the two is what would report a dismissal
  on every rotation.
- On the recreated Activity, if the `ViewModel` holds a live session, re-create the dialog and
  re-attach — without re-running `build()`'s session start.
- `present()` returns without effect if the host is `isFinishing`/`isDestroyed`, or if the owner's
  lifecycle is below `STARTED`.

### 5.5 `AlreadyPresenting` becomes Activity-scoped

A merchant can hold two `FrakSharing` instances on one Activity, and two sheets could stack. The
`FrakError.AlreadyPresenting` guard moves to the Activity-scoped host so it holds across instances.

---

## 6. Sequencing

| Step | Work | Unblocks |
|---|---|---|
| **A1** | `FrakSharing` + `Builder`, three build sites; `ComponentDialog` host; **drop `ModalBottomSheet`** (§3); split `warm()` from `build()`; lifecycle observer + `present()` guards; main-thread `onResult`; delete `rememberFrakSharingLauncher` **and migrate `example/native-android`'s call site in the same commit**; fold in §4.3 including the `SharingDependencies` collapse and its test refactor | XML and Java merchants; `07` §1.2 and §1.3 |
| **A2** | Rotation survival (§5.2): pool + presentation into a `ViewModel`, `MutableContextWrapper` on the web view, `onCleared()`-vs-`isChangingConfigurations` split, re-attach on the recreated Activity. Amend `03-sharing-and-install.md:46` to say configuration change rather than `SavedStateHandle` | `03`'s standing promise, unimplemented since the design phase |
| **B** | An **XML + Java** screen in `example/native-android`, plus a rotation pass and a leak check | Validates A on the path nothing has ever compiled |
| **C** | Replace the remaining Compose content with Views; split `id.frak:frak-sdk-ui-compose` for the `@Composable build()` | Compose leaves the base artifact; the dex gate stops being vacuous |
| **D** | `FrakSharingPresenter` on iOS; reimplement `.frakSharingSheet` on top | UIKit merchants |
| **E** | Answer `05` Q1–Q3, re-wire binary-compatibility-validator, commit dumps | The first publish |

A is split because A2 is the single largest risk item here and the only one that can leak an
Activity. A1 is a re-parenting with a compile error at every site that needs attention; A2 is a
lifetime change whose failure mode is silent. **Land them as separate commits**, so a rotation or
leak regression bisects to one of them rather than to a fifteen-file rewrite. A1 alone is shippable
— it leaves rotation behaving exactly as it does today, which `07` §2.1 already made honest.

A and D are independent and can run in parallel. **B gates C.** E is last and depends on all of it.

Note what moved: with `ModalBottomSheet` gone in A, **step C is now purely about the Compose
*dependency***, not about window structure. B therefore validates the final window architecture
rather than scaffolding C would discard — which was the reason to sequence B before C in the first
place.

`example/native-android` substitutes `id.frak:frak-sdk-ui` onto the local module through a Gradle
composite build, so deleting the old entry point breaks the harness's compilation in the same build.
That is the desired behaviour — there is no version-pinning gap to hide a missed migration — but it
means the harness edit is part of step A, not a follow-up.

Step C's Gradle shape, from Coil's verified layout (`coil-core` / `coil-compose-core` /
`coil-compose`): the Compose compiler plugin is applied **only** in the Compose modules, and
cross-module dependencies are `api`, not `implementation`, so a consumer of the sugar artifact still
sees the base artifact's types.

---

## 7. Risks and open questions

1. **The `MutableContextWrapper` swap is the one thing here that can leak an Activity**, and its
   failure mode is silent — no crash, no log, just a destroyed Activity retained per rotation. Step
   A2 is not done without a leak check: LeakCanary in `example/native-android`, plus a Robolectric
   test that rotates with a session live and asserts the previous Activity is collectable. Swapping
   the base back to the application context on `release()` is the load-bearing line.
2. **Edge-to-edge on Android 15+.** A `Dialog` is a child window with no independent
   `windowOptOutEdgeToEdgeEnforcement`; it must cooperate with the host's insets contract. Needs
   `WindowCompat.setDecorFitsSystemWindows(dialog.window, false)` and a device pass against a
   `targetSdk 35` host, both edge-to-edge and not.
3. **The merchant's theme.** The dialog is constructed with the host Activity's context and
   therefore its theme. A non-AppCompat/non-Material host theme must not break the composed content.
   Needs an explicit theme overlay on the dialog, and a harness screen that proves it.
4. **A merchant may already have a Dialog up.** Our `ComponentDialog` would stack on it. Defined
   behaviour needed — probably fine (it is a child window of the same Activity), but untested.
5. **IME.** Shopify needed the deprecated `SOFT_INPUT_ADJUST_RESIZE` on their dialog window, noting
   the modern insets listener *"is not adjusting the pan properly into the fields."* Our page has no
   text input today, so this is latent — and becomes real the moment it grows one.
6. **The dex budget is still vacuous.** `checkDexSizeBudget` dexes only the module's own
   `classes.jar`, never its transitive `implementation` deps, so the Compose runtime a merchant must
   ship is invisible. Step C fixes the underlying problem; the gate should be made transitive
   independently, or it keeps passing while lying.
7. **No millisecond number** for any of §3's claims. The mechanism is sound and is why Shopify chose
   as it did, but `07` §1.1's dominance was never measured either, and this compounds that. A
   Perfetto trace before and after step A is the check.

---

## 8. What this deliberately does not do

- **No `Configuration` class**, for the ABI reason in §4.3.
- **No change to `SharingRequest`, `SharingResult` or `FrakError`.** They stop needing to be
  `Parcelable` the moment we reject the Activity, and their shape is `05` Q1's business.
- **No reward-availability helper.** That is `frak-sdk` core.
- **No RN / Flutter surface.** A Builder with a plain-Activity build site is a precondition for one;
  building it is not in scope.
- **No durability across process death.** Not achievable for a WebView-backed sheet, and not worth
  simulating.
