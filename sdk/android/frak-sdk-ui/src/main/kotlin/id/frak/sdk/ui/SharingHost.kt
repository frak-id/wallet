package id.frak.sdk.ui

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import androidx.activity.ComponentActivity
import androidx.activity.ComponentDialog
import androidx.activity.OnBackPressedCallback
import androidx.annotation.MainThread
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.WeakHashMap
import kotlin.coroutines.CoroutineContext

/**
 * What [FrakSharing] actually talks to: one sharing surface per hosting Activity.
 *
 * Everything a sheet needs that outlives a sheet lives here — the warm web view pool, the
 * coroutine scope an in-flight `track()` runs on, and the "one sheet at a time" guard. That last
 * one is why this is per **Activity** and not per [FrakSharing]: a merchant may hold two
 * instances on one screen (a list row and a toolbar action, say), and two stacked sheets is not a
 * thing this SDK does. See [FrakError.AlreadyPresenting].
 *
 * Main thread only. Every mutable field below is touched from `present`/`warm`/the lifecycle
 * callbacks, all of which the public API annotates `@MainThread`; [finish] is the one entry point
 * that can arrive from elsewhere, and it hops first.
 */
internal class SharingHost private constructor(
    private val activity: ComponentActivity,
) : DefaultLifecycleObserver {
    /**
     * The application context, for everything that must not pin the Activity. The Activity itself
     * is used only for the dialog's window and the pooled web view, both of which die with it.
     *
     * `by lazy`, and that is not fussiness: `Activity.getApplicationContext()` answers null until
     * the framework has attached the base context, which happens *after* the Activity's
     * constructor. A merchant writing the idiomatic
     * `private val sharing = FrakSharing.Builder(...).build(this)` as a property initialiser would
     * otherwise get a null here. `lifecycle` has no such problem — it is a field of
     * `ComponentActivity` itself — so the observer below can be registered eagerly.
     */
    private val appContext: Context by lazy { activity.applicationContext }

    /**
     * Deliberately not the sheet's own scope, and deliberately main-confined.
     *
     * Not the sheet's: `SharingSheetState`'s attribution work — a chooser the user is still
     * looking at, a `track()` still being written — has to outlive the sheet that started it.
     * That is the same intent `rememberCoroutineScope()` served before, re-parented from "the
     * composable that called the factory" to "the Activity", which is the lifetime it always
     * wanted.
     *
     * Main-confined: `SharingSheetState` drives the `WebView` from this scope (the install-page
     * load, the `view=confirmation` navigation, share-again), and a `WebView` may only be touched
     * from the thread that created it.
     */
    private val scope = CoroutineScope(SupervisorJob() + MainThreadDispatcher)

    private var pool: SharingWebViewPool? = null

    /** Set once [warmSharingData] has been started, so repeated `warm()` calls are free. */
    private var warmStarted = false

    private var dialog: ComponentDialog? = null
    private var composeView: ComposeView? = null

    /**
     * Bumped to ask the composed sheet to animate itself out and then report. Read inside the
     * composition, so it has to be snapshot state; a plain `Int` would never recompose.
     *
     * A signal rather than a boolean because a sheet may be asked to leave more than once in one
     * process (back, then the next session's back), and a boolean would need resetting from two
     * places that do not see each other.
     */
    private val exitSignal = mutableIntStateOf(0)

    private var active: SharingRequest? = null
    private var presentation: SharingPresentation? = null
    private var callback: FrakSharing.ResultCallback? = null

    /** Set by [onDestroy]. A host whose Activity has gone must refuse everything. */
    private var destroyed = false

    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        activity.lifecycle.addObserver(this)
    }

    /**
     * Starts the pooled web view and the identity/config reads.
     *
     * Split from construction on purpose. In a single-Activity app — the dominant architecture —
     * building at `onCreate` and warming with it would boot a WebView and do two network round
     * trips on every cold start, whether or not the user ever reaches a share surface. That is
     * the opposite of what the warm pool is for. So the merchant calls this when a share
     * affordance becomes visible, and the `@Composable` build site does it on composition-enter
     * so Compose callers keep exactly today's behaviour.
     *
     * Cheap to call repeatedly, and a no-op before `Frak.initialize` — a later call still warms.
     */
    @MainThread
    fun warm() {
        if (destroyed) return
        val pool = poolOrNull() ?: return
        if (warmStarted) return
        warmStarted = true
        scope.launch { warmSharingData(pool, appContext.packageName) }
    }

    /**
     * Null until `Frak.initialize` has run: the pool needs a wallet origin to boot a view against,
     * and the `preloadSharing` flag to know whether to boot one at all. Re-tried on every call,
     * so a merchant who initializes late still gets a pool.
     */
    private fun poolOrNull(): SharingWebViewPool? {
        pool?.let { return it }
        if (!Frak.isInitialized) return null
        return SharingWebViewPool(
            // The Activity, not [appContext]: a WebView needs a themed, windowed context for its
            // own popups (select dropdowns, text-selection handles) to place themselves.
            context = activity,
            walletOrigin = Frak.client.environment.wallet,
            preload = Frak.preloadSharing,
        ).also { pool = it }
    }

    @MainThread
    fun present(
        request: SharingRequest,
        heightFraction: Float,
        callback: FrakSharing.ResultCallback,
    ) {
        val decision =
            sharingPresentDecision(
                hostDestroyed = destroyed,
                hostUnavailable = activity.isFinishing || activity.isDestroyed,
                lifecycleStarted = activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED),
                sessionActive = active != null,
            )
        when (decision) {
            SharingPresentDecision.Ignore -> return
            SharingPresentDecision.Refuse -> {
                report(callback, SharingResult.Failed(FrakError.AlreadyPresenting()))
                return
            }

            SharingPresentDecision.Present -> Unit
        }

        // Late is still better than never: a merchant who never called warm() pays a cold view,
        // not a broken sheet.
        warm()

        this.callback = callback
        active = request

        val pool = poolOrNull()
        if (pool == null) {
            // Frak.initialize has not run: no wallet origin to load and no client to build a link
            // from. Report it rather than present an empty sheet.
            finish(SharingResult.Failed(FrakError.NotInitialized()))
            return
        }

        // Before the window exists, which is the whole point of the split: the page load is in
        // flight by the time the dialog starts building its own. See [SharingPresentation].
        val started = SharingPresentation.start(pool, appContext, scope, request, ::finish)
        // `start` can report terminally before it returns — `prepare`'s catch-all and the tier-3
        // fallback both can — in which case [finish] has already run and there is nothing to show.
        // Its pooled view would otherwise stay lent for the life of the process.
        if (active !== request) {
            started.disposeIfUnpresented()
            return
        }
        presentation = started
        show(started, heightFraction)
    }

    /**
     * Asks the sheet to leave, animating out first.
     *
     * Not `finish(Dismissed)` directly: the exit animation runs inside the composition, and
     * reporting first would drop the composition before it could play. The sheet calls
     * `SharingSheetState.dismiss()` on its own once the animation lands, which routes back here
     * through [finish].
     */
    @MainThread
    private fun requestExit() {
        if (active == null) return
        exitSignal.intValue++
    }

    private fun show(
        presentation: SharingPresentation,
        heightFraction: Float,
    ) {
        exitSignal.intValue = 0
        val content =
            ComposeView(activity).apply {
                setContent {
                    // The sheet has no `MaterialTheme` ancestor any more: it used to compose
                    // inside the merchant's tree and now composes in a window of its own. Pinned
                    // light rather than inherited, because everything this theme still reaches
                    // (the drag handle, the skeleton, the renderer-crash surface) sits against the
                    // hosted page, and that page is white. A merchant's dark scheme bleeding into
                    // those would be a mismatch, not a courtesy.
                    MaterialTheme(colorScheme = lightColorScheme()) {
                        FrakSharingSheet(
                            presentation = presentation,
                            heightFraction = heightFraction,
                            exitSignal = exitSignal.intValue,
                        )
                    }
                }
            }

        // ComponentDialog, not Dialog: `setContentView` runs `initializeViewTreeOwners()`, which
        // is what gives the ComposeView above the `ViewTreeLifecycleOwner` and
        // `ViewTreeSavedStateRegistryOwner` that `AbstractComposeView` requires. It also brings an
        // `OnBackPressedDispatcher`, so predictive back works without a raw `onBackPressed`.
        //
        // A platform translucent theme, not the merchant's `android:dialogTheme`: every standard
        // dialog theme sets `windowIsFloating`, which shrink-wraps the decor and would defeat the
        // MATCH_PARENT below. Being a platform id it also needs no `res/` of our own, so there is
        // no `resourcePrefix` collision to manage.
        val created = ComponentDialog(activity, android.R.style.Theme_Translucent_NoTitleBar)
        created.setContentView(content)
        created.setCancelable(true)
        // Never fires with a MATCH_PARENT window — every touch is inside it. The scrim is a
        // Compose hit target instead; see [FrakSharingSheet].
        created.setCanceledOnTouchOutside(false)
        created.onBackPressedDispatcher.addCallback(
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = requestExit()
            },
        )
        created.window?.let { window ->
            // Full-screen, not wrap-content, and this is load-bearing rather than cosmetic: the
            // drag-to-dismiss and the exit animation translate the sheet down by its whole height,
            // and a window sized to the sheet would clip that translation at its own edge.
            window.setLayout(MATCH_PARENT, MATCH_PARENT)
            window.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            // The platform theme's own fade would race the sheet's slide-in.
            window.setWindowAnimations(0)
            // FLAG_DIM_BEHIND is deliberately not set. A window dim is constant for as long as the
            // window is up, so it would pop in at show() and out at dismiss() while the sheet
            // itself is still sliding. The scrim is drawn in the composition instead, keyed to the
            // same offset as the sheet.
            window.setDimAmount(0f)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // A Dialog is a child window with no independent
                // `windowOptOutEdgeToEdgeEnforcement`, so on Android 15+ it must cooperate with
                // the host's insets contract rather than opt out of it.
                window.setDecorFitsSystemWindows(false)
            }
        }
        dialog = created
        composeView = content
        created.show()
    }

    /**
     * The one place a session's outcome reaches the merchant.
     *
     * Arrives from `SharingSheetState.finish`, which reports on whatever thread got there —
     * including `workContext`, i.e. `Dispatchers.Default` for the tier-3 fallback and `prepare`'s
     * catch-all. A merchant callback that touches a View or Compose state from there would crash,
     * so the hop is here and [FrakSharing.ResultCallback] is annotated `@MainThread`.
     *
     * Inline when already on the main thread, so the overwhelmingly common case (a tap, a page
     * action) is not deferred a frame.
     */
    private fun finish(result: SharingResult) {
        onMainThread {
            // Report once per session, even when a failure and a dismissal arrive from different
            // callers. `SharingSheetState` enforces the same thing on its own side; this covers
            // the sessions that never got one (see the `pool == null` branch of [present]).
            if (active == null) return@onMainThread
            active = null
            val reported = callback
            callback = null
            val finished = presentation
            presentation = null
            // Dismissing first disposes the composition, which reaches `SharingPresentation.dispose`
            // through the sheet's own `onDispose`. `dispose` is idempotent and `abandon()` no-ops
            // once anything terminal has been reported — which it has, or we would not be here.
            dismissDialog()
            finished?.dispose()
            reported?.onResult(result)
        }
    }

    /** Reports a result for a session that never started. Same main-thread contract as [finish]. */
    private fun report(
        callback: FrakSharing.ResultCallback,
        result: SharingResult,
    ) {
        onMainThread { callback.onResult(result) }
    }

    private fun dismissDialog() {
        val current = dialog
        dialog = null
        val content = composeView
        composeView = null
        exitSignal.intValue = 0
        current?.dismiss()
        // `dismiss()` detaches the decor, and the default `ViewCompositionStrategy` disposes on
        // detach — but "normally" is not an invariant, and a composition still holding the pooled
        // web view is exactly what must not survive this.
        content?.disposeComposition()
    }

    override fun onDestroy(owner: LifecycleOwner) {
        destroyed = true
        hosts.remove(activity)
        owner.lifecycle.removeObserver(this)
        dismissDialog()
        // Reports whatever the session reached, or a dismissal, through `abandon()` — the same
        // outcome the composition's disposal produced before this class existed.
        presentation?.dispose()
        presentation = null
        active = null
        callback = null
        pool?.destroy()
        pool = null
        warmStarted = false
        // After `dispose()`: `abandon()` defers to any attribution still in flight, and cancelling
        // first would take the deferral with it. Cancelling at all matches what the composition's
        // `rememberCoroutineScope()` did at this same moment.
        scope.cancel()
    }

    private fun onMainThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
    }

    companion object {
        /**
         * One host per Activity, for the lifetime of that Activity.
         *
         * Weakly keyed **and** explicitly removed in [onDestroy], because the value holds the key:
         * a `WeakHashMap` entry whose value reaches its own key is never collectable, so the weak
         * key alone would be decoration. The removal is what actually frees it; the weakness only
         * covers an Activity that somehow never reaches `onDestroy`.
         *
         * Main thread only, so no synchronisation.
         */
        private val hosts = WeakHashMap<ComponentActivity, SharingHost>()

        @MainThread
        fun of(activity: ComponentActivity): SharingHost = hosts.getOrPut(activity) { SharingHost(activity) }
    }
}

/** What [SharingHost.present] should do, given the state of its host and its session. */
internal enum class SharingPresentDecision {
    Present,

    /**
     * Nothing happens and nothing is reported. The merchant's screen is going away, so there is
     * no callback worth delivering to and `Dialog.show()` on a window token that has gone throws
     * `BadTokenException`.
     */
    Ignore,

    /** A sheet is already up. Reported as [FrakError.AlreadyPresenting] rather than queued or stacked. */
    Refuse,
}

/**
 * Extracted from [SharingHost.present] so the guards are decidable — and testable — without a
 * window. Every one of them is a case that used to be either impossible (the sheet could not
 * exist outside a live composition) or handled by Compose on the SDK's behalf.
 */
internal fun sharingPresentDecision(
    hostDestroyed: Boolean,
    hostUnavailable: Boolean,
    lifecycleStarted: Boolean,
    sessionActive: Boolean,
): SharingPresentDecision =
    when {
        hostDestroyed || hostUnavailable || !lifecycleStarted -> SharingPresentDecision.Ignore
        sessionActive -> SharingPresentDecision.Refuse
        else -> SharingPresentDecision.Present
    }

/**
 * Posts to the main looper. Used for [SharingHost]'s scope, which drives a `WebView`.
 *
 * Hand-rolled rather than `Dispatchers.Main`: that lives in `kotlinx-coroutines-android`, which is
 * on no classpath in this build — touching it would throw
 * `IllegalStateException: Module with the Main dispatcher had failed to initialize` inside the
 * merchant's process, at the exact moment a share result is being reported. Adding the artifact to
 * fix a two-line dispatcher is not a trade worth making for a library that advertises zero
 * third-party runtime dependencies.
 *
 * Always dispatches, never runs inline. That matches what `rememberCoroutineScope()` did here
 * before — its dispatcher drives work from the choreographer frame callback, so nothing launched
 * on it ever ran synchronously either.
 */
internal object MainThreadDispatcher : CoroutineDispatcher() {
    private val handler = Handler(Looper.getMainLooper())

    override fun dispatch(
        context: CoroutineContext,
        block: Runnable,
    ) {
        handler.post(block)
    }
}
