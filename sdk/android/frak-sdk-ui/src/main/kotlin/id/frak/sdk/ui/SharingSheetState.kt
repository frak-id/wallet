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
import id.frak.sdk.OpenAppResult
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
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
        val full = pageUrl?.let { if (confirmed) "$it&confirmed=1" else it } ?: return null
        val warm = warmBaseUrl
        val fragment = activationFragment
        if (warm != null && fragment != null && currentBaseUrl == warm) {
            return SharingNavigation.Activate(
                fragment = if (confirmed) "$fragment&confirmed=1" else fragment,
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
 * the page's router normalises its own search params on load (`native=1` becomes `native=true`,
 * an absent `confirmed` becomes `confirmed=false`), so the address bar has moved before the user
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
    private val scope: CoroutineScope,
    private val context: Context,
    private val sessionId: String,
    private val onFinished: (SharingResult) -> Unit,
    /** Milestones inside [build], which device traces showed to be the largest share of tap-to-paint. */
    private val trace: SharingTrace = SharingTrace(),
    /**
     * Where [build] runs.
     *
     * Off the composition's Main scope deliberately. [scope] is `rememberCoroutineScope()`, whose
     * dispatcher drives work from the choreographer frame callback — so on Main this coroutine
     * queued behind the sheet's entry animation and the web view's first layout and did not start
     * for 203-430ms on device. Everything it calls does its own IO dispatching; the Compose state
     * it writes ([session], [failure]) is snapshot state and safe to write from any thread.
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
    // Individually injected and resolved lazily, since Frak.initialize may not have run yet
    // when this is constructed.
    private val buildSharingLink: suspend (SharingRequest) -> String? = { Frak.client.sharing.buildLink(it) },
    private val anonymousId: suspend () -> String? = { Frak.client.anonymousId() },
    private val environment: () -> FrakEnvironment = { Frak.client.environment },
    private val resolveConfig: suspend () -> FrakResolvedConfig = { Frak.client.config.resolve() },
    private val bestReward: suspend (String?, List<ProductDetails>?) -> BestReward? =
        { targetInteraction, products ->
            Frak.client.rewards.best(targetInteraction = targetInteraction, products = products)
        },
    private val track: suspend (Interaction) -> FrakResult<Unit> = { Frak.client.tracking.track(it) },
    private val installPageUrl: suspend (String, String) -> String? =
        { returnScheme, sid -> Frak.client.appLink.installPageUrl(returnScheme, sid) },
    private val openFrakApp: suspend () -> OpenAppResult = { Frak.client.appLink.openFrakApp() },
) {
    var session: SharingSession? by mutableStateOf(null)
        private set

    var failure: FrakError? by mutableStateOf(null)
        private set

    /**
     * Whether the hosted page has actually painted. Drives the skeleton that covers the web
     * view until then.
     *
     * Latches: once the page has been seen, a later same-session navigation (the `confirmed=1`
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

    private var best: SharingResult? = null
    private var webView: WebView? = null
    private var finished = false

    /** Document-finished. Observable so the sheet can bound how long its skeleton waits for a paint signal. */
    var pageLoaded: Boolean by mutableStateOf(false)
        private set

    /** True between the page's share press and its outcome. */
    private var shareInFlight = false

    /** The [copy] half of [shareInFlight]: two taps would bill two interactions for one copy. */
    private var copyInFlight = false

    /**
     * True once the sheet has left the sharing page for the wallet's install page.
     *
     * A plain field, not `mutableStateOf`: nothing renders off it. It survives because
     * [onPageUnavailable] has to tell a failed install page apart from a failed sharing page —
     * both reach it identically but need opposite answers.
     */
    private var showingInstallPage = false

    /**
     * Guards tier-3 fallback to fire once. [finished] doesn't suffice: it's set only after the
     * chooser has been raised and the share attributed, so two fallbacks racing that window
     * both pass it. The deadline and a main-frame error can genuinely race (both fire offline).
     */
    private var fallbackFired = false

    /** Completes once [session] is known: built, or un-buildable ([failure] set instead). Not what [awaitLoadDeadline] races — see [contentSettled]. */
    private val resolved = CompletableDeferred<Unit>()

    /**
     * Completes when the page paints ([onPageReady]) or a terminal outcome hits ([finish]).
     * What [awaitLoadDeadline] races against, on one budget spanning build + resolve + page
     * load, so a fast build and a slow page can't each stay under budget while together
     * blowing it.
     */
    private val contentSettled = CompletableDeferred<Unit>()

    /** Set once the load-deadline budget passes; [prepare] checks it so a merely-slow build still lands on tier 3. */
    private var deadlineExpired = false

    /** Guards [prepare], which is started from composition rather than an effect. */
    private var prepareStarted = false

    /** Guards [loadSessionUrl] so the session's page is navigated to exactly once. */
    private var sessionLoaded = false

    /** The hop back to the web view's own thread from [workContext]. See [loadSessionUrl]. */
    private val mainHandler = Handler(Looper.getMainLooper())

    /** Idempotent: the sheet starts this during composition, so a recomposition must not re-enter it. */
    fun prepare(request: SharingRequest) {
        if (prepareStarted) return
        prepareStarted = true
        scope.launch(workContext) {
            // Distance from "sheet opened" is scheduling overhead, not work. See [workContext].
            trace.mark("  prepare running")
            if (!Frak.isInitialized) {
                failure = FrakError.NotInitialized()
                resolved.complete(Unit)
                return@launch
            }
            // Catch-all: an unexpected throw from build() still records a failure instead of
            // leaving a spinner forever. CancellationException rethrows untouched.
            val built =
                try {
                    build(request)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (unexpected: Throwable) {
                    if (failure == null) {
                        failure = FrakError.Decoding("the sharing sheet could not be prepared")
                    }
                    throw unexpected
                } finally {
                    resolved.complete(Unit)
                }
            when {
                // Budget already expired while this was resolving; onLoadDeadline had no session yet to fall back with.
                deadlineExpired -> {
                    fallBackOrFail(built)
                }

                // build() already hit tier 3 itself (cold cache, no network) — no page will ever arrive.
                built != null && !built.hasPage -> {
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
        if (sessionLoaded) return
        val view = webView ?: return
        val navigation = pageNavigation(confirmed = false) ?: return
        sessionLoaded = true
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
        if (shareInFlight) return
        shareInFlight = true
        scope.launch {
            // Nothing took the intent.
            if (!NativeShare.share(context, active.link, active.shareTitle)) {
                // Cleared here, unlike the success path: no chooser came up, so the user must
                // be able to try again.
                shareInFlight = false
                return@launch
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
     * itself to its confirmation toast on its own button press, and a `confirmed=1` reload here
     * would tear that down mid-toast.
     */
    fun copy() {
        val active = session ?: return
        if (copyInFlight) return
        copyInFlight = true
        scope.launch {
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
                scope.launch {
                    // Navigates to the wallet's install page in-sheet rather than to the
                    // store; that page owns install code / store link / installed-wallet
                    // routing.
                    val current = session ?: return@launch
                    val page = installPageUrl(current.returnScheme, sessionId)
                    if (page == null) {
                        // No identity/merchant to hand the install page — falls back to the
                        // store. Reported only after the open, since finishing first could
                        // tear this scope down mid-call.
                        openFrakApp()
                        finish(SharingResult.InstallStarted)
                        return@launch
                    }
                    webView?.loadUrl(page)
                    showingInstallPage = true
                    record(SharingResult.InstallStarted)
                }
            }

            SharingPageAction.ShareAgain -> {
                pageNavigation(confirmed = false)?.let {
                    // Reopens the guards share()/copy() left set.
                    shareInFlight = false
                    copyInFlight = false
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
        // chooser on top of a sheet in use; leave a dismissible blank sheet instead.
        if (pageLoaded) return
        val active = session ?: return
        fallBackOrFail(active)
    }

    /** [active].link is 100% local; its presence, not the page's, decides whether this session can still share. */
    private fun fallBackOrFail(active: SharingSession?) {
        if (fallbackFired) return // deadline and page failure are independent triggers that both fire offline
        // finish() no-ops once reported, but NativeShare would still raise a chooser for a
        // sheet the user has closed.
        if (finished) return
        fallbackFired = true
        if (active == null) {
            failure?.let(::fail)
            return
        }
        scope.launch {
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
            scope.launch { openFrakApp() }
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, parsed).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    /** True only for this environment's own Play listing; dev and production ship different package ids, so it's read off the URL rather than assumed. */
    private fun isWalletStoreListing(url: Uri): Boolean =
        url.host.equals(PLAY_STORE_HOST, ignoreCase = true) &&
            url.getQueryParameter("id") == environment().walletPackageId

    /** The user swiped or tapped away. Reports whatever the session achieved. */
    fun dismiss() = finish(SharingResult.Dismissed)

    /** The sheet could not be built at all. Routed through [finish] so it cannot double-report. */
    fun fail(error: FrakError) = finish(SharingResult.Failed(error))

    /** Suspends until the event is durable. See [share]. */
    private suspend fun track() {
        track(Interaction.Sharing())
    }

    /**
     * Moves the page to its post-share confirmation screen via a `confirmed=1` reload — only
     * this sheet learns whether a chooser actually came up, and the page's own confirmation
     * state has to survive the user leaving and coming back.
     */
    private fun confirm(result: SharingResult) {
        record(result)
        val confirmed = pageNavigation(confirmed = true) ?: return // null under tier 3 (no page)
        webView?.navigate(confirmed)
    }

    private fun record(result: SharingResult) {
        val current = best
        if (current == null || result.significance > current.significance) best = result
    }

    /** Reports once. A session can produce several outcomes; the caller gets the most significant. */
    private fun finish(result: SharingResult) {
        if (finished) return
        finished = true
        contentSettled.complete(Unit) // every terminal outcome funnels through here
        record(result)
        onFinished(best ?: result)
    }

    /** Null only when there's nothing to share (no identity/merchant); a later resolveConfig failure still returns a no-page session, never null. */
    private suspend fun build(request: SharingRequest): SharingSession? {
        val link = buildSharingLink(request)
        trace.mark("  link built")
        val clientId = anonymousId()
        trace.mark("  identity ready")
        if (link == null || clientId == null) {
            failure = FrakError.MerchantResolutionFailed("no anonymous id or merchant to build a sharing link from")
            return null
        }

        val walletOrigin = environment().wallet
        val packageId = context.packageName
        val config =
            try {
                resolveConfig()
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
                    bestReward(request.targetInteraction, scopedProducts)?.formatted
                } catch (unavailable: FrakError) {
                    null
                }
            }
        trace.mark("  reward seeded")

        val appName = config.sdkConfig?.name ?: config.name
        val requestLogoUrl = request.logoUrl
        return SharingSession(
            walletOrigin = walletOrigin,
            returnScheme = SharingPageUrl.returnScheme(packageId),
            link = link,
            shareTitle = appName,
            pageUrl =
                SharingPageUrl.build(
                    walletOrigin = walletOrigin,
                    merchantId = config.merchantId,
                    clientId = clientId,
                    packageId = packageId,
                    sessionId = sessionId,
                    appName = appName,
                    logoUrl = requestLogoUrl ?: config.sdkConfig?.logoUrl,
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
                    merchantId = config.merchantId,
                    clientId = clientId,
                    packageId = packageId,
                    appName = appName,
                    logoUrl = config.sdkConfig?.logoUrl,
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

        /** Host of the store listing the install page links to. */
        const val PLAY_STORE_HOST = "play.google.com"
    }
}

/**
 * Performs a [SharingNavigation].
 *
 * The activation case reads [android.webkit.WebView.getUrl] rather than using the URL we warmed
 * the view with, and that is the whole fix: the sharing page's router normalises its own search
 * params on load (`native=1` becomes `native=true`, an absent `confirmed` becomes
 * `confirmed=false`), so by the time anyone taps, the document has moved somewhere we never
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
