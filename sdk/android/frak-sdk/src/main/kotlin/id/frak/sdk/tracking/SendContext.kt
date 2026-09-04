package id.frak.sdk.tracking

import id.frak.sdk.identity.ProofOp
import id.frak.sdk.net.HttpClient

/**
 * Everything a [RowSender] needs that must be true at send time rather than at capture time: the
 * row itself carries the rest. Built fresh per drain by [EventOutbox], so [resolveMerchantId]
 * can memoise for that drain's lifetime. Deliberately narrow — no consent, no queue, no backoff;
 * those stay owned by [EventOutbox].
 */
internal class SendContext(
    val http: HttpClient,
    val resolveMerchantId: suspend () -> String?,
    val signProof: suspend (op: ProofOp, merchantId: String, binding: ByteArray) -> String?,
)
