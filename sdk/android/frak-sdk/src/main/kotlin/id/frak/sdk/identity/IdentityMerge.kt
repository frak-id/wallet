package id.frak.sdk.identity

import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.net.HttpClient
import id.frak.sdk.net.UrlQuery
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.security.MessageDigest

/**
 * Inbound `?fmt=` handling: this install is the merge *target*, folding its anonymous id into the
 * group the token names. Mirrors the web SDK's handling in `createIFrameFrakClient.ts`, except
 * there the listener posts and here the SDK does.
 *
 * The outbound half (`/merge/initiate`) has no native caller.
 */
internal class IdentityMerge(
    private val http: HttpClient,
    private val identity: AnonymousIdStore,
    private val logger: FrakLogger,
) {
    private val mutex = Mutex()
    private val consumed = mutableSetOf<String>()

    /**
     * Never throws: this runs off a merchant's deep-link callback. Returns whether the backend
     * accepted the merge.
     *
     * A proof is mandatory, unlike the web arm that must keep working for keyless legacy ids: a
     * native id that cannot sign is one the backend is expected to start refusing (see ROLLOUT.md).
     */
    suspend fun execute(
        mergeToken: String,
        merchantId: String,
        anonymousId: String,
    ): Boolean {
        if (mergeToken.isEmpty()) return false
        // A merchant's router replays the same intent on every recreation; each is not a merge.
        if (!mutex.withLock { consumed.add(mergeToken) }) return false

        val proof =
            identity.signProof(ProofOp.Merge, merchantId, binding = sha256(mergeToken))
                ?: run {
                    logger.warn("Could not sign the merge proof; skipping the identity merge.")
                    return false
                }

        val body =
            JSONObject()
                .put("mergeToken", mergeToken)
                .put("targetAnonymousId", anonymousId)
                .put("merchantId", merchantId)
                .put("proof", proof)

        return try {
            val response = http.post(MERGE_EXECUTE_PATH, body.toString())
            if (response.isSuccess) {
                true
            } else {
                logger.warn("Identity merge refused with status ${response.status}.")
                false
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (failure: FrakError) {
            logger.warn("Identity merge could not reach the backend", failure)
            false
        }
    }

    /** UTF-8, matching `IdentityProofService.hashMergeToken`. */
    private fun sha256(value: String): ByteArray =
        MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))

    companion object {
        const val TOKEN_KEY: String = "fmt"

        const val MERGE_EXECUTE_PATH: String = "/user/identity/merge/execute"

        fun parseToken(url: String): String? = UrlQuery.parse(url)?.get(TOKEN_KEY)?.takeIf { it.isNotEmpty() }
    }
}
