package id.frak.sdk.applink

import android.app.Activity
import android.app.Application
import android.content.Intent
import android.os.Bundle
import id.frak.sdk.identity.IdentityMerge
import id.frak.sdk.net.UrlQuery
import id.frak.sdk.sharing.SharingLinkBuilder
import java.util.WeakHashMap

/**
 * Watches host activities for an inbound `fCtx` link. Both `onActivityCreated` and
 * `onActivityResumed` read the intent: a `singleTask` activity delivers a warm-start intent via
 * `onNewIntent`/`onResume`, never `onCreate`. Each intent is marked handled so a resume (share
 * sheet return, screen unlock) doesn't re-track the same arrival.
 */
internal class DeepLinkObserver(
    private val onLink: (String) -> Unit,
) : Application.ActivityLifecycleCallbacks {
    override fun onActivityCreated(
        activity: Activity,
        savedInstanceState: Bundle?,
    ) = consume(activity)

    override fun onActivityResumed(activity: Activity) = consume(activity)

    private fun consume(activity: Activity) {
        val intent = activity.intent ?: return
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

    override fun onActivityDestroyed(activity: Activity) = Unit

    private fun carriesFrakParams(url: String): Boolean {
        val query = UrlQuery.parse(url) ?: return false
        return query.get(SharingLinkBuilder.CONTEXT_KEY) != null || query.get(IdentityMerge.TOKEN_KEY) != null
    }

    /** `Intent` does not override `equals`, so this is identity-keyed; weak so a finished activity's intent is collectable. */
    private val handled = WeakHashMap<Intent, Unit>()
}
