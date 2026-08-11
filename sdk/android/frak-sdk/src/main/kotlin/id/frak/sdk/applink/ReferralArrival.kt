package id.frak.sdk.applink

import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.tracking.Interaction

/** Turning an inbound referral context into an arrival, and deciding whether to. */
internal object ReferralArrival {
    /**
     * Mandatory before any arrival is tracked. Ignores a self-referral (this device's own
     * [anonymousId] as the link's `clientId`) and a foreign-merchant V2 referral; a V1 link carries
     * no `merchantId`, so it counts as this merchant's. A null [ownMerchantId] lets it through.
     */
    fun shouldIgnoreArrival(
        context: FrakContext,
        anonymousId: String?,
        ownMerchantId: String? = null,
    ): Boolean =
        when (context) {
            // A V1 context has no merchantId to compare against ownMerchantId.
            is FrakContext.V1 -> {
                false
            }

            is FrakContext.V2 -> {
                val sameDevice = anonymousId != null && context.clientId == anonymousId
                val foreignMerchant = ownMerchantId != null && !sameMerchant(context.merchantId, ownMerchantId)
                sameDevice || foreignMerchant
            }
        }

    /** Trim + case-insensitive: shared with [id.frak.sdk.tracking.InteractionSender]'s send-time guard. */
    internal fun sameMerchant(
        a: String,
        b: String,
    ): Boolean = a.trim().equals(b.trim(), ignoreCase = true)

    fun arrivalFrom(context: FrakContext): Interaction =
        when (context) {
            is FrakContext.V1 -> {
                Interaction.arrival(
                    referrerWallet = context.wallet,
                    // V1 carries an address and nothing else
                    referrerClientId = null,
                    referrerMerchantId = null,
                    referralTimestamp = null,
                )
            }

            is FrakContext.V2 -> {
                Interaction.arrival(
                    referrerWallet = context.wallet,
                    referrerClientId = context.clientId,
                    referrerMerchantId = context.merchantId,
                    referralTimestamp = context.timestamp,
                )
            }
        }
}
