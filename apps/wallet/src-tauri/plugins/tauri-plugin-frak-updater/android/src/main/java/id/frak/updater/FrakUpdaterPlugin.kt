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
import com.google.android.play.core.appupdate.AppUpdateOptions
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

    private val installListener = InstallStateUpdatedListener { state ->
        when (state.installStatus()) {
            InstallStatus.PENDING -> {
                // PENDING (accepted but not yet downloading) can persist for
                // minutes on slow/metered connections; surface it as
                // `in_progress` so a focus refetch can't revert the banner.
                triggerStatusEvent(JSObject().apply {
                    put("currentVersion", currentVersionName())
                    put("status", "in_progress")
                    put("bytesDownloaded", 0L)
                    put("totalBytes", 0L)
                })
            }
            InstallStatus.DOWNLOADING -> {
                triggerStatusEvent(JSObject().apply {
                    put("currentVersion", currentVersionName())
                    put("status", "in_progress")
                    put("bytesDownloaded", state.bytesDownloaded())
                    put("totalBytes", state.totalBytesToDownload())
                })
            }
            InstallStatus.DOWNLOADED -> {
                triggerStatusEvent(JSObject().apply {
                    put("currentVersion", currentVersionName())
                    put("status", "downloaded")
                })
            }
            InstallStatus.FAILED, InstallStatus.CANCELED -> {
                // Surface the cancellation back to JS so the soft-update prompt
                // can drop the optimistic "in progress" state and let the user
                // retry from the available banner. Note: Play Core does NOT emit
                // a CANCELED event when the user dismisses the FLEXIBLE consent
                // dialog itself — only for a started-then-aborted download — so
                // the JS layer also polls via `refetchInterval` as a safety net.
                triggerStatusEvent(JSObject().apply {
                    put("currentVersion", currentVersionName())
                    put("status", "available")
                })
            }
            else -> {
                // INSTALLED (app is restarting via completeUpdate),
                // REQUIRES_UI_INTENT, UNKNOWN — leave the JS cache alone; the
                // next checkUpdate() / focus refetch will reconcile if needed.
                Unit
            }
        }
    }

    /**
     * Pushes the current Play Core install state to JS via `addPluginListener`.
     * Pairs with `listenToNativeUpdateStatus` on the JS side so the soft-update
     * UI can reflect progress and completion without waiting for the next
     * window-focus refetch.
     */
    private fun triggerStatusEvent(payload: JSObject) {
        trigger(UPDATE_STATUS_EVENT, payload)
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
                val availability = info.updateAvailability()
                val canStart =
                    availability == UpdateAvailability.UPDATE_AVAILABLE &&
                        info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                // Once the user accepts the consent dialog Play flips
                // availability to DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
                // re-launching the flow then is Google's documented "resume"
                // path that recovers a stalled download instead of dead-ending
                // a re-tap with started: false.
                val canResume =
                    availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS

                if (!canStart && !canResume) {
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
                        pluginActivity,
                        AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
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
                // completeUpdate() returns a Task that only settles once Play
                // accepts the install+restart. Resolving before it settles
                // would report completed: true even on a failed install,
                // stranding the user on the "Restart now" banner.
                updateManager.completeUpdate()
                    .addOnSuccessListener {
                        invoke.resolve(JSObject().apply { put("completed", true) })
                    }
                    .addOnFailureListener { error ->
                        Log.w(TAG, "Failed to complete flexible update", error)
                        invoke.resolve(JSObject().apply { put("completed", false) })
                    }
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
        val installStatus = info.installStatus()

        // An already-running FLEXIBLE update must win over the availability
        // check, else a focus refetch reverts the banner to "Update". Play
        // signals it as DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS (after consent)
        // and/or installStatus PENDING/DOWNLOADING/DOWNLOADED — PENDING can
        // linger for minutes, which is when the old code mis-reported it.
        // A FAILED/CANCELED install is excluded so a transient in-progress
        // availability can't make this poll fight the listener's `available`.
        val installAborted =
            installStatus == InstallStatus.FAILED || installStatus == InstallStatus.CANCELED
        val updateInProgress = !installAborted &&
            (info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS ||
                installStatus == InstallStatus.PENDING ||
                installStatus == InstallStatus.DOWNLOADING ||
                installStatus == InstallStatus.DOWNLOADED)

        if (updateInProgress) {
            if (installStatus == InstallStatus.DOWNLOADED) {
                invoke.resolve(JSObject().apply {
                    put("currentVersion", current)
                    put("status", "downloaded")
                })
                return
            }
            // Bytes come straight from AppUpdateInfo so the value is correct
            // even after process death (a cached counter would read 0/0).
            invoke.resolve(JSObject().apply {
                put("currentVersion", current)
                put("status", "in_progress")
                put("bytesDownloaded", info.bytesDownloaded())
                put("totalBytes", info.totalBytesToDownload())
            })
            return
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

    companion object {
        private const val TAG = "FrakUpdaterPlugin"
        private const val UPDATE_REQUEST_CODE = 1042
        private const val UPDATE_STATUS_EVENT = "update-status"
    }
}
