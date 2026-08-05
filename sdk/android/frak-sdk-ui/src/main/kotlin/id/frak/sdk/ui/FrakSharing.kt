package id.frak.sdk.ui

import android.content.Context
import android.content.ContextWrapper
import androidx.activity.ComponentActivity
import androidx.annotation.MainThread
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import id.frak.sdk.sharing.SharingRequest

/**
 * The Frak sharing sheet.
 *
 * Built once per screen and kept, not built per share:
 *
 * ```kotlin
 * // Activity / XML / Java — in onCreate
 * private val sharing = FrakSharing.Builder(::onShareResult).build(this)
 *
 * // when a share affordance becomes visible
 * sharing.warm()
 *
 * // on the tap
 * sharing.present(request)
 * ```
 *
 * ```kotlin
 * // Compose — warms on composition-enter, so warm() never has to be called by hand
 * val sharing = remember { FrakSharing.Builder(::onShareResult) }.build()
 * ```
 *
 * Note the Compose form: `remember { Builder(...) }.build()`, because it is `build()` that is
 * `@Composable`, not the `Builder`'s construction.
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
         * Call from `onCreate`. Nothing here touches the network or boots a web view — that is
         * [warm]'s job, and it is separate precisely so a single-Activity app does not pay for a
         * share surface the user may never reach.
         */
        @MainThread
        public fun build(activity: ComponentActivity): FrakSharing =
            FrakSharing(SharingHost.of(activity), heightFraction, callback)

        /**
         * The Compose build site. Warms on composition-enter, so a Compose caller never sees
         * [warm] at all — the composable existing *is* the share surface becoming visible, which
         * is the earliest honest moment to start warming.
         *
         * The hosting Activity is resolved from the composition's `LocalContext`.
         */
        @Composable
        public fun build(): FrakSharing {
            val activity = LocalContext.current.findComponentActivity()
            val sharing =
                remember(activity, heightFraction) {
                    FrakSharing(SharingHost.of(activity), heightFraction, callback)
                }
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
 * A `LocalContext` inside a Compose tree is usually the Activity itself, but it is wrapped by
 * anything that themes a subtree (`ContextThemeWrapper`) and by the SDK's own
 * `MutableContextWrapper` around the pooled web view.
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
