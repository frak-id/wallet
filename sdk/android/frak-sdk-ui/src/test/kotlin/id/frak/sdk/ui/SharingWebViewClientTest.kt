package id.frak.sdk.ui

import android.content.Context
import android.net.Uri
import android.os.Looper
import android.webkit.FakeRenderProcessGoneDetail
import android.webkit.FakeWebResourceError
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Duration

/** Driven through [createSharingWebView], so the shipped hardening is what is under test. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SharingWebViewClientTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    private class Harness {
        val actions = mutableListOf<SharingPageAction>()
        val externalUrls = mutableListOf<String>()
        var pageReadyCount = 0
        var pageVisibleCount = 0
        var loadFailedCount = 0
    }

    /** The handle, for the tests that exercise what the pool does to a view rather than the client alone. */
    private fun boundHandle(): Pair<SharingWebViewHandle, Harness> {
        val h = Harness()
        val handle =
            createSharingWebView(
                context = context,
                walletOrigin = WALLET_ORIGIN,
                returnScheme = RETURN_SCHEME,
            )
        handle.bind(
            SharingWebViewBinding(
                sessionId = SESSION_ID,
                onAction = { h.actions += it },
                onPageReady = { h.pageReadyCount++ },
                onPageVisible = { h.pageVisibleCount++ },
                onLoadFailed = { h.loadFailedCount++ },
                onOpenExternal = { h.externalUrls += it },
            ),
        )
        return handle to h
    }

    private fun harness(): Pair<WebView, Harness> {
        val (handle, h) = boundHandle()
        return handle.view to h
    }

    private val WebView.client: WebViewClient
        get() = requireNotNull(shadowOf(this).webViewClient) { "the factory must install a WebViewClient" }

    private fun request(
        url: String,
        mainFrame: Boolean = true,
    ): WebResourceRequest =
        object : WebResourceRequest {
            override fun getUrl(): Uri = Uri.parse(url)

            override fun isForMainFrame(): Boolean = mainFrame

            override fun isRedirect(): Boolean = false

            override fun hasGesture(): Boolean = false

            override fun getMethod(): String = "GET"

            override fun getRequestHeaders(): Map<String, String> = emptyMap()
        }

    private fun error(code: Int = WebViewClient.ERROR_HOST_LOOKUP): WebResourceError = FakeWebResourceError(code)

    private fun httpError(): WebResourceResponse = WebResourceResponse("text/html", "utf-8", null)

    /** Runs the ladder's backoff, which is posted to the main looper rather than run inline. */
    private fun settleRetry() = shadowOf(Looper.getMainLooper()).runToEndOfTasks()

    /** Advances the virtual clock by exactly [millis], so a rung's delay can be pinned rather than drained. */
    private fun elapse(millis: Long) = shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(millis))

    /** One whole rung: the attempt starts, fails, and its retry (if any) is let through. */
    private fun failOnce(
        view: WebView,
        url: String,
        error: WebResourceError = error(WebViewClient.ERROR_TIMEOUT),
    ) {
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error)
        settleRetry()
    }

    @Test
    fun `the factory hardens the view`() {
        val (view, _) = harness()
        val settings = view.settings

        assertTrue("the page is a React app", settings.javaScriptEnabled)
        assertFalse("file:// access would expose app-private storage", settings.allowFileAccess)
        assertFalse("content:// access would expose other apps' providers", settings.allowContentAccess)
        assertEquals(
            "a chromeless sheet must never render downgraded content",
            WebSettings.MIXED_CONTENT_NEVER_ALLOW,
            settings.mixedContentMode,
        )
    }

    @Test
    fun `same-origin navigation stays in the sheet`() {
        val (view, h) = harness()
        val handled = view.client.shouldOverrideUrlLoading(view, request("$WALLET_ORIGIN/sharing?x=1"))

        assertFalse("same origin must load in place", handled)
        assertTrue(h.externalUrls.isEmpty())
    }

    @Test
    fun `a lookalike host is not the wallet origin`() {
        val (view, h) = harness()
        val hostile = "https://wallet.frak.id.attacker.example/sharing"
        val handled = view.client.shouldOverrideUrlLoading(view, request(hostile))

        assertTrue("a foreign origin must be intercepted", handled)
        assertEquals(listOf(hostile), h.externalUrls)
    }

    @Test
    fun `a return-scheme action with the right session id is delivered`() {
        val (view, h) = harness()
        val handled =
            view.client.shouldOverrideUrlLoading(
                view,
                request("$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}?action=dismiss&sid=$SESSION_ID"),
            )

        assertTrue(handled)
        assertEquals(listOf(SharingPageAction.Dismiss), h.actions)
    }

    @Test
    fun `a code action carries its value and expiry`() {
        val (view, h) = harness()
        val handled =
            view.client.shouldOverrideUrlLoading(
                view,
                request(
                    "$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}" +
                        "?action=code&value=ABC234&exp=1700000000&sid=$SESSION_ID",
                ),
            )

        assertTrue(handled)
        assertEquals(listOf(SharingPageAction.Code("ABC234", 1_700_000_000L)), h.actions)
    }

    @Test
    fun `a code action with no code is not one`() {
        val (view, h) = harness()
        view.client.shouldOverrideUrlLoading(
            view,
            request("$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}?action=code&sid=$SESSION_ID"),
        )
        view.client.shouldOverrideUrlLoading(
            view,
            request("$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}?action=code&value=&sid=$SESSION_ID"),
        )

        assertTrue("a value-less code action must be ignored, not crash", h.actions.isEmpty())
    }

    @Test
    fun `a code action with an unparseable expiry still delivers the code`() {
        val (view, h) = harness()
        view.client.shouldOverrideUrlLoading(
            view,
            request(
                "$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}" +
                    "?action=code&value=ABC234&exp=not-a-number&sid=$SESSION_ID",
            ),
        )

        assertEquals(listOf(SharingPageAction.Code("ABC234", null)), h.actions)
    }

    @Test
    fun `a share action carries the page's title and text`() {
        val (view, h) = harness()
        view.client.shouldOverrideUrlLoading(
            view,
            request(
                "$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}" +
                    "?action=share&title=Kettle+deal&text=Grab+it%21&sid=$SESSION_ID",
            ),
        )

        assertEquals(listOf(SharingPageAction.Share(title = "Kettle deal", text = "Grab it!")), h.actions)
    }

    @Test
    fun `a share action with no payload still delivers, with null title and text`() {
        val (view, h) = harness()
        view.client.shouldOverrideUrlLoading(
            view,
            request("$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}?action=share&sid=$SESSION_ID"),
        )

        assertEquals(listOf(SharingPageAction.Share(title = null, text = null)), h.actions)
    }

    @Test
    fun `an empty share title or text decodes to null, not a blank string`() {
        val (view, h) = harness()
        view.client.shouldOverrideUrlLoading(
            view,
            request("$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}?action=share&title=&text=&sid=$SESSION_ID"),
        )

        assertEquals(listOf(SharingPageAction.Share(title = null, text = null)), h.actions)
    }

    @Test
    fun `a share action ignores an image param entirely`() {
        // Android ships no preview thumbnail, so `image` must not reach the actions at all.
        val (view, h) = harness()
        view.client.shouldOverrideUrlLoading(
            view,
            request(
                "$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}" +
                    "?action=share&title=Kettle&image=https%3A%2F%2Fcdn.example.com%2Fp.png&sid=$SESSION_ID",
            ),
        )

        assertEquals(listOf(SharingPageAction.Share(title = "Kettle", text = null)), h.actions)
    }

    @Test
    fun `a sub-frame cannot hand the host an install code`() {
        val (view, h) = harness()
        view.client.shouldOverrideUrlLoading(
            view,
            request(
                "$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}" +
                    "?action=code&value=ABC234&sid=$SESSION_ID",
                mainFrame = false,
            ),
        )

        assertTrue(h.actions.isEmpty())
    }

    @Test
    fun `a return-scheme action from a stale session is ignored`() {
        val (view, h) = harness()
        val handled =
            view.client.shouldOverrideUrlLoading(
                view,
                request("$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}?action=dismiss&sid=some-other-session"),
            )

        assertTrue("still swallowed — it is our scheme", handled)
        assertTrue("but never acted on", h.actions.isEmpty())
    }

    @Test
    fun `a main-frame failure retries over the network after a backoff`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)

        view.client.onReceivedError(view, request(url), error(WebViewClient.ERROR_TIMEOUT))

        // The rung is a backoff, not an immediate reload: without this the ladder would spend both
        // its attempts inside the same failing instant.
        elapse(FIRST_RUNG_MILLIS - 1)
        assertEquals("the rung must wait out its backoff", null, shadowOf(view).lastLoadedUrl)
        elapse(1)

        assertEquals("the retry must reload the same url", url, shadowOf(view).lastLoadedUrl)
        assertEquals("tier 3 must not have fired yet", 0, h.loadFailedCount)
    }

    @Test
    fun `the second rung backs off further than the first`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        failOnce(view, url)

        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error(WebViewClient.ERROR_TIMEOUT))

        // A marker load, so "the rung has not fired yet" is observable on `lastLoadedUrl`.
        val marker = "$WALLET_ORIGIN/sharing?marker=1"
        view.loadUrl(marker)

        elapse(FIRST_RUNG_MILLIS)
        assertEquals("the second rung has not dispatched yet", marker, shadowOf(view).lastLoadedUrl)
        elapse(SECOND_RUNG_MILLIS - FIRST_RUNG_MILLIS)

        assertEquals("the second rung reloads over the network", url, shadowOf(view).lastLoadedUrl)
        assertEquals("the ladder is not spent yet", 0, h.loadFailedCount)
    }

    @Test
    fun `a spent ladder falls through to tier 3`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        failOnce(view, url)
        failOnce(view, url)

        failOnce(view, url)

        assertEquals("tier 3 must fire exactly once", 1, h.loadFailedCount)
        assertEquals(
            "a later unrelated load must not stay pinned to the cache",
            WebSettings.LOAD_DEFAULT,
            view.settings.cacheMode,
        )
    }

    @Test
    fun `an unreachable network skips the whole ladder`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"

        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error(WebViewClient.ERROR_HOST_LOOKUP))

        // The document is `no-store`, so there is no cached copy to fall back on and dialling a
        // dead radio again only spends the sheet's budget.
        assertEquals("offline reaches the chooser in no rungs at all", 1, h.loadFailedCount)
    }

    @Test
    fun `both error callbacks for one navigation still spend a single rung`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)

        view.client.onReceivedError(view, request(url), error(WebViewClient.ERROR_TIMEOUT))
        view.client.onReceivedHttpError(view, request(url), httpError())
        settleRetry()

        assertEquals(
            "the duplicate must not have consumed the network rung too",
            WebSettings.LOAD_DEFAULT,
            view.settings.cacheMode,
        )
        assertEquals("the duplicate is not a second failure", 0, h.loadFailedCount)
    }

    @Test
    fun `a doubly-reported final failure reports tier 3 only once`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        failOnce(view, url)
        failOnce(view, url)

        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())
        view.client.onReceivedHttpError(view, request(url), httpError())

        assertEquals("the caller must not be told twice", 1, h.loadFailedCount)
    }

    @Test
    fun `rebinding cancels a retry the previous session booked`() {
        val (view, _) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error(WebViewClient.ERROR_TIMEOUT))

        // The sheet closed and the pool took the view back before the backoff elapsed.
        (view.client as SharingWebViewClient).binding = SharingWebViewBinding.Warm
        settleRetry()

        assertEquals(
            "a closed session must not navigate the view it gave back",
            null,
            shadowOf(view).lastLoadedUrl,
        )
    }

    @Test
    fun `a sub-resource failure is not a page failure`() {
        val (view, h) = harness()
        view.client.onPageStarted(view, "$WALLET_ORIGIN/sharing", null)

        view.client.onReceivedError(view, request("$WALLET_ORIGIN/logo.png", mainFrame = false), error())

        assertEquals(0, h.loadFailedCount)
        assertEquals(WebSettings.LOAD_DEFAULT, view.settings.cacheMode)
    }

    @Test
    fun `a first load that finishes reports readiness`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"

        view.client.onPageStarted(view, url, null)
        view.client.onPageFinished(view, url)

        assertEquals(1, h.pageReadyCount)
        assertEquals(0, h.loadFailedCount)
    }

    @Test
    fun `a retry that starts and finishes reports readiness and unpins the cache`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        failOnce(view, url)
        failOnce(view, url) // down to the cache-only rung

        view.client.onPageStarted(view, url, null)
        view.client.onPageFinished(view, url)

        assertEquals(1, h.pageReadyCount)
        assertEquals(
            "the view outlives this session; it must not stay pinned",
            WebSettings.LOAD_DEFAULT,
            view.settings.cacheMode,
        )
    }

    @Test
    fun `the error page's own onPageFinished is not a successful load`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing"
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())

        // Android fires onPageFinished for its own error page too, in the same load cycle.
        view.client.onPageFinished(view, url)

        assertEquals(0, h.pageReadyCount)
    }

    @Test
    fun `the last rung still paints after the error page finishes`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing"
        failOnce(view, url) // first rung
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error(WebViewClient.ERROR_TIMEOUT))
        view.client.onPageFinished(view, url) // the error page, in the same load cycle
        settleRetry() // the last rung dispatches

        view.client.onPageStarted(view, url, null)
        view.client.onPageFinished(view, url)

        assertEquals(1, h.pageReadyCount)
        assertEquals(0, h.loadFailedCount)
    }

    @Test
    fun `a second document gets its own ladder`() {
        val (view, h) = harness()
        val sharing = "$WALLET_ORIGIN/sharing?x=1"
        failOnce(view, sharing) // one rung spent recovering the sharing page

        // The session navigates itself to the install page, which has never failed.
        val install = "$WALLET_ORIGIN/install?x=1"
        failOnce(view, install)

        assertEquals(
            "a fresh document must get the network rung, not inherit a spent budget",
            WebSettings.LOAD_DEFAULT,
            view.settings.cacheMode,
        )
        assertEquals(install, shadowOf(view).lastLoadedUrl)
        assertEquals(0, h.loadFailedCount)
    }

    @Test
    fun `going unreachable after the first rung ends the ladder there`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        failOnce(view, url) // first rung spent normally

        // The radio dropped between the two attempts.
        failOnce(view, url, error(WebViewClient.ERROR_CONNECT))

        assertEquals(1, h.loadFailedCount)
    }

    @Test
    fun `destroying the view cancels a retry booked against it`() {
        val (handle, _) = boundHandle()
        val view = handle.view
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error(WebViewClient.ERROR_TIMEOUT))

        // The pool reaches this without rebinding: a dead pool releasing a lent view, or
        // destroying a warm one. `loadUrl` after `destroy()` takes the host process down.
        handle.destroy()
        settleRetry()

        assertEquals("nothing may be loaded into a destroyed view", null, shadowOf(view).lastLoadedUrl)
    }

    @Test
    fun `rebinding leaves the view on the default cache mode`() {
        val (handle, _) = boundHandle()
        val view = handle.view
        val url = "$WALLET_ORIGIN/sharing?x=1"
        failOnce(view, url)
        failOnce(view, url)

        // The sheet closed mid-rung and the pool re-warmed this view.
        handle.bind(SharingWebViewBinding.Warm)

        assertEquals(
            "the next load must not inherit a pinned cache mode",
            WebSettings.LOAD_DEFAULT,
            view.settings.cacheMode,
        )
    }

    @Test
    fun `a renderer crash falls through to tier 3 without killing the host`() {
        val (view, h) = harness()
        view.client.onPageStarted(view, "$WALLET_ORIGIN/sharing", null)

        val handled = view.client.onRenderProcessGone(view, FakeRenderProcessGoneDetail())

        // false here would let the framework kill the merchant's app, not just the sheet
        assertTrue(handled)
        assertEquals(1, h.loadFailedCount)
    }

    @Test
    fun `a renderer crash clears the finished document the next sheet would activate into`() {
        val handle =
            createSharingWebView(
                context = context,
                walletOrigin = WALLET_ORIGIN,
                returnScheme = RETURN_SCHEME,
            )
        handle.load("$WALLET_ORIGIN/sharing")
        handle.onDocumentReady()

        handle.view.client.onRenderProcessGone(handle.view, FakeRenderProcessGoneDetail())

        assertFalse("a fragment hung off a dead renderer starts no request at all", handle.documentReady)
        assertTrue("and the view is finished for good, so the pool has to drop it", handle.rendererGone)
    }

    @Test
    fun `a same-origin sub-frame is left to the web view`() {
        val (view, h) = harness()

        val overridden =
            view.client.shouldOverrideUrlLoading(view, request("$WALLET_ORIGIN/embed", mainFrame = false))

        assertFalse(overridden)
        assertTrue(h.externalUrls.isEmpty())
    }

    @Test
    fun `a cross-origin sub-frame is cancelled, not launched externally`() {
        val (view, h) = harness()

        val overridden =
            view.client.shouldOverrideUrlLoading(view, request("https://ads.example/x", mainFrame = false))

        // Cancelled rather than handed to onOpenExternal: an iframe must not yank the user out.
        assertTrue(overridden)
        assertTrue(h.externalUrls.isEmpty())
    }

    @Test
    fun `a sub-frame cannot forge a page result`() {
        val (view, h) = harness()

        // A same-origin iframe can read the real sid, so the frame check is the real guard.
        view.client.shouldOverrideUrlLoading(
            view,
            request(
                "$RETURN_SCHEME://${SharingPageUrl.RESULT_HOST}?action=install&sid=$SESSION_ID",
                mainFrame = false,
            ),
        )

        assertTrue(h.actions.isEmpty())
    }

    private companion object {
        const val WALLET_ORIGIN = "https://wallet.frak.id"
        const val RETURN_SCHEME = "frak-com.acme.app"
        const val SESSION_ID = "test-session"

        /** Mirrors `SharingWebViewClient.RETRY_LADDER`, which is private. */
        const val FIRST_RUNG_MILLIS = 300L
        const val SECOND_RUNG_MILLIS = 900L
    }
}
