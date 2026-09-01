import Foundation

/// `POST /user/track/purchase`. `QueuedRow.payload` is the wire body minus `merchantId`, filled in here.
struct PurchaseSender: RowSender {
    static let kind = "purchase"
    private static let path = "/user/track/purchase"

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
}
