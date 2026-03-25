package id.frak.webauthn

import android.app.Activity
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Thin passthrough to Android Credential Manager.
 * JSON flows straight through without intermediate type conversion,
 * preserving all fields including `publicKey` in registration responses.
 */
@TauriPlugin
class FrakWebauthnPlugin(activity: Activity) : Plugin(activity) {
    private val scope = CoroutineScope(Dispatchers.Main)
    private val credentialManager = CredentialManager.create(activity)
    private val pluginActivity = activity

    @Command
    fun register(invoke: Invoke) {
        val options = invoke.getArgs().getJSObject("options")
        if (options == null) {
            invoke.reject("Missing 'options' parameter")
            return
        }

        val request = CreatePublicKeyCredentialRequest(requestJson = options.toString())

        scope.launch {
            try {
                val result = credentialManager.createCredential(pluginActivity, request)

                when (result) {
                    is CreatePublicKeyCredentialResponse ->
                        invoke.resolve(JSObject(result.registrationResponseJson))
                    else -> invoke.reject("Unexpected credential type")
                }
            } catch (e: Exception) {
                invoke.reject(e.message ?: "WebAuthn registration failed")
            }
        }
    }

    @Command
    fun authenticate(invoke: Invoke) {
        val options = invoke.getArgs().getJSObject("options")
        if (options == null) {
            invoke.reject("Missing 'options' parameter")
            return
        }

        val getOption = GetPublicKeyCredentialOption(requestJson = options.toString())
        val getRequest = GetCredentialRequest(listOf(getOption))

        scope.launch {
            try {
                val result = credentialManager.getCredential(pluginActivity, getRequest).credential

                when (result) {
                    is PublicKeyCredential ->
                        invoke.resolve(JSObject(result.authenticationResponseJson))
                    else -> invoke.reject("Unexpected credential type")
                }
            } catch (e: Exception) {
                invoke.reject(e.message ?: "WebAuthn authentication failed")
            }
        }
    }
}
