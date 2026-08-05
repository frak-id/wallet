package id.frak.sdk.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject

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
) {
    val hasPage: Boolean get() = pageUrl != null

    /** Null when [hasPage] is false. Never call this without checking it first. */
    fun url(confirmed: Boolean): String? = pageUrl?.let { if (confirmed) "$it&confirmed=1" else it }
}

/** The sheet's behaviour, kept out of the composable since the ordering rules here are sequencing-sensitive. */
@Stable
internal class SharingSheetState(
    private val scope: CoroutineScope,
    private val context: Context,
    private val sessionId: String,
    private val onFinished: (SharingResult) -> Unit,
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

    private var best: SharingResult? = null
    private var webView: WebView? = null
    private var finished = false
    private var pageLoaded = false

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

    fun prepare(request: SharingRequest) {
        scope.launch {
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
                deadlineExpired -> fallBackOrFail(built)

                // build() already hit tier 3 itself (cold cache, no network) — no page will ever arrive.
                built != null && !built.hasPage -> fallBackOrFail(built)

                else -> session = built
            }
        }
    }

    /** Bounds tap-to-content: [prepare] start to page painted or terminal outcome. See [contentSettled]. */
    suspend fun awaitLoadDeadline(deadlineMillis: Long) {
        val arrivedInTime = withTimeoutOrNull(deadlineMillis) { contentSettled.await() }
        if (arrivedInTime == null) onLoadDeadline()
    }

    fun attach(view: WebView) {
        webView = view
        session?.url(confirmed = false)?.let { view.loadUrl(it) }
    }

    /** Drops the web view when the sheet leaves composition; its timers and context reference go with it. */
    fun release() {
        webView?.destroy()
        webView = null
    }

    fun onPageReady() {
        pageLoaded = true
        contentSettled.complete(Unit)
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
                session?.url(confirmed = false)?.let {
                    // Reopens the guards share()/copy() left set.
                    shareInFlight = false
                    copyInFlight = false
                    // Back on the sharing page — a later load failure belongs to it again.
                    showingInstallPage = false
                    webView?.loadUrl(it)
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
        }
    }

    /** A broken or unreachable page must never be shown; same fallback [onLoadDeadline] uses. */
    fun onPageUnavailable() {
        // A failed install page: tier-3 fallback is wrong here (already shared), so reload the
        // confirmation screen instead — it has its own share-again/install controls.
        if (showingInstallPage) {
            showingInstallPage = false
            session?.url(confirmed = true)?.let { webView?.loadUrl(it) }
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
        val confirmedUrl = session?.url(confirmed = true) ?: return // null under tier 3 (no page)
        webView?.loadUrl(confirmedUrl)
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
        val clientId = anonymousId()
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

        // Seeds the page's headline on first frame from the reward cache, bounded so a cold
        // cache can't turn it into a delay. catch(FrakError), not runCatching, to avoid
        // swallowing this composition's own CancellationException on mid-seed teardown. Scoped
        // like the page's own selection so the two never disagree on a product-gated campaign.
        val scopedProducts = request.products.mapNotNull { it.details }.ifEmpty { null }
        val seededReward =
            withTimeoutOrNull(SEED_TIMEOUT_MILLIS) {
                try {
                    bestReward(request.targetInteraction, scopedProducts)?.formatted
                } catch (unavailable: FrakError) {
                    null
                }
            }

        return SharingSession(
            walletOrigin = walletOrigin,
            returnScheme = SharingPageUrl.returnScheme(packageId),
            link = link,
            shareTitle = config.sdkConfig?.name ?: config.name,
            pageUrl =
                SharingPageUrl.build(
                    walletOrigin = walletOrigin,
                    merchantId = config.merchantId,
                    clientId = clientId,
                    packageId = packageId,
                    sessionId = sessionId,
                    appName = config.sdkConfig?.name ?: config.name,
                    logoUrl = request.logoUrl ?: config.sdkConfig?.logoUrl,
                    link = request.link ?: request.products.firstOrNull()?.link,
                    products = productsJson(request),
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
        /** How long the reward seed may delay the sheet. Past this the page fetches it itself. */
        const val SEED_TIMEOUT_MILLIS = 150L

        /** Host of the store listing the install page links to. */
        const val PLAY_STORE_HOST = "play.google.com"
    }
}
