import Foundation

/// `POST /user/identity/merge/execute`. `QueuedRow.idempotencyKey` is the merge token itself; it
/// never reaches the wire from there — see `IdentityMerge.body`.
struct MergeSender: RowSender {
    static let kind = "merge"

    let logger: FrakLogger

    // The backend mints the token with exactly a 60-minute lifetime
    // (services/backend/src/domain/identity/services/AnonymousMergeService.ts:36); holding longer cannot succeed.
    var holdTimeout: TimeInterval { 60 * 60 }

    func deliver(row: QueuedRow, ctx: SendContext) async throws(CancellationError) -> DeliveryOutcome {
        // A merge names the identity it folds in; a row that lost it can only post an empty
        // target, so drop it rather than spend the failure cap on a request that can't succeed.
        guard let anonymousId = row.clientId else {
            logger.warn("Dropping a merge row that carries no anonymous id.")
            return .dropped
        }
        let mergeToken = row.idempotencyKey
        guard !mergeToken.isEmpty else {
            logger.warn("Dropping a merge row with no token.")
            return .dropped
        }

        let merchantId: String
        if let known = row.merchantId {
            merchantId = known
        } else if let resolved = await ctx.resolveMerchantId() {
            merchantId = resolved
        } else {
            return .hold
        }

        // Minted on every attempt, never cached: it binds merchantId, unknown until drain, and a
        // locked enclave is transient device state, not a backend verdict — hold, not rejected,
        // or one bad moment traps the row for good.
        guard let proof = await ctx.signProof(.merge, merchantId, IdentityMerge.binding(mergeToken)) else {
            return .hold
        }

        guard
            let body = IdentityMerge.body(
                mergeToken: mergeToken,
                anonymousId: anonymousId,
                merchantId: merchantId,
                proof: proof
            )
        else {
            return .dropped
        }

        do {
            let response = try await ctx.http.post(IdentityMerge.executePath, body: body)
            let outcome = classify(response)
            if case .rejected = outcome {
                logger.warn("Identity merge refused with status \(response.status).")
            }
            return outcome
        } catch let error as FrakError {
            return .retryable(error)
        } catch {
            // Cancellation, and nothing else — HTTPClient maps every transport failure to a FrakError.
            throw CancellationError()
        }
    }
}
