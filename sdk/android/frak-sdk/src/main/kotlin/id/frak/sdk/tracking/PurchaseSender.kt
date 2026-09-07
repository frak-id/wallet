package id.frak.sdk.tracking

import id.frak.sdk.core.FrakError
import org.json.JSONObject

/** `POST /user/track/purchase`. [QueuedRow.payload] is the wire body minus `merchantId`, filled in here. */
internal class PurchaseSender : RowSender {
    override suspend fun deliver(
        row: QueuedRow,
        ctx: SendContext,
    ): DeliveryOutcome {
        val merchantId = row.merchantId ?: ctx.resolveMerchantId() ?: return DeliveryOutcome.Hold
        val body = JSONObject(row.payload.toString()).put(MERCHANT_ID_KEY, merchantId)

        val response =
            try {
                ctx.http.post(PATH, body.toString(), clientIdHeaders(row))
            } catch (failure: FrakError) {
                return DeliveryOutcome.Retryable(failure)
            }

        return classifyStatus(response)
    }

    companion object {
        const val KIND = "purchase"
        const val PATH = "/user/track/purchase"

        private const val MERCHANT_ID_KEY = "merchantId"
    }
}
