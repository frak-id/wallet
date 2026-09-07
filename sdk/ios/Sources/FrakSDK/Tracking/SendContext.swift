import Foundation

/// Everything a `RowSender` needs that must be true at send time rather than at capture time: the
/// row itself carries the rest. Built fresh per drain, so `resolveMerchantId` can memoise for
/// that drain's lifetime. Deliberately narrow — no consent, no queue, no backoff; those stay
/// owned by the drain loop.
struct SendContext: Sendable {
    let http: HTTPClient
    let resolveMerchantId: @Sendable () async -> String?
    let signProof: @Sendable (ProofOp, String, Data) async -> String?
}
