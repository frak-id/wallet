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
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.CoroutineContext

/**
 * The sheet's behaviour, kept out of the composable since the ordering rules here are sequencing-sensitive.
 *
 * Confined to [scope]'s dispatcher — Main in production, the test scheduler under test. The only
 * work that leaves it is the session build and the load-deadline wait, which run on [workContext]
 * and hop back through [stateContext] before touching anything here. Nothing in this class, or in
 * the [SharingOutcome] it owns, is safe to reach from anywhere else.
 */
@Stable
internal class SharingSheetState(
    /** The host's scope, not the sheet's: an in-flight `track()` or an open chooser must outlive the sheet. */
    private val scope: CoroutineScope,
    /** The application context; the web view gets an Activity one from [SharingWebViewPool]. */
    private val context: Context,
    private val sessionId: String,
    onFinished: (SharingResult) -> Unit,
    private val trace: SharingTrace = SharingTrace(),
    /**
     * Where the build runs. Off the main thread deliberately: [scope] is main-confined, so there it
     * queued behind the sheet's entry animation. Tests override it with `EmptyCoroutineContext`.
     */
    private val workContext: CoroutineContext = Dispatchers.Default,
    /** Set when the view was handed a finished warm page, so the session can activate by fragment. */
    private val activationBaseUrl: String? = null,
    private val dependencies: SharingDependencies = FrakClientDependencies,
) {
    var session: SharingSession? by mutableStateOf(null)
        private set

    var failure: FrakError? by mutableStateOf(null)
        private set

    /**
     * Whether the page has painted; drives the skeleton over the web view. Latches, so a later
     * same-session navigation cannot put the skeleton back.
     *
     * Starts false even on a warm view: a pooled view is never in a window while it warms, so a
     * finished warm document has drawn nothing and uncovering it shows a blank web view.
     */
    var pageVisible: Boolean by mutableStateOf(false)
        private set

    /**
     * Set only by a renderer crash after the page had painted. The sheet then paints an opaque
     * surface, since the transparent web view would otherwise leave a see-through hole.
     */
    var contentLost: Boolean by mutableStateOf(false)
        private set

    /** Document-finished. Observable so the sheet can bound how long its skeleton waits for a paint signal. */
    var pageLoaded: Boolean by mutableStateOf(false)
        private set

    private var webView: WebView? = null

    /** Completes on first paint ([onPageReady]) or a terminal outcome, on one budget spanning build + load. */
    private val contentSettled = CompletableDeferred<Unit>()

    private val outcome =
        SharingOutcome(scope) { result ->
            // Every report settles the budget first: whatever it was waiting for is moot now.
            settleContent()
            onFinished(result)
        }

    private val builder =
        SharingSessionBuilder(
            dependencies = dependencies,
            packageId = context.packageName,
            sessionId = sessionId,
            trace = trace,
        )

    /**
     * The page's buttons that are mid-round-trip. The footer stays enabled throughout, so without
     * this a second tap stacks a second chooser, or bills a second reward-bearing interaction, or
     * fetches a second install page to race the first one's navigation on the one shared web view.
     */
    private val claimed = mutableSetOf<SharingPageAction>()

    /** [onPageUnavailable] has to tell a failed install page apart from a failed sharing page. */
    private var showingInstallPage = false

    /** Tier-3 fallback fires once: the load deadline and a main-frame error genuinely race offline. */
    private var fellBack = false

    /** Set once the load-deadline budget passes; the build checks it so a merely-slow one still lands on tier 3. */
    private var deadlineExpired = false

    private var prepareStarted = false

    private var navigated = false

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * [scope]'s own dispatcher, so work dispatched to [workContext] can come back on-thread before
     * it touches anything here. A no-op hop when the two share an interceptor, which is what tests
     * pass and what keeps them free of an extra dispatch.
     */
    private val stateContext: CoroutineContext = scope.coroutineContext.minusKey(Job)

    /**
     * Idempotent. Started from the merchant's click handler before any sheet exists, so a rotation
     * that rebuilds the composition must not restart the build.
     */
    fun prepare(request: SharingRequest) {
        if (prepareStarted) return
        prepareStarted = true
        scope.launch(workContext) {
            trace.mark("  prepare running")
            val built =
                if (Frak.isInitialized) {
                    builder.build(request)
                } else {
                    SharingBuild.Unavailable(FrakError.NotInitialized())
                }
            withContext(stateContext) { onBuilt(built) }
        }
    }

    private fun onBuilt(built: SharingBuild) {
        when (built) {
            is SharingBuild.Unavailable -> {
                failure = built.error
                fail(built.error)
            }

            is SharingBuild.Ready -> {
                // A budget that expired while this resolved, and a session that will never have a
                // page (cold cache, no network), both land on tier 3.
                if (deadlineExpired || !built.session.hasPage) {
                    fallBack(built.session)
                } else {
                    session = built.session
                    // Navigated here rather than from a LaunchedEffect, whose body waits on a frame
                    // clock busy building the sheet's window and attaching the web view.
                    loadSessionUrl()
                }
            }
        }
    }

    /** Bounds tap-to-content: [prepare] start to page painted or terminal outcome. See [contentSettled]. */
    suspend fun awaitLoadDeadline(deadlineMillis: Long) {
        val arrivedInTime = withTimeoutOrNull(deadlineMillis) { contentSettled.await() }
        if (arrivedInTime == null) withContext(stateContext) { onLoadDeadline() }
    }

    /** Starts [awaitLoadDeadline] off the caller's thread, so the budget is not measured by a congested Main. */
    fun startLoadDeadline(deadlineMillis: Long) {
        scope.launch(workContext) { awaitLoadDeadline(deadlineMillis) }
    }

    /** Gives this state the view it will drive, before the sheet composes. */
    fun attach(view: WebView) {
        if (webView === view) return
        webView = view
        loadSessionUrl()
    }

    /** Navigates to the session's page once both halves exist, and at most once. */
    private fun loadSessionUrl() {
        val view = webView ?: return
        val navigation = pageNavigation(confirmed = false) ?: return
        if (navigated) return
        navigated = true
        // Handler(mainLooper), not View.post: the pooled view is still detached at this point, and
        // View.post would park the runnable until the sheet attaches it to a window.
        if (Looper.myLooper() == Looper.getMainLooper()) {
            view.navigate(navigation)
        } else {
            mainHandler.post { view.navigate(navigation) }
        }
    }

    /** Every navigation goes through here, preferring a same-document activation over a full load. */
    private fun pageNavigation(confirmed: Boolean): SharingNavigation? =
        session?.navigation(
            confirmed = confirmed,
            // Not the handle's tracked value: only this sheet knows it navigated to the install page.
            currentBaseUrl = if (showingInstallPage) null else activationBaseUrl,
        )

    /** Drops the view reference. Does not destroy it — the view belongs to [SharingWebViewPool]. */
    fun release() {
        webView = null
    }

    fun onPageReady() {
        pageLoaded = true
        settleContent()
    }

    /**
     * Stops the tap-to-content budget: whatever it was waiting for has happened, or has been
     * overtaken by the user. Idempotent — [CompletableDeferred.complete] answers false the second
     * time — and it only stops [awaitLoadDeadline] from firing, never anything already in flight.
     */
    private fun settleContent() {
        contentSettled.complete(Unit)
    }

    /** The page has painted. Distinct from [onPageReady], which fires at document-finished. */
    fun onPageVisible() {
        pageVisible = true
    }

    /**
     * Past this the page is treated as unavailable. [session] may not exist yet, so this records
     * [deadlineExpired] instead of falling back.
     */
    fun onLoadDeadline() {
        if (pageLoaded) return
        val active = session
        if (active != null) fallBack(active) else deadlineExpired = true
    }

    /** Claims one of the page's buttons for its round trip. False when that button is already in flight. */
    private fun claim(action: SharingPageAction): Boolean = claimed.add(action)

    /** Raises the chooser, then attributes the share. */
    fun share() {
        val active = session ?: return
        if (!claim(SharingPageAction.Share)) return
        outcome.launch {
            if (!NativeShare.share(context, active.link, active.shareTitle)) {
                // Released here, unlike the success path: no chooser came up, so the user can retry.
                claimed.remove(SharingPageAction.Share)
                return@launch
            }
            // Tracked when the chooser opens rather than on completion: this is the reward-bearing
            // interaction, and it pays out for anyone who opened the chooser and backed out.
            track()
            confirm(SharingResult.Shared(active.link))
            // The claim is kept: the confirmation screen has no Share button, and ShareAgain is what
            // reopens the flow.
        }
    }

    /**
     * Copies the link and attributes it. Records rather than [confirm]s: the page moves itself to
     * its own toast, and a `view=confirmation` reload here would tear that down mid-toast.
     */
    fun copy() {
        val active = session ?: return
        if (!claim(SharingPageAction.Copy)) return
        outcome.launch {
            track()
            NativeShare.copy(context, active.link)
            outcome.record(SharingResult.Copied(active.link))
        }
    }

    fun onPageAction(action: SharingPageAction) {
        // Any action at all is the page's own JS reporting a user driving a rendered document, so
        // the tap-to-content budget has been met however this session got here — a fragment
        // activation never fires `onPageFinished`, so [pageLoaded] can still be false on a warm
        // page the user is already sharing from. Without this, the deadline elapsing behind an
        // accepted chooser raises a second one and closes the sheet under it.
        settleContent()
        // And it is a paint signal by the same argument: a user cannot drive a document that is not
        // on screen. This is what replaces the skeleton's old max-hold timer — evidence rather than
        // a deadline. Not [SharingPageAction.Error], which is the page saying it rendered nothing.
        if (action != SharingPageAction.Error) onPageVisible()
        when (action) {
            SharingPageAction.Install -> {
                install()
            }

            SharingPageAction.ShareAgain -> {
                pageNavigation(confirmed = false)?.let {
                    // Reopens every button share()/copy()/install() left claimed.
                    claimed.clear()
                    // Back on the sharing page — a later load failure belongs to it again.
                    showingInstallPage = false
                    webView?.navigate(it)
                }
            }

            // The page draws the buttons; this sheet performs them — `navigator.share` does not exist
            // in a WebView, and the interaction must be signed by a keypair the page cannot reach.
            SharingPageAction.Share -> {
                share()
            }

            SharingPageAction.Copy -> {
                copy()
            }

            is SharingPageAction.Code -> {
                // The SDK owns the clipboard here since the page cannot set the sensitive flag.
                NativeShare.copyInstallCode(context, action.value, action.expiresAtSeconds)
            }

            SharingPageAction.Dismiss -> {
                finish(SharingResult.Dismissed)
            }

            SharingPageAction.Error -> {
                fail(FrakError.InternalFailure("the sharing page refused to render"))
            }

            SharingPageAction.Ready -> {
                trace.mark("page reported ready")
                // Settles the tier-3 deadline as well as the skeleton: a fragment activation is a
                // same-document navigation and may never produce an `onPageFinished`.
                onPageReady()
                onPageVisible()
            }
        }
    }

    private fun install() {
        val current = session ?: return
        if (!claim(SharingPageAction.Install)) return
        outcome.launch {
            // In-sheet, not to the store: that page owns install code, store link and
            // installed-wallet routing.
            val page = guarded { dependencies.installPageUrl(current.returnScheme, sessionId) }
            if (page == null) {
                // No identity or merchant to hand the install page — fall back to the store.
                guarded { dependencies.openFrakApp() }
                finish(SharingResult.InstallStarted)
                return@launch
            }
            webView?.loadUrl(page)
            showingInstallPage = true
            outcome.record(SharingResult.InstallStarted)
        }
    }

    /** A broken or unreachable page must never be shown; same fallback [onLoadDeadline] uses. */
    fun onPageUnavailable() {
        // A failed install page: already shared, so reload the confirmation screen instead of
        // raising a tier-3 chooser.
        if (showingInstallPage) {
            // Computed before the flag is cleared: the view is on the failed install page, not the
            // activated document, so a fragment hung off it would leave the user nowhere.
            val recovery = pageNavigation(confirmed = true)
            showingInstallPage = false
            // Back on a page that plausibly offers Install again, so a second tap must be able to
            // fetch a fresh one rather than stay locked out by this session's first attempt.
            claimed.remove(SharingPageAction.Install)
            recovery?.let { webView?.navigate(it) }
            return
        }
        // A renderer crash after paint: leave a dismissible sheet rather than raise an unwanted
        // chooser over one the user is looking at. Opaque, because the web view now paints nothing.
        if (pageLoaded) {
            contentLost = true
            return
        }
        session?.let(::fallBack)
    }

    /** [active].link is local; its presence, not the page's, decides whether this session can still share. */
    private fun fallBack(active: SharingSession) {
        // finish() no-ops once reported, but NativeShare would still raise a chooser over a closed sheet.
        if (outcome.isFinished) return
        // Deadline and page failure are independent triggers that both fire offline.
        if (fellBack) return
        fellBack = true
        outcome.launch {
            // Same rule as share(): pays out after the chooser, not before.
            val shared = NativeShare.share(context, active.link, active.shareTitle)
            if (shared) track()
            finish(if (shared) SharingResult.Shared(active.link) else SharingResult.Dismissed)
        }
    }

    /**
     * Where the page's own outbound links go. The wallet's own Play listing is routed through the
     * deep-link-first app open, so an already-installed wallet does not land on its store page.
     */
    fun openExternally(url: String) {
        // normalizeScheme, not a lowercase compare: Android does not fold "HTTPS:" for intent resolution either.
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

    /** Read off the URL rather than assumed: dev and production ship different package ids. */
    private fun isWalletStoreListing(url: Uri): Boolean =
        url.host.equals(PLAY_STORE_HOST, ignoreCase = true) &&
            url.getQueryParameter("id") == dependencies.environment().walletPackageId

    /** The user swiped or tapped away. Reports whatever the session achieved. */
    fun dismiss() = finish(SharingResult.Dismissed)

    /** The sheet went away with no explicit outcome. See [SharingOutcome.abandon]. */
    fun abandon() = outcome.abandon()

    /** The sheet could not be built at all. Routed through [finish] so it cannot double-report. */
    fun fail(error: FrakError) = finish(SharingResult.Failed(error))

    private fun finish(result: SharingResult) = outcome.finish(result)

    /**
     * `Frak.client`'s getter throws [FrakError.NotInitialized] once [id.frak.sdk.Frak.shutdown] has
     * run, and these calls have no exception handler between them and the merchant's process.
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
        guarded { dependencies.track(Interaction.sharing()) }
    }

    /** Moves the page to its post-share confirmation screen via a `view=confirmation` navigation. */
    private fun confirm(result: SharingResult) {
        outcome.record(result)
        val confirmed = pageNavigation(confirmed = true) ?: return // null under tier 3 (no page)
        webView?.navigate(confirmed)
    }

    private companion object {
        const val PLAY_STORE_HOST = "play.google.com"
    }
}
