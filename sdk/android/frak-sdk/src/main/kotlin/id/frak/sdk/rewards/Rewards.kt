package id.frak.sdk.rewards

/** A reward amount in raw token units and each fiat currency the backend prices. */
public class TokenAmount(
    /** Non-zero even when every fiat field is zero (fiat is `0` when unpriced, not worthless). */
    public val amount: Double,
    public val eurAmount: Double,
    public val usdAmount: Double,
    public val gbpAmount: Double,
)

/** One band of a tiered reward. Null `maxValue` means no upper bound (not a sentinel). */
public sealed class RewardTier {
    public abstract val minValue: Double
    public abstract val maxValue: Double?

    public class Amount(
        override val minValue: Double,
        override val maxValue: Double?,
        public val amount: TokenAmount,
    ) : RewardTier()

    public class Percentage(
        override val minValue: Double,
        override val maxValue: Double?,
        public val percent: Double,
    ) : RewardTier()
}

/** What a campaign pays out. [Percentage] has no concrete amount so it's suppressed from display. */
public sealed class EstimatedReward {
    public class Fixed(
        public val amount: TokenAmount,
    ) : EstimatedReward()

    public class Percentage(
        public val percent: Double,
        /** What the percentage applies to, e.g. `purchase_amount`. Open on the wire. */
        public val percentOf: String,
        public val maxAmount: TokenAmount?,
        public val minAmount: TokenAmount?,
    ) : EstimatedReward()

    public class Tiered(
        public val tierField: String,
        public val tiers: List<RewardTier>,
    ) : EstimatedReward()

    /** A payout type newer than this binary. Never rendered, never dropped. */
    public class Unknown(
        public val payoutType: String,
    ) : EstimatedReward()
}

/** One active campaign. Arrives sorted by priority descending; do not re-sort. */
public class Campaign(
    public val campaignId: String,
    public val name: String,
    /** The interaction that triggers this campaign, e.g. `purchase`. Open on the wire. */
    public val interactionTypeKey: String,
    /** What the sharer earns. Absent when the campaign rewards only the referee. */
    public val referrer: EstimatedReward?,
    /** What the person arriving through the link earns. */
    public val referee: EstimatedReward?,
    /** Whole days a reward is locked before it can be claimed, when configured. */
    public val defaultLockupSeconds: Double?,
    public val maxRewardsPerUser: Double?,
    /** ISO-8601 expiry, or null for a campaign that never expires. */
    public val expiresAt: String?,
)

/**
 * The single reward worth advertising, formatted server-side. [formatted] contains a
 * non-breaking space (U+00A0) before the currency symbol; render as-is, do not reformat.
 */
public class BestReward(
    public val formatted: String,
    /** `fixed`/`percentage`/`tiered`. `String`, not an enum, so a new server value still decodes. */
    public val payoutType: String,
    public val minPurchaseAmount: String?,
    public val minPurchaseValue: Double?,
    public val lockupDurationDays: Double?,
)

/** Who a reward is being estimated for: sharer ([REFERRER]) or arriving referee ([REFEREE]). */
public enum class RewardAudience(
    public val wireValue: String,
) {
    REFERRER("referrer"),
    REFEREE("referee"),
}
