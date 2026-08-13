import Foundation
import Testing

@testable import FrakSDK

@Suite("RewardsDecoder")
struct RewardsDecoderTests {
    private static let fixedResponse = """
        {"rewards":[{
          "campaignId":"c1","name":"Summer","interactionTypeKey":"purchase","conditions":[],
          "expiresAt":null,
          "referrer":{"payoutType":"fixed",
            "amount":{"amount":1000,"eurAmount":10,"usdAmount":11,"gbpAmount":9}}
        }]}
        """

    private static let percentageResponse = """
        {"rewards":[{
          "campaignId":"c1","name":"Summer","interactionTypeKey":"purchase","conditions":[],
          "referrer":{"payoutType":"percentage","percent":5,"percentOf":"purchase_amount",
            "maxAmount":{"amount":5000,"eurAmount":50,"usdAmount":55,"gbpAmount":45}}
        }]}
        """

    private static let tieredResponse = """
        {"rewards":[{
          "campaignId":"c1","name":"Summer","interactionTypeKey":"purchase","conditions":[],
          "referrer":{"payoutType":"tiered","tierField":"purchase_amount","tiers":[
            {"minValue":0,"maxValue":100,
             "amount":{"amount":100,"eurAmount":1,"usdAmount":1,"gbpAmount":1}},
            {"minValue":100,"percent":5}
          ]}
        }]}
        """

    private static let formattedResponse = """
        {"rewards":[],"best":{
          "formatted":"12\u{00a0}€","payoutType":"fixed",
          "minPurchaseAmount":"10\u{00a0}€","minPurchaseValue":10,"lockupDurationDays":7
        }}
        """

    private static let productScopedResponse = """
        {"rewards":[],"best":{
          "formatted":"12\u{00a0}€","payoutType":"fixed","isProductScoped":true,
          "matchedProducts":[{"sku":"SHOE-42","name":"Sneakers"}]
        }}
        """

    @Test("decodes a fixed reward")
    func decodesFixedReward() throws {
        let result = try RewardsDecoder.decode(Data(Self.fixedResponse.utf8))

        #expect(result.campaigns.count == 1)
        let campaign = result.campaigns[0]
        #expect(campaign.name == "Summer")
        #expect(campaign.interactionTypeKey == "purchase")

        guard case .fixed(let amount) = try #require(campaign.referrer) else {
            Issue.record("expected .fixed")
            return
        }
        #expect(amount.eurAmount == 10.0)
    }

    @Test("decodes a percentage reward with optional bounds")
    func decodesPercentageReward() throws {
        let referrer = try #require(
            try RewardsDecoder.decode(Data(Self.percentageResponse.utf8)).campaigns.first?.referrer
        )

        guard case .percentage(let percent, let percentOf, let maxAmount, let minAmount) = referrer else {
            Issue.record("expected .percentage")
            return
        }
        #expect(percent == 5.0)
        #expect(percentOf == "purchase_amount")
        #expect(maxAmount?.eurAmount == 50.0)
        // Absent bounds stay absent rather than becoming zero.
        #expect(minAmount == nil)
    }

    @Test("an empty product list is sent as absent, matching how Android maps RewardRequest")
    func emptyProductsAreAbsentOnTheWire() {
        #expect(RewardRequest().wireProducts == nil)
        #expect(RewardRequest(products: []).wireProducts == nil)
        #expect(RewardRequest(products: [ProductDetails(productId: "p")]).wireProducts?.count == 1)
    }

    @Test("a tier that is neither a percentage nor an amount degrades, keeping the tiers around it")
    func unknownTierDegrades() throws {
        let body = """
            {"rewards":[{"campaignId":"c","name":"Tiered","interactionTypeKey":"purchase","conditions":[],
            "referrer":{"payoutType":"tiered","tierField":"total","tiers":[
            {"minValue":0,"maxValue":10,"quantumPayout":{"units":3}},
            {"minValue":10,"percent":5}]}}]}
            """

        let referrer = try #require(try RewardsDecoder.decode(Data(body.utf8)).campaigns.first?.referrer)
        guard case .tiered(_, let tiers) = referrer else {
            Issue.record("expected .tiered")
            return
        }

        // Throwing here would fail the entire reward over one band, since a tier decodes inside
        // the array.
        #expect(tiers.count == 2)
        guard case .unknown(let minValue, let maxValue) = tiers[0] else {
            Issue.record("expected first tier to be .unknown, got \(tiers[0])")
            return
        }
        #expect(minValue == 0)
        #expect(maxValue == 10)
        guard case .percentage = tiers[1] else {
            Issue.record("expected second tier to still decode")
            return
        }
    }

    @Test("a malformed amount object still fails, so a degraded tier never hides a broken one")
    func malformedTierAmountStillThrows() {
        let body = """
            {"rewards":[{"campaignId":"c","name":"Tiered","interactionTypeKey":"purchase","conditions":[],
            "referrer":{"payoutType":"tiered","tierField":"total","tiers":[
            {"minValue":0,"amount":{"amount":"not-a-number"}}]}}]}
            """

        // decodeForgivingObject, not decodeForgiving: absent or not-an-object degrades, a
        // malformed object still throws, which is what Kotlin's JsonReader.obj does.
        #expect(throws: (any Error).self) {
            try RewardsDecoder.decode(Data(body.utf8))
        }
    }

    @Test("decodes tiered rewards, discriminating tiers on the presence of percent")
    func decodesTieredRewards() throws {
        let referrer = try #require(try RewardsDecoder.decode(Data(Self.tieredResponse.utf8)).campaigns.first?.referrer)

        guard case .tiered(_, let tiers) = referrer else {
            Issue.record("expected .tiered")
            return
        }
        #expect(tiers.count == 2)
        guard case .amount = tiers[0] else {
            Issue.record("expected first tier to be .amount")
            return
        }
        guard case .percentage = tiers[1] else {
            Issue.record("expected second tier to be .percentage")
            return
        }
        // An open-ended top tier omits maxValue rather than sending a sentinel.
        #expect(tiers[1].maxValue == nil)
    }

    @Test("a tiered campaign missing tiers survives instead of failing the whole response")
    func tieredWithoutTiersKeepsTheResponse() throws {
        let response = """
            {"rewards":[{
              "campaignId":"c1","name":"Summer","interactionTypeKey":"purchase","conditions":[],
              "referrer":{"payoutType":"tiered","tierField":"purchase_amount"}
            }]}
            """

        // `tiers` absent is a backend shape, not a client error: Android answers with an
        // empty list, and a throw here would drop every campaign in the response.
        let campaigns = try RewardsDecoder.decode(Data(response.utf8)).campaigns
        let referrer = try #require(campaigns.first?.referrer)
        guard case .tiered(_, let tiers) = referrer else {
            Issue.record("expected .tiered")
            return
        }
        #expect(tiers.isEmpty)
    }

    @Test("an unknown payout type degrades to .unknown rather than dropping the campaign")
    func unknownPayoutTypeDegrades() throws {
        let body = """
            {"rewards":[{"campaignId":"c","name":"New","interactionTypeKey":"purchase",
            "conditions":[],"referrer":{"payoutType":"quantum","somethingNew":1}}]}
            """

        let referrer = try #require(try RewardsDecoder.decode(Data(body.utf8)).campaigns.first?.referrer)

        guard case .unknown(let payoutType) = referrer else {
            Issue.record("expected .unknown")
            return
        }
        #expect(payoutType == "quantum")
    }

    @Test("a missing payoutType is a decoding error")
    func missingPayoutTypeIsDecodingError() {
        let body = """
            {"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase",
            "conditions":[],"referrer":{"somethingNew":1}}]}
            """

        do {
            _ = try RewardsDecoder.decode(Data(body.utf8))
            Issue.record("expected a decoding error")
        } catch let FrakError.decoding(message) {
            #expect(message.contains("payoutType"))
        } catch {
            Issue.record("expected FrakError.decoding")
        }
    }

    @Test("an empty rewards array decodes to an empty list, not an error")
    func emptyRewardsArrayDecodesToEmptyList() throws {
        let result = try RewardsDecoder.decode(Data(#"{"rewards":[]}"#.utf8))

        #expect(result.campaigns.isEmpty)
        #expect(result.best == nil)
    }

    @Test("best is absent when the server did not select one")
    func bestIsAbsentWhenNotSelected() throws {
        #expect(try RewardsDecoder.decode(Data(Self.fixedResponse.utf8)).best == nil)
    }

    @Test("best preserves the non-breaking space before the currency symbol")
    func bestPreservesNonBreakingSpace() throws {
        let best = try #require(try RewardsDecoder.decode(Data(Self.formattedResponse.utf8)).best)

        #expect(best.formatted == "12\u{00a0}€")
        #expect(best.formatted[best.formatted.index(best.formatted.endIndex, offsetBy: -2)] == "\u{00a0}")
    }

    @Test("best decodes its optional display fields")
    func bestDecodesOptionalFields() throws {
        let best = try #require(try RewardsDecoder.decode(Data(Self.formattedResponse.utf8)).best)

        #expect(best.payoutType == "fixed")
        #expect(best.minPurchaseAmount == "10\u{00a0}€")
        #expect(best.minPurchaseValue == 10.0)
        #expect(best.lockupDurationDays == 7.0)
    }

    @Test("isProductScoped and matchedProducts decode when the backend sends them")
    func decodesProductScopedFields() throws {
        let best = try #require(try RewardsDecoder.decode(Data(Self.productScopedResponse.utf8)).best)

        #expect(best.isProductScoped)
        #expect(best.matchedProducts == [ProductDetails(sku: "SHOE-42", name: "Sneakers")])
    }

    @Test("isProductScoped defaults to false and matchedProducts to nil on a backend that predates them")
    func productScopedFieldsDefaultOnAnOlderBackend() throws {
        let best = try #require(try RewardsDecoder.decode(Data(Self.formattedResponse.utf8)).best)

        #expect(best.isProductScoped == false)
        #expect(best.matchedProducts == nil)
    }

    @Test("a wrong-typed isProductScoped degrades to false rather than failing decode")
    func wrongTypedIsProductScopedDegradesToFalse() throws {
        let body = #"{"rewards":[],"best":{"formatted":"12€","payoutType":"fixed","isProductScoped":"yes"}}"#

        let best = try #require(try RewardsDecoder.decode(Data(body.utf8)).best)

        #expect(best.isProductScoped == false)
    }

    @Test("a malformed entry inside matchedProducts is skipped, the rest survive")
    func malformedMatchedProductEntryIsSkipped() throws {
        let body = """
            {"rewards":[],"best":{"formatted":"12€","payoutType":"fixed",
            "matchedProducts":[42,{"sku":"SHOE-42"}]}}
            """

        let best = try #require(try RewardsDecoder.decode(Data(body.utf8)).best)

        #expect(best.matchedProducts == [ProductDetails(sku: "SHOE-42")])
    }

    @Test("a non-expiring campaign decodes expiresAt as nil")
    func nonExpiringCampaignDecodesExpiresAtAsNil() throws {
        #expect(try RewardsDecoder.decode(Data(Self.fixedResponse.utf8)).campaigns.first?.expiresAt == nil)
    }

    @Test("a missing required field is a decoding error")
    func missingRequiredFieldIsDecodingError() {
        let body = #"{"rewards":[{"name":"Summer","interactionTypeKey":"purchase","conditions":[]}]}"#

        do {
            _ = try RewardsDecoder.decode(Data(body.utf8))
            Issue.record("expected a decoding error")
        } catch let FrakError.decoding(message) {
            #expect(message.contains("campaignId"))
        } catch {
            Issue.record("expected FrakError.decoding")
        }
    }

    @Test("an absent rewards key decodes to an empty campaign list")
    func absentRewardsKeyDecodesToEmptyList() throws {
        let result = try RewardsDecoder.decode(Data(#"{"best":null}"#.utf8))

        #expect(result.campaigns.isEmpty)
        #expect(result.best == nil)
    }

    @Test("a non-array rewards value decodes to an empty campaign list")
    func nonArrayRewardsDecodesToEmptyList() throws {
        let result = try RewardsDecoder.decode(Data(#"{"rewards":"nope"}"#.utf8))

        #expect(result.campaigns.isEmpty)
    }

    @Test("a wrong-typed optional scalar degrades to nil, campaign still decodes")
    func wrongTypedOptionalScalarDegradesToNil() throws {
        let body = """
            {"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase",
            "defaultLockupSeconds":"not-a-number"}]}
            """

        let campaign = try #require(try RewardsDecoder.decode(Data(body.utf8)).campaigns.first)

        #expect(campaign.defaultLockupSeconds == nil)
    }

    @Test("a wrong-typed referrer degrades to nil, campaign still decodes")
    func wrongTypedReferrerDegradesToNil() throws {
        let body = #"{"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase","referrer":"nope"}]}"#

        let campaign = try #require(try RewardsDecoder.decode(Data(body.utf8)).campaigns.first)

        #expect(campaign.referrer == nil)
    }

    @Test("a malformed entry in the rewards array is skipped, the rest survive")
    func malformedArrayEntryIsSkipped() throws {
        let body = """
            {"rewards":[
            42,
            {"campaignId":"c1","name":"Good","interactionTypeKey":"purchase"}
            ]}
            """

        let result = try RewardsDecoder.decode(Data(body.utf8))

        #expect(result.campaigns.count == 1)
        #expect(result.campaigns.first?.campaignId == "c1")
    }

    @Test("a wrong-typed optional field on best still lets best decode")
    func wrongTypedOptionalOnBestStillDecodes() throws {
        let body = """
            {"rewards":[],"best":{"formatted":"12€","payoutType":"fixed","lockupDurationDays":"soon"}}
            """

        let best = try #require(try RewardsDecoder.decode(Data(body.utf8)).best)

        #expect(best.formatted == "12€")
        #expect(best.lockupDurationDays == nil)
    }

    @Test("a campaign missing the required campaignId still throws, naming the field")
    func missingCampaignIdStillThrows() {
        let body = #"{"rewards":[{"name":"Summer","interactionTypeKey":"purchase"}]}"#

        do {
            _ = try RewardsDecoder.decode(Data(body.utf8))
            Issue.record("expected a decoding error")
        } catch let FrakError.decoding(message) {
            #expect(message.contains("campaignId"))
        } catch {
            Issue.record("expected FrakError.decoding")
        }
    }

    @Test("a wrong-typed required field nested inside a required object still throws")
    func wrongTypedRequiredFieldNestedInRequiredObjectStillThrows() {
        let body = """
            {"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase",
            "referrer":{"payoutType":"fixed",
            "amount":{"amount":"nope","eurAmount":1,"usdAmount":1,"gbpAmount":1}}}]}
            """

        do {
            _ = try RewardsDecoder.decode(Data(body.utf8))
            Issue.record("expected a decoding error")
        } catch is FrakError {
        } catch {
            Issue.record("expected FrakError.decoding")
        }
    }

    @Test("best present but missing its required formatted field still throws")
    func bestMissingRequiredFormattedStillThrows() {
        let body = #"{"rewards":[],"best":{"payoutType":"fixed"}}"#

        do {
            _ = try RewardsDecoder.decode(Data(body.utf8))
            Issue.record("expected a decoding error")
        } catch let FrakError.decoding(message) {
            #expect(message.contains("formatted"))
        } catch {
            Issue.record("expected FrakError.decoding")
        }
    }

    @Test("zero fiat amounts are preserved rather than treated as absent")
    func zeroFiatAmountsArePreserved() throws {
        let body = """
            {"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase","conditions":[],
            "referrer":{"payoutType":"fixed","amount":{"amount":100,"eurAmount":0,"usdAmount":0,"gbpAmount":0}}}]}
            """

        guard
            case .fixed(let amount) = try #require(try RewardsDecoder.decode(Data(body.utf8)).campaigns.first?.referrer)
        else {
            Issue.record("expected .fixed")
            return
        }
        #expect(amount.eurAmount == 0.0)
        #expect(amount.amount == 100.0)
    }
}

extension RewardsDecoderTests {
    /// The synthesized `Decodable` throws on a wrong-typed value even for an `Optional`
    /// property, so one bad field inside `matchedProducts` could otherwise fail the whole
    /// response, losing `rewards` along with `best`.
    @Test("a wrong-typed field inside matchedProducts costs that field, not the whole response")
    func matchedProductsFieldIsForgiving() throws {
        let body = """
            {"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase","conditions":[]}],
            "best":{"formatted":"5 €","payoutType":"fixed","isProductScoped":true,
            "matchedProducts":[{"sku":"SHOE-42","quantity":"not-a-number"}]}}
            """

        let result = try RewardsDecoder.decode(Data(body.utf8))

        #expect(result.campaigns.count == 1)
        let matched = try #require(result.best?.matchedProducts?.first)
        #expect(matched.sku == "SHOE-42")
        #expect(matched.quantity == nil)
    }

    /// "The winner is unscoped" must be one value, not two: an empty array decodes to nil,
    /// matching the absent case.
    @Test("an empty matchedProducts array decodes to nil, matching the absent case")
    func emptyMatchedProductsIsNil() throws {
        let body = """
            {"rewards":[],"best":{"formatted":"5 €","payoutType":"fixed","isProductScoped":false,
            "matchedProducts":[]}}
            """

        #expect(try RewardsDecoder.decode(Data(body.utf8)).best?.matchedProducts == nil)
    }
}
