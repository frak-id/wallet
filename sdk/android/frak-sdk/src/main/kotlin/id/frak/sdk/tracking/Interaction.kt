package id.frak.sdk.tracking

/**
 * Something the user did that the merchant wants attributed. Closed to the three shapes
 * `POST /user/track/interaction` accepts; use [custom] for anything else.
 */
public class Interaction internal constructor(
    internal val kind: Kind,
) {
    internal sealed interface Kind {
        data class Arrival(
            val referrerWallet: String?,
            val referrerClientId: String?,
            val referrerMerchantId: String?,
            val referralTimestamp: Long?,
        ) : Kind

        data class Sharing(
            val sharingTimestamp: Long?,
            val purchaseId: String?,
        ) : Kind

        data class Custom(
            val customType: String,
            val data: Map<String, String>,
            val idempotencyKey: String?,
        ) : Kind
    }

    public companion object {
        /**
         * A referral arrival. Built for you by [id.frak.sdk.AppLinkApi.handleReferral]; tracking one
         * yourself for a link the SDK already handled double-counts it, as the `arrival` schema
         * carries no idempotency key.
         */
        @JvmStatic
        public fun arrival(
            referrerWallet: String?,
            referrerClientId: String?,
            referrerMerchantId: String?,
            referralTimestamp: Long?,
        ): Interaction =
            Interaction(
                Kind.Arrival(
                    referrerWallet = referrerWallet,
                    referrerClientId = referrerClientId,
                    referrerMerchantId = referrerMerchantId,
                    referralTimestamp = referralTimestamp,
                ),
            )

        /** A share, timestamped at enqueue. What the sharing sheet reports when the user shares. */
        @JvmStatic
        public fun sharing(): Interaction = sharing(sharingTimestamp = null, purchaseId = null)

        /** A share tied to a purchase, timestamped at enqueue. */
        @JvmStatic
        public fun sharing(purchaseId: String?): Interaction = sharing(sharingTimestamp = null, purchaseId = purchaseId)

        /**
         * A share with an explicit timestamp and/or the purchase it followed. [sharingTimestamp] is
         * Unix SECONDS; null is stamped at enqueue, so a queued event reports when the share
         * happened rather than when it was delivered.
         */
        @JvmStatic
        public fun sharing(
            sharingTimestamp: Long?,
            purchaseId: String?,
        ): Interaction = Interaction(Kind.Sharing(sharingTimestamp = sharingTimestamp, purchaseId = purchaseId))

        /**
         * Anything the three built-in shapes do not cover. [customType] is free-form; the route's
         * schema is the authority, so an unrecognised value comes back as a 4xx.
         */
        @JvmStatic
        public fun custom(customType: String): Interaction = custom(customType, emptyMap(), null)

        /** [data] is sent verbatim as the event's `data` object. */
        @JvmStatic
        public fun custom(
            customType: String,
            data: Map<String, String>,
        ): Interaction = custom(customType, data, null)

        /** @param idempotencyKey overrides the key the SDK stamps at enqueue. */
        @JvmStatic
        public fun custom(
            customType: String,
            data: Map<String, String>,
            idempotencyKey: String?,
        ): Interaction =
            Interaction(
                Kind.Custom(
                    customType = customType,
                    // copied: the map is handed to a queue that outlives this call
                    data = data.toMap(),
                    idempotencyKey = idempotencyKey,
                ),
            )
    }

    override fun equals(other: Any?): Boolean = other is Interaction && other.kind == kind

    override fun hashCode(): Int = kind.hashCode()

    override fun toString(): String = "Interaction($kind)"
}
