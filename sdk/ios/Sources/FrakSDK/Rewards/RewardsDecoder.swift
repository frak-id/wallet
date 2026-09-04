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
///
/// The wire types stay `private` for the same reason as in `ResolvedConfigDecoder`: no
/// `Decodable` conformance may reach the public reward models.
enum RewardsDecoder {
    private struct Wire: Decodable {
        let rewards: [Campaign]
        let best: BestReward?

        private enum CodingKeys: String, CodingKey {
            case rewards, best
        }

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let wires = try container.decodeIfPresent(ForgivingArray<CampaignWire>.self, forKey: .rewards)
            rewards = (wires?.elements ?? []).map(\.value)
            best = try container.decodeForgivingObject(BestRewardWire.self, forKey: .best)?.value
        }
    }

    static func decode(_ body: Data) throws -> EstimatedRewardsResult {
        let wire = try JSONDecoding.decode(Wire.self, from: body)
        return EstimatedRewardsResult(campaigns: wire.rewards, best: wire.best)
    }
}

private struct TokenAmountWire: Decodable {
    let amount: Double
    let eurAmount: Double
    let usdAmount: Double
    let gbpAmount: Double

    var value: TokenAmount {
        TokenAmount(amount: amount, eurAmount: eurAmount, usdAmount: usdAmount, gbpAmount: gbpAmount)
    }
}

/// `payoutType` dispatches the shape; an unrecognised value degrades to `.unknown`
/// rather than an error or a dropped campaign. A genuinely missing `payoutType` is
/// a contract break and fails decode, like any other missing required field.
private struct EstimatedRewardWire: Decodable {
    let value: EstimatedReward

    private enum CodingKeys: String, CodingKey {
        case payoutType, amount, percent, percentOf, maxAmount, minAmount, tierField, tiers
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let payoutType = try container.decode(String.self, forKey: .payoutType)
        switch payoutType {
        case "fixed":
            value = .fixed(amount: try container.decode(TokenAmountWire.self, forKey: .amount).value)
        case "percentage":
            value = .percentage(
                percent: try container.decode(Double.self, forKey: .percent),
                percentOf: try container.decode(String.self, forKey: .percentOf),
                maxAmount: try container.decodeForgivingObject(TokenAmountWire.self, forKey: .maxAmount)?.value,
                minAmount: try container.decodeForgivingObject(TokenAmountWire.self, forKey: .minAmount)?.value
            )
        case "tiered":
            value = .tiered(
                tierField: try container.decode(String.self, forKey: .tierField),
                tiers: (try container.decodeIfPresent(ForgivingArray<RewardTierWire>.self, forKey: .tiers)?.elements
                    ?? []).map(\.value)
            )
        default:
            value = .unknown(payoutType: payoutType)
        }
    }
}

/// No discriminator field on a tier; presence of `percent` is the discriminator,
/// matching the producer.
private struct RewardTierWire: Decodable {
    let value: RewardTier

    private enum CodingKeys: String, CodingKey {
        case minValue, maxValue, percent, amount
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let minValue = try container.decode(Double.self, forKey: .minValue)
        let maxValue = container.decodeForgiving(Double.self, forKey: .maxValue)
        if let percent = container.decodeForgiving(Double.self, forKey: .percent) {
            value = .percentage(minValue: minValue, maxValue: maxValue, percent: percent)
        } else if let amount = try container.decodeForgivingObject(TokenAmountWire.self, forKey: .amount) {
            value = .amount(minValue: minValue, maxValue: maxValue, amount: amount.value)
        } else {
            // A tier decodes inside `tiered`'s array, so throwing here would fail the entire
            // reward over one band — the opposite of what `.unknown` exists to prevent.
            value = .unknown(minValue: minValue, maxValue: maxValue)
        }
    }
}

/// Required fields still fail decode; every optional degrades to nil so one reshaped
/// field cannot take down the whole rewards call on a frozen merchant binary.
private struct CampaignWire: Decodable {
    let value: Campaign

    private enum CodingKeys: String, CodingKey {
        case campaignId, name, interactionTypeKey, referrer, referee, defaultLockupSeconds, maxRewardsPerUser,
            expiresAt
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        value = Campaign(
            campaignId: try container.decode(String.self, forKey: .campaignId),
            name: try container.decode(String.self, forKey: .name),
            interactionTypeKey: try container.decode(String.self, forKey: .interactionTypeKey),
            referrer: try container.decodeForgivingObject(EstimatedRewardWire.self, forKey: .referrer)?.value,
            referee: try container.decodeForgivingObject(EstimatedRewardWire.self, forKey: .referee)?.value,
            defaultLockupSeconds: container.decodeForgiving(Double.self, forKey: .defaultLockupSeconds),
            maxRewardsPerUser: container.decodeForgiving(Double.self, forKey: .maxRewardsPerUser),
            expiresAt: container.decodeForgiving(String.self, forKey: .expiresAt)
        )
    }
}

/// Same contract as `CampaignWire`: `formatted` and `payoutType` are the display contract and
/// stay required; the supporting detail fields degrade to nil.
///
/// `isProductScoped`/`matchedProducts` degrade to `false`/`nil` rather than failing decode when
/// absent, so a backend that predates product scoping still decodes cleanly.
private struct BestRewardWire: Decodable {
    let value: BestReward

    private enum CodingKeys: String, CodingKey {
        case formatted, payoutType, minPurchaseAmount, minPurchaseValue, lockupDurationDays, isProductScoped,
            matchedProducts
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Empty folds to nil, so "the winner is unscoped" is one value rather than two a caller
        // has to remember to check. Matches Kotlin's `ifEmpty { null }`.
        let matched = try container.decodeIfPresent(
            ForgivingArray<ProductDetailsWire>.self,
            forKey: .matchedProducts
        )?.elements.map(\.value)
        value = BestReward(
            formatted: try container.decode(String.self, forKey: .formatted),
            payoutType: try container.decode(String.self, forKey: .payoutType),
            minPurchaseAmount: container.decodeForgiving(String.self, forKey: .minPurchaseAmount),
            minPurchaseValue: container.decodeForgiving(Double.self, forKey: .minPurchaseValue),
            lockupDurationDays: container.decodeForgiving(Double.self, forKey: .lockupDurationDays),
            isProductScoped: container.decodeForgiving(Bool.self, forKey: .isProductScoped) ?? false,
            matchedProducts: (matched?.isEmpty ?? true) ? nil : matched
        )
    }
}

/// Every field forgiving: `matchedProducts` is advisory display context, so one reshaped value
/// inside it must cost that value, not the campaign list it arrived with. A synthesized
/// `Decodable` would throw instead — `Optional` only defaults to nil when the key is absent,
/// not when it is present with the wrong type.
private struct ProductDetailsWire: Decodable {
    let value: ProductDetails

    private enum CodingKeys: String, CodingKey {
        case productId, sku, name, quantity, unitPrice, totalPrice
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        value = ProductDetails(
            productId: container.decodeForgiving(String.self, forKey: .productId),
            sku: container.decodeForgiving(String.self, forKey: .sku),
            name: container.decodeForgiving(String.self, forKey: .name),
            quantity: container.decodeForgiving(Double.self, forKey: .quantity),
            unitPrice: container.decodeForgiving(Double.self, forKey: .unitPrice),
            totalPrice: container.decodeForgiving(Double.self, forKey: .totalPrice)
        )
    }
}
