import Foundation

/// The decoded `GET /user/merchant/estimated-rewards` body.
struct EstimatedRewardsResult: Sendable {
    let campaigns: [Campaign]
    /// Present only when `?formatted=1` was sent and a campaign was selected.
    let best: BestReward?
}

/// Turns a `GET /user/merchant/estimated-rewards` body into typed models.
///
/// `conditions`/`productScope` (the recursive rule-conditions tree) are not decoded:
/// nothing reads them yet.
enum RewardsDecoder {
    private struct Wire: Decodable {
        let rewards: [Campaign]
        let best: BestReward?

        private enum CodingKeys: String, CodingKey {
            case rewards, best
        }

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            rewards = try container.decodeIfPresent(ForgivingArray<Campaign>.self, forKey: .rewards)?.elements ?? []
            best = try container.decodeForgivingObject(BestReward.self, forKey: .best)
        }
    }

    static func decode(_ body: Data) throws -> EstimatedRewardsResult {
        let wire = try JSONDecoding.decode(Wire.self, from: body)
        return EstimatedRewardsResult(campaigns: wire.rewards, best: wire.best)
    }
}

/// `payoutType` dispatches the shape; an unrecognised value degrades to `.unknown`
/// rather than an error or a dropped campaign. A genuinely missing `payoutType` is
/// a contract break and fails decode, like any other missing required field.
extension EstimatedReward: Decodable {
    private enum CodingKeys: String, CodingKey {
        case payoutType, amount, percent, percentOf, maxAmount, minAmount, tierField, tiers
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let payoutType = try container.decode(String.self, forKey: .payoutType)
        switch payoutType {
        case "fixed":
            self = .fixed(amount: try container.decode(TokenAmount.self, forKey: .amount))
        case "percentage":
            self = .percentage(
                percent: try container.decode(Double.self, forKey: .percent),
                percentOf: try container.decode(String.self, forKey: .percentOf),
                maxAmount: try container.decodeForgivingObject(TokenAmount.self, forKey: .maxAmount),
                minAmount: try container.decodeForgivingObject(TokenAmount.self, forKey: .minAmount)
            )
        case "tiered":
            self = .tiered(
                tierField: try container.decode(String.self, forKey: .tierField),
                tiers: try container.decodeIfPresent(ForgivingArray<RewardTier>.self, forKey: .tiers)?.elements ?? []
            )
        default:
            self = .unknown(payoutType: payoutType)
        }
    }
}

/// No discriminator field on a tier; presence of `percent` is the discriminator,
/// matching the producer.
extension RewardTier: Decodable {
    private enum CodingKeys: String, CodingKey {
        case minValue, maxValue, percent, amount
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let minValue = try container.decode(Double.self, forKey: .minValue)
        let maxValue = container.decodeForgiving(Double.self, forKey: .maxValue)
        if let percent = container.decodeForgiving(Double.self, forKey: .percent) {
            self = .percentage(minValue: minValue, maxValue: maxValue, percent: percent)
        } else {
            self = .amount(
                minValue: minValue,
                maxValue: maxValue,
                amount: try container.decode(TokenAmount.self, forKey: .amount)
            )
        }
    }
}

/// Required fields still fail decode; every optional degrades to nil so one reshaped
/// field cannot take down the whole rewards call on a frozen merchant binary.
extension Campaign {
    private enum CodingKeys: String, CodingKey {
        case campaignId, name, interactionTypeKey, referrer, referee, defaultLockupSeconds, maxRewardsPerUser,
            expiresAt
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        campaignId = try container.decode(String.self, forKey: .campaignId)
        name = try container.decode(String.self, forKey: .name)
        interactionTypeKey = try container.decode(String.self, forKey: .interactionTypeKey)
        referrer = try container.decodeForgivingObject(EstimatedReward.self, forKey: .referrer)
        referee = try container.decodeForgivingObject(EstimatedReward.self, forKey: .referee)
        defaultLockupSeconds = container.decodeForgiving(Double.self, forKey: .defaultLockupSeconds)
        maxRewardsPerUser = container.decodeForgiving(Double.self, forKey: .maxRewardsPerUser)
        expiresAt = container.decodeForgiving(String.self, forKey: .expiresAt)
    }
}

/// Same contract as `Campaign`: `formatted` and `payoutType` are the display contract and
/// stay required; the supporting detail fields degrade to nil.
///
/// `isProductScoped`/`matchedProducts` degrade to `false`/`nil` rather than failing decode when
/// absent, so a backend that predates product scoping still decodes cleanly.
extension BestReward {
    private enum CodingKeys: String, CodingKey {
        case formatted, payoutType, minPurchaseAmount, minPurchaseValue, lockupDurationDays, isProductScoped,
            matchedProducts
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        formatted = try container.decode(String.self, forKey: .formatted)
        payoutType = try container.decode(String.self, forKey: .payoutType)
        minPurchaseAmount = container.decodeForgiving(String.self, forKey: .minPurchaseAmount)
        minPurchaseValue = container.decodeForgiving(Double.self, forKey: .minPurchaseValue)
        lockupDurationDays = container.decodeForgiving(Double.self, forKey: .lockupDurationDays)
        isProductScoped = container.decodeForgiving(Bool.self, forKey: .isProductScoped) ?? false
        // Empty folds to nil, so "the winner is unscoped" is one value rather than two a caller
        // has to remember to check. Matches Kotlin's `ifEmpty { null }`.
        let matched = try container.decodeIfPresent(
            ForgivingArray<ProductDetails>.self,
            forKey: .matchedProducts
        )?.elements
        matchedProducts = (matched?.isEmpty ?? true) ? nil : matched
    }
}

/// Every field forgiving: `matchedProducts` is advisory display context, so one reshaped value
/// inside it must cost that value, not the campaign list it arrived with. The synthesized
/// `Decodable` would throw instead — `Optional` only defaults to nil when the key is absent,
/// not when it is present with the wrong type.
extension ProductDetails: Decodable {
    private enum CodingKeys: String, CodingKey {
        case productId, sku, name, quantity, unitPrice, totalPrice
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            productId: container.decodeForgiving(String.self, forKey: .productId),
            sku: container.decodeForgiving(String.self, forKey: .sku),
            name: container.decodeForgiving(String.self, forKey: .name),
            quantity: container.decodeForgiving(Double.self, forKey: .quantity),
            unitPrice: container.decodeForgiving(Double.self, forKey: .unitPrice),
            totalPrice: container.decodeForgiving(Double.self, forKey: .totalPrice)
        )
    }
}
