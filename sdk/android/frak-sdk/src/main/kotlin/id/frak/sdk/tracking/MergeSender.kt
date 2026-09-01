package id.frak.sdk.tracking

import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.identity.IdentityMerge
import id.frak.sdk.identity.ProofOp

/**
 * `POST /user/identity/merge/execute`. [QueuedRow.idempotencyKey] is the merge token itself; it
 * never reaches the wire from there — see [IdentityMerge.body].
 */
internal class MergeSender(
    private val logger: FrakLogger,
) : RowSender {
    // The backend mints a merge token with a 60-minute lifetime (AnonymousMergeService.ts:36); holding longer cannot succeed.
    override val holdTimeoutMillis: Long = 60L * 60 * 1000

    override suspend fun deliver(
        row: QueuedRow,
        ctx: SendContext,
    ): DeliveryOutcome {
        // A merge names the identity it folds in; a row that lost it can only post an empty
        // target, so drop it rather than spend the failure cap on a request that can't succeed.
        val anonymousId =
            row.clientId ?: run {
                logger.warn("Dropping a merge row that carries no anonymous id.")
                return DeliveryOutcome.Dropped
            }
        val mergeToken = row.idempotencyKey
        if (mergeToken.isEmpty()) {
            logger.warn("Dropping a merge row with no token.")
            return DeliveryOutcome.Dropped
        }
        val merchantId = row.merchantId ?: ctx.resolveMerchantId() ?: return DeliveryOutcome.Hold

        // Minted on every attempt, never cached: it binds merchantId, unknown until drain, and a
        // locked keystore is transient device state, not a verdict — Hold, not Rejected, or one
        // bad moment traps the row for good. Costs no round trip either way.
        val proof =
            ctx.signProof(ProofOp.Merge, merchantId, IdentityMerge.binding(mergeToken))
                ?: return DeliveryOutcome.Hold

        val body = IdentityMerge.body(mergeToken, anonymousId, merchantId, proof)
        val response =
            try {
                ctx.http.post(IdentityMerge.MERGE_EXECUTE_PATH, body.toString())
            } catch (failure: FrakError) {
                return DeliveryOutcome.Retryable(failure)
            }

        // A merge token is single-use, so 429/5xx must answer "later", not "no": that is the
        // difference between a retry and losing the referral. classifyStatus owns that boundary.
        val outcome = classifyStatus(response)
        if (outcome is DeliveryOutcome.Rejected) {
            logger.warn("Identity merge refused with status ${response.status}.")
        }
        return outcome
    }

    companion object {
        const val KIND = "merge"
    }
}
