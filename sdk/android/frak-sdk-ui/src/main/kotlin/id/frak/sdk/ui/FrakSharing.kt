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
 * The Frak sharing sheet. Build it once per screen, [warm] it when a share affordance becomes
 * visible, then [present] on the tap.
 *
 * A sheet that is up survives a configuration change, but not process death. Use one instance per
 * Activity: two share a warm web view and a "one sheet at a time" guard, and after a configuration
 * change a live session reports to whichever was built first, not whichever presented.
 */
public class FrakSharing internal constructor(
    private val host: SharingHost,
    private val heightFraction: Float,
    private val callback: ResultCallback,
) {
    /**
     * How a sharing session ended. Always invoked on the main thread, and it can arrive after the
     * hosting Activity is destroyed, so write it defensively. Should be a stable reference.
     */
    public fun interface ResultCallback {
        @MainThread
        public fun onResult(result: SharingResult)
    }

    // See the note atop sharing/SharingRequest.kt.

    /** Builds a [FrakSharing] against a hosting Activity. */
    public class Builder(
        private val callback: ResultCallback,
    ) {
        private var heightFraction: Float = FrakSharingDefaults.HEIGHT_FRACTION

        /**
         * Share of the screen height the sheet occupies.
         *
         * @throws IllegalArgumentException if [fraction] is outside `0.3..1.0`, or is not finite.
         */
        public fun heightFraction(fraction: Float): Builder {
            // NaN fails this too, since every comparison against NaN is false.
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
         * The Activity that will host the sheet's window. Call from `onCreate` (after
         * `super.onCreate`), never from a property initialiser, where there is no `ViewModelStore`
         * yet to hold the retained sheet state.
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
         * The Compose build site; resolves the hosting Activity from `LocalContext` and warms on
         * composition-enter, so [warm] never has to be called by hand.
         */
        @Composable
        public fun build(): FrakSharing {
            val activity = LocalContext.current.findComponentActivity()
            val current = rememberUpdatedState(callback)
            val stable = remember { ResultCallback { result -> current.value.onResult(result) } }
            val host = remember(activity) { SharingHost.of(activity) }
            // An effect, not the `remember` above: `attach` registers a lifecycle observer, can
            // show a dialog and can replay a buffered result into merchant code.
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
     * Starts warming the pooled web view and the identity/config reads. Call when a share
     * affordance becomes visible; cheap to call repeatedly, and [present] implies it.
     */
    @MainThread
    public fun warm() {
        host.warm()
    }

    /**
     * Opens the sheet. No-op if the hosting Activity is finishing, destroyed, or not at least
     * `STARTED`.
     */
    @MainThread
    public fun present(request: SharingRequest) {
        host.present(request, heightFraction, callback)
    }
}

/** Walks the `ContextWrapper` chain to the hosting Activity. */
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
