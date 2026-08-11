package id.frak.sdk.identity

import id.frak.sdk.net.UrlQuery
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.security.MessageDigest

/**
 * Inbound `?fmt=` wire contract: this install is the merge *target*, folding its anonymous id into
 * the group the token names. Mirrors the web SDK's handling in `createIFrameFrakClient.ts`, except
 * there the listener posts and here [id.frak.sdk.tracking.MergeSender] does.
 *
 * Delivery itself lives in [id.frak.sdk.tracking.MergeSender], which is retried from the durable
 * queue; this class keeps only the once-per-process claim and the stateless wire contract.
 */
internal class IdentityMerge {
    private val mutex = Mutex()
    private val consumed = mutableSetOf<String>()

    /**
     * Claims a token for this process, so a merchant's router replaying the same intent on every
     * activity recreation enqueues one merge, not one per recreation. Returns false if this
     * process has already claimed it.
     *
     * Separate from delivery on purpose: delivery is retried from the durable queue, and a
     * once-only guard inside it would make the first failed attempt the last one.
     */
    suspend fun claim(mergeToken: String): Boolean =
        mergeToken.isNotEmpty() && mutex.withLock { consumed.add(mergeToken) }

    companion object {
        const val TOKEN_KEY: String = "fmt"
        const val MERGE_EXECUTE_PATH: String = "/user/identity/merge/execute"

        fun parseToken(url: String): String? = UrlQuery.parse(url)?.get(TOKEN_KEY)?.takeIf { it.isNotEmpty() }

        /** UTF-8, matching `IdentityProofService.hashMergeToken`. Binds the proof to this token, not just this merchant. */
        fun binding(mergeToken: String): ByteArray =
            MessageDigest.getInstance("SHA-256").digest(mergeToken.toByteArray(Charsets.UTF_8))

        fun body(
            mergeToken: String,
            anonymousId: String,
            merchantId: String,
            proof: String,
        ): JSONObject =
            JSONObject()
                .put("mergeToken", mergeToken)
                .put("targetAnonymousId", anonymousId)
                .put("merchantId", merchantId)
                .put("proof", proof)
    }
}
