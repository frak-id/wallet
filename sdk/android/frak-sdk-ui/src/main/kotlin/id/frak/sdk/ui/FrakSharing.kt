package id.frak.sdk.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.annotation.MainThread
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.platform.LocalContext
import id.frak.sdk.sharing.SharingRequest

/**
 * The Frak sharing sheet.
 *
 * Built once per screen and kept, not built per share:
 *
 * ```kotlin
 * // Activity / XML / Java
 * private lateinit var sharing: FrakSharing
 *
 * override fun onCreate(savedInstanceState: Bundle?) {
 *     super.onCreate(savedInstanceState)
 *     sharing = FrakSharing.Builder(::onShareResult).build(this)
 * }
 *
 * // when a share affordance becomes visible
 * sharing.warm()
 *
 * // on the tap
 * sharing.present(request)
 * ```
 *
 * `build(activity)` genuinely has to be inside `onCreate`, not a property initialiser: an
 * Activity has no `Application` — and therefore no `ViewModelStore`, which is where a sheet that
 * survives a rotation lives — until the framework attaches one, which happens after the
 * constructor has run.
 *
 * ```kotlin
 * // Compose — warms on composition-enter, so warm() never has to be called by hand
 * val sharing = remember { FrakSharing.Builder(::onShareResult) }.build()
 * ```
 *
 * Note the Compose form: `remember { Builder(...) }.build()`, because it is `build()` that is
 * `@Composable`, not the `Builder`'s construction.
 *
 * A sheet that is up survives a configuration change: the web view, its DOM, its JS heap and the
 * in-flight session are retained on the Activity's `ViewModelStore` and re-attached to a fresh
 * dialog. Nothing is reported for the rotation itself. Process death is a different matter and is
 * not survivable here — the warm view is gone with the process, so there is nothing to restore.
 *
 * Two instances on one Activity share a warm web view and a single "one sheet at a time" guard —
 * so building one per list row is wasteful but not harmful, and a second [present] while a sheet
 * is up reports [id.frak.sdk.core.FrakError.AlreadyPresenting] no matter which instance it came
 * from. When two instances disagree about [Builder.heightFraction], the one that called
 * [present] wins.
 */
public class FrakSharing internal constructor(
    private val host: SharingHost,
    private val heightFraction: Float,
    private val callback: ResultCallback,
) {
    /**
     * How a sharing session ended.
     *
     * A `fun interface` so Java callers can pass a lambda and Kotlin callers a method reference.
     * Always invoked on the main thread: the session's own work runs off it (see
     * `SharingSheetState`'s `workContext`), and a callback that touched a View or Compose state
     * from there would crash. [SharingHost] hops before calling this.
     *
     * **Can arrive after the hosting Activity is destroyed, and after `onSaveInstanceState`.**
     * A share the user completed outlives the sheet on purpose — the OS chooser is a different
     * Activity and the user can leave from it — so this reports what happened even when there is
     * no screen left to report it to. Write it defensively: no view access without a null/state
     * check, and nothing that assumes a `FragmentManager` still accepts transactions.
     *
     * Should be a *stable* reference. When the `Builder` is `remember`ed (the documented Compose
     * idiom) the callback is captured with it, so a method reference on a long-lived object is the
     * right shape and a lambda closing over per-frame state is not.
     */
    public fun interface ResultCallback {
        @MainThread
        public fun onResult(result: SharingResult)
    }

    /**
     * Builds a [FrakSharing] against a hosting Activity.
     *
     * No default arguments anywhere, by construction rather than by oversight: a Kotlin default
     * argument compiles to a synthetic `$default` bridge whose signature carries a bitmask of
     * which parameters were supplied, so adding one later breaks an already-shipped merchant
     * binary with `NoSuchMethodError`. Builder methods are additive with no such break, which is
     * also why there is no `Configuration` class here.
     */
    public class Builder(
        private val callback: ResultCallback,
    ) {
        private var heightFraction: Float = FrakSharingDefaults.HEIGHT_FRACTION

        /**
         * Share of the screen height the sheet occupies.
         *
         * The default leaves the hosted page its whole first screenful (reward card, product
         * cards, stepper, FAQ). A merchant whose page is shorter can trim it.
         *
         * @throws IllegalArgumentException if [fraction] is outside `0.3..1.0`, or is not finite.
         *   Deliberately loud: this used to be clamped in silence, which turned a miscomputed
         *   fraction into a working-looking sheet at the wrong size with no diagnostic anywhere.
         */
        public fun heightFraction(fraction: Float): Builder {
            // NaN fails this too — every comparison against NaN is false — which is the case a
            // merchant computing a fraction actually hits.
            require(
                fraction >= FrakSharingDefaults.MIN_HEIGHT_FRACTION &&
                    fraction <= FrakSharingDefaults.MAX_HEIGHT_FRACTION,
            ) {
                "heightFraction must be between ${FrakSharingDefaults.MIN_HEIGHT_FRACTION} and " +
                    "${FrakSharingDefaults.MAX_HEIGHT_FRACTION}, was $fraction"
            }
            this.heightFraction = fraction
            return this
        }

        /**
         * The Activity that will host the sheet's window.
         *
         * Call from `onCreate` — after `super.onCreate(...)` — unconditionally and on every
         * creation, including the one that follows a rotation, which is where a sheet that was up
         * before it gets picked back up.
         *
         * **Not** from a property initialiser. Those run in the Activity's constructor, before the
         * framework has attached the `Application`, and `ComponentActivity.getViewModelStore()`
         * throws there. The sheet's retained state lives on that store (it is what carries a live
         * sheet across a rotation), so there is nowhere for this to put it that early.
         *
         * Nothing here touches the network or boots a web view; that is [warm]'s job, and it is
         * separate precisely so a single-Activity app does not pay for a share surface the user may
         * never reach.
         *
         * @throws IllegalStateException if called before the Activity reaches `onCreate`.
         */
        @MainThread
        public fun build(activity: ComponentActivity): FrakSharing {
            check(activity.application != null) {
                "FrakSharing.Builder.build(activity) must be called from onCreate or later, not " +
                    "from a property initialiser: an Activity has no ViewModelStore until the " +
                    "framework attaches its Application."
            }
            val host = SharingHost.of(activity)
            host.attach(activity, callback)
            return FrakSharing(host, heightFraction, callback)
        }

        /**
         * The Compose build site. Warms on composition-enter, so a Compose caller never sees
         * [warm] at all — the composable existing *is* the share surface becoming visible, which
         * is the earliest honest moment to start warming.
         *
         * The hosting Activity is resolved from the composition's `LocalContext`.
         *
         * The callback is read through `rememberUpdatedState` rather than frozen at the first
         * composition. That covers a caller who writes `FrakSharing.Builder { … }.build()` — a
         * fresh `Builder` and a fresh lambda every composition — whose *first* lambda would
         * otherwise be called, with all of its captures, for the life of the screen.
         *
         * It does **not** cover the documented `remember { Builder(cb) }` idiom, where the
         * `Builder` and therefore the callback are pinned by the merchant's own `remember`. That is
         * why the documentation shows a method reference there: see [ResultCallback], which asks
         * for a stable one. The deleted `rememberFrakSharingLauncher` took the lambda as a direct
         * composable parameter and so had no equivalent hole; this shape trades that for a callback
         * that also works from Java and from `onCreate`.
         */
        @Composable
        public fun build(): FrakSharing {
            val activity = LocalContext.current.findComponentActivity()
            val current = rememberUpdatedState(callback)
            val stable = remember { ResultCallback { result -> current.value.onResult(result) } }
            val host = remember(activity) { SharingHost.of(activity) }
            // An effect, not the `remember` calculation above: `attach` registers a lifecycle
            // observer, can show a dialog for a session resumed across a rotation, and can replay a
            // buffered result into merchant code. A `remember` calculation runs during composition
            // and is not rolled back when a composition is abandoned; none of that belongs there.
            DisposableEffect(host, stable) {
                host.attach(activity, stable)
                onDispose { }
            }
            val sharing = remember(host, heightFraction, stable) { FrakSharing(host, heightFraction, stable) }
            LaunchedEffect(sharing) { sharing.warm() }
            return sharing
        }
    }

    /**
     * Starts warming the pooled web view and the identity/config reads.
     *
     * Call when a share affordance becomes visible — not at construction. Warming boots a web view
     * against the wallet origin and does the identity and merchant-config round trips the sheet
     * cannot build a URL without; doing that at every cold start of a single-Activity app, for a
     * share the user may never ask for, is the regression this method exists to avoid.
     *
     * Cheap to call repeatedly. [present] implies it if it never happened — correct, just late.
     * Gated on `FrakConfig.preloadSharing`, and a no-op before `Frak.initialize`.
     */
    @MainThread
    public fun warm() {
        host.warm()
    }

    /**
     * Opens the sheet.
     *
     * No-op if the hosting Activity is finishing, destroyed, or not at least `STARTED` — a
     * `Dialog.show()` on a window token that has gone throws `BadTokenException`, and there is no
     * merchant UI left to return a result to either.
     */
    @MainThread
    public fun present(request: SharingRequest) {
        host.present(request, heightFraction, callback)
    }
}

/**
 * Walks the `ContextWrapper` chain to the hosting Activity.
 *
 * A `LocalContext` inside a Compose tree is usually the Activity itself, but anything that themes
 * a subtree wraps it in a `ContextThemeWrapper` — `MaterialTheme`'s own dynamic-colour path and
 * `androidx.appcompat`'s view inflation both do.
 */
private fun Context.findComponentActivity(): ComponentActivity {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is ComponentActivity) return current
        current = current.baseContext
    }
    error(
        "FrakSharing.Builder.build() must be called from a composition hosted by a ComponentActivity. " +
            "Use build(activity) instead if your host is not one.",
    )
}
