@_spi(FrakInternal) import FrakSDK
import Testing

/// Reward read models are decoded by the SDK, never built by a merchant, so their initialisers are
/// `@_spi(FrakInternal)` — the Swift twin of the Android constructors' `@InternalFrakApi`. This
/// suite therefore imports the SPI, unlike `PublicSurfaceTests`, whose plain import is what proves
/// the merchant-facing half.
@Suite("Reward model construction")
struct RewardModelConstructionTests {
    @Test("every reward model is constructible by the SDK, which is what decodes them")
    func rewardModelsAreConstructibleThroughTheSPI() {
        let amount = TokenAmount(amount: 1000, eurAmount: 10, usdAmount: 11, gbpAmount: 9)
        let tier = RewardTier.amount(minValue: 0, maxValue: 100, amount: amount)
        let reward = EstimatedReward.fixed(amount: amount)
        let campaign = Campaign(
            campaignId: "c1",
            name: "Summer",
            interactionTypeKey: "purchase",
            referrer: reward
        )
        let best = BestReward(formatted: "10\u{00a0}€", payoutType: "fixed")
        let scopedBest = BestReward(
            formatted: "10\u{00a0}€",
            payoutType: "fixed",
            isProductScoped: true,
            matchedProducts: [ProductDetails(sku: "SHOE-42")]
        )

        #expect(tier.minValue == 0)
        #expect(campaign.referrer == reward)
        #expect(best.payoutType == "fixed")
        #expect(best.isProductScoped == false)
        #expect(best.matchedProducts == nil)
        #expect(scopedBest.isProductScoped)
        #expect(scopedBest.matchedProducts == [ProductDetails(sku: "SHOE-42")])
    }

    @Test("a reward model compares equal to an identical value")
    func rewardModelsAreEquatable() {
        let amount = TokenAmount(amount: 1000, eurAmount: 10, usdAmount: 11, gbpAmount: 9)
        #expect(amount == TokenAmount(amount: 1000, eurAmount: 10, usdAmount: 11, gbpAmount: 9))
        #expect(amount != TokenAmount(amount: 1, eurAmount: 10, usdAmount: 11, gbpAmount: 9))
    }
}
