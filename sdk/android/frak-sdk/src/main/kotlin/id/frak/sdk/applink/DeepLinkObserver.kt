package id.frak.sdk.applink

import android.app.Activity
import android.app.Application
import android.os.Bundle

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
        if (intent.getBooleanExtra(HANDLED_EXTRA, false)) return
        val url = intent.data?.toString() ?: return
        intent.putExtra(HANDLED_EXTRA, true)
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

    private companion object {
        const val HANDLED_EXTRA = "id.frak.sdk.deeplink.handled"
    }
}
