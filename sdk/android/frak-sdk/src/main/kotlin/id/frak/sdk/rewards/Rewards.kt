package id.frak.sdk.rewards

import id.frak.sdk.core.ProductDetails

/** A reward amount in raw token units and each fiat currency the backend prices. */
public class TokenAmount(
    /** Non-zero even when every fiat field is zero (fiat is `0` when unpriced, not worthless). */
    public val amount: Double,
    public val eurAmount: Double,
    public val usdAmount: Double,
    public val gbpAmount: Double,
) {
    override fun toString(): String =
        "TokenAmount(amount=$amount, eurAmount=$eurAmount, usdAmount=$usdAmount, gbpAmount=$gbpAmount)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is TokenAmount) return false
        return amount == other.amount &&
            eurAmount == other.eurAmount &&
            usdAmount == other.usdAmount &&
            gbpAmount == other.gbpAmount
    }

    override fun hashCode(): Int {
        var result = amount.hashCode()
        result = 31 * result + eurAmount.hashCode()
        result = 31 * result + usdAmount.hashCode()
        result = 31 * result + gbpAmount.hashCode()
        return result
    }
}

/** One band of a tiered reward. Null `maxValue` means no upper bound (not a sentinel). */
public sealed class RewardTier {
    public abstract val minValue: Double
    public abstract val maxValue: Double?

    public class Amount(
        override val minValue: Double,
        override val maxValue: Double?,
        public val amount: TokenAmount,
    ) : RewardTier() {
        override fun toString(): String = "RewardTier.Amount(minValue=$minValue, maxValue=$maxValue, amount=$amount)"

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Amount) return false
            return minValue == other.minValue && maxValue == other.maxValue && amount == other.amount
        }

        override fun hashCode(): Int {
            var result = minValue.hashCode()
            result = 31 * result + (maxValue?.hashCode() ?: 0)
            result = 31 * result + amount.hashCode()
            return result
        }
    }

    public class Percentage(
        override val minValue: Double,
        override val maxValue: Double?,
        public val percent: Double,
    ) : RewardTier() {
        override fun toString(): String =
            "RewardTier.Percentage(minValue=$minValue, maxValue=$maxValue, percent=$percent)"

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Percentage) return false
            return minValue == other.minValue && maxValue == other.maxValue && percent == other.percent
        }

        override fun hashCode(): Int {
            var result = minValue.hashCode()
            result = 31 * result + (maxValue?.hashCode() ?: 0)
            result = 31 * result + percent.hashCode()
            return result
        }
    }
}

/** What a campaign pays out. [Percentage] has no concrete amount so it's suppressed from display. */
public sealed class EstimatedReward {
    public class Fixed(
        public val amount: TokenAmount,
    ) : EstimatedReward() {
        override fun toString(): String = "EstimatedReward.Fixed(amount=$amount)"

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Fixed) return false
            return amount == other.amount
        }

        override fun hashCode(): Int = amount.hashCode()
    }

    public class Percentage(
        public val percent: Double,
        /** What the percentage applies to, e.g. `purchase_amount`. Open on the wire. */
        public val percentOf: String,
        public val maxAmount: TokenAmount?,
        public val minAmount: TokenAmount?,
    ) : EstimatedReward() {
        override fun toString(): String =
            "EstimatedReward.Percentage(percent=$percent, percentOf=$percentOf, " +
                "maxAmount=$maxAmount, minAmount=$minAmount)"

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Percentage) return false
            return percent == other.percent &&
                percentOf == other.percentOf &&
                maxAmount == other.maxAmount &&
                minAmount == other.minAmount
        }

        override fun hashCode(): Int {
            var result = percent.hashCode()
            result = 31 * result + percentOf.hashCode()
            result = 31 * result + (maxAmount?.hashCode() ?: 0)
            result = 31 * result + (minAmount?.hashCode() ?: 0)
            return result
        }
    }

    public class Tiered(
        public val tierField: String,
        public val tiers: List<RewardTier>,
    ) : EstimatedReward() {
        override fun toString(): String = "EstimatedReward.Tiered(tierField=$tierField, tiers=$tiers)"

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Tiered) return false
            return tierField == other.tierField && tiers == other.tiers
        }

        override fun hashCode(): Int = 31 * tierField.hashCode() + tiers.hashCode()
    }

    /** A payout type newer than this binary. Never rendered, never dropped. */
    public class Unknown(
        public val payoutType: String,
    ) : EstimatedReward() {
        override fun toString(): String = "EstimatedReward.Unknown(payoutType=$payoutType)"

        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Unknown) return false
            return payoutType == other.payoutType
        }

        override fun hashCode(): Int = payoutType.hashCode()
    }
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
) {
    override fun toString(): String =
        "Campaign(campaignId=$campaignId, name=$name, interactionTypeKey=$interactionTypeKey, " +
            "referrer=$referrer, referee=$referee, defaultLockupSeconds=$defaultLockupSeconds, " +
            "maxRewardsPerUser=$maxRewardsPerUser, expiresAt=$expiresAt)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Campaign) return false
        return campaignId == other.campaignId &&
            name == other.name &&
            interactionTypeKey == other.interactionTypeKey &&
            referrer == other.referrer &&
            referee == other.referee &&
            defaultLockupSeconds == other.defaultLockupSeconds &&
            maxRewardsPerUser == other.maxRewardsPerUser &&
            expiresAt == other.expiresAt
    }

    override fun hashCode(): Int {
        var result = campaignId.hashCode()
        result = 31 * result + name.hashCode()
        result = 31 * result + interactionTypeKey.hashCode()
        result = 31 * result + (referrer?.hashCode() ?: 0)
        result = 31 * result + (referee?.hashCode() ?: 0)
        result = 31 * result + (defaultLockupSeconds?.hashCode() ?: 0)
        result = 31 * result + (maxRewardsPerUser?.hashCode() ?: 0)
        result = 31 * result + (expiresAt?.hashCode() ?: 0)
        return result
    }
}

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
    /** Whether the selected campaign is gated to a `productScope`; not the reward's basis. */
    public val isProductScoped: Boolean,
    /** The requested products matching the winning campaign's scope; null when unscoped or none requested. */
    public val matchedProducts: List<ProductDetails>?,
) {
    override fun toString(): String =
        "BestReward(formatted=$formatted, payoutType=$payoutType, minPurchaseAmount=$minPurchaseAmount, " +
            "minPurchaseValue=$minPurchaseValue, lockupDurationDays=$lockupDurationDays, " +
            "isProductScoped=$isProductScoped, matchedProducts=$matchedProducts)"

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is BestReward) return false
        return formatted == other.formatted &&
            payoutType == other.payoutType &&
            minPurchaseAmount == other.minPurchaseAmount &&
            minPurchaseValue == other.minPurchaseValue &&
            lockupDurationDays == other.lockupDurationDays &&
            isProductScoped == other.isProductScoped &&
            matchedProducts == other.matchedProducts
    }

    override fun hashCode(): Int {
        var result = formatted.hashCode()
        result = 31 * result + payoutType.hashCode()
        result = 31 * result + (minPurchaseAmount?.hashCode() ?: 0)
        result = 31 * result + (minPurchaseValue?.hashCode() ?: 0)
        result = 31 * result + (lockupDurationDays?.hashCode() ?: 0)
        result = 31 * result + isProductScoped.hashCode()
        result = 31 * result + (matchedProducts?.hashCode() ?: 0)
        return result
    }
}

/** Who a reward is being estimated for: sharer ([REFERRER]) or arriving referee ([REFEREE]). */
public enum class RewardAudience(
    public val wireValue: String,
) {
    REFERRER("referrer"),
    REFEREE("referee"),
}
