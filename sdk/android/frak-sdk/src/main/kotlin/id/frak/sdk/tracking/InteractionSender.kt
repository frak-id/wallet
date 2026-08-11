package id.frak.sdk.tracking

import id.frak.sdk.applink.ReferralArrival
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import org.json.JSONObject

/** `POST /user/track/interaction`. [QueuedRow.payload] is the wire body minus `merchantId`, filled in here. */
internal class InteractionSender(
    private val logger: FrakLogger,
) : RowSender {
    override suspend fun deliver(
        row: QueuedRow,
        ctx: SendContext,
    ): DeliveryOutcome {
        val merchantId = row.merchantId ?: ctx.resolveMerchantId() ?: return DeliveryOutcome.Hold
        val body = JSONObject(row.payload.toString()).put(MERCHANT_ID_KEY, merchantId)

        if (isForeignMerchantArrival(body)) {
            logger.info("Dropping an arrival captured for another merchant.")
            return DeliveryOutcome.Dropped
        }

        val response =
            try {
                ctx.http.post(PATH, body.toString(), clientIdHeaders(row))
            } catch (failure: FrakError) {
                return DeliveryOutcome.Retryable(failure)
            }

        return classifyStatus(response)
    }

    /**
     * The arrival guard re-run at send time. [id.frak.sdk.applink.ReferralArrival] runs it at
     * capture, where a cold cache leaves it with no own merchant to compare against and it
     * deliberately fails open; here the merchant is known, so a foreign one can finally be caught.
     */
    private fun isForeignMerchantArrival(body: JSONObject): Boolean {
        if (body.opt("type") != ARRIVAL_TYPE) return false
        // Absent on a V1 context, which carries no merchant to disagree with.
        val referrer = body.opt("referrerMerchantId") as? String ?: return false
        val own = body.opt(MERCHANT_ID_KEY) as? String ?: return false
        return !ReferralArrival.sameMerchant(referrer, own)
    }

    companion object {
        const val KIND = "interaction"
        const val PATH = "/user/track/interaction"

        private const val MERCHANT_ID_KEY = "merchantId"
        private const val ARRIVAL_TYPE = "arrival"
    }
}
