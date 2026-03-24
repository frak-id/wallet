package com.plugin.install_referrer

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener

@TauriPlugin
class InstallReferrerPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun getInstallReferrer(invoke: Invoke) {
        val client = InstallReferrerClient.newBuilder(activity).build()

        client.startConnection(object : InstallReferrerStateListener {
            override fun onInstallReferrerSetupFinished(responseCode: Int) {
                when (responseCode) {
                    InstallReferrerClient.InstallReferrerResponse.OK -> {
                        try {
                            val response = client.installReferrer
                            val result = JSObject().apply {
                                put("referrer", response.installReferrer)
                                put("clickTimestamp", response.referrerClickTimestampSeconds)
                                put("installTimestamp", response.installBeginTimestampSeconds)
                            }
                            client.endConnection()
                            invoke.resolve(result)
                        } catch (e: Exception) {
                            client.endConnection()
                            invoke.reject("Failed to read referrer: ${e.message}")
                        }
                    }
                    InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED -> {
                        client.endConnection()
                        invoke.reject("Install referrer not supported on this device")
                    }
                    InstallReferrerClient.InstallReferrerResponse.SERVICE_UNAVAILABLE -> {
                        client.endConnection()
                        invoke.reject("Install referrer service unavailable")
                    }
                    else -> {
                        client.endConnection()
                        invoke.reject("Unknown referrer response code: $responseCode")
                    }
                }
            }

            override fun onInstallReferrerServiceDisconnected() {
                // Connection lost — callback won't fire, caller should retry
            }
        })
    }
}
