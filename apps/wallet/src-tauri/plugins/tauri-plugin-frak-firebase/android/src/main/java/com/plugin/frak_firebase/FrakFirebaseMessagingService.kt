package com.plugin.frak_firebase

import android.content.Context
import android.util.Log
import app.tauri.plugin.JSObject
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Firebase Messaging service.
 *
 * Vendored from `srod/tauri-plugin-fcm` (commit b9d4d186) with the plugin
 * reference renamed from `FcmPlugin` to `FrakFirebasePlugin`.
 */
class FrakFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        val plugin = FrakFirebasePlugin.instance
        if (plugin != null) {
            plugin.trigger("token-refresh", JSObject().put("token", token))
        } else {
            // Cold start: buffer token in SharedPreferences for later retrieval.
            getSharedPreferences("frak_firebase_plugin", Context.MODE_PRIVATE)
                .edit().putString("fcm_token", token).apply()
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Token-only plugin — no display handling.
        Log.d("FrakFirebasePlugin", "Message received from: ${message.from}")
    }
}
