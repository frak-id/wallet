package com.plugin.store_review

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.play.core.review.ReviewManagerFactory

@TauriPlugin
class StoreReviewPlugin(
    private val activity: Activity,
) : Plugin(activity) {
    private val manager by lazy { ReviewManagerFactory.create(activity) }

    // Always resolves `{ requested }`: true when the Play flow ran, which does not mean the prompt showed.
    @Command
    fun requestReview(invoke: Invoke) {
        manager.requestReviewFlow().addOnCompleteListener { request ->
            val launch =
                if (request.isSuccessful) {
                    runCatching { manager.launchReviewFlow(activity, request.result) }.getOrNull()
                } else {
                    null
                }
            if (launch == null) {
                resolveRequested(invoke, false)
            } else {
                launch.addOnCompleteListener { resolveRequested(invoke, it.isSuccessful) }
            }
        }
    }

    private fun resolveRequested(
        invoke: Invoke,
        requested: Boolean,
    ) {
        invoke.resolve(JSObject().put("requested", requested))
    }
}
