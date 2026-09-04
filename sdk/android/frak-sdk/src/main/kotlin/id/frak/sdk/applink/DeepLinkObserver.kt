package id.frak.sdk.applink

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.os.Bundle
import androidx.core.app.OnNewIntentProvider
import androidx.core.util.Consumer
import id.frak.sdk.identity.IdentityMerge
import id.frak.sdk.net.UrlQuery
import id.frak.sdk.sharing.SharingLinkBuilder
import java.util.WeakHashMap

/**
 * Watches host activities for an inbound `fCtx` link.
 *
 * Subscribes to `OnNewIntentProvider` where the host offers it: `Activity.onNewIntent` does not
 * update `activity.intent`, so reading the intent alone sees the launch intent forever. Each intent
 * is marked handled so a resume doesn't re-track the same arrival.
 */
internal class DeepLinkObserver(
    private val onLink: (String) -> Unit,
) : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(
        activity: Activity,
        savedInstanceState: Bundle?,
    ) {
        subscribeToNewIntents(activity)
        consume(activity)
    }

    override fun onActivityResumed(activity: Activity) = consume(activity)

    /**
     * No-op when androidx.core is absent — it is `compileOnly`, so a merchant with no androidx at
     * all keeps a working SDK and loses only the warm-start path they cannot trigger anyway.
     */
    private fun subscribeToNewIntents(activity: Activity) {
        if (listeners.containsKey(activity)) return
        val provider =
            try {
                activity as? OnNewIntentProvider
            } catch (missing: NoClassDefFoundError) {
                return
            } ?: return

        val listener = Consumer<Intent> { intent -> consumeIntent(intent) }
        listeners[activity] = listener
        provider.addOnNewIntentListener(listener)
    }

    private fun consume(activity: Activity) = consumeIntent(activity.intent)

    private fun consumeIntent(intent: Intent?) {
        if (intent == null) return
        val url = intent.data?.toString() ?: return
        // Every activity's data URI reaches here, including a `content://` from a share target
        // and the merchant's own schemes. Only a link that carries something for us is consumed.
        if (!carriesFrakParams(url)) return
        // Identity-keyed and weak, not an extra on the intent: the intent belongs to the merchant,
        // may be re-parcelled, and an unknown extra can break their own equality or logging.
        if (handled.put(intent, Unit) != null) return
        onLink(url)
    }

    override fun onActivityStarted(activity: Activity) = Unit

    override fun onActivityPaused(activity: Activity) = Unit

    override fun onActivityStopped(activity: Activity) = Unit

    override fun onActivitySaveInstanceState(
        activity: Activity,
        outState: Bundle,
    ) = Unit

    override fun onActivityDestroyed(activity: Activity) {
        val listener = listeners.remove(activity) ?: return
        (activity as? OnNewIntentProvider)?.removeOnNewIntentListener(listener)
    }

    private fun carriesFrakParams(url: String): Boolean {
        val query = UrlQuery.parse(url) ?: return false
        return query.get(SharingLinkBuilder.CONTEXT_KEY) != null || query.get(IdentityMerge.TOKEN_KEY) != null
    }

    /** `Intent` does not override `equals`, so this is identity-keyed; weak so a finished activity's intent is collectable. */
    private val handled = WeakHashMap<Intent, Unit>()

    /** Weak, so an activity this SDK never sees destroyed is still collectable. */
    private val listeners = WeakHashMap<Activity, Consumer<Intent>>()
}
