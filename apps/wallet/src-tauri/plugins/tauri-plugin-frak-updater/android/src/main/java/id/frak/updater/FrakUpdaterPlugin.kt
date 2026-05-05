package id.frak.updater

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Native Android update flow backed by the Play In-App Updates API.
 *
 * Three command surfaces correspond to the three frontend states:
 *   - `checkUpdate`         queries `AppUpdateManager.appUpdateInfo` and
 *                           reports availability + ongoing download state
 *                           so the wallet can render the right UI on boot
 *                           or after returning from background.
 *   - `startSoftUpdate`     launches the FLEXIBLE flow (`startUpdateFlowForResult`).
 *                           The user accepts a single dialog, then the
 *                           download proceeds in the background; the app
 *                           keeps running and the React banner reflects
 *                           progress.
 *   - `completeSoftUpdate`  calls `completeUpdate()` once the download has
 *                           finished, which restarts the app into the new
 *                           version. Safe to call when nothing is pending —
 *                           Play returns false and we resolve cleanly.
 *
 * `openStore` is a fallback used by the hard-update gate — bypasses Play
 * Core entirely and opens the Play Store listing.
 */
@TauriPlugin
class FrakUpdaterPlugin(activity: Activity) : Plugin(activity) {
    private val pluginActivity = activity
    private val updateManager: AppUpdateManager =
        AppUpdateManagerFactory.create(activity.applicationContext)

    /**
     * Tracks bytes downloaded for the in-progress flexible update so
     * subsequent `checkUpdate` calls (e.g. on focus) can resolve with
     * progress without re-querying Play.
     */
    @Volatile
    private var lastDownloadProgress: DownloadProgress? = null

    private val installListener = InstallStateUpdatedListener { state ->
        when (state.installStatus()) {
            InstallStatus.DOWNLOADING -> {
                lastDownloadProgress = DownloadProgress(
                    bytesDownloaded = state.bytesDownloaded(),
                    totalBytes = state.totalBytesToDownload()
                )
            }
            InstallStatus.DOWNLOADED -> {
                lastDownloadProgress = DownloadProgress(
                    bytesDownloaded = state.totalBytesToDownload(),
                    totalBytes = state.totalBytesToDownload()
                )
            }
            else -> {
                // INSTALLED, FAILED, CANCELED — clear any cached progress so
                // the next checkUpdate() reflects the current Play state.
                lastDownloadProgress = null
            }
        }
    }

    init {
        // The listener is process-scoped: registering once in `init` is
        // enough because Tauri only spins up one plugin instance per
        // activity. `unregisterListener` happens implicitly when the
        // process dies.
        updateManager.registerListener(installListener)
    }

    @Command
    fun checkUpdate(invoke: Invoke) {
        updateManager.appUpdateInfo
            .addOnSuccessListener { info -> resolveCheck(invoke, info) }
            .addOnFailureListener { error ->
                Log.w(TAG, "Failed to read app update info", error)
                invoke.resolve(unsupported())
            }
    }

    @Command
    fun startSoftUpdate(invoke: Invoke) {
        updateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
                    !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                ) {
                    invoke.resolve(JSObject().apply { put("started", false) })
                    return@addOnSuccessListener
                }

                try {
                    // Play returns the result via Activity.onActivityResult;
                    // we don't hook into it because the InstallStateUpdatedListener
                    // already covers the lifecycle (downloading → downloaded →
                    // installed). The request code is required by the API
                    // signature but is otherwise inert here.
                    updateManager.startUpdateFlowForResult(
                        info,
                        AppUpdateType.FLEXIBLE,
                        pluginActivity,
                        UPDATE_REQUEST_CODE
                    )
                    invoke.resolve(JSObject().apply { put("started", true) })
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to start flexible update flow", e)
                    invoke.resolve(JSObject().apply { put("started", false) })
                }
            }
            .addOnFailureListener { error ->
                Log.w(TAG, "Failed to fetch update info before starting flow", error)
                invoke.resolve(JSObject().apply { put("started", false) })
            }
    }

    @Command
    fun completeSoftUpdate(invoke: Invoke) {
        updateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (info.installStatus() != InstallStatus.DOWNLOADED) {
                    invoke.resolve(JSObject().apply { put("completed", false) })
                    return@addOnSuccessListener
                }
                updateManager.completeUpdate()
                invoke.resolve(JSObject().apply { put("completed", true) })
            }
            .addOnFailureListener { error ->
                Log.w(TAG, "Failed to fetch update info before completing", error)
                invoke.resolve(JSObject().apply { put("completed", false) })
            }
    }

    @Command
    fun openStore(invoke: Invoke) {
        val pkg = pluginActivity.packageName
        // Try the native Play Store app first (`market://`); fall back to
        // the public web URL when Play isn't installed (rare but happens on
        // sideloaded devices / emulators without Play Services).
        val marketIntent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("market://details?id=$pkg")
        ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }
        val webIntent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("https://play.google.com/store/apps/details?id=$pkg")
        ).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) }

        val opened = try {
            pluginActivity.startActivity(marketIntent)
            true
        } catch (_: Exception) {
            try {
                pluginActivity.startActivity(webIntent)
                true
            } catch (e: Exception) {
                Log.w(TAG, "Unable to open Play Store", e)
                false
            }
        }
        invoke.resolve(JSObject().apply { put("opened", opened) })
    }

    // helpers

    private fun resolveCheck(invoke: Invoke, info: AppUpdateInfo) {
        val current = currentVersionName()

        // If a flexible download is already running or finished, surface
        // that state so the frontend doesn't restart the flow on the next
        // focus check.
        when (info.installStatus()) {
            InstallStatus.DOWNLOADING -> {
                val progress = lastDownloadProgress ?: DownloadProgress(0, 0)
                invoke.resolve(JSObject().apply {
                    put("currentVersion", current)
                    put("status", "in_progress")
                    put("bytesDownloaded", progress.bytesDownloaded)
                    put("totalBytes", progress.totalBytes)
                })
                return
            }
            InstallStatus.DOWNLOADED -> {
                invoke.resolve(JSObject().apply {
                    put("currentVersion", current)
                    put("status", "downloaded")
                })
                return
            }
            else -> Unit
        }

        if (info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE) {
            // Play Core has already done the comparison server-side; we
            // intentionally do NOT surface `availableVersionCode` because
            // it's a monotonic Int with no human-readable mapping (Play
            // hides the version name for available releases). The frontend
            // dismissal logic copes with the missing field by keying on a
            // platform-agnostic constant.
            invoke.resolve(JSObject().apply {
                put("currentVersion", current)
                put("status", "available")
            })
            return
        }

        invoke.resolve(JSObject().apply {
            put("currentVersion", current)
            put("status", "up_to_date")
        })
    }

    private fun currentVersionName(): String {
        return try {
            val info = pluginActivity.packageManager.getPackageInfo(pluginActivity.packageName, 0)
            info.versionName ?: ""
        } catch (e: Exception) {
            Log.w(TAG, "Unable to read package version name", e)
            ""
        }
    }

    private fun unsupported(): JSObject = JSObject().apply {
        put("currentVersion", currentVersionName())
        put("status", "unsupported")
    }

    private data class DownloadProgress(val bytesDownloaded: Long, val totalBytes: Long)

    companion object {
        private const val TAG = "FrakUpdaterPlugin"
        private const val UPDATE_REQUEST_CODE = 1042
    }
}
