package id.frak.webauthn

import android.app.Activity
import androidx.credentials.CreatePublicKeyCredentialRequest
import androidx.credentials.CreatePublicKeyCredentialResponse
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPublicKeyCredentialOption
import androidx.credentials.PublicKeyCredential
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.publickeycredential.CreatePublicKeyCredentialDomException
import androidx.credentials.exceptions.publickeycredential.GetPublicKeyCredentialDomException
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
class FrakWebauthnPlugin(
    activity: Activity,
) : Plugin(activity) {
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
                    is CreatePublicKeyCredentialResponse -> {
                        invoke.resolve(JSObject(result.registrationResponseJson))
                    }

                    else -> {
                        invoke.reject("Unexpected credential type")
                    }
                }
            } catch (e: CreatePublicKeyCredentialDomException) {
                invoke.reject(webauthnError(e.domError.type, e.message))
            } catch (e: CreateCredentialException) {
                // Base type — catches cancellation, interrupted, no-create-option,
                // provider-config and unknown. Forward `e.type`; the JS classifier
                // is the single source of truth for bucketing.
                invoke.reject(webauthnError(e.type, e.message))
            } catch (e: Exception) {
                invoke.reject(webauthnError(null, e.message))
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

        // Fail-fast flag from the JS bridge. Strip it from `options` before
        // serializing so it never leaks into the WebAuthn `requestJson` (it is a
        // Credential Manager option, not part of the assertion request).
        val preferImmediate = options.optBoolean("preferImmediatelyAvailable", false)
        options.remove("preferImmediatelyAvailable")

        val getOption = GetPublicKeyCredentialOption(requestJson = options.toString())
        // The fail-fast flag lives on the request, not the option: with it set,
        // Credential Manager throws NoCredentialException (TYPE_NO_CREDENTIAL)
        // immediately instead of showing account-picker UI when no passkey exists.
        val getRequest =
            GetCredentialRequest(
                credentialOptions = listOf(getOption),
                preferImmediatelyAvailableCredentials = preferImmediate,
            )

        scope.launch {
            try {
                val result = credentialManager.getCredential(pluginActivity, getRequest).credential

                when (result) {
                    is PublicKeyCredential -> {
                        invoke.resolve(JSObject(result.authenticationResponseJson))
                    }

                    else -> {
                        invoke.reject("Unexpected credential type")
                    }
                }
            } catch (e: GetPublicKeyCredentialDomException) {
                invoke.reject(webauthnError(e.domError.type, e.message))
            } catch (e: GetCredentialException) {
                // Base type — catches cancellation, interrupted, no-credential,
                // unsupported and unknown. Forward `e.type`; the JS classifier
                // is the single source of truth for bucketing.
                invoke.reject(webauthnError(e.type, e.message))
            } catch (e: Exception) {
                invoke.reject(webauthnError(null, e.message))
            }
        }
    }

    // Unified `{ type, message }` reject envelope the JS bridge classifies on.
    // `type` is the locale-stable androidx enum token; `message` carries the GPS
    // `[50xxx]` code on the legacy FIDO2 path (e.g. 50162 folsom). On the
    // Credential Manager path GPS strips that prefix, so the JS side also matches
    // the (non-localized) folsom/decrypt message text — keep `message` verbatim.
    private fun webauthnError(
        type: String?,
        message: String?,
    ): String {
        val payload = JSObject()
        if (type != null) {
            payload.put("type", type)
        }
        payload.put("message", message ?: "")
        return payload.toString()
    }
}
