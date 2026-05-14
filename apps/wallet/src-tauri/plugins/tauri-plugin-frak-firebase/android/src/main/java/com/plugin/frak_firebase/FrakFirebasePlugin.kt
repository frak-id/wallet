package com.plugin.frak_firebase

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.Permission
import app.tauri.annotation.PermissionCallback
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.messaging.FirebaseMessaging
import java.io.File
import java.util.concurrent.atomic.AtomicInteger
import org.json.JSONObject

// =====================================================================
// FCM args (vendored from srod/tauri-plugin-fcm)
// =====================================================================

@InvokeArg
data class CreateChannelArgs(
    val id: String = "",
    val name: String = "",
    val importance: Int = 0
)

@InvokeArg
data class SendNotificationArgs(
    val title: String = "",
    val body: String? = null,
    val icon: String? = null,
    val id: Int? = null,
    val channelId: String? = null
)

// =====================================================================
// Crashlytics args (merged from tauri-plugin-frak-crashlytics)
// =====================================================================

@InvokeArg
class SetUserIdArgs {
    var userId: String? = null
}

@InvokeArg
class SetKeyArgs {
    var key: String? = null
    var value: String? = null
}

@InvokeArg
class LogArgs {
    var message: String? = null
}

@InvokeArg
class RecordErrorArgs {
    var name: String? = null
    var message: String? = null
    var stack: String? = null
}

@InvokeArg
class SetCollectionEnabledArgs {
    var enabled: Boolean? = null
}

/**
 * Combined FCM + Crashlytics plugin.
 *
 * Firebase auto-capture (uncaught JVM exceptions + native NDK signals) and
 * FCM message routing are wired by the Firebase SDK as soon as
 * `FirebaseApp.initializeApp()` has run, which the `google-services` Gradle
 * plugin triggers automatically via `FirebaseInitProvider` before any
 * application code runs.
 *
 * This class only adds:
 *   * The **FCM commands** vendored from srod/tauri-plugin-fcm (getToken,
 *     register, requestPermissions, checkPermissions, deleteToken,
 *     createChannel, sendNotification).
 *   * The **Crashlytics commands** merged from tauri-plugin-frak-crashlytics
 *     (setUserId, setKey, log, recordError, setCollectionEnabled).
 *   * The **persisted Rust panic forwarder** that surfaces panics captured
 *     by the Rust panic hook on the *previous* launch.
 */
@TauriPlugin(
    permissions = [
        Permission(
            strings = [Manifest.permission.POST_NOTIFICATIONS],
            alias = "notification"
        )
    ]
)
class FrakFirebasePlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        var instance: FrakFirebasePlugin? = null
        private const val PREFS_NAME = "frak_firebase_plugin"
        private const val KEY_PERMISSION_REQUESTED = "permission_requested"
    }

    private val tag = "FrakFirebasePlugin"
    private val notificationIdCounter = AtomicInteger(0)

    /** Filename written by the Rust panic hook (see `panic_hook.rs`).
     *  Must stay in sync with `PANIC_REPORT_FILENAME` on the Rust side. */
    private val panicReportFilename = "frak.wallet.last_rust_panic.txt"
    private val crashlytics: FirebaseCrashlytics by lazy { FirebaseCrashlytics.getInstance() }

    override fun load(webView: WebView) {
        super.load(webView)
        instance = this
        forwardPersistedRustPanic()
    }

    // =====================================================================
    // Crashlytics: persisted Rust panic forwarder
    // =====================================================================

    /**
     * Look for a Rust panic report left over from the previous session
     * and surface it as a non-fatal Crashlytics issue. Idempotent — the
     * file is deleted after a successful read regardless of whether the
     * recording itself succeeded so we don't flood the dashboard on
     * repeat launches.
     */
    private fun forwardPersistedRustPanic() {
        try {
            val file = File(activity.cacheDir, panicReportFilename)
            if (!file.exists()) return
            val payload = file.readText(Charsets.UTF_8)
            // Best-effort delete — we always remove the file even if the
            // recording below fails so we don't loop reporting the same
            // panic on every cold start.
            file.delete()
            val json = JSONObject(payload)
            val name = json.optString("name", "RustPanic")
            val message = json.optString("message", "")
            val stack = json.optString("stack", "")
            if (stack.isNotEmpty()) {
                crashlytics.log("[rust panic backtrace from previous session]\n$stack")
            }
            crashlytics.recordException(NonFatalReportedError("$name: $message"))
        } catch (e: Exception) {
            Log.w(tag, "forwardPersistedRustPanic failed", e)
        }
    }

    // =====================================================================
    // FCM commands
    // =====================================================================

    private fun permissionStatus(value: String): JSObject {
        val ret = JSObject()
        ret.put("notification", value)
        return ret
    }

    @Command
    fun getToken(invoke: Invoke) {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val ret = JSObject()
                ret.put("token", task.result)
                invoke.resolve(ret)
            } else {
                // Fallback: check SharedPreferences for token buffered during cold start.
                val prefs = activity.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE)
                val buffered = prefs.getString("fcm_token", null)
                if (buffered != null) {
                    prefs.edit().remove("fcm_token").apply()
                    val ret = JSObject()
                    ret.put("token", buffered)
                    invoke.resolve(ret)
                } else {
                    invoke.reject(task.exception?.message ?: "Failed to get FCM token")
                }
            }
        }
    }

    @Command
    override fun requestPermissions(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val status = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            )
            if (status == PackageManager.PERMISSION_GRANTED) {
                invoke.resolve(permissionStatus("granted"))
            } else {
                requestPermissionForAlias("notification", invoke, "permissionResultCallback")
            }
        } else {
            val enabled = NotificationManagerCompat.from(activity).areNotificationsEnabled()
            invoke.resolve(permissionStatus(if (enabled) "granted" else "denied"))
        }
    }

    @PermissionCallback
    fun permissionResultCallback(invoke: Invoke) {
        val granted = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED

        // Record that we asked, so checkPermissions can distinguish prompt vs denied.
        activity.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE)
            .edit().putBoolean(KEY_PERMISSION_REQUESTED, true).apply()

        val deniedState =
            if (activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                "prompt-with-rationale"
            } else {
                "denied"
            }

        invoke.resolve(permissionStatus(if (granted) "granted" else deniedState))
    }

    @Command
    override fun checkPermissions(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val status = ContextCompat.checkSelfPermission(
                activity,
                Manifest.permission.POST_NOTIFICATIONS
            )
            if (status == PackageManager.PERMISSION_GRANTED) {
                invoke.resolve(permissionStatus("granted"))
            } else {
                val prefs = activity.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE)
                val everRequested = prefs.getBoolean(KEY_PERMISSION_REQUESTED, false)
                val deniedState =
                    if (activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                        "prompt-with-rationale"
                    } else {
                        "denied"
                    }
                invoke.resolve(permissionStatus(if (everRequested) deniedState else "prompt"))
            }
        } else {
            val enabled = NotificationManagerCompat.from(activity).areNotificationsEnabled()
            invoke.resolve(permissionStatus(if (enabled) "granted" else "denied"))
        }
    }

    @Command
    fun register(invoke: Invoke) {
        // No-op on Android — FCM auto-registers via FirebaseInitProvider.
        invoke.resolve()
    }

    @Command
    fun deleteToken(invoke: Invoke) {
        FirebaseMessaging.getInstance().deleteToken().addOnCompleteListener { task ->
            if (task.isSuccessful) {
                invoke.resolve()
            } else {
                invoke.reject(task.exception?.message ?: "Failed to delete FCM token")
            }
        }
    }

    @Command
    fun createChannel(invoke: Invoke) {
        val args = invoke.parseArgs(CreateChannelArgs::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(args.id, args.name, args.importance)
            NotificationManagerCompat.from(activity).createNotificationChannel(channel)
            invoke.resolve()
        } else {
            invoke.resolve()
        }
    }

    private fun ensureDefaultChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = NotificationManagerCompat.from(activity)
            if (manager.getNotificationChannel("default") == null) {
                val channel = NotificationChannel(
                    "default",
                    "Default",
                    NotificationManager.IMPORTANCE_DEFAULT
                )
                manager.createNotificationChannel(channel)
            }
        }
    }

    @Command
    fun sendNotification(invoke: Invoke) {
        val args = invoke.parseArgs(SendNotificationArgs::class.java)

        val resolvedIcon = if (args.icon != null) {
            val id = activity.resources.getIdentifier(args.icon, "drawable", activity.packageName)
            if (id != 0) id else activity.applicationInfo.icon
        } else {
            activity.applicationInfo.icon
        }

        val effectiveChannelId = args.channelId ?: "default"
        if (effectiveChannelId == "default") {
            ensureDefaultChannel()
        }

        val builder = NotificationCompat.Builder(activity, effectiveChannelId)
            .setContentTitle(args.title)
            .setSmallIcon(resolvedIcon)
            .setAutoCancel(true)

        if (args.body != null) {
            builder.setContentText(args.body)
        }

        val notification = builder.build()
        NotificationManagerCompat.from(activity).notify(
            args.id ?: notificationIdCounter.incrementAndGet(),
            notification
        )
        invoke.resolve()
    }

    // =====================================================================
    // Crashlytics commands
    // =====================================================================

    @Command
    fun setUserId(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SetUserIdArgs::class.java)
            crashlytics.setUserId(args.userId.orEmpty())
            invoke.resolve()
        } catch (e: Exception) {
            Log.w(tag, "setUserId failed", e)
            invoke.reject("setUserId failed: ${e.message}")
        }
    }

    @Command
    fun setKey(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SetKeyArgs::class.java)
            val key = args.key.orEmpty()
            // FirebaseCrashlytics.setCustomKey accepts String/Boolean/Double/Float/Int/Long.
            // The JS facade pre-stringifies values to keep the surface uniform — that's
            // also what the Crashlytics dashboard ends up displaying.
            crashlytics.setCustomKey(key, args.value.orEmpty())
            invoke.resolve()
        } catch (e: Exception) {
            Log.w(tag, "setKey failed", e)
            invoke.reject("setKey failed: ${e.message}")
        }
    }

    @Command
    fun log(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(LogArgs::class.java)
            crashlytics.log(args.message.orEmpty())
            invoke.resolve()
        } catch (e: Exception) {
            Log.w(tag, "log failed", e)
            invoke.reject("log failed: ${e.message}")
        }
    }

    @Command
    fun recordError(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(RecordErrorArgs::class.java)
            // Crashlytics expects a Throwable; synthesize one from the JS Error.
            // We attach the original stack as a custom log entry that's
            // included in the next report — that preserves the JS stack frames
            // rather than showing the synthetic Java stack.
            val name = args.name.orEmpty().ifEmpty { "Error" }
            val message = args.message.orEmpty()
            val throwable = NonFatalReportedError("$name: $message")
            args.stack?.takeIf { it.isNotEmpty() }?.let { stack ->
                crashlytics.log("[non-fatal stack] $stack")
            }
            crashlytics.recordException(throwable)
            invoke.resolve()
        } catch (e: Exception) {
            Log.w(tag, "recordError failed", e)
            invoke.reject("recordError failed: ${e.message}")
        }
    }

    @Command
    fun setCollectionEnabled(invoke: Invoke) {
        try {
            val args = invoke.parseArgs(SetCollectionEnabledArgs::class.java)
            crashlytics.setCrashlyticsCollectionEnabled(args.enabled ?: true)
            invoke.resolve()
        } catch (e: Exception) {
            Log.w(tag, "setCollectionEnabled failed", e)
            invoke.reject("setCollectionEnabled failed: ${e.message}")
        }
    }
}

/**
 * Marker exception used for non-fatal reports. Subclassing keeps the report
 * grouping consistent in the Crashlytics dashboard regardless of the JS
 * Error class — name/message provide the actual differentiation.
 */
private class NonFatalReportedError(message: String) : RuntimeException(message)
