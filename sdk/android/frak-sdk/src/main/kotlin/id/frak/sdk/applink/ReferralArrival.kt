package id.frak.sdk.applink

import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.tracking.Interaction

/** Turning an inbound referral context into an arrival, and deciding whether to. */
internal object ReferralArrival {
    /**
     * Mandatory before any arrival is tracked. Ignores a self-referral (this device's own
     * [anonymousId] as the link's `clientId`) and a foreign-merchant V2 referral. V1 carries no
     * `merchantId`, so a V1 link from any merchant is still tracked as this merchant's arrival.
     *
     * [ownMerchantId] is best-effort (cached config, not a fresh resolve): null lets the context
     * through rather than discard telemetry.
     *
     * The merchant-id comparison is case-insensitive and trims whitespace: [ownMerchantId] and
     * `context.merchantId` may differ only by casing between a free-typed config value and the
     * backend's canonical form.
     */
    fun shouldIgnoreArrival(
        context: FrakContext,
        anonymousId: String?,
        ownMerchantId: String? = null,
    ): Boolean =
        when (context) {
            // No merchantId on a V1 context to compare against ownMerchantId — see the doc above.
            is FrakContext.V1 -> {
                false
            }

            is FrakContext.V2 -> {
                val sameDevice = anonymousId != null && context.clientId == anonymousId
                val foreignMerchant = ownMerchantId != null && !sameMerchant(context.merchantId, ownMerchantId)
                sameDevice || foreignMerchant
            }
        }

    private fun sameMerchant(
        a: String,
        b: String,
    ): Boolean = a.trim().equals(b.trim(), ignoreCase = true)

    fun arrivalFrom(context: FrakContext): Interaction =
        when (context) {
            is FrakContext.V1 -> {
                Interaction.arrival(
                    referrerWallet = context.wallet,
                    // V1 carries an address and nothing else. That is finding 3.2: with no
                    // merchantId on the wire there is no way to tell a V1 link from this merchant
                    // apart from a V1 link from any other.
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
