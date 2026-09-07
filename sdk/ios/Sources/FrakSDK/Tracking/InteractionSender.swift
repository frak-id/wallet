import Foundation

/// `POST /user/track/interaction`. `QueuedRow.payload` is the wire body minus `merchantId`, filled in here.
struct InteractionSender: RowSender {
    static let kind = "interaction"
    private static let path = "/user/track/interaction"
    private static let arrivalType = "arrival"
    private static let referrerMerchantIdKey = "referrerMerchantId"

    let logger: FrakLogger

    func deliver(row: QueuedRow, ctx: SendContext) async throws(CancellationError) -> DeliveryOutcome {
        let merchantId: String
        if let known = row.merchantId {
            merchantId = known
        } else if let resolved = await ctx.resolveMerchantId() {
            merchantId = resolved
        } else {
            return .hold
        }
        guard let built = RowBody.withMerchantId(row.payload, merchantId: merchantId) else {
            return .dropped
        }

        if isForeignMerchantArrival(built.fields, ownMerchantId: merchantId) {
            logger.info("Dropping an arrival captured for another merchant.")
            return .dropped
        }

        do {
            let response = try await ctx.http.post(Self.path, body: built.data, headers: clientIdHeaders(row))
            return classify(response)
        } catch let error as FrakError {
            return .retryable(error)
        } catch {
            // Cancellation, and nothing else — HTTPClient maps every transport failure to a FrakError.
            throw CancellationError()
        }
    }

    /// The arrival guard re-run at send time. `ReferralArrival` runs it at capture, where a cold
    /// cache leaves it with no own merchant to compare against and it deliberately fails open;
    /// here the merchant is known, so a foreign one can finally be caught.
    private func isForeignMerchantArrival(_ fields: [String: Any], ownMerchantId: String) -> Bool {
        guard fields["type"] as? String == Self.arrivalType else { return false }
        // Absent on a V1 context, which carries no merchant to disagree with.
        guard let referrer = fields[Self.referrerMerchantIdKey] as? String else { return false }
        return !ReferralArrival.sameMerchant(referrer, ownMerchantId)
    }
}
