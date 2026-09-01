package id.frak.sdk.identity

import id.frak.sdk.net.UrlQuery
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.security.MessageDigest

/**
 * Inbound `?fmt=` wire contract: this install is the merge *target*, folding its anonymous id into
 * the group the token names. Keeps only the once-per-process claim and the stateless wire
 * contract; delivery lives in [id.frak.sdk.tracking.MergeSender].
 */
internal class IdentityMerge {
    private val mutex = Mutex()
    private val consumed = mutableSetOf<String>()
    private val arrivals = mutableSetOf<String>()

    /**
     * Claims a token for this process, so a router replaying the same intent on every activity
     * recreation enqueues one merge. Separate from delivery, which the durable queue retries.
     */
    suspend fun claim(mergeToken: String): Boolean =
        mergeToken.isNotEmpty() && mutex.withLock { consumed.add(mergeToken) }

    /**
     * The arrival half of [claim]: a merchant routing the same URL by hand from more than one
     * entry point would otherwise track one arrival per call.
     */
    suspend fun claimArrival(context: String): Boolean =
        context.isNotEmpty() && mutex.withLock { arrivals.add(context) }

    companion object {
        const val TOKEN_KEY: String = "fmt"
        const val MERGE_EXECUTE_PATH: String = "/user/identity/merge/execute"

        fun parseToken(url: String): String? = UrlQuery.parse(url)?.getExact(TOKEN_KEY)?.takeIf { it.isNotEmpty() }

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
