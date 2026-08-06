package id.frak.sdk.tracking

/**
 * Something the user did that the merchant wants attributed. Closed to the three shapes
 * `POST /user/track/interaction` accepts; use [custom] for anything else.
 *
 * **An opaque type with static factories, not a sealed hierarchy.** It used to be a
 * `sealed interface` with three publicly-constructible classes, which made it inspectable and
 * exhaustively matchable — and made adding a fourth shape a compile break for any consumer who had
 * written an exhaustive `when`. iOS took the opposite design from the start (an opaque `struct` over
 * an internal `Kind` enum with static factories) and nothing documented the asymmetry; that is
 * finding 9.8, and this is Android converging on the iOS shape rather than the reverse. Four things
 * fall out of it at once:
 *
 *  - **A new shape is additive.** No consumer has a `when` this can break, because there is nothing
 *    to match on (A2).
 *  - **One fewer sealed hierarchy in the frozen surface.** [Kind] is `internal`, so it never enters
 *    the `.api` dump, and neither do the eight default arguments the three classes used to carry.
 *  - **Java gets the same API as Kotlin.** `@JvmStatic` factories are `Interaction.custom("x")` from
 *    Java, where a sealed hierarchy would have been `instanceof` chains and a `when` to fake.
 *  - **No default arguments**, per the rule in `sharing/SharingRequest.kt`: the optional shapes get
 *    explicit overloads instead.
 *
 * The cost is that an `Interaction` cannot be introspected field by field or switched over. That is
 * acceptable because the *value* is write-only: you build one and hand it to
 * [id.frak.sdk.TrackingApi.track], and nothing reads one back out.
 *
 * It is emphatically **not** acceptable for the value to be un-comparable and un-printable, though,
 * because the *code that builds* an interaction is ordinary merchant code that wants a test. So
 * `equals`/`hashCode`/`toString` are structural, over the whole payload — a merchant's
 * `assertEquals(Interaction.custom("checkout"), theirBuilder())` works, and a log line prints the
 * shape and its fields. iOS's twin is `Hashable` and pins exactly that in its own surface test; this
 * is the same guarantee, and getting it wrong would have been a fresh instance of finding 9.9.
 */
public class Interaction internal constructor(
    internal val kind: Kind,
) {
    /**
     * The three wire shapes. `internal`, which is the whole point: the payload is
     * `InteractionTracker`'s business, and keeping it out of the public surface is what makes a
     * fourth shape additive.
     */
    internal sealed interface Kind {
        // `data class`es, unlike everything else on this surface: these are `internal`, so the
        // generated `copy()`/`componentN()` can never enter the `.api` dump and the usual objection
        // does not apply. What they buy is the structural `equals`/`hashCode`/`toString` that
        // `Interaction` delegates to below, hand-written nowhere.
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
         * A referral arrival. **Built for you** by
         * [id.frak.sdk.AppLinkApi.handleReferral], which also applies the self-referral guard and
         * the merchant check — calling this and tracking the result yourself for a link the SDK has
         * already handled double-counts the arrival.
         *
         * One full-arity factory rather than a set of overloads: every field is optional on the
         * wire, a merchant essentially never builds one of these, and four nullable arguments spelled
         * out is clearer at the one call site that does than four overloads would be.
         *
         * Carries no idempotency key — the `arrival` schema has none, so a re-send is a duplicate.
         * That is why `handleReferral` guards re-delivery rather than relying on the backend.
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

        /**
         * A share tied to a purchase, timestamped at enqueue. The common merchant call: "they shared,
         * after this order", with no better answer for *when* than now.
         */
        @JvmStatic
        public fun sharing(purchaseId: String?): Interaction = sharing(sharingTimestamp = null, purchaseId = purchaseId)

        /**
         * A share with an explicit timestamp and/or the purchase it followed.
         *
         * A null [sharingTimestamp] is stamped at enqueue, so an event that sits in the queue across
         * a restart still reports when the share happened rather than when it was finally delivered.
         * Supply one only if you have a better answer than "now".
         */
        @JvmStatic
        public fun sharing(
            sharingTimestamp: Long?,
            purchaseId: String?,
        ): Interaction = Interaction(Kind.Sharing(sharingTimestamp = sharingTimestamp, purchaseId = purchaseId))

        /**
         * Anything the three built-in shapes do not cover. [customType] is free-form; the route's
         * schema is the authority, so an unrecognised value comes back as a 4xx the flush loop evicts.
         */
        @JvmStatic
        public fun custom(customType: String): Interaction = custom(customType, emptyMap(), null)

        /** [data] is sent verbatim as the event's `data` object. */
        @JvmStatic
        public fun custom(
            customType: String,
            data: Map<String, String>,
        ): Interaction = custom(customType, data, null)

        /**
         * @param idempotencyKey overrides the key the SDK stamps at enqueue. Only worth supplying if
         *   you can reproduce the same value across a process restart — otherwise the SDK's own key
         *   is strictly better, since it is minted once and persisted with the event.
         */
        @JvmStatic
        public fun custom(
            customType: String,
            data: Map<String, String>,
            idempotencyKey: String?,
        ): Interaction =
            Interaction(
                Kind.Custom(
                    customType = customType,
                    // Copied: the map is handed to a queue that outlives this call, and a caller who
                    // kept a reference to a mutable map could otherwise change an event already
                    // enqueued.
                    data = data.toMap(),
                    idempotencyKey = idempotencyKey,
                ),
            )
    }

    /** Structural, over [kind] — see the note in this class's KDoc for why an opaque type still has it. */
    override fun equals(other: Any?): Boolean = other is Interaction && other.kind == kind

    override fun hashCode(): Int = kind.hashCode()

    /**
     * Names the shape and its fields, e.g. `Interaction(Custom(customType=checkout, data={}, …))`.
     * Deliberately leans on [Kind]'s generated `toString`: an interaction that cannot be printed is
     * one a merchant cannot debug.
     */
    override fun toString(): String = "Interaction($kind)"
}
