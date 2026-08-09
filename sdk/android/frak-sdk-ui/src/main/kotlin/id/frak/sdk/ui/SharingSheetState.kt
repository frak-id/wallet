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
 * Resolved once before anything can be shown. [link] is local and always usable; a null page URL
 * is the tier-3 fallback (native share sheet, no page), not a broken session.
 */
internal class SharingSession(
    val walletOrigin: String,
    val returnScheme: String,
    val link: String,
    val shareTitle: String?,
    private val pageUrl: String?,
    /** The warm page this session's params can be hung off, if the view is actually showing it. */
    val warmBaseUrl: String? = null,
    private val activationFragment: String? = null,
) {
    val hasPage: Boolean get() = pageUrl != null

    /** How the view should get to this session's page. Null when [hasPage] is false. */
    fun navigation(
        confirmed: Boolean,
        currentBaseUrl: String? = null,
    ): SharingNavigation? {
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
 * How to get the page in front of the user. A warmed document's URL is not the URL it was warmed
 * on — the page's router normalises its own search params on load — so an activation is a fragment
 * change on whatever is committed, never a rebuilt URL.
 */
internal sealed interface SharingNavigation {
    data class Load(
        val url: String,
    ) : SharingNavigation

    /** A fragment set on whatever document is loaded, which is the only same-document option. */
    data class Activate(
        val fragment: String,
        val fullUrl: String,
    ) : SharingNavigation
}

/** The sheet's behaviour, kept out of the composable since the ordering rules here are sequencing-sensitive. */
@Stable
internal class SharingSheetState(
    /** The host's scope, not the sheet's: an in-flight `track()` or an open chooser must outlive the sheet. */
    private val scope: CoroutineScope,
    /** The application context; the web view gets an Activity one from [SharingWebViewPool]. */
    private val context: Context,
    private val sessionId: String,
    private val onFinished: (SharingResult) -> Unit,
    private val trace: SharingTrace = SharingTrace(),
    /**
     * Where [build] runs. Off the main thread deliberately: [scope] is main-confined, so there it
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
     * same-session navigation cannot put the skeleton back, and starts true for a warm page.
     */
    var pageVisible: Boolean by mutableStateOf(activationBaseUrl != null)
        private set

    /**
     * Set only by a renderer crash after the page had painted. The sheet then paints an opaque
     * surface, since the transparent web view would otherwise leave a see-through hole.
     */
    var contentLost: Boolean by mutableStateOf(false)
        private set

    /**
     * The latches below are atomics, not plain `var`s: [workContext] and `Main.immediate` both reach
     * them, and a check-then-act has an interleaving where two callers pass.
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

    /** [onPageUnavailable] has to tell a failed install page apart from a failed sharing page. */
    @Volatile
    private var showingInstallPage = false

    /** Tier-3 fallback fires once: the load deadline and a main-frame error genuinely race offline. */
    private val fallbackFired = AtomicBoolean(false)

    /** Completes on first paint ([onPageReady]) or a terminal outcome, on one budget spanning build + load. */
    private val contentSettled = CompletableDeferred<Unit>()

    /** Set once the load-deadline budget passes; [prepare] checks it so a merely-slow build still lands on tier 3. */
    @Volatile
    private var deadlineExpired = false

    private val prepareStarted = AtomicBoolean(false)

    private val sessionLoaded = AtomicBoolean(false)

    /** Outcome-deciding coroutines still running; [abandon] must not report over them. */
    private val attributionsInFlight = AtomicInteger(0)

    /** Set by [abandon] when it had to defer to [attributionsInFlight]. */
    private val abandonRequested = AtomicBoolean(false)

    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Idempotent. Started from the merchant's click handler before any sheet exists, so a rotation
     * that rebuilds the composition must not restart the build.
     */
    fun prepare(request: SharingRequest) {
        if (!prepareStarted.compareAndSet(false, true)) return
        scope.launch(workContext) {
            trace.mark("  prepare running")
            if (!Frak.isInitialized) {
                fail(FrakError.NotInitialized())
                return@launch
            }
            // Catch-all: this coroutine has no exception handler between it and the merchant's
            // process, so an unexpected throw reports rather than propagating.
            val built =
                try {
                    buildWithinBudget(request)
                } catch (cancelled: CancellationException) {
                    throw cancelled
                } catch (unexpected: Throwable) {
                    fail(
                        failure
                            ?: unexpected as? FrakError
                            ?: FrakError.InternalFailure("the sharing sheet could not be prepared"),
                    )
                    return@launch
                }
            when {
                // Budget expired while this resolved; onLoadDeadline had no session to fall back with.
                deadlineExpired -> {
                    fallBackOrFail(built)
                }

                // No page will ever arrive (cold cache, no network), or the build itself timed out.
                built == null || !built.hasPage -> {
                    fallBackOrFail(built)
                }

                else -> {
                    session = built
                    // Navigated here rather than from a LaunchedEffect, whose body waits on a frame
                    // clock busy building the sheet's window and attaching the web view.
                    loadSessionUrl()
                }
            }
        }
    }

    /**
     * [build] under a hard ceiling, so a `resolveConfig()` that hangs rather than throws still reports.
     * A liveness backstop, not a second UX budget — tier 3 enforces the user-facing one.
     */
    private suspend fun buildWithinBudget(request: SharingRequest): SharingSession? {
        val built = withTimeoutOrNull(BUILD_DEADLINE_MILLIS) { build(request) }
        // build() sets `failure` itself when it has nothing to share; still null means the budget expired.
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
        // [attach] (Main) and the tail of [prepare] ([workContext]) both reach here.
        if (!sessionLoaded.compareAndSet(false, true)) return
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
        contentSettled.complete(Unit)
    }

    /** The page has painted. Distinct from [onPageReady], which fires at document-finished. */
    fun onPageVisible() {
        pageVisible = true
    }

    /**
     * Past this the page is treated as unavailable. [session] may not exist yet, so this records
     * [deadlineExpired] instead of delegating to [onPageUnavailable].
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
        // The page's footer stays enabled through the round trip; a second tap would stack a second
        // chooser and bill a second reward-bearing interaction.
        if (!shareInFlight.compareAndSet(false, true)) return
        launchAttribution {
            if (!NativeShare.share(context, active.link, active.shareTitle)) {
                // Cleared here, unlike the success path: no chooser came up, so the user can retry.
                shareInFlight.set(false)
                return@launchAttribution
            }
            // Tracked when the chooser opens rather than on completion: this is the reward-bearing
            // interaction, and it pays out for anyone who opened the chooser and backed out.
            track()
            confirm(SharingResult.Shared(active.link))
            // shareInFlight is not cleared: the confirmation screen has no Share button, and
            // ShareAgain is what reopens the flow.
        }
    }

    /**
     * Copies the link and attributes it. Records rather than [confirm]s: the page moves itself to
     * its own toast, and a `view=confirmation` reload here would tear that down mid-toast.
     */
    fun copy() {
        val active = session ?: return
        if (!copyInFlight.compareAndSet(false, true)) return
        launchAttribution {
            track()
            NativeShare.copy(context, active.link)
            record(SharingResult.Copied(active.link))
        }
    }

    fun onPageAction(action: SharingPageAction) {
        when (action) {
            SharingPageAction.Install -> {
                launchAttribution {
                    // In-sheet, not to the store: that page owns install code, store link and
                    // installed-wallet routing.
                    val current = session ?: return@launchAttribution
                    val page = guarded { dependencies.installPageUrl(current.returnScheme, sessionId) }
                    if (page == null) {
                        // No identity or merchant to hand the install page — fall back to the store.
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
                finish(SharingResult.Failed(FrakError.InternalFailure("the sharing page refused to render")))
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

    /** A broken or unreachable page must never be shown; same fallback [onLoadDeadline] uses. */
    fun onPageUnavailable() {
        // A failed install page: already shared, so reload the confirmation screen instead of
        // raising a tier-3 chooser.
        if (showingInstallPage) {
            // Computed before the flag is cleared: the view is on the failed install page, not the
            // activated document, so a fragment hung off it would leave the user nowhere.
            val recovery = pageNavigation(confirmed = true)
            showingInstallPage = false
            recovery?.let { webView?.navigate(it) }
            return
        }
        // A renderer crash after paint: leave a dismissible sheet rather than raise an unwanted
        // chooser over one the user is looking at. Opaque, because the web view now paints nothing.
        if (pageLoaded) {
            contentLost = true
            return
        }
        val active = session ?: return
        fallBackOrFail(active)
    }

    /** [active].link is local; its presence, not the page's, decides whether this session can still share. */
    private fun fallBackOrFail(active: SharingSession?) {
        // finish() no-ops once reported, but NativeShare would still raise a chooser over a closed sheet.
        if (finished.get()) return
        // Deadline and page failure are independent triggers that both fire offline.
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

    /**
     * The sheet went away with no explicit outcome, reported as a dismissal. Defers to
     * [attributionsInFlight] so it cannot beat a real outcome that is still resolving to [finish].
     */
    fun abandon() {
        abandonRequested.set(true)
        if (attributionsInFlight.get() == 0) finish(SharingResult.Dismissed)
    }

    /**
     * Launches work that decides or records this session's outcome, tracked so [abandon] can wait
     * for it. Everything ending in a [record] or a [finish] has to go through here.
     */
    private fun launchAttribution(block: suspend () -> Unit) {
        // Incremented before the launch: `abandon` could otherwise run between the two and report
        // over work that is about to start.
        attributionsInFlight.incrementAndGet()
        scope.launch {
            try {
                block()
            } finally {
                // Only ever supplies the dismissal `abandon` deferred; `finish` no-ops if the block
                // already reported one.
                if (attributionsInFlight.decrementAndGet() == 0 && abandonRequested.get()) {
                    finish(SharingResult.Dismissed)
                }
            }
        }
    }

    /** The sheet could not be built at all. Routed through [finish] so it cannot double-report. */
    fun fail(error: FrakError) = finish(SharingResult.Failed(error))

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
        record(result)
        val confirmed = pageNavigation(confirmed = true) ?: return // null under tier 3 (no page)
        webView?.navigate(confirmed)
    }

    /**
     * Keeps the most significant outcome seen so far. `updateAndGet`, not read-then-write: Main and
     * [workContext] both record, and a lost update is a share reported as a dismissal.
     */
    private fun record(result: SharingResult) {
        best.updateAndGet { current ->
            if (current == null || result.significance > current.significance) result else current
        }
    }

    /** Reports once. A session can produce several outcomes; the caller gets the most significant. */
    private fun finish(result: SharingResult) {
        if (!finished.compareAndSet(false, true)) return
        contentSettled.complete(Unit)
        record(result)
        onFinished(best.get() ?: result)
    }

    /** Null only when there is nothing to share; a failed `resolveConfig` still returns a no-page session. */
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
                // Tier 3: the link stands alone. `failure` is deliberately not set — a no-page session,
                // not a failed one.
                return SharingSession(
                    walletOrigin = walletOrigin,
                    returnScheme = SharingPageUrl.returnScheme(packageId),
                    link = link,
                    shareTitle = null,
                    pageUrl = null,
                )
            }
        trace.mark("  config resolved")

        // Seeds the page's headline so it opens on content. Opportunistic: sized for a cache hit, and
        // on a miss the page fetches the same value itself. Scoped like the page's own selection so
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
            // Rebuilt from the same resolved config as pageUrl. If the pool warmed against anything
            // else the strings differ, and the session does a full load instead of activating.
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
                    // Only when the request overrides the config: the warm URL already carries the
                    // config's own logo.
                    logoUrl = requestLogoUrl,
                    seededReward = seededReward,
                ),
        )
    }

    /**
     * Null rather than `[]` when empty — the page skips the card section on null and renders an
     * empty one on `[]`. Mirrored in iOS's `sharingPageProductsJSON` (SharingSheetLogic.swift); keep both in step.
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
                // finiteOrNull: JSONObject.put throws on NaN/Infinity, which would crash this launch.
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
        /** Sized for a cache hit and nothing more; a miss needs the network, which the page does itself. */
        const val SEED_TIMEOUT_MILLIS = 40L

        /** Hard ceiling on [build]. A liveness backstop, sized never to fire on a merely slow device. */
        const val BUILD_DEADLINE_MILLIS = 8_000L

        const val PLAY_STORE_HOST = "play.google.com"
    }
}

/**
 * Performs a [SharingNavigation]. The activation case hangs the fragment off the committed URL
 * rather than the one the view was warmed with — the page rewrites its own search params on load,
 * so they differ, and only a fragment-only change resolves same-document.
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
                // Nothing loaded to hang a fragment off; load the page rather than leave a skeleton.
                loadUrl(navigation.fullUrl)
            }
        }
    }
}
