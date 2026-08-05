package id.frak.sdk.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.CoroutineContext

/**
 * Resolved once before anything can be shown. [link] is local and always usable; [pageUrl]
 * needs the network and may be null — the tier-3 fallback (native share sheet, no page), not a
 * broken session.
 */
internal class SharingSession(
    val walletOrigin: String,
    val returnScheme: String,
    val link: String,
    val shareTitle: String?,
    private val pageUrl: String?,
    /**
     * The warm URL this session's params can be hung off, when one exists. Compared against what
     * the view is actually showing before any fragment is used — a pool warmed for a different
     * merchant, or not warmed at all, must not be activated on top of.
     */
    val warmBaseUrl: String? = null,
    /** The per-tap params as a fragment, for the [warmBaseUrl] case. See [SharingPageUrl.activationFragment]. */
    private val activationFragment: String? = null,
) {
    val hasPage: Boolean get() = pageUrl != null

    /**
     * How the view should get to this session's page, given what it is already showing.
     *
     * [SharingNavigation.Activate] when [currentBaseUrl] is the page this session was warmed
     * against — no request, no remount, no React boot. Otherwise a full [SharingNavigation.Load],
     * which is also the answer whenever preloading is off, the warm-up never finished, or the
     * sheet has since navigated somewhere else entirely (the install page).
     *
     * Null when [hasPage] is false. Never call this without checking it first.
     */
    fun navigation(
        confirmed: Boolean,
        currentBaseUrl: String? = null,
    ): SharingNavigation? {
        // Both answers derive from the same value, so "no page" cannot be expressed as an
        // activation. [build] never assembles a warm half without a page — the tier-3 branch
        // returns before either is known — but the caller gates tier 3 on this being null, and a
        // session reporting an activation it has no page for would skip the fallback and leave
        // the user on a fragment pointing at nothing.
        val full = pageUrl?.let { if (confirmed) "$it&view=confirmation" else it } ?: return null
        val warm = warmBaseUrl
        val fragment = activationFragment
        if (warm != null && fragment != null && currentBaseUrl == warm) {
            return SharingNavigation.Activate(
                fragment = if (confirmed) "$fragment&view=confirmation" else fragment,
                fullUrl = full,
            )
        }
        return SharingNavigation.Load(full)
    }

    /** Test/diagnostic view of [navigation]'s full-load answer. */
    fun url(confirmed: Boolean): String? = (navigation(confirmed) as? SharingNavigation.Load)?.url
}

/**
 * How to get the page in front of the user.
 *
 * The distinction is not cosmetic. A warmed document's URL is *not* the URL we warmed it on:
 * the page's router normalises its own search params on load (absent params are filled in,
 * so e.g. an absent `view` becomes `view=share`), so the address bar has moved before the user
 * ever taps. `loadUrl(warmUrl + fragment)` therefore compares against the wrong string, misses,
 * and does a full cross-document navigation — which is exactly what the first device trace of
 * this showed: `ACTIVATING` followed by a 695ms `document finished`. It is also why every trace
 * since preloading landed has carried a second `document finished` a few ms after the first.
 */
internal sealed interface SharingNavigation {
    /** A full navigation, for a view that is not already on this session's warm page. */
    data class Load(
        val url: String,
    ) : SharingNavigation

    /**
     * A fragment set on whatever document is loaded, which is the only way to stay same-document
     * without knowing the URL the page rewrote itself to.
     */
    data class Activate(
        val fragment: String,
        /**
         * The same page a [Load] would have gone to. Used only if the view turns out to have no
         * committed URL to hang [fragment] off.
         */
        val fullUrl: String,
    ) : SharingNavigation
}

/** The sheet's behaviour, kept out of the composable since the ordering rules here are sequencing-sensitive. */
@Stable
internal class SharingSheetState(
    /**
     * Outlives any one sheet on purpose: an in-flight `track()` or a chooser the user is still
     * looking at must not be cancelled by the sheet closing. Owned by [SharingHost] and cancelled
     * when the host's owner is destroyed.
     */
    private val scope: CoroutineScope,
    /**
     * The **application** context, not the presenting Activity's.
     *
     * Everything this class does with it survives that: the chooser and the external-link intent
     * both already carry `FLAG_ACTIVITY_NEW_TASK`, the clipboard is a process-wide system service,
     * and `packageName` is identical either way. Holding the Activity here would pin it for as long
     * as the session lives — which, once the session moves into a `ViewModel`, is across
     * configuration changes. The web view still gets an Activity context; see
     * [SharingWebViewPool].
     */
    private val context: Context,
    private val sessionId: String,
    private val onFinished: (SharingResult) -> Unit,
    /** Milestones inside [build], which device traces showed to be the largest share of tap-to-paint. */
    private val trace: SharingTrace = SharingTrace(),
    /**
     * Where [build] runs.
     *
     * Off the main thread deliberately. [scope] is main-confined, so on it this coroutine queued
     * behind the sheet's entry animation and the web view's first layout and did not start for
     * 203-430ms on device. Everything it calls does its own IO dispatching; the Compose state it
     * writes ([session], [failure]) is snapshot state and safe to write from any thread.
     *
     * Tests override this with `EmptyCoroutineContext` so work stays on their `TestScope`.
     */
    private val workContext: CoroutineContext = Dispatchers.Default,
    /**
     * The document the view handed to this sheet is already showing, if it is a finished warm
     * page. Lets the session activate by fragment instead of loading the page a second time.
     *
     * Decided once, at the tap, by [SharingPresentation]: whether the warm-up had finished by
     * then is exactly the question, and re-asking it later would race the answer.
     */
    private val activationBaseUrl: String? = null,
    /**
     * Everything this state needs from the SDK core. See [SharingDependencies] for why it is one
     * interface rather than the eight individually injected lambdas it replaced, and why the
     * default resolves `Frak.client` per call rather than holding one.
     */
    private val dependencies: SharingDependencies = FrakClientDependencies,
) {
    var session: SharingSession? by mutableStateOf(null)
        private set

    var failure: FrakError? by mutableStateOf(null)
        private set

    /**
     * Whether the hosted page has actually painted. Drives the skeleton that covers the web
     * view until then.
     *
     * Latches: once the page has been seen, a later same-session navigation (the `view=confirmation`
     * reload, the install page) must not put the skeleton back — the user is looking at real
     * content and a reappearing placeholder reads as a fault.
     *
     * Starts true when this sheet was handed a finished warm page. The skeleton exists to hide a
     * blank web view, and an activated view is not blank — it is already showing the merchant's
     * own page, painted before the user tapped. Covering that with a placeholder and then
     * cross-fading to it is strictly worse than showing it, and on device it read as a flash.
     */
    var pageVisible: Boolean by mutableStateOf(activationBaseUrl != null)
        private set

    /**
     * The page is gone and is not coming back, on a sheet that has to stay up anyway.
     *
     * Exactly one path sets this: a renderer crash *after* the page had painted. [onPageUnavailable]
     * deliberately does nothing there — raising the tier-3 chooser over a sheet the user is looking
     * at would be worse than the crash — so the sheet is left for the user to dismiss.
     *
     * It needs saying out loud now that the web view is transparent. "Left blank" used to mean an
     * opaque white rectangle; with a transparent view, a rectangular RectangleShape sheet and a
     * transparent container, it would mean a see-through hole with a grab pill floating in it. The
     * sheet paints an opaque surface when this is set.
     */
    var contentLost: Boolean by mutableStateOf(false)
        private set

    /**
     * Every latch below is an atomic, and that is load-bearing rather than defensive.
     *
     * [workContext] is `Dispatchers.Default` in production while [share], [copy], [onPageAction]
     * and [dismiss] arrive on `Main.immediate`, so each of these is read and written from two
     * threads. As plain `var`s their "fires once" guarantees were comments, not properties — a
     * `if (flag) return; flag = true` check-then-act has a real interleaving where both callers
     * pass. `compareAndSet` is what actually makes it once.
     *
     * The tests cannot reach this: they inject `EmptyCoroutineContext` for [workContext], which
     * puts everything on one virtual scheduler.
     *
     * [session], [failure], [pageLoaded] and [pageVisible] deliberately stay Compose snapshot
     * state — the snapshot system is cross-thread safe by design and publishes to observers on
     * the right scheduler.
     */
    private val best = AtomicReference<SharingResult?>(null)

    @Volatile
    private var webView: WebView? = null

    /** Set by the one caller that gets to report; see [finish]. */
    private val finished = AtomicBoolean(false)

    /** Document-finished. Observable so the sheet can bound how long its skeleton waits for a paint signal. */
    var pageLoaded: Boolean by mutableStateOf(false)
        private set

    /** True between the page's share press and its outcome. */
    private val shareInFlight = AtomicBoolean(false)

    /** The [copy] half of [shareInFlight]: two taps would bill two interactions for one copy. */
    private val copyInFlight = AtomicBoolean(false)

    /**
     * True once the sheet has left the sharing page for the wallet's install page.
     *
     * Not `mutableStateOf`: nothing renders off it. It survives because [onPageUnavailable] has to
     * tell a failed install page apart from a failed sharing page — both reach it identically but
     * need opposite answers.
     */
    @Volatile
    private var showingInstallPage = false

    /**
     * Guards tier-3 fallback to fire once. [finished] doesn't suffice: it's set only after the
     * chooser has been raised and the share attributed, so two fallbacks racing that window
     * both pass it. The deadline and a main-frame error can genuinely race (both fire offline).
     */
    private val fallbackFired = AtomicBoolean(false)

    /**
     * Completes when the page paints ([onPageReady]) or a terminal outcome hits ([finish]).
     * What [awaitLoadDeadline] races against, on one budget spanning build + resolve + page
     * load, so a fast build and a slow page can't each stay under budget while together
     * blowing it.
     */
    private val contentSettled = CompletableDeferred<Unit>()

    /** Set once the load-deadline budget passes; [prepare] checks it so a merely-slow build still lands on tier 3. */
    @Volatile
    private var deadlineExpired = false

    /** Guards [prepare]; see it for why once-only is a property here rather than a convention. */
    private val prepareStarted = AtomicBoolean(false)

    /** Guards [loadSessionUrl] so the session's page is navigated to exactly once. */
    private val sessionLoaded = AtomicBoolean(false)

    /**
     * How many outcome-deciding coroutines are still running. See [launchAttribution].
     *
     * These run on [scope], which is the host's rather than the sheet's, deliberately: a
     * chooser the user is still looking at, or a `track()` still being written, has to outlive the
     * sheet that started it. That is exactly what makes [abandon] dangerous — without this counter
     * it would report a dismissal over a share that had not finished resolving yet.
     */
    private val attributionsInFlight = AtomicInteger(0)

    /** Set by [abandon] when it had to defer to [attributionsInFlight]. */
    private val abandonRequested = AtomicBoolean(false)

    /** The hop back to the web view's own thread from [workContext]. See [loadSessionUrl]. */
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Idempotent. Started by [SharingPresentation.start] from the merchant's click handler, before
     * any sheet exists — the whole point of the split — so nothing in the composition can re-enter
     * it, and a rotation that rebuilds the composition must not restart the session's build.
     */
    fun prepare(request: SharingRequest) {
        if (!prepareStarted.compareAndSet(false, true)) return
        scope.launch(workContext) {
            // Distance from "sheet opened" is scheduling overhead, not work. See [workContext].
            trace.mark("  prepare running")
            if (!Frak.isInitialized) {
                fail(FrakError.NotInitialized())
                return@launch
            }
            // Catch-all: an unexpected throw from build() reports rather than propagating.
            //
            // It used to rethrow, on the reasoning that `failure` had been recorded and the sheet's
            // `LaunchedEffect(state.failure)` would pick it up. Two problems with that: this
            // coroutine has no exception handler, so the rethrow reached the thread's default one
            // and took the merchant's process with it — and a `FrakError` from `buildSharingLink`
            // or `anonymousId` after `Frak.shutdown()` is an entirely reachable way to get here.
            // Reporting directly also removes the dependency on a composable still being alive to
            // observe the state change. CancellationException still rethrows untouched.
            val built =
                try {
                    buildWithinBudget(request)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (unexpected: Throwable) {
                    // A `FrakError` is reported as itself — `NotInitialized` from a mid-build
                    // shutdown is far more actionable to a merchant than a generic decode failure.
                    fail(
                        failure
                            ?: unexpected as? FrakError
                            ?: FrakError.Decoding("the sharing sheet could not be prepared"),
                    )
                    return@launch
                }
            when {
                // Budget already expired while this was resolving; onLoadDeadline had no session yet to fall back with.
                deadlineExpired -> {
                    fallBackOrFail(built)
                }

                // build() already hit tier 3 itself (cold cache, no network) — no page will ever
                // arrive. Null lands here too: `buildWithinBudget` answers null for a can't-share
                // *and* for its own timeout, and both need reporting rather than a session set to
                // null and a navigation that quietly no-ops. Unreachable today — the 1.5s page
                // deadline always beats the 8s build ceiling, so `deadlineExpired` catches it
                // first — but only by the ordering of two constants, which is not an invariant.
                built == null || !built.hasPage -> {
                    fallBackOrFail(built)
                }

                else -> {
                    session = built
                    // Straight into the view, without waiting for the sheet to notice. This used
                    // to be a LaunchedEffect keyed on `session`, whose body is dispatched on the
                    // composition's frame clock — which at sheet-open is busy building the
                    // sheet's Dialog window and attaching the web view, and delayed the
                    // navigation by 230-427ms on device.
                    loadSessionUrl()
                }
            }
        }
    }

    /**
     * [build] under a hard ceiling, so a hang always reports something.
     *
     * [awaitLoadDeadline] does not cover this. It races [contentSettled], which nothing completes
     * while `build()` is still running — [onLoadDeadline] with no session only records
     * [deadlineExpired] and waits for the build to come back. So a `resolveConfig()` or
     * `anonymousId()` that never returns (as opposed to throwing) left the merchant's `onResult`
     * uncalled forever and the sheet on a blank surface once the skeleton's own 2.5s hold expired.
     *
     * Deliberately far longer than the 1.5s page-load deadline: the user-facing budget is still
     * 1.5s to content, enforced by the tier-3 fallback. This is a liveness backstop that should
     * never fire on a working device, not a second UX budget.
     */
    private suspend fun buildWithinBudget(request: SharingRequest): SharingSession? {
        val built = withTimeoutOrNull(BUILD_DEADLINE_MILLIS) { build(request) }
        // build() sets `failure` itself when it has nothing to share. Still null here means the
        // budget expired, and the caller needs something to report.
        if (built == null && failure == null) {
            failure =
                FrakError.Network(
                    IOException("the sharing sheet was not ready within ${BUILD_DEADLINE_MILLIS}ms"),
                )
        }
        return built
    }

    /** Bounds tap-to-content: [prepare] start to page painted or terminal outcome. See [contentSettled]. */
    suspend fun awaitLoadDeadline(deadlineMillis: Long) {
        val arrivedInTime = withTimeoutOrNull(deadlineMillis) { contentSettled.await() }
        if (arrivedInTime == null) onLoadDeadline()
    }

    /** Starts [awaitLoadDeadline] off the caller's thread, so the budget is not measured by a congested Main. */
    fun startLoadDeadline(deadlineMillis: Long) {
        scope.launch(workContext) { awaitLoadDeadline(deadlineMillis) }
    }

    /**
     * Gives this state the view it will drive. Called before the sheet composes, so the page can
     * start loading while the sheet is still animating in.
     */
    fun attach(view: WebView) {
        if (webView === view) return
        webView = view
        loadSessionUrl()
    }

    /**
     * Navigates to the session's page, once both halves exist. Fires from whichever of
     * [attach]/[prepare] completes second, and at most once — a second navigation would restart
     * a load already in flight.
     */
    private fun loadSessionUrl() {
        val view = webView ?: return
        val navigation = pageNavigation(confirmed = false) ?: return
        // Claimed last, and atomically: `attach` (Main) and the tail of `prepare` (workContext)
        // both reach here, so a plain check-then-act has an interleaving where both pass and the
        // page is navigated to twice — the second restarting a load already in flight.
        if (!sessionLoaded.compareAndSet(false, true)) return
        // A WebView must be driven from the thread that created it, and build() runs off Main
        // ([workContext]) — so a hop is needed, but only from there.
        //
        // Handler(mainLooper), emphatically NOT View.post: at this point the pooled view is
        // still detached (the sheet attaches it a frame or two later), and View.post on a
        // detached view parks the runnable in the view's own run queue until it is attached to a
        // window. That would put the navigation back behind the sheet composition this whole
        // split exists to get ahead of.
        if (Looper.myLooper() == Looper.getMainLooper()) {
            view.navigate(navigation)
        } else {
            mainHandler.post { view.navigate(navigation) }
        }
    }

    /**
     * How the page should get where it is going next, preferring a same-document activation over
     * loading the whole page again.
     *
     * Every navigation this sheet makes goes through here, not just the first: once the view is
     * on the warm document, the confirmation and share-again steps are fragment changes too, and
     * routing only the initial load through it would make those the expensive ones instead.
     */
    private fun pageNavigation(confirmed: Boolean): SharingNavigation? =
        session?.navigation(
            confirmed = confirmed,
            // Not the handle's tracked value: once the sheet owns the view it navigates the
            // view itself (install page, and back), and only this sheet knows where it went.
            currentBaseUrl = if (showingInstallPage) null else activationBaseUrl,
        )

    /**
     * Drops this state's reference to the view.
     *
     * Deliberately does NOT destroy it: the sheet acquired the view from [SharingWebViewPool]
     * and hands it back there, since a pooled view is lent for one sheet and reused by the next.
     */
    fun release() {
        webView = null
    }

    fun onPageReady() {
        pageLoaded = true
        contentSettled.complete(Unit)
    }

    /**
     * The page has painted, so the skeleton covering it can lift. Distinct from [onPageReady]:
     * that fires at document-finished, which for a React app is still a blank frame.
     */
    fun onPageVisible() {
        pageVisible = true
    }

    /**
     * Past this, the page is treated as unavailable rather than shown late. [session] may not
     * exist yet ([awaitLoadDeadline] also covers `build()` itself), so this can't delegate to
     * [onPageUnavailable] unconditionally — sets [deadlineExpired] instead.
     */
    fun onLoadDeadline() {
        if (pageLoaded) return
        val active = session
        if (active != null) {
            fallBackOrFail(active)
        } else {
            deadlineExpired = true
        }
    }

    /** Raises the chooser, then attributes the share. */
    fun share() {
        val active = session ?: return
        // The page's footer stays enabled through the round trip. Without this guard, a
        // second tap during the track() write below could stack a second chooser and bill a
        // second reward-bearing interaction for one share.
        if (!shareInFlight.compareAndSet(false, true)) return
        launchAttribution {
            // Nothing took the intent.
            if (!NativeShare.share(context, active.link, active.shareTitle)) {
                // Cleared here, unlike the success path: no chooser came up, so the user must
                // be able to try again.
                shareInFlight.set(false)
                return@launchAttribution
            }
            // Tracked after the chooser opens, not after a share completes: this is the
            // reward-bearing interaction, and it pays out for anyone who opened the chooser
            // and backed out (same asymmetry as the wallet's own web share plugin).
            track()
            confirm(SharingResult.Shared(active.link))
            // Not cleared here: confirm() moves to the confirmation screen, which has no
            // Share button. ShareAgain is what reopens the flow, and clears it.
        }
    }

    /**
     * Copies the link and attributes it. The page owns the feedback.
     *
     * Records the outcome rather than [confirm]ing it — unlike [share], the page already moves
     * itself to its confirmation toast on its own button press, and a `view=confirmation` reload here
     * would tear that down mid-toast.
     */
    fun copy() {
        val active = session ?: return
        if (!copyInFlight.compareAndSet(false, true)) return
        launchAttribution {
            // Tracked before the copy, unlike share(): there's no chooser or cancellation
            // window to guard against.
            track()
            NativeShare.copy(context, active.link)
            record(SharingResult.Copied(active.link))
        }
    }

    fun onPageAction(action: SharingPageAction) {
        when (action) {
            SharingPageAction.Install -> {
                launchAttribution {
                    // Navigates to the wallet's install page in-sheet rather than to the
                    // store; that page owns install code / store link / installed-wallet
                    // routing.
                    val current = session ?: return@launchAttribution
                    // Guarded, like everything else that reaches `Frak.client` from this scope:
                    // its getter throws once `Frak.shutdown()` has run, and this coroutine has no
                    // exception handler between it and the merchant's process. See [guarded].
                    val page = guarded { dependencies.installPageUrl(current.returnScheme, sessionId) }
                    if (page == null) {
                        // No identity/merchant to hand the install page — falls back to the
                        // store. Reported only after the open, since finishing first could
                        // tear this scope down mid-call.
                        guarded { dependencies.openFrakApp() }
                        finish(SharingResult.InstallStarted)
                        return@launchAttribution
                    }
                    webView?.loadUrl(page)
                    showingInstallPage = true
                    record(SharingResult.InstallStarted)
                }
            }

            SharingPageAction.ShareAgain -> {
                pageNavigation(confirmed = false)?.let {
                    // Reopens the guards share()/copy() left set.
                    shareInFlight.set(false)
                    copyInFlight.set(false)
                    // Back on the sharing page — a later load failure belongs to it again.
                    showingInstallPage = false
                    webView?.navigate(it)
                }
            }

            // The page draws the buttons; this sheet performs them — navigator.share doesn't
            // exist in an Android WebView, and the interaction must be signed by a keypair the
            // page can't reach.
            SharingPageAction.Share -> {
                share()
            }

            SharingPageAction.Copy -> {
                copy()
            }

            is SharingPageAction.Code -> {
                // The page generates and displays it; the SDK owns the clipboard since the
                // page can't set the sensitive flag.
                NativeShare.copyInstallCode(context, action.value, action.expiresAtSeconds)
            }

            SharingPageAction.Dismiss -> {
                finish(SharingResult.Dismissed)
            }

            SharingPageAction.Error -> {
                finish(SharingResult.Failed(FrakError.Decoding("the sharing page refused to render")))
            }

            SharingPageAction.Ready -> {
                // Progress, not an outcome: the page says it has painted. Everything else in
                // this `when` finishes the session.
                trace.mark("page reported ready")
                // Settles the tier-3 deadline as well as the skeleton, and that is not belt-and-
                // braces. A fragment activation is a same-document navigation, which is not
                // guaranteed to produce an `onPageFinished` — the only other thing that settles
                // it. Without this, the fast path would be the one that times out at 1.5s and
                // fell back to the native chooser with a perfectly good page already on screen.
                onPageReady()
                onPageVisible()
            }
        }
    }

    /** A broken or unreachable page must never be shown; same fallback [onLoadDeadline] uses. */
    fun onPageUnavailable() {
        // A failed install page: tier-3 fallback is wrong here (already shared), so reload the
        // confirmation screen instead — it has its own share-again/install controls.
        if (showingInstallPage) {
            // Navigation computed *before* clearing the flag. pageNavigation() reads it to decide
            // whether the view is still on the activated document, and the view is emphatically
            // not: it is on an install page that just failed. Clearing first made this recover
            // by hanging a fragment off the failed page's own URL, leaving the user nowhere.
            val recovery = pageNavigation(confirmed = true)
            showingInstallPage = false
            recovery?.let { webView?.navigate(it) }
            return
        }
        // A renderer crash after paint also lands here. Falling back would raise an unwanted
        // chooser on top of a sheet in use; leave a dismissible sheet instead — but an opaque one,
        // since the web view that used to paint it is transparent and now paints nothing at all.
        // See [contentLost].
        if (pageLoaded) {
            contentLost = true
            return
        }
        val active = session ?: return
        fallBackOrFail(active)
    }

    /** [active].link is 100% local; its presence, not the page's, decides whether this session can still share. */
    private fun fallBackOrFail(active: SharingSession?) {
        // finish() no-ops once reported, but NativeShare would still raise a chooser for a
        // sheet the user has closed.
        if (finished.get()) return
        // deadline and page failure are independent triggers that both fire offline
        if (!fallbackFired.compareAndSet(false, true)) return
        if (active == null) {
            failure?.let(::fail)
            return
        }
        launchAttribution {
            // Same rule as share(): pays out after the chooser, not before.
            val shared = NativeShare.share(context, active.link, active.shareTitle)
            if (shared) track()
            finish(if (shared) SharingResult.Shared(active.link) else SharingResult.Dismissed)
        }
    }

    /**
     * Where the page's own outbound links go.
     *
     * Routes the wallet's own Play listing through [openFrakApp] (deep-link first, store
     * fallback) instead of a bare intent, so an already-installed wallet opens directly instead
     * of landing on its own store page.
     */
    fun openExternally(url: String) {
        // normalizeScheme, not a lowercase compare: Android doesn't fold "HTTPS:" for intent
        // resolution either.
        val parsed = Uri.parse(url).normalizeScheme()
        // Only http(s): intent: and vendor schemes could reach arbitrary installed activities.
        if (parsed.scheme != "https" && parsed.scheme != "http") return
        if (isWalletStoreListing(parsed)) {
            scope.launch { guarded { dependencies.openFrakApp() } }
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, parsed).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    /** True only for this environment's own Play listing; dev and production ship different package ids, so it's read off the URL rather than assumed. */
    private fun isWalletStoreListing(url: Uri): Boolean =
        url.host.equals(PLAY_STORE_HOST, ignoreCase = true) &&
            url.getQueryParameter("id") == dependencies.environment().walletPackageId

    /** The user swiped or tapped away. Reports whatever the session achieved. */
    fun dismiss() = finish(SharingResult.Dismissed)

    /**
     * The sheet went away without any explicit outcome.
     *
     * Reported as a dismissal, because from a merchant's side that is what it is: the sheet is
     * gone and nothing was shared. Reached when the presenting Activity is destroyed, when a
     * dialog is dismissed by something other than [dismiss], or when the composition hosting the
     * sheet is disposed for any other reason — none of which route through [dismiss], so before
     * this existed the merchant's `onResult` was simply never called for those sessions and any
     * "sharing in progress" state they kept hung forever.
     *
     * Not a lie about a share that did happen, and this is the part that needs the counter rather
     * than just [finish]'s significance ordering. [share], [copy], the install handoff and the
     * tier-3 fallback all run on [scope] — the host's, not the sheet's — precisely so a chooser
     * the user is still looking at outlives the sheet. Reporting a dismissal in that window would
     * beat the share to [finish]'s compare-and-set and the real outcome would be dropped, not
     * merely out-ranked. So this defers: if anything is still resolving, the last one out reports,
     * by which time [record] has seen the truth.
     */
    fun abandon() {
        abandonRequested.set(true)
        if (attributionsInFlight.get() == 0) finish(SharingResult.Dismissed)
    }

    /**
     * Launches work that decides or records this session's outcome, tracked so [abandon] can wait
     * for it. Everything that ends in a [record] or a [finish] has to go through here.
     */
    private fun launchAttribution(block: suspend () -> Unit) {
        // Incremented before the launch, not inside it: `abandon` can run between the two
        // otherwise, see nothing in flight, and report over work that is about to start.
        attributionsInFlight.incrementAndGet()
        scope.launch {
            try {
                block()
            } finally {
                // `finish` no-ops if the block already reported one, so this only ever supplies the
                // dismissal `abandon` deferred — and by now `best` holds whatever the block
                // recorded, which is what actually reaches the merchant.
                if (attributionsInFlight.decrementAndGet() == 0 && abandonRequested.get()) {
                    finish(SharingResult.Dismissed)
                }
            }
        }
    }

    /** The sheet could not be built at all. Routed through [finish] so it cannot double-report. */
    fun fail(error: FrakError) = finish(SharingResult.Failed(error))

    /**
     * Runs a `Frak.client` call that must not be allowed to escape this sheet's scope.
     *
     * `Frak.client`'s getter throws [FrakError.NotInitialized] once [id.frak.sdk.Frak.shutdown]
     * has run, which a host app may legitimately do while a sheet is open (logout, account
     * switch). These calls run inside `scope.launch { }` with no `CoroutineExceptionHandler`
     * between them and the merchant's process, so an uncaught one is a crash — in the middle of
     * a share the user already completed.
     *
     * `CancellationException` is rethrown untouched: it is how the scope tears down.
     */
    private suspend fun <T> guarded(call: suspend () -> T): T? =
        try {
            call()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (unavailable: FrakError) {
            trace.mark("client call refused: ${unavailable.message}")
            null
        }

    /** Suspends until the event is durable. See [share]. */
    private suspend fun track() {
        guarded { dependencies.track(Interaction.Sharing()) }
    }

    /**
     * Moves the page to its post-share confirmation screen via a `view=confirmation` reload — only
     * this sheet learns whether a chooser actually came up, and the page's own confirmation
     * state has to survive the user leaving and coming back.
     */
    private fun confirm(result: SharingResult) {
        record(result)
        val confirmed = pageNavigation(confirmed = true) ?: return // null under tier 3 (no page)
        webView?.navigate(confirmed)
    }

    /**
     * Keeps the most significant outcome seen so far.
     *
     * `updateAndGet`, not read-then-write: [copy] and [confirm] run on Main while the tier-3
     * fallback runs on [workContext], and a lost update here is a share reported as a dismissal.
     */
    private fun record(result: SharingResult) {
        best.updateAndGet { current ->
            if (current == null || result.significance > current.significance) result else current
        }
    }

    /** Reports once. A session can produce several outcomes; the caller gets the most significant. */
    private fun finish(result: SharingResult) {
        // The one place the "exactly one callback" contract is enforced. Every terminal path funnels
        // through here, from both threads, so the claim has to be a compare-and-set rather than a
        // comment on a plain boolean.
        if (!finished.compareAndSet(false, true)) return
        contentSettled.complete(Unit) // every terminal outcome funnels through here
        record(result)
        onFinished(best.get() ?: result)
    }

    /** Null only when there's nothing to share (no identity/merchant); a later resolveConfig failure still returns a no-page session, never null. */
    private suspend fun build(request: SharingRequest): SharingSession? {
        val link = dependencies.buildSharingLink(request)
        trace.mark("  link built")
        val clientId = dependencies.anonymousId()
        trace.mark("  identity ready")
        if (link == null || clientId == null) {
            failure = FrakError.MerchantResolutionFailed("no anonymous id or merchant to build a sharing link from")
            return null
        }

        val walletOrigin = dependencies.environment().wallet
        val packageId = context.packageName
        val merchant =
            try {
                dependencies.resolveConfig()
            } catch (resolveFailed: FrakError) {
                // Tier 3: link stands alone. failure is deliberately not set — this is a
                // no-page session, not a failed one.
                return SharingSession(
                    walletOrigin = walletOrigin,
                    returnScheme = SharingPageUrl.returnScheme(packageId),
                    link = link,
                    shareTitle = null,
                    pageUrl = null,
                )
            }
        trace.mark("  config resolved")

        // Seeds the page's headline on first frame so it opens on content rather than its own
        // skeleton. Opportunistic, not awaited: RewardRepository's cache is keyed on the encoded
        // product list, so the first share of any given product is always a cache miss, and the
        // old 150ms budget bought a cosmetic headline by delaying the navigation behind it on
        // every one of those. At this timeout a hit still lands (a cache read is a mutex and a
        // map lookup) and a miss costs nothing — the page fetches the same value itself either
        // way. catch(FrakError), not runCatching, to avoid swallowing this composition's own
        // CancellationException on mid-seed teardown. Scoped like the page's own selection so
        // the two never disagree on a product-gated campaign.
        val scopedProducts = request.products.mapNotNull { it.details }.ifEmpty { null }
        val seededReward =
            withTimeoutOrNull(SEED_TIMEOUT_MILLIS) {
                try {
                    dependencies.bestReward(request.targetInteraction, scopedProducts)?.formatted
                } catch (unavailable: FrakError) {
                    null
                }
            }
        trace.mark("  reward seeded")

        val appName = merchant.displayName
        val requestLogoUrl = request.logoUrl
        return SharingSession(
            walletOrigin = walletOrigin,
            returnScheme = SharingPageUrl.returnScheme(packageId),
            link = link,
            shareTitle = appName,
            pageUrl =
                SharingPageUrl.build(
                    walletOrigin = walletOrigin,
                    merchantId = merchant.merchantId,
                    clientId = clientId,
                    packageId = packageId,
                    sessionId = sessionId,
                    appName = appName,
                    logoUrl = requestLogoUrl ?: merchant.logoUrl,
                    link = request.link ?: request.products.firstOrNull()?.link,
                    products = productsJson(request),
                    seededReward = seededReward,
                ),
            // Rebuilt here rather than passed in from the pool, so it is derived from the same
            // resolved config as pageUrl. If the pool warmed against anything else — a stale
            // merchant, a config that changed under us — the strings differ and the session
            // falls back to a full load rather than activating on top of the wrong page.
            warmBaseUrl =
                SharingPageUrl.warm(
                    walletOrigin = walletOrigin,
                    merchantId = merchant.merchantId,
                    clientId = clientId,
                    packageId = packageId,
                    appName = appName,
                    logoUrl = merchant.logoUrl,
                ),
            activationFragment =
                SharingPageUrl.activationFragment(
                    sessionId = sessionId,
                    link = request.link ?: request.products.firstOrNull()?.link,
                    products = productsJson(request),
                    // Only when the request overrides the config: the warm URL already carries
                    // the config's own logo, and re-sending it would be noise.
                    logoUrl = requestLogoUrl,
                    seededReward = seededReward,
                ),
        )
    }

    /**
     * Null rather than `[]` when empty — the page skips the card section on null, renders empty
     * on `[]`. Flattens [SharingProduct.details]' scope fields since the page forwards this
     * object straight into reward selection. Mirrored in iOS's `SharingSheetModel.productsJSON`;
     * keep both in step.
     */
    private fun productsJson(request: SharingRequest): String? {
        if (request.products.isEmpty()) return null
        val array = JSONArray()
        for (product in request.products) {
            val entry =
                JSONObject()
                    .put("title", product.title)
                    .put("link", product.link)
                    .put("imageUrl", product.imageUrl)
                    .put("utmContent", product.utmContent)
            product.details?.let { details ->
                entry.put("productId", details.productId)
                entry.put("sku", details.sku)
                entry.put("name", details.name)
                // finiteOrNull: JSONObject.put throws on NaN/Infinity, which would crash this
                // launch instead of just dropping the field.
                entry.put("quantity", details.quantity.finiteOrNull())
                entry.put("unitPrice", details.unitPrice.finiteOrNull())
                entry.put("totalPrice", details.totalPrice.finiteOrNull())
            }
            array.put(entry)
        }
        return array.toString()
    }

    /** Null for NaN/Infinity, which [JSONObject.put] rejects outright. */
    private fun Double?.finiteOrNull(): Double? = this?.takeIf { it.isFinite() }

    private companion object {
        /**
         * How long the reward seed may delay the navigation. Sized for a cache hit and nothing
         * more — a miss needs the network, and the page fetches the same value itself anyway.
         */
        const val SEED_TIMEOUT_MILLIS = 40L

        /**
         * Hard ceiling on [build]. See [buildWithinBudget] — a liveness backstop, not a UX budget,
         * so it is sized to never fire on a device that is merely slow.
         */
        const val BUILD_DEADLINE_MILLIS = 8_000L

        /** Host of the store listing the install page links to. */
        const val PLAY_STORE_HOST = "play.google.com"
    }
}

/**
 * Performs a [SharingNavigation].
 *
 * The activation case reads [android.webkit.WebView.getUrl] rather than using the URL we warmed
 * the view with, and that is the whole fix: the sharing page's router normalises its own search
 * params on load (absent params are filled in, so e.g. an absent `view` becomes
 * `view=share`), so by the time anyone taps, the document has moved somewhere we never
 * named. Hanging the fragment off our string missed by exactly that much and reloaded the entire
 * page — `ACTIVATING` followed by a 695ms `document finished` in the first device trace of this.
 *
 * Against the committed URL it is a fragment-only change, which Blink resolves same-document: no
 * request, no remount, no React boot, and a `hashchange` for the page to read.
 */
private fun WebView.navigate(navigation: SharingNavigation) {
    when (navigation) {
        is SharingNavigation.Load -> {
            loadUrl(navigation.url)
        }

        is SharingNavigation.Activate -> {
            val committed = url?.substringBefore('#')
            if (committed != null) {
                loadUrl(committed + navigation.fragment)
            } else {
                // No committed URL means nothing is loaded to hang a fragment off. The caller's
                // documentReady guard should make this unreachable; load the page rather than
                // leave the sheet on a skeleton if it ever is not.
                loadUrl(navigation.fullUrl)
            }
        }
    }
}
