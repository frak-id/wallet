package id.frak.sdk.ui

import android.content.Context
import android.content.MutableContextWrapper
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * A `WebView` holds a hard reference to the `Context` it was built with, so the pooled view
 * must hold `SharingHost`'s `MutableContextWrapper` rather than resolve through it once.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SharingWebViewContextTest {
    private val appContext: Context get() = ApplicationProvider.getApplicationContext()

    private fun binding() = SharingWebViewBinding(sessionId = "session-1")

    @Test
    fun `a pooled view holds the wrapper it was built with, not the base behind it`() {
        val wrapper = MutableContextWrapper(appContext)
        val pool = SharingWebViewPool(wrapper, WALLET_ORIGIN)

        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())

        assertSame(
            "the view must hold the wrapper, or swapping its base later changes nothing",
            wrapper,
            handle.view.context,
        )
    }

    @Test
    fun `swapping the wrapper's base is visible through the retained view`() {
        val wrapper = MutableContextWrapper(appContext)
        val pool = SharingWebViewPool(wrapper, WALLET_ORIGIN)
        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())

        val themed = android.view.ContextThemeWrapper(appContext, android.R.style.Theme_DeviceDefault)
        wrapper.baseContext = themed
        assertSame(themed, (handle.view.context as MutableContextWrapper).baseContext)

        wrapper.baseContext = appContext
        assertSame(appContext, (handle.view.context as MutableContextWrapper).baseContext)
    }

    @Test
    fun `the same web view instance survives a release and re-acquire`() {
        val wrapper = MutableContextWrapper(appContext)
        val pool = SharingWebViewPool(wrapper, WALLET_ORIGIN)
        pool.warm(WARM_URL)

        val first = pool.acquire(binding())
        pool.release(first)
        val second = pool.acquire(binding())

        assertSame("the pool must never re-create a view it still owns", first.view, second.view)
    }

    private companion object {
        const val WALLET_ORIGIN = "https://wallet.frak.id"
        const val WARM_URL =
            "$WALLET_ORIGIN/sharing?embed=native&state=warm&merchantId=m1&clientId=c1&sid=warm"
    }
}
