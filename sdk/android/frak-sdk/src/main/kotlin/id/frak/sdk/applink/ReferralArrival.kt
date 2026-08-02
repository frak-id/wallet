package id.frak.sdk.applink

import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.tracking.Interaction

/** Turning an inbound referral context into an arrival, and deciding whether to. */
internal object ReferralArrival {
    /** Mandatory before any arrival is tracked, or a user resharing their own link corrupts the referral graph. */
    fun isSelfReferral(
        context: FrakContext,
        anonymousId: String?,
    ): Boolean =
        when (context) {
            is FrakContext.V1 -> false
            is FrakContext.V2 -> anonymousId != null && context.clientId == anonymousId
        }

    fun arrivalFrom(context: FrakContext): Interaction.Arrival =
        when (context) {
            is FrakContext.V1 -> {
                Interaction.Arrival(referrerWallet = context.wallet)
            }

            is FrakContext.V2 -> {
                Interaction.Arrival(
                    referrerWallet = context.wallet,
                    referrerClientId = context.clientId,
                    referrerMerchantId = context.merchantId,
                    referralTimestamp = context.timestamp,
                )
            }
        }
}
