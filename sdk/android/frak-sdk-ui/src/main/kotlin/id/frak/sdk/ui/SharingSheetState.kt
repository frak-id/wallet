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
 * The share, resolved once before anything can be shown. [link] is 100% local
 * ([id.frak.sdk.SharingApi.buildLink]) and survives a cold cache/no network;
 * [pageUrl] needs the network and can legitimately be null — that's the tier-3 fallback
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
    // Individually injected, not `() -> FrakClient`: FrakClient carries no substitutable
    // abstraction (02-sdk-design.md), so the seam is the handful of members this sheet
    // actually calls, not all of them. Defaulted to `Frak.client`'s namespaces, resolved
    // lazily since Frak.initialize may not have run when this is constructed.
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

    /**
     * A share is between its page-side press and its outcome. See [share] for why the page's
     * own button cannot be trusted to have gone away in the meantime.
     */
    private var shareInFlight = false

    /** The [copy] half of [shareInFlight]: two taps would bill two interactions for one copy. */
    private var copyInFlight = false

    /**
     * The sheet has left the sharing page for the wallet's install page.
     *
     * A plain field, not `mutableStateOf`: nothing renders off it any more — it used to hide a
     * native footer, and that footer is the page's now. It survives only because
     * [onPageUnavailable] has to tell a failed install page apart from a failed sharing page,
     * which reach it identically and need opposite answers.
     */
    private var showingInstallPage = false

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
                failure = FrakError.NotInitialized()
                resolved.complete(Unit)
                return@launch
            }
            // Catch-all so an unexpected throw from `build` still records a failure
            // instead of leaving a spinner forever; CancellationException rethrows untouched.
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
        // The page's footer is what drives this now, and it stays enabled for the whole round
        // trip: the web `isSharing` flag that would normally disable it belongs to
        // `useShareLink`, which a handed-off press never reaches. The gap is not the few
        // milliseconds before the chooser covers the app — it is `track()` below, a queue write
        // the chooser's dismissal returns into, with the page live and tappable underneath.
        // Two taps across it would stack two choosers and bill two reward-bearing interactions
        // for one share, which is the same failure `fallbackFired` exists to stop for tier 3.
        if (shareInFlight) return
        shareInFlight = true
        scope.launch {
            // Nothing took the intent.
            if (!NativeShare.share(context, active.link, active.shareTitle)) {
                // Deliberately cleared, unlike the success path: no chooser came up, so the
                // page is still on its sharing screen and the user must be able to try again.
                shareInFlight = false
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
            // Not cleared here: `confirm` reloads onto the confirmation screen, which has no
            // Share button. `ShareAgain` is what reopens the flow, and clears it.
        }
    }

    /**
     * Copies the link and attributes it. The page owns the feedback.
     *
     * Records the outcome rather than [confirm]ing it, which is the one asymmetry with [share].
     * The page moves itself to its confirmation screen the moment its own button is pressed and
     * raises its own "link copied" toast; a `confirmed=1` reload on top of that would tear down
     * the document mid-toast and repaint the same screen, so the user's only feedback that the
     * copy happened would be destroyed by the navigation confirming it. `share` still reloads,
     * because only this sheet learns whether a chooser actually came up.
     */
    fun copy() {
        val active = session ?: return
        if (copyInFlight) return
        copyInFlight = true
        scope.launch {
            // Before, unlike `share()`, and deliberately: a copy has no chooser and no
            // completion to wait on, so there is no cancellation to avoid counting. Matches the
            // web, where `handleCopy` calls `trackSharing()` outright.
            track()
            NativeShare.copy(context, active.link)
            record(SharingResult.Copied(active.link))
        }
    }

    fun onPageAction(action: SharingPageAction) {
        when (action) {
            SharingPageAction.Install -> {
                scope.launch {
                    // The sheet stays open and navigates to the wallet's install page rather
                    // than handing the user to the store. That page owns the decision — install
                    // code, store link, or straight into an installed wallet — and keeping it
                    // here is what makes the flow identical on both platforms, even though only
                    // iOS strictly needs the install code to preserve attribution.
                    val current = session ?: return@launch
                    val page = installPageUrl(current.returnScheme, sessionId)
                    if (page == null) {
                        // No identity or no merchant, so nothing to hand the install page. The
                        // store handoff is the honest fallback, and it closes the sheet.
                        // Reported only after the open is attempted; finishing first could tear
                        // this scope down mid-call.
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
                    // The user is asking to share a second time, so the guards that closed the
                    // first one have to open again — [share] deliberately leaves its own set.
                    shareInFlight = false
                    copyInFlight = false
                    // Back on the sharing page, so a later load failure is that page's again.
                    showingInstallPage = false
                    webView?.loadUrl(it)
                }
            }

            // The page draws both buttons and this sheet performs them: `navigator.share` does
            // not exist in an Android WebView, and either way the interaction a share earns has
            // to be signed by the SDK keypair the page cannot reach.
            SharingPageAction.Share -> {
                share()
            }

            SharingPageAction.Copy -> {
                copy()
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
        // A failed *install* page lands here first. Tier 3 is not the answer — the user has
        // already shared — but neither is doing nothing: the sheet would sit on the WebView's
        // own error page, and since the controls that used to rescue it were native and are now
        // the *sharing* page's, there is nothing left on screen to press. Reloading the
        // confirmation screen is the page-owned equivalent of what the old native footer did
        // here, and it lands the user somewhere with its own share-again and install controls.
        if (showingInstallPage) {
            showingInstallPage = false
            session?.url(confirmed = true)?.let { webView?.loadUrl(it) }
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
     * Where the page's own outbound links go.
     *
     * The Play listing for the wallet is the exception, and the reason this is not a bare
     * `startActivity`: the install page's download button points at the store unconditionally,
     * so a user who already has the wallet installed was being sent to its store page instead of
     * into it. [openFrakApp] is the deep-link-first answer the no-install-page branch of
     * [onPageAction] already uses — it tries `frakwallet://install?m=&a=` first and only reaches
     * the store if nothing took that intent, where the referrer it builds carries the same
     * `merchantId`/`anonymousId` pair the page's own referrer would have. Attribution survives
     * either way; what changes is that an installed wallet gets the handoff directly, and can
     * merge the anonymous id into the wallet on `/install` without a store round trip.
     */
    fun openExternally(url: String) {
        // normalizeScheme, not just a lowercased comparison: Android does not fold `HTTPS:` for
        // intent resolution either, so the guard and the launch must see the same value.
        val parsed = Uri.parse(url).normalizeScheme()
        // The page chooses this URL. Anything but http(s) is an app-to-app launch the merchant
        // never sanctioned — `intent:` and vendor schemes reach arbitrary installed activities.
        if (parsed.scheme != "https" && parsed.scheme != "http") return
        if (isWalletStoreListing(parsed)) {
            scope.launch { openFrakApp() }
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, parsed).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(intent) }
    }

    /**
     * The Play listing for *this environment's* wallet, and nothing else: a merchant's own app,
     * or any other listing the page might link to, still opens Play as asked. The package id is
     * read off the URL rather than assumed, since dev and production ship different ones.
     */
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
     * Moves the page to its post-share confirmation screen.
     *
     * A reload with `&confirmed=1` rather than letting the page confirm itself off its own
     * button press: the page asks for the share, but only this sheet learns whether a chooser
     * actually came up, and `saveConfirmation` has to survive the user leaving and coming back.
     * It costs a page load at the moment the chooser dismisses, which is the obvious thing to
     * optimise away next — the page would have to own the optimism to do it.
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
        // Scoped the same way the page's own selection will be, so the seed and the page
        // never briefly disagree on a product-gated campaign.
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
     * Null rather than `[]` when empty: page skips the card section on absent, renders empty
     * on `[]`. Flattens [SharingProduct.details]' six scope fields alongside the display
     * fields — the page forwards this same object straight into reward selection
     * (`rewardProductsForSelection` → `selectBestReward`), so a product-scoped campaign is
     * only ranked correctly if the scope fields actually reach the wire here. Mirrored in
     * `SharingSheetModel.productsJSON` on iOS; keep both in step.
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
                // `finiteOrNull`: `JSONObject.put` throws on NaN/Infinity ("JSON does not allow
                // non-finite numbers"), and this runs inside the sheet's `launch`, where the
                // throw would surface as a crash rather than a missing product card. A price
                // that is not a number carries no scope meaning, so it is dropped like any
                // other absent field.
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

        /** Host of the store listing the install page links to (`buildPlayStoreInstallUrl`). */
        const val PLAY_STORE_HOST = "play.google.com"
    }
}
