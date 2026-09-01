package id.frak.sdk.applink

import android.app.Activity
import android.content.Intent
import android.net.Uri
import androidx.core.app.OnNewIntentProvider
import androidx.core.util.Consumer
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val REFERRAL = "https://acme.example/p?fCtx=abc"

/** Mirrors `ComponentActivity`: the SDK subscribes here rather than re-reading `activity.intent`. */
private class FakeComponentActivity :
    Activity(),
    OnNewIntentProvider {
    private val listeners = mutableListOf<Consumer<Intent>>()

    override fun addOnNewIntentListener(listener: Consumer<Intent>) {
        listeners += listener
    }

    override fun removeOnNewIntentListener(listener: Consumer<Intent>) {
        listeners -= listener
    }

    fun deliverNewIntent(intent: Intent) = listeners.toList().forEach { it.accept(intent) }

    fun listenerCount(): Int = listeners.size
}

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class DeepLinkObserverTest {
    private fun intentFor(url: String): Intent {
        val intent = Intent()
        intent.data = Uri.parse(url)
        return intent
    }

    @Test
    fun `a warm-start intent is caught without the merchant calling setIntent`() {
        val seen = mutableListOf<String>()
        val observer = DeepLinkObserver(onLink = { seen += it })
        val activity = FakeComponentActivity()

        observer.onActivityCreated(activity, null)
        activity.deliverNewIntent(intentFor(REFERRAL))

        assertEquals(listOf(REFERRAL), seen)
    }

    @Test
    fun `the same warm-start intent is not tracked twice across a later resume`() {
        val seen = mutableListOf<String>()
        val observer = DeepLinkObserver(onLink = { seen += it })
        val activity = FakeComponentActivity()

        observer.onActivityCreated(activity, null)
        val intent = intentFor(REFERRAL)
        activity.deliverNewIntent(intent)
        activity.deliverNewIntent(intent)

        assertEquals(listOf(REFERRAL), seen)
    }

    @Test
    fun `a warm-start intent carrying nothing for us is ignored`() {
        val seen = mutableListOf<String>()
        val observer = DeepLinkObserver(onLink = { seen += it })
        val activity = FakeComponentActivity()

        observer.onActivityCreated(activity, null)
        activity.deliverNewIntent(intentFor("https://acme.example/plain"))

        assertEquals(emptyList<String>(), seen)
    }

    @Test
    fun `the listener is registered once and released on destroy`() {
        val observer = DeepLinkObserver(onLink = {})
        val activity = FakeComponentActivity()

        observer.onActivityCreated(activity, null)
        observer.onActivityCreated(activity, null)
        assertEquals(1, activity.listenerCount())

        observer.onActivityDestroyed(activity)
        assertEquals(0, activity.listenerCount())
    }
}
