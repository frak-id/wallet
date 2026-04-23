package com.plugin.recovery_hint

import android.app.Activity
import android.content.Context
import android.content.SharedPreferences
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
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import org.json.JSONObject

/**
 * Persists a tiny recovery hint that survives app uninstall.
 *
 * Primary backend: Google Block Store (encrypted, auto-backs-up to the
 * user's Google account when cloud backup is enabled, restored on reinstall
 * and during new-device setup). Max 16 entries / 4 KB per entry.
 *
 * Fallback: plain SharedPreferences — written to the `device_protected`
 * prefs file and opted in to Android Auto Backup via `android:allowBackup`
 * + `dataExtractionRules` so same-device uninstall survival still works on
 * devices without Google Play Services (Huawei / Amazon Fire / custom ROMs).
 *
 * The hint is non-sensitive (credential ids are public WebAuthn artifacts
 * and the wallet address is public on-chain), so the fallback's weaker
 * security posture is acceptable.
 */
@TauriPlugin
class RecoveryHintPlugin(private val activity: Activity) : Plugin(activity) {
    private val tag = "RecoveryHintPlugin"
    private val storageKey = "frak.wallet.recovery_hint.v1"
    private val prefsFile = "frak.wallet.recovery_hint"
    // SupervisorJob so a single coroutine failure doesn't cancel the whole
    // plugin scope.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Lazy because instantiation touches Google Play Services. */
    private val client: BlockstoreClient by lazy { Blockstore.getClient(activity) }
    private val prefs: SharedPreferences by lazy {
        activity.getSharedPreferences(prefsFile, Context.MODE_PRIVATE)
    }

    private val isBlockStoreAvailable: Boolean by lazy {
        val status = GoogleApiAvailability.getInstance()
            .isGooglePlayServicesAvailable(activity)
        val available = status == ConnectionResult.SUCCESS
        if (!available) {
            Log.w(tag, "Google Play Services unavailable (status=$status); falling back to SharedPreferences")
        }
        available
    }

    @Command
    fun getRecoveryHint(invoke: Invoke) {
        scope.launch {
            // Read from Block Store first (cloud-synced + cross-device restore),
            // fall back to SharedPreferences (local survival via Auto Backup).
            val blockStoreJson = if (isBlockStoreAvailable) readFromBlockStore() else null
            val json = blockStoreJson ?: readFromPrefs()
            val result = json?.let { jsonToJSObject(it) } ?: JSObject()
            invoke.resolve(result)
        }
    }

    @Command
    fun setRecoveryHint(invoke: Invoke) {
        scope.launch {
            try {
                val args = invoke.parseArgs(RecoveryHintArgs::class.java)
                val json = args.toJson()
                // Refuse to persist an empty payload so a caller that
                // accidentally passes `{}` doesn't clobber a good hint.
                if (json.length() == 0) {
                    invoke.reject("Refusing to persist an empty recovery hint")
                    return@launch
                }
                val payload = json.toString().toByteArray(Charsets.UTF_8)
                val blockStoreOk = if (isBlockStoreAvailable) {
                    writeToBlockStore(payload)
                } else {
                    false
                }
                val prefsOk = writeToPrefs(json)
                if (!blockStoreOk && !prefsOk) {
                    invoke.reject("Failed to persist recovery hint to any backing store")
                    return@launch
                }
                invoke.resolve()
            } catch (e: Exception) {
                Log.e(tag, "recovery-hint set failed", e)
                invoke.reject("Failed to set recovery hint: ${e.message}")
            }
        }
    }

    @Command
    fun clearRecoveryHint(invoke: Invoke) {
        scope.launch {
            if (isBlockStoreAvailable) {
                try {
                    val request = DeleteBytesRequest.Builder()
                        .setKeys(listOf(storageKey))
                        .build()
                    client.deleteBytes(request).await()
                } catch (e: Exception) {
                    Log.w(tag, "Block Store delete failed", e)
                }
            }
            try {
                prefs.edit().remove(storageKey).apply()
            } catch (e: Exception) {
                Log.w(tag, "SharedPreferences delete failed", e)
            }
            invoke.resolve()
        }
    }

    // MARK: - Block Store

    private suspend fun readFromBlockStore(): JSONObject? {
        return try {
            val request = RetrieveBytesRequest.Builder()
                .setKeys(listOf(storageKey))
                .build()
            val response = client.retrieveBytes(request).await()
            val bytes = response.blockstoreDataMap[storageKey]?.bytes
            if (bytes != null && bytes.isNotEmpty()) {
                JSONObject(String(bytes, Charsets.UTF_8))
            } else {
                null
            }
        } catch (e: Exception) {
            Log.w(tag, "Block Store read failed", e)
            null
        }
    }

    private suspend fun writeToBlockStore(payload: ByteArray): Boolean {
        return try {
            // Gate cloud backup on E2EE availability (API 28+ with screen
            // lock). If E2EE isn't available we still write locally but
            // don't opt into cloud backup — the hint is non-sensitive but
            // there's no reason to ship it to Google in the clear.
            val e2eeAvailable = try {
                client.isEndToEndEncryptionAvailable().await()
            } catch (e: Exception) {
                false
            }
            val data = StoreBytesData.Builder()
                .setKey(storageKey)
                .setBytes(payload)
                .setShouldBackupToCloud(e2eeAvailable)
                .build()
            client.storeBytes(data).await()
            true
        } catch (e: Exception) {
            Log.w(tag, "Block Store write failed", e)
            false
        }
    }

    // MARK: - SharedPreferences fallback

    private fun readFromPrefs(): JSONObject? {
        return try {
            prefs.getString(storageKey, null)?.let { JSONObject(it) }
        } catch (e: Exception) {
            Log.w(tag, "SharedPreferences read failed", e)
            null
        }
    }

    private fun writeToPrefs(json: JSONObject): Boolean {
        return try {
            prefs.edit().putString(storageKey, json.toString()).apply()
            true
        } catch (e: Exception) {
            Log.w(tag, "SharedPreferences write failed", e)
            false
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

    fun toJson(): JSONObject {
        val obj = JSONObject()
        lastAuthenticatorId?.let { obj.put("lastAuthenticatorId", it) }
        lastWallet?.let { obj.put("lastWallet", it) }
        lastLoginAt?.let { obj.put("lastLoginAt", it) }
        return obj
    }
}
