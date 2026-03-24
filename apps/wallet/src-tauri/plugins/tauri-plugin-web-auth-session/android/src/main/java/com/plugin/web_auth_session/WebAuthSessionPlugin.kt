package com.plugin.web_auth_session

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@TauriPlugin
class WebAuthSessionPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun startWebAuthSession(invoke: Invoke) {
        invoke.reject("ASWebAuthenticationSession is only available on iOS")
    }
}
