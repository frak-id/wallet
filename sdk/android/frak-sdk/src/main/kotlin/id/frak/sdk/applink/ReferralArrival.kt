package id.frak.sdk.applink

import id.frak.sdk.sharing.FrakContext
import id.frak.sdk.tracking.Interaction

/** Turning an inbound referral context into an arrival, and deciding whether to. */
internal object ReferralArrival {
    /**
     * Mandatory before any arrival is tracked. Ignores two shapes of inbound context:
     * - a self-referral: this device's own [anonymousId] as the link's `clientId`, or a user
     *   resharing their own link corrupts the referral graph;
     * - a foreign-merchant referral: a V2 context whose `merchantId` is not [ownMerchantId].
     *   V1 carries no `merchantId` at all, so this guard cannot apply to it — a V1 link from any
     *   merchant is still tracked as this merchant's arrival. That bypass is open, see 3.2 in
     *   `06-open-findings.md`.
     *
     * [ownMerchantId] is best-effort (the cached config, not a fresh resolve, since arrival
     * handling is fire-and-forget and must not block on network): null means "unknown", which
     * lets the context through rather than discard telemetry the SDK hasn't resolved its own
     * merchant for yet.
     *
     * The merchant-id comparison is case-insensitive and trims whitespace: [ownMerchantId] comes
     * from either the merchant's own free-typed [id.frak.sdk.core.FrakConfig.merchantId] or the
     * backend's canonical form, `context.merchantId` was minted by (possibly another build of)
     * this same merchant's app — an exact-match compare would silently drop genuine referrals on
     * nothing more than a casing difference.
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
