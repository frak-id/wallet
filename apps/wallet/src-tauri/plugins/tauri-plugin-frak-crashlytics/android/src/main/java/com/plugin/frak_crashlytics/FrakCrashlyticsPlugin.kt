package com.plugin.frak_crashlytics

import android.app.Activity
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import com.google.firebase.crashlytics.FirebaseCrashlytics
import org.json.JSONObject
import java.io.File

/**
 * Bridges Tauri commands to the FirebaseCrashlytics singleton.
 *
 * Auto-capture (uncaught JVM exceptions + native NDK signals) is wired by
 * the Firebase SDK itself as soon as `FirebaseApp.initializeApp()` has run
 * (which happens during tauri-plugin-fcm setup). This class only adds the
 * **context** surface: user id, custom keys, breadcrumb logs, and explicit
 * non-fatal errors recorded from the JS / Rust side.
 */
@TauriPlugin
class FrakCrashlyticsPlugin(private val activity: Activity) : Plugin(activity) {
    private val tag = "FrakCrashlyticsPlugin"
    /** Filename written by the Rust panic hook (see `panic_hook.rs`). Must
     *  stay in sync with `PANIC_REPORT_FILENAME` on the Rust side. */
    private val panicReportFilename = "frak.wallet.last_rust_panic.txt"
    private val crashlytics: FirebaseCrashlytics by lazy { FirebaseCrashlytics.getInstance() }

    override fun load(webView: android.webkit.WebView) {
        super.load(webView)
        forwardPersistedRustPanic()
    }

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
