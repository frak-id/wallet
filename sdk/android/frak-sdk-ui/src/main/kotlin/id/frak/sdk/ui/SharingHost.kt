package id.frak.sdk.ui

import android.content.Context
import android.content.MutableContextWrapper
import android.os.Handler
import android.os.Looper
import androidx.activity.ComponentActivity
import androidx.activity.ComponentDialog
import androidx.annotation.MainThread
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.coroutines.CoroutineContext

/**
 * Retains the [SharingHost] across the hosting Activity's configuration changes. Not a
 * `SavedStateHandle`: after process death the pool and the warm document are gone anyway.
 */
internal class SharingViewModel : ViewModel() {
    var host: SharingHost? = null

    override fun onCleared() {
        host?.onOwnerCleared()
        host = null
    }
}

/**
 * The session the host is currently showing, from the tap until something reports.
 *
 * One object rather than four fields because they only mean anything together: [exitRequested]
 * belongs to this session and must not outlive it, and [heightFraction] is what a rotation has to
 * re-create the sheet at. Dropping the object is what ends the session — see [SharingHost.finish].
 */
private class LiveSession(
    /** Identity, not data: [SharingHost.present] uses it to spot a session that reported before it returned. */
    val request: SharingRequest,
    /** The presenting [FrakSharing]'s fraction, kept so a rotation can re-create the sheet at the same size. */
    val heightFraction: Float,
) {
    /** Null between the tap and the presentation being built; `start` can report before it returns. */
    var presentation: SharingPresentation? = null

    /** The sheet was asked to leave and its exit animation has not landed; a rotation can land in that window. */
    var exitRequested = false
}

/**
 * How far [SharingHost.warm]'s one-shot resolution has got. A state rather than a `started` flag
 * and a nullable URL, which together spell two combinations that mean nothing.
 */
private sealed interface WarmState {
    /** Never asked, or the last attempt failed and the next `warm()` should get another go. */
    data object Idle : WarmState

    data object Resolving : WarmState

    /** Held until there is an Activity to boot a view against. See [SharingHost.applyWarmUrl]. */
    data class Resolved(
        val url: String,
    ) : WarmState
}

/**
 * One sharing surface per hosting Activity, retained across its configuration changes: the warm web
 * view pool, the attribution scope, the live session and the "one sheet at a time" guard. The dialog
 * is the one thing that cannot be retained. Main thread only, except [finish], which hops first.
 */
internal class SharingHost private constructor(
    private val appContext: Context,
) : DefaultLifecycleObserver {
    /** Null between a configuration change's two halves, so a retained host never pins a dead Activity. */
    private var activity: ComponentActivity? = null

    /**
     * A `WebView` hard-references its construction context, so a retained one built against an
     * Activity leaks it — but it also needs a themed, windowed context for its own popups. The base
     * is swapped in [attach] and [onDestroy].
     */
    private val webViewContext = MutableContextWrapper(appContext)

    /**
     * Not the sheet's scope: attribution work has to outlive the sheet that started it. Main-confined,
     * because [SharingSheetState] drives the `WebView` from here — see [MainThreadDispatcher].
     */
    private val scope = CoroutineScope(SupervisorJob() + MainThreadDispatcher)

    private var pool: SharingWebViewPool? = null

    /** Whether [warm] has been asked for, as opposed to having run: it needs an attached Activity. */
    private var warmRequested = false

    private var warmState: WarmState = WarmState.Idle

    private var dialog: ComponentDialog? = null
    private var composeView: ComposeView? = null

    /** Bumped to ask the composed sheet to animate itself out and then report. Read in the composition. */
    private val exitSignal = mutableIntStateOf(0)

    private var live: LiveSession? = null

    /** Null while no Activity is attached: a merchant callback is usually a method reference on it. */
    private var callback: FrakSharing.ResultCallback? = null

    /** A terminal result that landed mid-rotation, with no callback attached. Replayed by [attach]. */
    private var pendingResult: SharingResult? = null

    /** Set by [onOwnerCleared]. The screen is really gone; refuse everything. */
    private var cleared = false

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Binds this host to the Activity that will carry its window, and picks a session that outlived
     * the previous Activity back up. Must be called from `onCreate` or later:
     * `ComponentActivity.getViewModelStore()` throws before that.
     */
    @MainThread
    fun attach(
        activity: ComponentActivity,
        callback: FrakSharing.ResultCallback,
    ) {
        if (cleared) return
        if (this.activity !== activity) {
            this.activity = activity
            webViewContext.baseContext = activity
            activity.lifecycle.addObserver(this)
        }

        // A session that outlived the previous Activity has nowhere to report until now.
        val resumed = live
        if (resumed?.presentation != null) {
            if (this.callback == null) this.callback = callback
            // The dialog died with the previous Activity; the web view did not, so no entry animation.
            if (dialog == null) show(resumed, animateIn = false)
        }

        // Posted, never inline: this runs from `build(...)`, which a Compose caller reaches from inside
        // a composition.
        pendingResult?.let { pending ->
            pendingResult = null
            // Re-checked inside the post: a fast rotate-rotate can destroy this Activity first.
            mainHandler.post { if (!cleared && this.activity === activity) callback.onResult(pending) }
        }
        // Either picks up a `warm()` that arrived before there was an Activity, or boots the pool
        // against a URL that resolved during the rotation gap.
        if (warmRequested) warm()
    }

    /**
     * Starts the pooled web view and the identity/config reads, so a single-Activity app does not boot
     * a WebView on every cold start. Cheap to call repeatedly and a no-op before `Frak.initialize`.
     * The reads only answer a URL; [applyWarmUrl] boots the pool once there is an Activity.
     */
    @MainThread
    fun warm() {
        if (cleared) return
        warmRequested = true
        // Nothing to construct a themed, windowed web view against yet. [attach] re-drives this.
        if (activity == null) return
        when (warmState) {
            // The launch below will apply its own answer when it lands.
            WarmState.Resolving -> {
                return
            }

            is WarmState.Resolved -> {
                applyWarmUrl()
                return
            }

            WarmState.Idle -> {}
        }
        warmState = WarmState.Resolving
        scope.launch {
            val url = resolveWarmUrl(appContext.packageName)
            if (url == null) {
                // Un-latched deliberately: `present()`'s own late `warm()` should get another go rather
                // than inherit a failure the user never saw.
                warmState = WarmState.Idle
                return@launch
            }
            warmState = WarmState.Resolved(url)
            applyWarmUrl()
        }
    }

    /**
     * Boots the pool against the resolved warm URL, if there is an Activity to build the view against.
     * Re-driven from [attach], which is the other end of the gap described on [warm].
     */
    private fun applyWarmUrl() {
        val url = (warmState as? WarmState.Resolved)?.url ?: return
        if (cleared || activity == null) return
        try {
            poolOrNull()?.warm(url)
        } catch (unavailable: Exception) {
            // Constructing a `WebView` throws on a device whose WebView provider is missing, disabled
            // or mid-update. Not a reason to take the merchant's process down for a preload nobody
            // asked for; `present()` reports the same failure properly if the user gets that far.
            warmState = WarmState.Idle
            pool = null
        }
    }

    /**
     * Null until `Frak.initialize` has run: the pool needs a wallet origin. Re-tried on every
     * call, so a merchant who initializes late still gets a pool.
     */
    private fun poolOrNull(): SharingWebViewPool? {
        pool?.let { return it }
        if (!Frak.isInitialized) return null
        return SharingWebViewPool(
            context = webViewContext,
            walletOrigin = Frak.client.environment.wallet,
        ).also { pool = it }
    }

    @MainThread
    fun present(
        request: SharingRequest,
        heightFraction: Float,
        callback: FrakSharing.ResultCallback,
    ) {
        val activity = this.activity
        val decision =
            sharingPresentDecision(
                hostDestroyed = cleared || activity == null,
                hostUnavailable = activity != null && (activity.isFinishing || activity.isDestroyed),
                lifecycleStarted =
                    activity != null && activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED),
                sessionActive = live != null,
            )
        when (decision) {
            SharingPresentDecision.Ignore -> {
                return
            }

            SharingPresentDecision.Refuse -> {
                report(callback, SharingResult.Failed(FrakError.AlreadyPresenting()))
                return
            }

            // Fall through to presentation.
            SharingPresentDecision.Present -> {}
        }

        // Late is still better than never: a merchant who never called warm() pays a cold view, not a
        // broken sheet.
        warm()

        this.callback = callback
        val session = LiveSession(request = request, heightFraction = heightFraction)
        live = session

        val pool = poolOrNull()
        if (pool == null) {
            // No wallet origin to load and no client to build a link from; report rather than present
            // an empty sheet.
            finish(SharingResult.Failed(FrakError.NotInitialized()))
            return
        }

        // Before the window exists: the page load is in flight by the time the dialog builds its own.
        // Guarded, because constructing the `WebView` can throw — and it would throw with the session
        // already live, so every later `present()` here would answer `AlreadyPresenting`.
        val started =
            try {
                SharingPresentation.start(pool, appContext, scope, request, ::finish)
            } catch (unavailable: Exception) {
                // Almost always a missing/disabled/updating WebView provider. The pool goes with it,
                // since `acquire` may have marked its view lent before the throw.
                pool.destroy()
                this.pool = null
                finish(
                    SharingResult.Failed(
                        FrakError.InternalFailure("the sharing web view could not be created", unavailable),
                    ),
                )
                return
            }
        // `start` can report terminally before it returns, in which case there is nothing to show and
        // its pooled view would otherwise stay lent for the life of the process.
        if (live !== session) {
            started.disposeIfUnpresented()
            return
        }
        session.presentation = started
        show(session, animateIn = true)
    }

    /**
     * Asks the sheet to leave, animating out first. Not `finish(Dismissed)` directly: the animation
     * runs inside the composition, which reporting would drop before it could play.
     */
    @MainThread
    private fun requestExit() {
        val session = live ?: return
        // The sheet sets this from its own dismissal routes too; set here as well because a back press
        // can arrive before the composition has read the signal.
        session.exitRequested = true
        exitSignal.intValue++
    }

    private fun show(
        session: LiveSession,
        animateIn: Boolean,
    ) {
        val activity = this.activity ?: return
        val presentation = session.presentation ?: return
        // A window token that has gone throws BadTokenException, and [attach] runs from the merchant's
        // onCreate, which cannot assume the Activity survived it.
        if (activity.isFinishing || activity.isDestroyed) return
        exitSignal.intValue = 0
        val content =
            ComposeView(activity).apply {
                setContent {
                    // Pinned light rather than inherited: everything this theme still reaches sits
                    // against the hosted page, and that page is white.
                    MaterialTheme(colorScheme = lightColorScheme()) {
                        FrakSharingSheet(
                            presentation = presentation,
                            heightFraction = session.heightFraction,
                            exitSignal = exitSignal.intValue,
                            animateIn = animateIn,
                            onExitStarted = { live?.exitRequested = true },
                        )
                    }
                }
            }

        val created = createSharingSheetDialog(activity, content, ::requestExit)
        dialog = created
        composeView = content
        created.show()
    }

    /**
     * The one place a session's outcome reaches the merchant. `SharingSheetState.finish` reports on
     * whatever thread got there, so the hop to Main is here; inline when already on it.
     */
    private fun finish(result: SharingResult) {
        onMainThread {
            // Report once per session, even when a failure and a dismissal arrive from different
            // callers. This also covers sessions that never got one. Dropping the session is what
            // makes this idempotent, and it takes `exitRequested` with it.
            val finished = live ?: return@onMainThread
            live = null
            val reported = callback
            callback = null
            dismissDialog(finished.presentation)
            finished.presentation?.dispose()
            if (reported != null) {
                reported.onResult(result)
            } else {
                // Mid-rotation: buffered rather than dropped — see [pendingResult].
                pendingResult = result
            }
        }
    }

    /** Reports a result for a session that never started. Same main-thread contract as [finish]. */
    private fun report(
        callback: FrakSharing.ResultCallback,
        result: SharingResult,
    ) {
        onMainThread { callback.onResult(result) }
    }

    /**
     * @param detaching the session whose web view has to leave the view tree, when there is one.
     *   Passed rather than read off [live], because [finish] drops that first.
     */
    private fun dismissDialog(detaching: SharingPresentation? = live?.presentation) {
        val current = dialog
        dialog = null
        val content = composeView
        composeView = null
        exitSignal.intValue = 0
        current?.dismiss()
        // `dismiss()` detaches the decor and the default `ViewCompositionStrategy` disposes on detach,
        // but a composition still holding the pooled web view is exactly what must not survive this.
        content?.disposeComposition()
        // `WebView.destroy` and re-parenting both require the view out of the tree, and the next
        // Activity re-attaches this very instance.
        detaching?.detachView()
    }

    /**
     * The Activity is going away; whether the session is too is a different question. Drops everything
     * belonging to this Activity and reports nothing — [onOwnerCleared] follows if the screen is really
     * finishing, [attach] picks the session back up if it was a configuration change.
     */
    override fun onDestroy(owner: LifecycleOwner) {
        val current = activity
        val changingConfigurations = current?.isChangingConfigurations == true
        // Dropped before the report below: on a rotation the outgoing Activity is past
        // `onSaveInstanceState`, so a result delivered to it lands in state that is never persisted.
        if (changingConfigurations) callback = null
        if (live?.exitRequested == true) {
            // Back or a fling whose exit animation never landed: nothing else would report, and [attach]
            // would put the sheet back on screen for a session the user has already dismissed.
            finish(SharingResult.Dismissed)
        } else {
            dismissDialog()
        }
        current?.lifecycle?.removeObserver(this)
        activity = null
        // The load-bearing line for the leak: a retained WebView must not keep a destroyed Activity.
        webViewContext.baseContext = appContext
    }

    /**
     * The `ViewModelStore` was cleared, which is the real "this screen is gone" signal — as opposed to
     * `onDestroy`, which fires on every rotation.
     */
    fun onOwnerCleared() {
        cleared = true
        // Before `dispose()`: a pool already marked dead destroys the view on release instead of
        // reloading a warm URL into a view that is about to be thrown away.
        pool?.destroy()
        pool = null
        warmState = WarmState.Idle
        pendingResult = null
        // Reports whatever the session reached, or a dismissal, through `abandon()`.
        live?.presentation?.dispose()
        // After `dispose()`: `abandon()` defers to any attribution still in flight, and cancelling first
        // would take the deferral with it. The cancellation then runs those coroutines' `finally` blocks.
        scope.cancel()
        // `live` and `callback` are deliberately NOT cleared: a deferred attribution reports through
        // [finish], which early-returns once the session has been dropped.
    }

    private fun onMainThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post { block() }
    }

    companion object {
        /** One host per Activity, resolved through its own `ViewModelStore` so a recreate finds the same one. */
        @MainThread
        fun of(activity: ComponentActivity): SharingHost {
            // Throws `IllegalStateException` before `onCreate`: an Activity has no `Application`, and
            // therefore no `ViewModelStore`, until the framework attaches it.
            val retained = ViewModelProvider(activity)[SharingViewModel::class.java]
            return retained.host
                ?: SharingHost(activity.applicationContext).also { retained.host = it }
        }
    }
}

/** What [SharingHost.present] should do, given the state of its host and its session. */
internal enum class SharingPresentDecision {
    Present,

    /** Nothing happens and nothing is reported: the merchant's screen is going away. */
    Ignore,

    /** A sheet is already up. Reported as [FrakError.AlreadyPresenting] rather than queued or stacked. */
    Refuse,
}

/** Extracted from [SharingHost.present] so the guards are decidable, and testable, without a window. */
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
 * Posts to the main looper. Hand-rolled because `kotlinx-coroutines-android` is on no classpath in
 * this build: `Dispatchers.Main` would throw inside the merchant's process, and `viewModelScope`
 * silently falls back to `EmptyCoroutineContext`, which would put `WebView` calls on a background
 * thread. Implements neither `Delay` nor `MonotonicFrameClock` — do not animate on this scope.
 */
internal object MainThreadDispatcher : CoroutineDispatcher() {
    private val handler = Handler(Looper.getMainLooper())

    override fun dispatch(
        context: CoroutineContext,
        block: Runnable,
    ) {
        if (handler.post(block)) return
        // `post` returns false only when the looper is exiting. Dropping the block would leave whatever
        // is waiting on this resumption suspended forever, so cancel and then run it anyway — what
        // `kotlinx-coroutines-android`'s own `HandlerContext` does.
        context.cancel(CancellationException("Frak's main looper is shutting down"))
        Dispatchers.IO.dispatch(context, block)
    }
}
