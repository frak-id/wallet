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

    /**
     * The sheet has left the sharing page for the wallet's install page. The footer's
     * Copy/Share act on the *product* link and reload `/sharing`, which would throw away the
     * install page and the proof minted for it, so they are hidden past this point.
     */
    var showingInstallPage: Boolean by mutableStateOf(false)
        private set

    private var best: SharingResult? = null
    private var webView: WebView? = null
    private var finished = false
    private var pageLoaded = false

    /**
     * Tier-3 commits once. [finished] can't stand in: it's set only after the chooser has
     * been raised and the share attributed, so two fallbacks racing that window both pass
     * it. The deadline and a main-frame error genuinely race (both fire when offline), and
     * without this guard both interactions get queued and two choosers stack on the user.
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

    /** Raises the chooser, then attributes the share. See the body for why that order. */
    fun share() {
        val active = session ?: return
        scope.launch {
            // Nothing took the intent.
            if (!NativeShare.share(context, active.link, active.shareTitle)) {
                return@launch
            }
            // After the chooser, never before it. This is the reward-bearing interaction, not
            // an analytics event, so recording it on intent pays out for anyone who opened the
            // chooser and backed out. The web splits the two: `sharing_link_started` fires
            // before, `onShared` wires the interaction after. This is the half that pays.
            //
            // Optimistic on Android, honestly so: this flag means "the chooser launched", not
            // "the user shared". The wallet's own share plugin has the same asymmetry. It
            // becomes exact for free if `ActivityResultLauncher` ever lands.
            track()
            confirm(SharingResult.Shared(active.link))
        }
    }

    /** Copies the link, then tells the page it happened. */
    fun copy() {
        val active = session ?: return
        scope.launch {
            // Before, unlike `share()`, and deliberately: a copy has no chooser and no
            // completion to wait on, so there is no cancellation to avoid counting. Matches the
            // web, where `handleCopy` calls `trackSharing()` outright.
            track()
            if (NativeShare.copy(context, active.link)) onCopyConfirmed()
            confirm(SharingResult.Copied(active.link))
        }
    }

    fun onPageAction(action: SharingPageAction) {
        when (action) {
            SharingPageAction.Install -> {
                scope.launch {
                    val active = client()
                    // The sheet stays open and navigates to the wallet's install page rather
                    // than handing the user to the store. That page owns the decision — install
                    // code, store link, or straight into an installed wallet — and keeping it
                    // here is what makes the flow identical on both platforms, even though only
                    // iOS strictly needs the install code to preserve attribution.
                    val current = session ?: return@launch
                    val page = active.installPageUrl(current.returnScheme, sessionId)
                    if (page == null) {
                        // No identity or no merchant, so nothing to hand the install page. The
                        // store handoff is the honest fallback, and it closes the sheet.
                        // Reported only after the open is attempted; finishing first could tear
                        // this scope down mid-call.
                        active.openFrakApp()
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
                    showingInstallPage = false
                    webView?.loadUrl(it)
                }
            }

            is SharingPageAction.Code -> {
                // The page owns generating and displaying it; the SDK owns the clipboard,
                // because the sensitive flag is not something the page can set.
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
        // The install page failed rather than the sharing page. Tier 3 is not the answer — the
        // user already shared — but the footer was hidden for it, so hiding it further would
        // leave an error page with no controls at all. Put it back; Copy/Share reload the
        // sharing page, which is the only recovery there is from here.
        if (showingInstallPage) {
            showingInstallPage = false
            return
        }
        // A renderer crash after the page painted arrives here too. Falling back then would raise
        // an OS chooser on top of a sheet the user is using, and queue a share they never asked
        // for. A blank sheet they can dismiss is the smaller failure.
        if (pageLoaded) return
        val active = session ?: return
        fallBackOrFail(active)
    }

    /** [active].link is 100% local; its presence, not the page's, decides whether this session can still share. */
    private fun fallBackOrFail(active: SharingSession?) {
        if (fallbackFired) return // deadline and page failure are independent triggers that both fire offline
        // Already reported: `finish` is a no-op by then, but NativeShare would still raise a
        // chooser for a sheet the user has closed.
        if (finished) return
        fallbackFired = true
        if (active == null) {
            failure?.let(::fail)
            return
        }
        scope.launch {
            // Same rule as `share()`: the interaction pays out, so it follows the chooser
            // rather than announcing it.
            val shared = NativeShare.share(context, active.link, active.shareTitle)
            if (shared) track()
            finish(if (shared) SharingResult.Shared(active.link) else SharingResult.Dismissed)
        }
    }

    /**
     * No `SKOverlay` counterpart, unlike iOS: Play always foregrounds the Play app and Android
     * offers no in-place install. It does not matter here — the install page's download button
     * carries `merchantId`, `anonymousId` and the proof in the Play referrer, so attribution
     * survives the trip deterministically. That referrer is built by the page
     * (`buildPlayStoreInstallUrl`) from the `#p=` fragment this sheet navigated to, so it is
     * load-bearing across the SDK/page boundary rather than something the SDK still owns.
     */
    fun openExternally(url: String) {
        // normalizeScheme, not just a lowercased comparison: Android does not fold `HTTPS:` for
        // intent resolution either, so the guard and the launch must see the same value.
        val parsed = Uri.parse(url).normalizeScheme()
        // The page chooses this URL. Anything but http(s) is an app-to-app launch the merchant
        // never sanctioned — `intent:` and vendor schemes reach arbitrary installed activities.
        if (parsed.scheme != "https" && parsed.scheme != "http") return
        val intent = Intent(Intent.ACTION_VIEW, parsed).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
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
