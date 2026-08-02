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
import id.frak.sdk.FrakClient
import id.frak.sdk.core.FrakError
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
 * The share, resolved once before anything can be shown. [link] is 100% local
 * ([FrakClient.buildSharingLink]) and survives a cold cache/no network; [pageUrl]
 * needs the network and can legitimately be null — that's the tier-3 fallback
 * (native share sheet, no page), not a broken session.
 */
internal class SharingSession(
    val walletOrigin: String,
    val returnScheme: String,
    /** The share link itself, built locally. Usable even when [pageUrl] is not. */
    val link: String,
    val shareTitle: String?,
    /** Null when the hosted page could not be resolved — see the class doc. */
    private val pageUrl: String?,
) {
    /** Whether there is a page to load at all. */
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
    private val onCopyConfirmed: () -> Unit,
    // Overridable for tests without touching the process-global `Frak` singleton;
    // resolved lazily since Frak.initialize may not have run when this is constructed.
    private val client: () -> FrakClient = { Frak.client },
) {
    var session: SharingSession? by mutableStateOf(null)
        private set

    var failure: FrakError? by mutableStateOf(null)
        private set

    private var best: SharingResult? = null
    private var webView: WebView? = null
    private var finished = false
    private var pageLoaded = false

    /**
     * Tier-3 commits once. [finished] can't stand in: it's set only after `track()`
     * suspends and the chooser is raised, so two fallbacks racing that window both
     * pass it. The deadline and a main-frame error genuinely race (both fire when
     * offline), and without this guard both interactions get queued and two
     * choosers stack on the user.
     */
    private var fallbackFired = false

    /** Completes once [session] is known: built, or un-buildable ([failure] set instead). Not what [awaitLoadDeadline] races — see [contentSettled]. */
    private val resolved = CompletableDeferred<Unit>()

    /**
     * Completes when the user has something: page painted ([onPageReady]) or a
     * terminal outcome ([finish]). What [awaitLoadDeadline] races — one budget
     * spanning build + resolve + page load, so a fast build and slow page can't
     * each individually stay under budget while together blowing it.
     */
    private val contentSettled = CompletableDeferred<Unit>()

    /** Set once the load-deadline budget passes; [prepare] checks it so a merely-slow build still lands on tier 3. */
    private var deadlineExpired = false

    fun prepare(request: SharingRequest) {
        scope.launch {
            if (!Frak.isInitialized) {
                failure = FrakError.NotInitialized
                resolved.complete(Unit)
                return@launch
            }
            // Catch-all so an unexpected throw from `build` still records a failure
            // instead of leaving a spinner forever; CancellationException rethrows untouched.
            val built =
                try {
                    build(client(), request)
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

    /** Drops the web view when the sheet leaves composition, so its timers and context reference go with it. */
    fun release() {
        webView?.destroy()
        webView = null
    }

    fun onPageReady() {
        pageLoaded = true
        contentSettled.complete(Unit)
    }

    /**
     * Past this, the page is treated as unavailable rather than shown late. [session]
     * may not exist yet ([awaitLoadDeadline] also covers `build()` itself), so this
     * can't unconditionally delegate to [onPageUnavailable]; sets [deadlineExpired] instead.
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

    /** Interaction is awaited before the chooser opens (not launched alongside): Android may kill the host while it's foregrounded. */
    fun share() {
        val active = session ?: return
        scope.launch {
            track()
            // Nothing took the intent.
            if (!NativeShare.share(context, active.link, active.shareTitle)) {
                return@launch
            }
            confirm(SharingResult.Shared(active.link))
        }
    }

    /** Copies the link, then tells the page it happened. */
    fun copy() {
        val active = session ?: return
        scope.launch {
            track()
            if (NativeShare.copy(context, active.link)) onCopyConfirmed()
            confirm(SharingResult.Copied(active.link))
        }
    }

    fun onPageAction(action: SharingPageAction) {
        when (action) {
            SharingPageAction.Install -> {
                // Reported only after the open is attempted; finishing first could tear this scope down mid-call.
                scope.launch {
                    client().openFrakApp()
                    finish(SharingResult.InstallStarted)
                }
            }

            SharingPageAction.ShareAgain -> {
                session?.url(confirmed = false)?.let { webView?.loadUrl(it) }
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
        val active = session ?: return
        fallBackOrFail(active)
    }

    /** [active].link is 100% local; its presence, not the page's, decides whether this session can still share. */
    private fun fallBackOrFail(active: SharingSession?) {
        if (fallbackFired) return // deadline and page failure are independent triggers that both fire offline
        fallbackFired = true
        if (active == null) {
            failure?.let(::fail)
            return
        }
        scope.launch {
            track()
            val shared = NativeShare.share(context, active.link, active.shareTitle)
            finish(if (shared) SharingResult.Shared(active.link) else SharingResult.Dismissed)
        }
    }

    fun openExternally(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    /** The user swiped or tapped away. Reports whatever the session achieved. */
    fun dismiss() = finish(SharingResult.Dismissed)

    /** The sheet could not be built at all. Routed through [finish] so it cannot double-report. */
    fun fail(error: FrakError) = finish(SharingResult.Failed(error))

    /** Suspends until the event is durable. See [share]. */
    private suspend fun track() {
        client().track(Interaction.Sharing())
    }

    /** `&confirmed=1` is load-bearing: under `native=1` the page hides its own share controls without this reload. */
    private fun confirm(result: SharingResult) {
        record(result)
        session?.url(confirmed = true)?.let { webView?.loadUrl(it) } // null under tier 3 (no page)
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
    private suspend fun build(
        client: FrakClient,
        request: SharingRequest,
    ): SharingSession? {
        val link = client.buildSharingLink(request)
        val clientId = client.anonymousId
        if (link == null || clientId == null) {
            failure = FrakError.MerchantResolutionFailed("no anonymous id or merchant to build a sharing link from")
            return null
        }

        val walletOrigin = client.environment.wallet
        val packageId = context.packageName
        val config =
            try {
                client.resolveConfig()
            } catch (resolveFailed: FrakError) {
                // Tier 3: link stands on its own. `failure` deliberately NOT set —
                // this is a no-page session, not a failed one.
                return SharingSession(
                    walletOrigin = walletOrigin,
                    returnScheme = SharingPageUrl.returnScheme(packageId),
                    link = link,
                    shareTitle = null,
                    pageUrl = null,
                )
            }

        // Seeded from the reward cache so the page paints a headline on first frame; bounded so
        // a cold cache can't turn it into a delay. `catch (FrakError)` not `runCatching`, which
        // would swallow this composition's own CancellationException on mid-seed teardown.
        val seededReward =
            withTimeoutOrNull(SEED_TIMEOUT_MILLIS) {
                try {
                    client.bestReward(targetInteraction = request.targetInteraction)?.formatted
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

    /** Null rather than `[]` when empty: page skips the card section on absent, renders empty on `[]`. */
    private fun productsJson(request: SharingRequest): String? {
        if (request.products.isEmpty()) return null
        val array = JSONArray()
        for (product in request.products) {
            array.put(
                JSONObject()
                    .put("title", product.title)
                    .put("link", product.link)
                    .put("imageUrl", product.imageUrl)
                    .put("utmContent", product.utmContent),
            )
        }
        return array.toString()
    }

    private companion object {
        /** How long the reward seed may delay the sheet. Past this the page fetches it itself. */
        const val SEED_TIMEOUT_MILLIS = 150L
    }
}
