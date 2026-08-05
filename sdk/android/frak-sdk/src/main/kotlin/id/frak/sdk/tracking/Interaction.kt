package id.frak.sdk.tracking

/**
 * Something the user did that the merchant wants attributed. Closed to the three shapes
 * `POST /user/track/interaction` accepts; use [Custom] for anything else.
 *
 * Not `data class`es: a published `copy()`/`componentN()` would enter the ABI and could never be
 * removed. See the note at the top of `sharing/SharingRequest.kt` for the wider rule.
 *
 * **The only type on the public surface still carrying default arguments**, eight across the three
 * classes below, and deliberately not converted to a `Builder`: this hierarchy is collapsing to an
 * opaque type with `@JvmStatic` factories (`docs/plans/native-sdk/09-android-api-surface.md` §4),
 * which removes the constructors rather than rewriting them. Converting first and collapsing after
 * would freeze a shape twice.
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
