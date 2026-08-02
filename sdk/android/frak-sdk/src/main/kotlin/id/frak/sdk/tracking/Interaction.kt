package id.frak.sdk.tracking

/**
 * Something the user did that the merchant wants attributed. Closed to the three shapes
 * `POST /user/track/interaction` accepts; use [Custom] for anything else. Not `data class`es,
 * see note in `id.frak.sdk.core.FrakConfig`.
 */
public sealed interface Interaction {
    public class Arrival(
        public val referrerWallet: String? = null,
        public val referrerClientId: String? = null,
        public val referrerMerchantId: String? = null,
        public val referralTimestamp: Long? = null,
    ) : Interaction

    public class Sharing(
        public val sharingTimestamp: Long? = null,
        public val purchaseId: String? = null,
    ) : Interaction

    public class Custom(
        public val customType: String,
        public val data: Map<String, String> = emptyMap(),
        /** Overrides the key the SDK stamps at enqueue; leave null to let the SDK stamp one. */
        public val idempotencyKey: String? = null,
    ) : Interaction
}
