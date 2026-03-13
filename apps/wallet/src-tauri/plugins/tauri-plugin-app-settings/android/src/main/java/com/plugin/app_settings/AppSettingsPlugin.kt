package com.plugin.app_settings

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
            val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
            }
            activity.startActivity(intent)
            invoke.resolve()
        } catch (e: Exception) {
            try {
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
