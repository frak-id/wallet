package id.frak.sdk.ui

import android.content.Context
import android.content.MutableContextWrapper
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlin.coroutines.CoroutineContext

/**
 * What holds the sharing surface across a configuration change.
 *
 * The [SharingHost] is the state; this is only the thing that decides how long it lives. A
 * `ViewModelStore` survives a rotation and is cleared when the owner really finishes, which is
 * exactly the lifetime the pooled web view, the session and the attribution scope want — and the
 * first owner in this SDK that has ever matched it. Everything before this was pinned to a
 * composition, which is destroyed and re-created by a rotation that changed nothing.
 *
 * Deliberately **not** a `SavedStateHandle`. That buys survival across process death, which is
 * undeliverable for a WebView-backed sheet at any price: after process death the pool is gone, the
 * warm document is gone and the session is gone, so a restored sheet would pay a full cold load —
 * the exact thing the warm pool exists to prevent. A plain `ViewModel` buys survival across
 * configuration change, which is the case that actually happens.
 */
internal class SharingViewModel : ViewModel() {
    var host: SharingHost? = null

    override fun onCleared() {
        host?.onOwnerCleared()
        host = null
    }
}

/**
 * What [FrakSharing] actually talks to: one sharing surface per hosting Activity, retained across
 * that Activity's configuration changes.
 *
 * Everything a sheet needs that outlives a sheet lives here — the warm web view pool, the
 * coroutine scope an in-flight `track()` runs on, the live session, and the "one sheet at a time"
 * guard. That last one is why this is per **Activity** and not per [FrakSharing]: a merchant may
 * hold two instances on one screen (a list row and a toolbar action, say), and two stacked sheets
 * is not a thing this SDK does. See [FrakError.AlreadyPresenting].
 *
 * The one thing that cannot be retained is the dialog: a `Dialog` is bound to a window token and
 * dies with the Activity. So a rotation dismisses the dialog and re-creates it against the new
 * Activity, re-attaching the same web view — the DOM, the JS heap and the in-flight session are
 * never re-created, which is the substantive half of what `03-sharing-and-install.md` promised.
 * What does not survive is the composition and with it the drag animation, so the sheet comes back
 * at its resting position. That is the right answer for a rotation anyway.
 *
 * Main thread only. Every mutable field below is touched from `present`/`warm`/`attach`/the
 * lifecycle callbacks, all of which the public API annotates `@MainThread`; [finish] is the one
 * entry point that can arrive from elsewhere, and it hops first.
 */
internal class SharingHost private constructor(
    /** The application context. Held for the life of the process either way, so it pins nothing. */
    private val appContext: Context,
) : DefaultLifecycleObserver {
    /**
     * The Activity currently hosting the sheet's window, or null between a configuration change's
     * two halves. Nulled in [onDestroy] and re-set by [attach], which is what keeps a retained host
     * from pinning a destroyed Activity.
     */
    private var activity: ComponentActivity? = null

    /**
     * The context the pooled `WebView` is constructed over.
     *
     * A `WebView` keeps a hard reference to its construction context, so a retained one built
     * against an Activity leaks that Activity on every rotation — silently, with no crash and no
     * log. It also cannot simply be given the application context: it needs a themed, windowed one
     * for its own popups (select dropdowns, text-selection handles) to place themselves.
     *
     * `MutableContextWrapper` is the standard answer to wanting both. The base is the Activity
     * whenever one is attached and the application context whenever none is, so the view is
     * *constructed* against an Activity (warming cannot start before [attach]) and never *retains*
     * a dead one.
     *
     * The swap points are [attach] and [onDestroy], **not** `SharingWebViewPool.acquire`/`release`
     * as `08-sharing-sheet-api.md` §5.2 says. Two reasons: `release` is not where the view is
     * built — `warm()` is, and it runs first, so an acquire-time swap would come too late to be
     * the thing that matters. And between a release and the next acquire the Activity is alive
     * anyway, so nothing is leaked by leaving it as the base; swapping there would only add a
     * window in which a popup resolves against the wrong context.
     */
    private val webViewContext = MutableContextWrapper(appContext)

    /**
     * Deliberately not the sheet's own scope, and deliberately main-confined.
     *
     * Not the sheet's: `SharingSheetState`'s attribution work — a chooser the user is still
     * looking at, a `track()` still being written — has to outlive the sheet that started it.
     * That is the same intent `rememberCoroutineScope()` served before, re-parented from "the
     * composable that called the factory" to "the `ViewModelStore`", which is the lifetime it
     * always wanted and now also spans a rotation.
     *
     * Main-confined, and this is the reason `viewModelScope` is not used: `SharingSheetState`
     * drives the `WebView` from this scope (the install-page load, the `view=confirmation`
     * navigation, share-again), and a `WebView` may only be touched from the thread that created
     * it. `viewModelScope` is `Dispatchers.Main.immediate` *if* `kotlinx-coroutines-android` is on
     * the classpath and silently `EmptyCoroutineContext` if it is not — and it is not, anywhere in
     * this build. See [MainThreadDispatcher].
     */
    private val scope = CoroutineScope(SupervisorJob() + MainThreadDispatcher)

    private var pool: SharingWebViewPool? = null

    /**
     * Whether [warm] has ever been asked for, as opposed to having run.
     *
     * The two differ because [warm] cannot do anything without an attached Activity, and the
     * Compose build site's `LaunchedEffect` is not ordered against [attach] by anything stronger
     * than composition order. Remembering the *request* means an early `warm()` is picked back up
     * by the next attach rather than silently lost.
     */
    private var warmRequested = false

    /** Set once [resolveWarmUrl] has been started, so repeated `warm()` calls are free. */
    private var warmStarted = false

    /** What [resolveWarmUrl] answered, held until there is an Activity to boot a view against. */
    private var warmUrl: String? = null

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

    /** The presenting [FrakSharing]'s fraction, kept so a rotation can re-create the sheet at the same size. */
    private var heightFraction: Float = FrakSharingDefaults.HEIGHT_FRACTION

    /**
     * Where the live session reports to, or null while no Activity is attached.
     *
     * A merchant's callback is almost always a method reference on their Activity, so holding one
     * past that Activity's `onDestroy` is a leak of exactly the kind this class exists to avoid.
     * It is dropped on a configuration change and re-supplied by the next [attach].
     */
    private var callback: FrakSharing.ResultCallback? = null

    /**
     * A terminal result that landed while no callback was attached.
     *
     * Reachable, not theoretical: the attribution work runs on [scope] precisely so a chooser the
     * user is still looking at outlives the sheet, and the user can rotate while that chooser is
     * up. Without this the result would be swallowed — and `SharingSheetState.finish`'s
     * compare-and-set means it would be swallowed permanently, not merely delayed. Replayed by the
     * next [attach].
     */
    private var pendingResult: SharingResult? = null

    /**
     * The user asked the sheet to leave and the animation has not landed yet.
     *
     * Kept on the host rather than in the composition because that 180ms window is long enough to
     * rotate in: the composition and its `Animatable` would die mid-exit, and [attach] would
     * cheerfully put the sheet back on screen having reported nothing.
     */
    private var exitRequested = false

    /** Set by [onOwnerCleared]. The screen is really gone; refuse everything. */
    private var cleared = false

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Binds this host to the Activity that will carry its window.
     *
     * Called from every `build(...)`, which means once per Activity instance per [FrakSharing] —
     * including the recreated Activity after a rotation, which is where the session is picked back
     * up. [callback] is the builder's, used both as the replay target for a result that landed
     * while nothing was attached and as the reporting target for a session resumed across the
     * rotation.
     *
     * With two [FrakSharing] instances on one Activity a replayed result reaches whichever of them
     * built first. Delivering it to the wrong callback is a worse outcome than delivering it to the
     * right one and a much better outcome than dropping it.
     *
     * Must be called from `onCreate` or later. `ComponentActivity.getViewModelStore()` throws
     * before the framework has attached the `Application`, which is the whole of the Activity's
     * constructor — see [FrakSharing.Builder.build].
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
        val resumed = presentation
        if (active != null && resumed != null) {
            if (this.callback == null) this.callback = callback
            // The dialog died with the previous Activity; the web view did not. Re-created without
            // the entry animation — the sheet was already on screen before the rotation.
            if (dialog == null) show(resumed, heightFraction, animateIn = false)
        }

        // Posted, never inline. This runs from `build(...)`, which a Compose caller reaches from
        // inside a composition — and merchant code that writes state it has already read this frame
        // is exactly what a re-entrant call from there produces.
        pendingResult?.let { pending ->
            pendingResult = null
            // Re-checked inside the post: a fast rotate-rotate can destroy this Activity before the
            // message runs, and reporting into a screen that is already gone is what the buffer
            // exists to avoid.
            mainHandler.post { if (!cleared && this.activity === activity) callback.onResult(pending) }
        }
        // Either picks up a `warm()` that arrived before there was an Activity to build a view
        // against, or boots the pool against a URL that resolved during the rotation gap.
        if (warmRequested) warm()
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
     * Survives a rotation: the second Activity's `warm()` finds the work already done.
     *
     * The identity and config reads and the pool's own boot are separated ([resolveWarmUrl] answers
     * a URL rather than warming). Those reads suspend on the network, so the continuation can land
     * in the gap between one Activity's `onDestroy` and the next one's `attach` — and booting the
     * pool there would construct the `WebView` against the application context, which is precisely
     * the thing [webViewContext] exists to prevent. The URL is held and applied by [applyWarmUrl]
     * once there is an Activity to build against.
     */
    @MainThread
    fun warm() {
        if (cleared) return
        warmRequested = true
        // Nothing to construct a themed, windowed web view against yet. [attach] re-drives this.
        if (activity == null) return
        if (warmStarted) {
            applyWarmUrl()
            return
        }
        warmStarted = true
        scope.launch {
            val url = resolveWarmUrl(appContext.packageName)
            if (url == null) {
                // Preloading off, `Frak.initialize` not run yet, or the config/identity reads did
                // not answer. Un-latched deliberately: `present()`'s own late `warm()` should get
                // another go rather than inherit a failure the user never saw.
                warmStarted = false
                return@launch
            }
            warmUrl = url
            applyWarmUrl()
        }
    }

    /**
     * Boots the pool against the resolved warm URL, if there is an Activity to build the view
     * against. Re-driven from [attach], which is the other end of the gap described on [warm].
     */
    private fun applyWarmUrl() {
        val url = warmUrl ?: return
        if (cleared || activity == null) return
        try {
            poolOrNull()?.warm(url)
        } catch (unavailable: Exception) {
            // Constructing a `WebView` throws on a device whose WebView provider is missing,
            // disabled or mid-update. Reachable here from `attach` — i.e. synchronously out of the
            // merchant's `onCreate` — and from `warm`'s coroutine, which has no exception handler
            // between it and the thread's default one. Neither is a place to take a process down
            // for a preload nobody asked for. `present()` reports the same failure properly, if
            // the user ever gets that far.
            warmUrl = null
            warmStarted = false
            pool = null
        }
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
            context = webViewContext,
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
        val activity = this.activity
        val decision =
            sharingPresentDecision(
                hostDestroyed = cleared || activity == null,
                hostUnavailable = activity != null && (activity.isFinishing || activity.isDestroyed),
                lifecycleStarted =
                    activity != null && activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED),
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
        this.heightFraction = heightFraction
        active = request
        exitRequested = false

        val pool = poolOrNull()
        if (pool == null) {
            // Frak.initialize has not run: no wallet origin to load and no client to build a link
            // from. Report it rather than present an empty sheet.
            finish(SharingResult.Failed(FrakError.NotInitialized()))
            return
        }

        // Before the window exists, which is the whole point of the split: the page load is in
        // flight by the time the dialog starts building its own. See [SharingPresentation].
        //
        // Guarded, because the first thing this does is construct a `WebView`, and that throws on
        // a device whose WebView provider is missing, disabled or mid-update. Unguarded it would
        // propagate into the merchant's click handler with `active` already set, so every later
        // `present()` on this screen would answer `AlreadyPresenting` for a sheet that never opened.
        val started =
            try {
                SharingPresentation.start(pool, appContext, scope, request, ::finish)
            } catch (unavailable: Exception) {
                // Almost always a missing/disabled/updating WebView provider. `Decoding` is the
                // least-wrong arm of the existing `FrakError` hierarchy — there is no
                // `WebViewUnavailable`, and adding one is `05-build-and-release.md` Q1's business,
                // not this change's. The cause is carried so the real class name survives.
                //
                // The pool goes with it: `acquire` may have marked its view lent before the throw,
                // and a pool that thinks a sheet is holding its view hands every later session a
                // cold one forever. `this.pool`, not `pool`: the local above shadows the field,
                // and it is the field a later `poolOrNull()` reads to decide whether to rebuild.
                pool.destroy()
                this.pool = null
                finish(
                    SharingResult.Failed(
                        FrakError.Decoding("the sharing web view could not be created", unavailable),
                    ),
                )
                return
            }
        // `start` can report terminally before it returns — `prepare`'s catch-all and the tier-3
        // fallback both can — in which case [finish] has already run and there is nothing to show.
        // Its pooled view would otherwise stay lent for the life of the process.
        if (active !== request) {
            started.disposeIfUnpresented()
            return
        }
        presentation = started
        show(started, heightFraction, animateIn = true)
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
        // The sheet sets this too, from its own three dismissal routes (scrim tap, drag, the
        // TalkBack dismiss action). Set here as well because a back press that arrives before the
        // composition has read the signal would otherwise leave it unset.
        exitRequested = true
        exitSignal.intValue++
    }

    private fun show(
        presentation: SharingPresentation,
        heightFraction: Float,
        animateIn: Boolean,
    ) {
        val activity = this.activity ?: return
        // A window token that has gone throws BadTokenException. Reachable from [attach], which
        // runs from the merchant's onCreate and cannot assume the Activity survived it.
        if (activity.isFinishing || activity.isDestroyed) return
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
                            animateIn = animateIn,
                            onExitStarted = { exitRequested = true },
                        )
                    }
                }
            }

        // ComponentDialog, not Dialog: `setContentView` runs `initializeViewTreeOwners()`, which
        // is what gives the ComposeView above the `ViewTreeLifecycleOwner` and
        // `ViewTreeSavedStateRegistryOwner` that `AbstractComposeView` requires. It also brings an
        // `OnBackPressedDispatcher`, so back is routed the modern way rather than through a raw
        // `onBackPressed`. Only `handleOnBackPressed` is implemented — there is no back *progress*
        // animation on API 34+; the sheet plays its own exit at commit.
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
            exitRequested = false
            dismissDialog(finished)
            finished?.dispose()
            if (reported != null) {
                reported.onResult(result)
            } else {
                // Mid-rotation: the old Activity's callback is gone and the new one has not built
                // yet. Buffered rather than dropped — see [pendingResult].
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
     *   Passed rather than read off [presentation], because [finish] nulls that field before it
     *   gets here — and the detach is only a no-op on that path by accident of
     *   `SharingWebViewPool.release` also removing the view.
     */
    private fun dismissDialog(detaching: SharingPresentation? = presentation) {
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
        // Compose removes the web view when the `AndroidView` leaves composition, but only via
        // that path. `WebView.destroy` and re-parenting both require it to be out of the tree, and
        // the next Activity re-attaches this very instance.
        detaching?.detachView()
    }

    /**
     * The Activity is going away. Whether the *session* is going away with it is a different
     * question, and conflating the two is what would report a dismissal on every rotation.
     *
     * Here: drop everything that belongs to this Activity — the dialog, the web view's attachment,
     * the merchant's callback, the Activity reference itself. Report nothing. If the screen is
     * really finishing, [onOwnerCleared] follows immediately and does the reporting; if it is a
     * configuration change, it does not, and [attach] picks the session back up.
     *
     * The callback is kept when the Activity is finishing rather than rotating, so
     * [onOwnerCleared]'s report has somewhere to go — it runs microseconds later, before anything
     * could observe the difference.
     */
    override fun onDestroy(owner: LifecycleOwner) {
        val current = activity
        val changingConfigurations = current?.isChangingConfigurations == true
        // Dropped *before* the report below, not after. On a rotation the outgoing Activity is
        // past `onSaveInstanceState`, so a result delivered to it lands in state that will never be
        // persisted; buffering it instead means the recreated screen actually learns the outcome.
        if (changingConfigurations) callback = null
        if (exitRequested && active != null) {
            // The user pressed back or flung the sheet away and the exit animation had not landed.
            // The composition is about to die with it, so nothing would ever report — and [attach]
            // would put the sheet back on screen for a session the user has already dismissed.
            // `finish` dismisses the dialog itself; the teardown below still has to run.
            finish(SharingResult.Dismissed)
        } else {
            dismissDialog()
        }
        current?.lifecycle?.removeObserver(this)
        activity = null
        // The load-bearing line for the leak: a retained WebView must not keep a destroyed
        // Activity as its context.
        webViewContext.baseContext = appContext
    }

    /**
     * The `ViewModelStore` was cleared, which is the real "this screen is gone" signal — as opposed
     * to `onDestroy`, which fires on every rotation.
     *
     * This is where `abandon()` belongs, and it is strictly better than where it used to be: "a
     * composable left the tree", which fired on rotation when nothing had been abandoned.
     */
    fun onOwnerCleared() {
        cleared = true
        // Before `dispose()`: a pool already marked dead destroys the view on release instead of
        // reloading a warm URL into a view that is about to be thrown away.
        pool?.destroy()
        pool = null
        warmStarted = false
        warmUrl = null
        pendingResult = null
        // Reports whatever the session reached, or a dismissal, through `abandon()`.
        presentation?.dispose()
        // After `dispose()`: `abandon()` defers to any attribution still in flight, and cancelling
        // first would take the deferral with it. The cancellation itself then runs those
        // coroutines' `finally` blocks, which is what finally reports.
        scope.cancel()
        // `active`, `presentation` and `callback` are deliberately NOT cleared here. A deferred
        // attribution reports through [finish], which early-returns on `active == null` — so
        // clearing them would drop the outcome of a share the user actually completed, which is
        // the exact failure `abandon()`'s counter exists to prevent. Nothing references this host
        // after `SharingViewModel.onCleared` nulls it, so holding them costs nothing.
    }

    private fun onMainThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post { block() }
    }

    companion object {
        /**
         * One host per Activity, surviving that Activity's configuration changes.
         *
         * Resolved through the Activity's own `ViewModelStore` rather than a map keyed on the
         * Activity: a map would have to be invalidated by hand on every recreate, and a
         * `WeakHashMap` would not even collect (the host holds the Activity, so the value reaches
         * its own key). The store already answers "same logical screen, new instance" correctly,
         * and clears exactly when the screen is really gone.
         */
        @MainThread
        fun of(activity: ComponentActivity): SharingHost {
            // Throws `IllegalStateException` if called before `onCreate` — an Activity has no
            // `Application`, and therefore no `ViewModelStore`, until the framework attaches it.
            // See [FrakSharing.Builder.build], which says so where a merchant will read it.
            val retained = ViewModelProvider(activity)[SharingViewModel::class.java]
            return retained.host
                ?: SharingHost(activity.applicationContext).also { retained.host = it }
        }
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
 * third-party runtime dependencies. It is also why `viewModelScope` is not used: it resolves the
 * same missing dispatcher and falls back to `EmptyCoroutineContext` in silence, which would put
 * `WebView` calls on a background thread.
 *
 * Always dispatches, never runs inline. That matches what `rememberCoroutineScope()` did here
 * before — its dispatcher drives work from the choreographer frame callback, so nothing launched
 * on it ever ran synchronously either.
 *
 * Implements neither `Delay` nor `MonotonicFrameClock`, which the dispatcher it replaced did carry.
 * Nothing on this scope uses `delay`/`withTimeout` (the sheet's own budgets run on `workContext`,
 * i.e. `Dispatchers.Default`) or `withFrameNanos`. Moving an `Animatable` onto this scope would
 * hang; do not.
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
