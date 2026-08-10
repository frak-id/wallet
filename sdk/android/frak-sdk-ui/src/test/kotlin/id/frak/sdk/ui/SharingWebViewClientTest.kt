package id.frak.sdk.ui

import android.content.Context
import android.net.Uri
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

    private fun harness(): Pair<WebView, Harness> {
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

    private fun error(): WebResourceError = FakeWebResourceError()

    private fun httpError(): WebResourceResponse = WebResourceResponse("text/html", "utf-8", null)

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
    fun `a main-frame failure retries once against the cache`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)

        view.client.onReceivedError(view, request(url), error())

        assertEquals(
            "the retry must be pinned to the cache",
            WebSettings.LOAD_CACHE_ONLY,
            view.settings.cacheMode,
        )
        assertEquals("the retry must reload the same url", url, shadowOf(view).lastLoadedUrl)
        assertEquals("tier 3 must not have fired yet", 0, h.loadFailedCount)
    }

    @Test
    fun `both error callbacks for one navigation still yield a single cache retry`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)

        view.client.onReceivedError(view, request(url), error())
        view.client.onReceivedHttpError(view, request(url), httpError())

        assertEquals(
            "the duplicate must not have reset the cache pinning",
            WebSettings.LOAD_CACHE_ONLY,
            view.settings.cacheMode,
        )
        assertEquals("the duplicate is not a second failure", 0, h.loadFailedCount)
    }

    @Test
    fun `a failure after the retry has started falls through to tier 3`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())

        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())

        assertEquals("tier 3 must fire exactly once", 1, h.loadFailedCount)
        assertEquals(
            "a later unrelated load must not stay pinned to the cache",
            WebSettings.LOAD_DEFAULT,
            view.settings.cacheMode,
        )
    }

    @Test
    fun `a doubly-reported retry failure reports tier 3 only once`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing?x=1"
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())

        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())
        view.client.onReceivedHttpError(view, request(url), httpError())

        assertEquals("the caller must not be told twice", 1, h.loadFailedCount)
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
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())

        view.client.onPageStarted(view, url, null)
        view.client.onPageFinished(view, url)

        assertEquals(1, h.pageReadyCount)
        assertEquals(WebSettings.LOAD_DEFAULT, view.settings.cacheMode)
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
        assertEquals(WebSettings.LOAD_CACHE_ONLY, view.settings.cacheMode)
    }

    @Test
    fun `the cache retry still paints after the error page finishes`() {
        val (view, h) = harness()
        val url = "$WALLET_ORIGIN/sharing"
        view.client.onPageStarted(view, url, null)
        view.client.onReceivedError(view, request(url), error())
        view.client.onPageFinished(view, url) // error page

        view.client.onPageStarted(view, url, null) // retry dispatches
        view.client.onPageFinished(view, url)

        assertEquals(1, h.pageReadyCount)
        assertEquals(0, h.loadFailedCount)
        assertEquals(WebSettings.LOAD_DEFAULT, view.settings.cacheMode)
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
    }
}
