/// A reward amount in raw token units and in each fiat currency the backend prices.
///
/// Fiat fields are `0` when unpriced, not when the reward is worthless — prefer
/// `BestReward.formatted`.
public struct TokenAmount: Sendable, Hashable {
    /// Raw token units. Non-zero even when every fiat field is zero.
    public let amount: Double
    public let eurAmount: Double
    public let usdAmount: Double
    public let gbpAmount: Double

    public init(amount: Double, eurAmount: Double, usdAmount: Double, gbpAmount: Double) {
        self.amount = amount
        self.eurAmount = eurAmount
        self.usdAmount = usdAmount
        self.gbpAmount = gbpAmount
    }
}

/// One band of a tiered reward.
///
/// `maxValue` is absent on an open-ended top tier rather than set to a sentinel, so
/// nil genuinely means "no upper bound".
public enum RewardTier: Sendable, Hashable {
    case amount(minValue: Double, maxValue: Double?, amount: TokenAmount)
    case percentage(minValue: Double, maxValue: Double?, percent: Double)

    public var minValue: Double {
        switch self {
        case .amount(let minValue, _, _), .percentage(let minValue, _, _):
            return minValue
        }
    }

    public var maxValue: Double? {
        switch self {
        case .amount(_, let maxValue, _), .percentage(_, let maxValue, _):
            return maxValue
        }
    }
}

/// What a campaign pays out. `.percentage` has no concrete amount to advertise, so
/// it is suppressed from display. `.unknown` covers a `payoutType` newer than this binary.
public enum EstimatedReward: Sendable, Hashable {
    case fixed(amount: TokenAmount)
    case percentage(percent: Double, percentOf: String, maxAmount: TokenAmount?, minAmount: TokenAmount?)
    case tiered(tierField: String, tiers: [RewardTier])
    case unknown(payoutType: String)
}

/// One active campaign, as returned by `GET /user/merchant/estimated-rewards`.
///
/// Arrives sorted by campaign priority, descending; do not re-sort it.
public struct Campaign: Sendable, Hashable {
    public let campaignId: String
    public let name: String
    /// The interaction that triggers this campaign, e.g. `purchase`. Open on the wire.
    public let interactionTypeKey: String
    /// What the sharer earns. Absent when the campaign rewards only the referee.
    public let referrer: EstimatedReward?
    /// What the person arriving through the link earns.
    public let referee: EstimatedReward?
    public let defaultLockupSeconds: Double?
    public let maxRewardsPerUser: Double?
    /// ISO-8601 expiry, or nil for a campaign that never expires.
    public let expiresAt: String?

    public init(
        campaignId: String,
        name: String,
        interactionTypeKey: String,
        referrer: EstimatedReward? = nil,
        referee: EstimatedReward? = nil,
        defaultLockupSeconds: Double? = nil,
        maxRewardsPerUser: Double? = nil,
        expiresAt: String? = nil
    ) {
        self.campaignId = campaignId
        self.name = name
        self.interactionTypeKey = interactionTypeKey
        self.referrer = referrer
        self.referee = referee
        self.defaultLockupSeconds = defaultLockupSeconds
        self.maxRewardsPerUser = maxRewardsPerUser
        self.expiresAt = expiresAt
    }
}

/// The single reward worth advertising, selected and formatted by the server, so
/// every surface shows an identical number.
///
/// `formatted` contains a non-breaking space (U+00A0) before the currency symbol —
/// render it as-is, never compare it against an ordinary-space string.
public struct BestReward: Sendable, Hashable {
    public let formatted: String
    /// Which shape `formatted` describes: `fixed`, `percentage` or `tiered`. A plain
    /// `String` so a payout type newer than this binary still decodes.
    public let payoutType: String
    public let minPurchaseAmount: String?
    public let minPurchaseValue: Double?
    public let lockupDurationDays: Double?
    /// Whether the selected campaign is gated to a `productScope`. The gate, not the reward's
    /// basis — a product-gated campaign can still pay a percentage of the whole basket.
    /// Defaults to `false` so a backend that predates this field still decodes.
    public let isProductScoped: Bool
    /// The subset of the products this call supplied that matched the winning campaign's
    /// scope. `nil` for an unscoped winner, or when no products were supplied.
    public let matchedProducts: [ProductDetails]?

    public init(
        formatted: String,
        payoutType: String,
        minPurchaseAmount: String? = nil,
        minPurchaseValue: Double? = nil,
        lockupDurationDays: Double? = nil,
        isProductScoped: Bool = false,
        matchedProducts: [ProductDetails]? = nil
    ) {
        self.formatted = formatted
        self.payoutType = payoutType
        self.minPurchaseAmount = minPurchaseAmount
        self.minPurchaseValue = minPurchaseValue
        self.lockupDurationDays = lockupDurationDays
        self.isProductScoped = isProductScoped
        self.matchedProducts = matchedProducts
    }
}

/// Who a reward is estimated for: the sharer (`.referrer`) or the person arriving
/// through the link (`.referee`).
public enum RewardAudience: String, Sendable, CaseIterable, Hashable {
    case referrer
    case referee
}
