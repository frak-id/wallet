package id.frak.sdk.applink

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Probing for the Frak wallet app and handing off to it. Interface so platform calls stay a test seam. */
internal interface AppLauncher {
    fun isInstalled(packageId: String): Boolean

    /** True when something handled [url]. */
    fun open(url: String): Boolean
}

internal class AndroidAppLauncher(
    context: Context,
) : AppLauncher {
    private val appContext = context.applicationContext

    /** Visibility comes from `<queries>` in the SDK's own manifest, merged into the merchant app. */
    override fun isInstalled(packageId: String): Boolean =
        runCatching { appContext.packageManager.getPackageInfo(packageId, 0) }.isSuccess

    override fun open(url: String): Boolean {
        val intent =
            Intent(Intent.ACTION_VIEW, Uri.parse(url))
                // Application context has no task of its own for the new activity.
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return runCatching { appContext.startActivity(intent) }.isSuccess
    }
}
