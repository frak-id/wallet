package id.frak.wallet

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@TauriPlugin
class AppSettingsPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun openNotificationSettings(invoke: Invoke) {
        try {
            // Direct notification settings (API 26+, min SDK is 28)
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
            }
            activity.startActivity(intent)
            invoke.resolve()
        } catch (e: Exception) {
            try {
                // Fallback to general app info page
                val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                    data = Uri.parse("package:${activity.packageName}")
                }
                activity.startActivity(intent)
                invoke.resolve()
            } catch (e2: Exception) {
                invoke.reject("Failed to open settings: ${e2.message}")
            }
        }
    }
}
