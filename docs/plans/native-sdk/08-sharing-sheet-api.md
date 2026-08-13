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
| [9](#9-what-actually-landed-deviations-from-the-above) | **What actually landed — deviations from the above** |

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
   then removed while the public shape was unfrozen; committing a dump ratifies the shape. This had to
   land **before** BCV returned, or we would have ratified the Compose-only surface and then broken it.
   It did: the sheet's Builder shipped first, then the five steps of
   `09-android-api-surface.md` reshaped the rest, then BCV came back. No dump is committed yet.

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
private lateinit var sharing: FrakSharing

override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    sharing = FrakSharing.Builder(::onShareResult).build(this)
}

// …when the share surface becomes visible:
sharing.warm()
sharing.present(request)

// Compose — warms on composition-enter, exactly as today
val sharing = remember { FrakSharing.Builder(::onShareResult) }.build()
```

> Amended after implementation. This originally showed a property initialiser annotated
> `// in onCreate`, and the `Fragment` build site. It cannot be an initialiser — `build()` needs the
> `ViewModelStore`, and an Activity has none until the framework attaches its `Application`, which
> is after the constructor. `build(Fragment)` is deferred; see §9.4.

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
| **E** | Answer `05` Q3 (Q1/Q2 are answered in `09`), commit the `api/*.api` dumps — BCV itself is already wired | The first publish |

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
6. **The dex budget was vacuous, and has been retired** (`32836c217`). It dexed only the module's
   own unminified `classes.jar`, so the Compose runtime a merchant must ship was invisible and the
   number bore no relation to what R8 keeps. A replacement over the minified-APK attribution is
   possible and needs a real app build in the loop. Step C fixes the underlying problem.
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

---

## 9. What actually landed — deviations from the above

Written after implementing A1 and A2 on Android. Everything not listed here landed as designed.
Each entry says what the plan asserted, what the code does instead, and why — so the next reader
trusts §1–§8 only where it was not corrected.

**None of this was compiled or run locally.** The machine the work was done on has no JDK and no
Android SDK. CI is the only verifier, and see 9.1 for what CI does not cover.

### 9.1 §6's enforcement mechanism does not exist

§6 says deleting `rememberFrakSharingLauncher` *"breaks the harness's compilation in the same
build… there is no version-pinning gap to hide a missed migration."* That is true for a developer
with a toolchain and false everywhere else: `.github/workflows/apps.yaml` triggers on
`apps/**`, `packages/**`, `sdk/**` and has no `example/**` path or job. **Nothing in CI ever
compiles `example/native-android`.** The harness migration is in the A1 commit as promised, but it
is unverified, and a future break in it will not go red.

What replaced the missing coverage, all inside `sdk/android/**` so CI does run it:

| Added | Pins |
|---|---|
| `frak-sdk-ui/src/test/java/…/JavaCallSiteFixture.java` | That the public API stays callable from Java: SAM lambda for `ResultCallback`, a chained `heightFraction`, `build(activity)`, every `SharingResult` arm, `FrakSharingDefaults.getHEIGHT_FRACTION()`. Compiled by `:frak-sdk-ui:test`, never executed |
| `SharingPresentDecisionTest` | The `present()` guards Compose used to make unreachable |
| `FrakSharingBuilderTest` | `heightFraction`'s `require`, including NaN |
| `SharingWebViewContextTest` (A2) | That the pooled `WebView` holds the `MutableContextWrapper` itself rather than resolving through it once, that swapping its base is visible through the retained view, and that a release/re-acquire cycle hands back **the same** `WebView` instance |

### 9.2 The dialog is built per `present()`, not at `build()` (§3)

§3 claims constructing the `ComponentDialog` at `build()` time moves ~300ms off the critical path.
Rejected, on three grounds:

1. `SharingPresentation.kt`'s own KDoc attributes that ~300ms to the Dialog **and** *"the pooled
   web view is attached and laid out in the same frames"*. The attach and layout are paid at
   `show()` whatever happens; only decor inflation is deferred. §7.7 already concedes there is no
   millisecond number for any of §3.
2. Re-showing one retained `ComponentDialog` + `ComposeView` depends on `onStop()` nulling and
   lazily rebuilding the lifecycle/saved-state registries, on `AbstractComposeView` re-creating its
   composition on re-attach, **and** on `WindowRecomposerPolicy`'s cached recomposer being replaced
   — three internal AndroidX details, none of which anything here can test. The failure mode is "the
   second share of a session renders a blank sheet."
3. The tap-time head start §3 actually cares about is untouched: `present()` still calls
   `SharingPresentation.start(...)` *before* it builds the window, so the page load is in flight
   first — exactly `FrakSharingLauncher.launch`'s old ordering.

Revisit if and when §7.7's Perfetto trace says the decor inflation is worth the fragility.

### 9.3 §4.2's threading fix names a dispatcher this build does not have

§4.2 says `finish()` should hop to `Dispatchers.Main.immediate`. `kotlinx-coroutines-android` is on
no classpath in `sdk/android` — `frak-sdk` declares only `kotlinx-coroutines-core`. `Dispatchers.Main`
compiles fine against core and throws `IllegalStateException: Module with the Main dispatcher had
failed to initialize` at first touch, i.e. inside the merchant's process, while reporting a share
result. Neither the unit tests nor `assembleRelease` would have caught it.

What landed instead:

- The hop is in `SharingHost`'s callback adapter, not in `SharingSheetState.finish()`, using the
  `Handler(Looper.getMainLooper())` pattern already in that file. Inline when already on main.
  `SharingSheetState`'s ordering invariants stay synchronous, and its test file moves by one line
  (the `SharingDependencies` collapse) rather than being rewritten around a new threading model.
- `SharingHost`'s scope uses a hand-rolled `MainThreadDispatcher` (a `CoroutineDispatcher` over the
  same `Handler`) for the same reason. It is main-confined because `SharingSheetState` drives the
  `WebView` from that scope — the install-page load, the `view=confirmation` navigation and
  share-again all reach `webView.navigate(...)` from it. A `ViewModel`'s `viewModelScope` would
  have silently fallen back to `Dispatchers.Default` here for exactly the missing-artifact reason
  above, which is a background-thread `WebView` call: A2 does **not** use `viewModelScope`.

### 9.4 `build(Fragment)` is deferred

§4.1 lists three build sites. Two landed. `build(Fragment)` would put `androidx.fragment` in the
published POM as `api` — imposed on every merchant, including pure-Compose apps that will never
touch it — for a build site nothing validates, since step B is out of scope. `build(requireActivity())`
works today, and §4.3's own point stands: Builder methods are additive with no ABI break, so this
lands alongside the Fragment harness screen that would exercise it.

### 9.5 §3's replacement table is incomplete

Four things `ModalBottomSheet` was supplying that §3 does not list, each of which had to be
replaced by hand:

| Missing from §3 | What it needed |
|---|---|
| The scrim | `window.setDimAmount` alone does nothing without `FLAG_DIM_BEHIND`, and a window dim is constant for the window's whole life, so it would pop in and out while the sheet is still sliding. The scrim is Compose-drawn (`drawBehind`) and keyed to the sheet's own offset instead |
| The window itself | A `Dialog` built with `themeResId = 0` picks up the merchant's `android:dialogTheme`, and every standard dialog theme sets `windowIsFloating`, which shrink-wraps the decor and defeats `setLayout(MATCH_PARENT, MATCH_PARENT)`. Built with `android.R.style.Theme_Translucent_NoTitleBar` — a platform id, so no `res/` and no `resourcePrefix` collision — and `setWindowAnimations(0)` so the theme's fade does not race the slide-in. This is §7.3, which §3 left open |
| `MaterialTheme` | The sheet used to compose inside the merchant's tree. In a window of its own it has no `MaterialTheme` ancestor, so `BottomSheetDefaults.DragHandle()`, `BottomSheetDefaults.ContainerColor` and the skeleton would silently fall back to M3 defaults. Pinned to `lightColorScheme()` — everything that reads it sits against the hosted page, and that page is white |
| Accessibility | `ModalBottomSheet` supplies a scrim close action and a pane title. Replaced with a `dismiss` semantics action on the sheet container, which TalkBack labels itself; the scrim is `clearAndSetSemantics {}`. A pane title is **not** replaced — it needs a localised string and this module ships no resources |

Also load-bearing and unstated: the window must be `MATCH_PARENT` in height, not `WRAP_CONTENT`.
Drag-to-dismiss and the exit animation translate the sheet down by its full height, and a
sheet-sized window clips that translation at its own edge.

### 9.6 §5.2's `MutableContextWrapper` swap points are wrong

§5.2: *"The swap points are exactly `SharingWebViewPool.acquire`/`release`."* They are not, because
`acquire` is not where the view is **constructed** — `warm()` → `newHandle()` is, and that runs
first. A `WebView` resolves its theme, `LayoutInflater` and popup host at construction, and swapping
the base afterwards does not retroactively fix it; `<select>` dropdowns and text-selection handles
would mis-place, silently, on a device nothing has tested. The pool's own KDoc already stated the
invariant: *"a WebView needs a themed, windowed context for its own popups."*

So the base is the **Activity** from the moment the host attaches to one, and is downgraded to the
application context in `onDestroy` — Shopify's direction, not the plan's. Those two are the swap
points, and `acquire`/`release` are deliberately **not**: between a release and the next acquire the
Activity is alive anyway, so leaving it as the base leaks nothing, while swapping there would open a
window in which a popup resolves against a context with no window.

The construction ordering needs one more guard than a swap. `resolveWarmUrl` suspends on two network
reads, so its continuation can land in the gap between one Activity's `onDestroy` and the next one's
attach — and warming the pool from in there would construct the view against the application
context after all. It therefore answers a URL rather than warming, and `SharingHost` holds it until
it has an Activity.

### 9.7 §5.5 and §5.2 contradict each other

§5.5 puts the `AlreadyPresenting` guard on the Activity-scoped host. §5.2 has the session outlive
the Activity in a `ViewModel`. Both cannot hold: a rotation mid-session would reset an
Activity-scoped guard and let a second `present()` stack over a live session. The guard tracks the
session, so in A2 it lives with it.

### 9.8 §5.2's onDestroy/onCleared table drops results

The table covers rotation not reporting `Dismissed`. It does not cover a **terminal** result
arriving *during* the rotation window — which is reachable by construction, since `launchAttribution`
runs on the retained scope precisely so a chooser the user is still looking at outlives the sheet.
With the old Activity's callback detached and the new one not yet attached, that result had nowhere
to go, and `finish()`'s compare-and-set means it is dropped rather than re-delivered. A2 buffers a
result that lands with no callback attached and replays it on the next `build()`.

### 9.9 Smaller deviations, recorded for completeness

- **`WindowCompat.setDecorFitsSystemWindows` → the platform API, gated at API 30.** §7.2 names the
  AndroidX wrapper; `androidx.core` is not a declared dependency of this module and adding one to
  reach a single call is not worth the resolution risk at `compileSdk 36`. The consequence is real
  and unstated in §7.2: on API 24–29 the dialog does nothing about insets at all.
- **`FrakSharing`'s internal constructor takes three parameters**, not §4.1's one — the host, the
  height fraction and the callback. Internal, so no ABI consequence.
- **The Compose build site keeps `rememberUpdatedState`.** §4.1's snippet implies the callback is
  captured by the `Builder`. It is, but `@Composable build()` reads the current one through
  `rememberUpdatedState` and hands the host a stable delegating `ResultCallback`, restoring exactly
  what `rememberFrakSharingLauncher` did. Without it a caller who omits the documented outer
  `remember { Builder(...) }` would have their first lambda — and all of its captures — called for
  the life of the screen.
- **`build(activity)` must be called from `onCreate`, and now says so loudly.** §4.1's snippet reads
  as a property initialiser with an `// in onCreate` comment. It cannot be one: `ViewModelStore` is
  where a rotation-surviving sheet lives, and `ComponentActivity` has none until the framework
  attaches its `Application`, which is after the constructor. `build(activity)` `check`s this with
  a message rather than letting AndroidX throw a generic one.
- **`@Composable build()` is the one ABI-hostile member of the new surface**, and neither §6 nor §4
  says so: its erased signature carries the Compose compiler's synthetic `(Composer, Int)`
  parameters, so a binary-compatibility dump ratifies a signature the Compose compiler version
  owns. It is also exactly what pins Compose into the base artifact that step C exists to unpin.
  Related, and also unstated: `androidx.activity` is `api` because `ComponentActivity` is in a
  public signature, but `androidx.compose.runtime` is only `implementation` — so a consumer who has
  not declared Compose themselves cannot call `@Composable build()` at all.
- **A `WebView` that cannot be constructed is reported as `FrakError.Decoding`.** A device whose
  WebView provider is missing, disabled or mid-update throws out of `WebView`'s constructor, and
  there is no arm of `FrakError` that means "no usable web view". `Decoding` is the least-wrong of
  the existing ones and carries the real cause; a proper arm is `05-build-and-release.md` Q1's
  business, and §8 says this change does not touch `FrakError`.

### 9.10 What A2 leaves untested

Deliberately not written: a `WeakReference` + `System.gc()` collectability assertion. Robolectric's
`ActivityController` retains Activities for the test's duration by design, so it would be asserting
against the harness rather than the code, `System.gc()` is advisory, and the result would be a
flaky red in the first CI job this package has ever had — on a machine that cannot run it once to
find out. `SharingWebViewContextTest` pins the load-bearing line instead: that the swap is
*possible*, i.e. that the view holds the wrapper.

Not covered by anything, and the first thing a device pass should look at:

- the `onDestroy(isChangingConfigurations)` / `onCleared()` split actually reporting once on a
  finish and not at all on a rotation,
- a sheet re-attaching to the recreated Activity's dialog with the session live — including that
  the web view is out of the old dialog's view tree by then, or `AndroidView`'s factory throws
  `The specified child already has a parent`,
- the buffered-result replay (§9.8), and a dismissal that lands mid-rotation. All four exit routes
  (back, scrim tap, drag/fling, the TalkBack dismiss action) tell the host an exit has begun before
  they animate, so the host can finish the session itself rather than putting the sheet back on
  screen — none of that has run,
- the guards and latches added after review — `exitRequested`, `warmRequested`, `present()`'s
  WebView-construction catch, and `onOwnerCleared` leaving the reporting path intact so a deferred
  attribution still reports. All are plain state machines, and all of them need a real Activity and
  a real dialog to reach, which is the same wall as everything else in this list,
- LeakCanary over a rotate-with-sheet-up loop, per §7.1,
- ~~insets, which nothing in the new window handles~~ — **found on the first device pass, fixed.**
  The reasoning here was wrong: it asked whether `ModalBottomSheet`'s own insets changed (they did
  not, they were top-only either way) when what changed was the *window underneath it*. The sheet
  used to compose in the merchant's window, which fits system windows, so its content area already
  stopped above the nav bar; it now composes in a dialog with `setDecorFitsSystemWindows(false)`
  spanning the whole display. Two visible regressions came out of that, both in `example/native-android`:
  the page's bottom ~48dp sat behind the nav bar, and both system bars flipped black for the life of
  the sheet because `Theme_Translucent_NoTitleBar` never sets `statusBarColor`/`navigationBarColor`
  and `Theme`'s default for both is opaque black. Fixed by `windowInsetsPadding(navigationBars)`
  inside the sheet's `graphicsLayer` (outside it, a full-offset exit strands a sliver over the nav
  bar) and transparent bar colours on the dialog window. `imePadding` is still absent, deliberately:
  the hosted page has no text input, so there is no keyboard path to get wrong yet.

Also unverified by construction: whether disposing the composition from inside its own effect
coroutine is safe. The exit chain runs `Animatable` frame callback → `state.dismiss()` →
`SharingHost.finish` (inline, on main) → `dialog.dismiss()` → `disposeComposition()`, which
disposes the composition whose `LaunchedEffect` is on the stack. M3's own `hide() →
onDismissRequest` has the same shape, so this is believed safe rather than known to be.

Reaching those from a JVM test would mean composing a `ComposeView` inside a real `ComponentDialog`
under Robolectric, which depends on enough internal Compose window machinery that a green result
would not have meant much anyway.

### 9.11 `clampSharingHeightFraction` stays

§4.3 replaces the silent clamp with `require(...)` at the build site, and that landed. The internal
clamp stays as well: `fillMaxHeight` *throws* on a non-finite fraction, and a crash inside the
merchant's process is a worse answer than the default for a value that still crosses an internal
boundary. `MIN_/MAX_HEIGHT_FRACTION` keep `const` — they are `internal`, so §4.3's inlining
argument does not apply to them. `HEIGHT_FRACTION` drops `const` and gains `@JvmStatic`, so Java
callers reach a getter rather than `INSTANCE`.
