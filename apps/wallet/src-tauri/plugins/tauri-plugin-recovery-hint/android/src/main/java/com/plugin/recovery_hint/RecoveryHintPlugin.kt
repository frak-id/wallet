package com.plugin.recovery_hint

import android.app.Activity
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.BlockstoreClient
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

/**
 * Persists a tiny recovery hint that survives app uninstall using Google
 * Block Store.
 *
 * Block Store auto-backs-up to the user's Google account when cloud backup
 * is enabled, restores on reinstall, and even follows the user to a new
 * device during Android setup. Max 16 KB per entry — we write ~200 B.
 */
@TauriPlugin
class RecoveryHintPlugin(private val activity: Activity) : Plugin(activity) {
    private val tag = "RecoveryHintPlugin"
    private val storageKey = "frak.wallet.recovery_hint.v1"
    private val client: BlockstoreClient = Blockstore.getClient(activity)
    private val scope = CoroutineScope(Dispatchers.IO)

    @Command
    fun getRecoveryHint(invoke: Invoke) {
        scope.launch {
            try {
                val request = RetrieveBytesRequest.Builder()
                    .setKeys(listOf(storageKey))
                    .build()
                val response = client.retrieveBytes(request).await()
                val bytes = response.blockstoreDataMap[storageKey]?.bytes
                val result = if (bytes != null && bytes.isNotEmpty()) {
                    jsonToJSObject(JSONObject(String(bytes, Charsets.UTF_8)))
                } else {
                    JSObject()
                }
                invoke.resolve(result)
            } catch (e: Exception) {
                Log.w(tag, "Block Store read failed, returning empty hint", e)
                invoke.resolve(JSObject())
            }
        }
    }

    @Command
    fun setRecoveryHint(invoke: Invoke) {
        scope.launch {
            try {
                val args = invoke.parseArgs(RecoveryHintArgs::class.java)
                val payload = args.toJsonBytes()
                val data = StoreBytesData.Builder()
                    .setKey(storageKey)
                    .setBytes(payload)
                    // Opt in to cloud backup so the hint restores on new devices.
                    .setShouldBackupToCloud(true)
                    .build()
                client.storeBytes(data).await()
                invoke.resolve()
            } catch (e: Exception) {
                Log.e(tag, "Block Store write failed", e)
                invoke.reject("Failed to set recovery hint: ${e.message}")
            }
        }
    }

    @Command
    fun clearRecoveryHint(invoke: Invoke) {
        scope.launch {
            try {
                val request = DeleteBytesRequest.Builder()
                    .setKeys(listOf(storageKey))
                    .build()
                client.deleteBytes(request).await()
                invoke.resolve()
            } catch (e: Exception) {
                Log.w(tag, "Block Store delete failed", e)
                invoke.resolve()
            }
        }
    }

    private fun jsonToJSObject(json: JSONObject): JSObject {
        val out = JSObject()
        val keys = json.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            out.put(key, json.get(key))
        }
        return out
    }
}

@InvokeArg
class RecoveryHintArgs {
    var lastAuthenticatorId: String? = null
    var lastWallet: String? = null
    var lastLoginAt: Long? = null

    fun toJsonBytes(): ByteArray {
        val obj = JSONObject()
        lastAuthenticatorId?.let { obj.put("lastAuthenticatorId", it) }
        lastWallet?.let { obj.put("lastWallet", it) }
        lastLoginAt?.let { obj.put("lastLoginAt", it) }
        return obj.toString().toByteArray(Charsets.UTF_8)
    }
}
