package id.frak.sdk.ui

import android.content.Context
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebViewClient
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/** Lending and returning the single pooled view. An explicit `warm` is the only thing that fills it. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SharingWebViewPoolTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    private fun pool() = SharingWebViewPool(context, WALLET_ORIGIN)

    private fun binding(sessionId: String = SESSION_ID) = SharingWebViewBinding(sessionId = sessionId)

    @Test
    fun `a view acquired before any warm is destroyed on release`() {
        val pool = pool()
        val handle = pool.acquire(binding())

        pool.release(handle)

        assertTrue("a view this sheet owned must not outlive it", shadowOf(handle.view).wasDestroyCalled())
    }

    @Test
    fun `warming loads the wallet origin before any sheet exists`() {
        val pool = pool()

        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())

        assertEquals(
            "the warm load must carry embed=native so the page skips wallet identity resolution",
            WARM_URL,
            shadowOf(handle.view).lastLoadedUrl,
        )
    }

    @Test
    fun `warming twice reuses the first view`() {
        val pool = pool()

        pool.warm(WARM_URL)
        val first = pool.acquire(binding())
        pool.release(first)
        pool.warm(WARM_URL)
        val second = pool.acquire(binding())

        assertSame("a second warm must not orphan the first view", first.view, second.view)
    }

    @Test
    fun `the warm view is the one the sheet presents`() {
        val pool = pool()
        pool.warm(WARM_URL)

        val handle = pool.acquire(binding())
        pool.release(handle)
        val next = pool.acquire(binding())

        assertSame("the point of the pool is that the sheet gets the already-warm view", handle.view, next.view)
        assertFalse("a lent view must survive its sheet", shadowOf(handle.view).wasDestroyCalled())
    }

    @Test
    fun `a returned view goes back to the warm url`() {
        val pool = pool()
        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())
        handle.load("$WALLET_ORIGIN/sharing?embed=native&merchantId=m&sid=$SESSION_ID")

        pool.release(handle)

        assertEquals(
            "the next sheet must not inherit the last one's page",
            WARM_URL,
            shadowOf(handle.view).lastLoadedUrl,
        )
    }

    @Test
    fun `a returned view stops answering to its old session`() {
        val pool = pool()
        pool.warm(WARM_URL)
        var actions = 0
        val handle = pool.acquire(SharingWebViewBinding(sessionId = SESSION_ID, onAction = { actions++ }))

        pool.release(handle)
        handle.dispatchResult(sessionId = SESSION_ID, action = "dismiss")

        assertEquals("a result from a closed sheet must reach nobody", 0, actions)
    }

    @Test
    fun `a second sheet cannot take a view that is still lent`() {
        val pool = pool()
        pool.warm(WARM_URL)

        val lent = pool.acquire(binding("first"))
        val concurrent = pool.acquire(binding("second"))

        assertNotSame("two sheets must never share one view", lent.view, concurrent.view)
    }

    @Test
    fun `the warm load finishing after the sheet took the view is not the sheet's page`() {
        val pool = pool()
        pool.warm(WARM_URL) // onPageStarted for the warm URL has fired; onPageFinished has not
        var ready = 0
        var visible = 0
        var failed = 0
        val handle =
            pool.acquire(
                SharingWebViewBinding(
                    sessionId = SESSION_ID,
                    onPageReady = { ready++ },
                    onPageVisible = { visible++ },
                    onLoadFailed = { failed++ },
                ),
            )

        handle.client().onPageFinished(handle.view, WARM_URL)

        assertEquals("the warm page settling must not cancel the tier-3 deadline", 0, ready)
        assertEquals("the skeleton must not lift onto the warm page", 0, visible)
        assertEquals("nor must it look like the session's page failing", 0, failed)
    }

    @Test
    fun `the session's own navigation still reports readiness`() {
        val pool = pool()
        pool.warm(WARM_URL)
        var ready = 0
        val handle = pool.acquire(SharingWebViewBinding(sessionId = SESSION_ID, onPageReady = { ready++ }))
        val sessionUrl = "$WALLET_ORIGIN/sharing?embed=native&merchantId=m&sid=$SESSION_ID"

        handle.client().onPageStarted(handle.view, sessionUrl, null)
        handle.client().onPageFinished(handle.view, sessionUrl)

        assertEquals("the guard must not swallow the navigation it exists to wait for", 1, ready)
    }

    @Test
    fun `destroying the pool destroys the warm view`() {
        val pool = pool()
        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())
        pool.release(handle)

        pool.destroy()

        assertTrue("the warm view must not outlive the share surface", shadowOf(handle.view).wasDestroyCalled())
    }

    private fun SharingWebViewHandle.client(): WebViewClient =
        requireNotNull(shadowOf(view).webViewClient) { "the factory must install a WebViewClient" }

    private fun SharingWebViewHandle.dispatchResult(
        sessionId: String,
        action: String,
    ) {
        val scheme = SharingPageUrl.returnScheme(context.packageName)
        val client = client()
        client.shouldOverrideUrlLoading(
            view,
            request("$scheme://${SharingPageUrl.RESULT_HOST}?sid=$sessionId&action=$action"),
        )
    }

    private fun request(url: String): WebResourceRequest =
        object : WebResourceRequest {
            override fun getUrl(): Uri = Uri.parse(url)

            override fun isForMainFrame(): Boolean = true

            override fun isRedirect(): Boolean = false

            override fun hasGesture(): Boolean = false

            override fun getMethod(): String = "GET"

            override fun getRequestHeaders(): Map<String, String> = emptyMap()
        }

    @Test
    fun `an unfinished warm view cannot be activated on top of`() {
        val pool = pool()
        pool.warm(WARM_URL)

        val handle = pool.acquire(binding())

        assertFalse("warming was still in flight", handle.documentReady)
        assertEquals(WARM_URL, handle.loadedBaseUrl)
    }

    @Test
    fun `a finished warm view can be activated on top of`() {
        val pool = pool()
        pool.warm(WARM_URL)
        pool.finishWarmLoad()

        val handle = pool.acquire(binding())

        assertTrue("a finished document is what makes a fragment free", handle.documentReady)
        assertEquals(WARM_URL, handle.loadedBaseUrl)
    }

    @Test
    fun `a warm view is paused once its document finishes, and resumed when a sheet takes it`() {
        val pool = pool()
        pool.warm(WARM_URL)
        val warm = requireNotNull(pool.warmHandle)

        assertFalse("a load in flight must not be paused", warm.paused)

        pool.finishWarmLoad()
        assertTrue("nothing is looking at this document", warm.paused)

        val handle = pool.acquire(binding())
        assertFalse("the sheet is about to navigate it; it has to be awake", handle.paused)
    }

    @Test
    fun `a re-warmed view is awake for its own load and paused again after it`() {
        val pool = pool()
        pool.warm(WARM_URL)
        pool.finishWarmLoad()
        val handle = pool.acquire(binding())

        pool.release(handle)

        assertFalse("the re-warm load needs an awake view", handle.paused)
        pool.finishWarmLoad()
        assertTrue("and it goes back to sleep on the same terms", handle.paused)
    }

    @Test
    fun `a returned view is re-warmed, not left on the session's page`() {
        val pool = pool()
        pool.warm(WARM_URL)
        pool.finishWarmLoad()
        val handle = pool.acquire(binding())
        handle.load("$WALLET_ORIGIN/sharing?embed=native&merchantId=m&sid=$SESSION_ID")

        pool.release(handle)

        assertEquals("the pooled view must go back to the warm page", WARM_URL, handle.loadedBaseUrl)
        assertFalse("and start unready again, since that load has not finished", handle.documentReady)

        pool.finishWarmLoad()
        assertTrue("the re-warm must still track readiness", handle.documentReady)
    }

    @Test
    fun `destroying the pool while a sheet holds the view leaves it to that sheet`() {
        val pool = pool()
        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())

        pool.destroy()

        // destroying a WebView a live sheet is still driving crashes it
        assertFalse("must not be pulled out from under an open sheet", shadowOf(handle.view).wasDestroyCalled())

        pool.release(handle)

        assertTrue("the sheet handing it back is what destroys it", shadowOf(handle.view).wasDestroyCalled())
    }

    private fun SharingWebViewPool.finishWarmLoad() {
        val warm = requireNotNull(warmHandle) { "nothing warm to finish" }
        warm.client().onPageStarted(warm.view, WARM_URL, null)
        warm.client().onPageFinished(warm.view, WARM_URL)
    }

    private companion object {
        const val WALLET_ORIGIN = "https://wallet.frak.id"
        const val SESSION_ID = "session-1"

        const val WARM_URL =
            "$WALLET_ORIGIN/sharing?embed=native&state=warm&merchantId=m1&clientId=c1&sid=warm"
    }
}
