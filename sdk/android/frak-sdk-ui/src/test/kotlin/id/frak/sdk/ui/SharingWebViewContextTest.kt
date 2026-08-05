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
 * The one thing in the rotation work that can leak an Activity, and whose failure mode is silent —
 * no crash, no log, just a destroyed Activity retained per rotation.
 *
 * A `WebView` keeps a hard reference to the `Context` it was constructed with. The pool is now
 * retained across configuration changes, so a view built directly against an Activity would pin
 * every Activity the user ever rotated away from. It also cannot simply be built against the
 * application context: it needs a themed, windowed one for its own popups.
 *
 * `SharingHost` resolves that with a `MutableContextWrapper` whose base is the Activity while one
 * is attached and the application context while none is. That only works if the view actually
 * holds the *wrapper* rather than resolving through it once at construction — which is what this
 * pins. A `System.gc()`-and-hope collectability assertion would be testing Robolectric's own
 * retention policy, not ours; this is the deterministic half.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class SharingWebViewContextTest {
    private val appContext: Context get() = ApplicationProvider.getApplicationContext()

    private fun binding() = SharingWebViewBinding(sessionId = "session-1")

    @Test
    fun `a pooled view holds the wrapper it was built with, not the base behind it`() {
        val wrapper = MutableContextWrapper(appContext)
        val pool = SharingWebViewPool(wrapper, WALLET_ORIGIN, preload = true)

        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())

        assertSame(
            "the view must hold the wrapper, or swapping its base later changes nothing",
            wrapper,
            handle.view.context,
        )
    }

    /**
     * Reads the swap the way `SharingHost.onDestroy` performs it: the base goes back to the
     * application context, and the view — which is retained — is looking at the new one.
     */
    @Test
    fun `swapping the wrapper's base is visible through the retained view`() {
        val wrapper = MutableContextWrapper(appContext)
        val pool = SharingWebViewPool(wrapper, WALLET_ORIGIN, preload = true)
        pool.warm(WARM_URL)
        val handle = pool.acquire(binding())

        val themed = android.view.ContextThemeWrapper(appContext, android.R.style.Theme_DeviceDefault)
        wrapper.baseContext = themed
        assertSame(themed, (handle.view.context as MutableContextWrapper).baseContext)

        wrapper.baseContext = appContext
        assertSame(appContext, (handle.view.context as MutableContextWrapper).baseContext)
    }

    /**
     * The pool never re-creates a view it still owns: a release and a re-acquire — what the *end
     * of a session* does — hands back the same instance.
     *
     * Not the rotation path, which is different and untested: a configuration change goes through
     * `SharingPresentation.detachView()` and leaves the handle lent, so the view never returns to
     * the pool at all. This is the closest deterministic proxy for "the `WebView` instance is
     * stable", which is what the rotation promise rests on.
     */
    @Test
    fun `the same web view instance survives a release and re-acquire`() {
        val wrapper = MutableContextWrapper(appContext)
        val pool = SharingWebViewPool(wrapper, WALLET_ORIGIN, preload = true)
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
