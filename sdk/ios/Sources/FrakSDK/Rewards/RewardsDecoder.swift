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
extension BestReward {
    private enum CodingKeys: String, CodingKey {
        case formatted, payoutType, minPurchaseAmount, minPurchaseValue, lockupDurationDays
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        formatted = try container.decode(String.self, forKey: .formatted)
        payoutType = try container.decode(String.self, forKey: .payoutType)
        minPurchaseAmount = container.decodeForgiving(String.self, forKey: .minPurchaseAmount)
        minPurchaseValue = container.decodeForgiving(Double.self, forKey: .minPurchaseValue)
        lockupDurationDays = container.decodeForgiving(Double.self, forKey: .lockupDurationDays)
    }
}
