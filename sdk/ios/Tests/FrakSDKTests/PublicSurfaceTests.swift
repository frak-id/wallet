import Foundation
// Deliberately a plain import, not `@testable`: catches types a merchant cannot construct outside the module.
import FrakSDK
import Testing

/// A hand-written fake, the way a merchant would write one — no mocking framework.
private final class RecordingLogSink: FrakLogSink, @unchecked Sendable {
    private let lock = NSLock()
    private var captured: [(level: FrakLogLevel, message: String, hasError: Bool)] = []

    func log(level: FrakLogLevel, message: String, error: (any Error)?) {
        lock.lock()
        defer { lock.unlock() }
        captured.append((level, message, error != nil))
    }

    var all: [(level: FrakLogLevel, message: String, hasError: Bool)] {
        lock.lock()
        defer { lock.unlock() }
        return captured
    }
}

@Suite("Public surface")
struct PublicSurfaceTests {
    @Test("the public reward and config models are constructible outside the module")
    func modelsAreConstructibleOutsideTheModule() {
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
        let config = FrakResolvedConfig(
            merchantId: "m1",
            name: "Acme",
            domain: "acme.example",
            lang: .en,
            currency: .eur
        )

        #expect(tier.minValue == 0)
        #expect(campaign.referrer == reward)
        #expect(best.payoutType == "fixed")
        #expect(best.isProductScoped == false)
        #expect(best.matchedProducts == nil)
        #expect(scopedBest.isProductScoped)
        #expect(scopedBest.matchedProducts == [ProductDetails(sku: "SHOE-42")])
        #expect(config.merchantId == "m1")
    }

    @Test("the merchant-config model tree, including sdkConfig, is constructible outside the module")
    func resolvedSdkConfigTreeIsConstructibleOutsideTheModule() {
        let sdkConfig = ResolvedSdkConfig(
            name: "Acme Shop",
            logoURL: "https://acme.example/logo.png",
            translations: ["sharing.title": "Share"],
            placements: [
                "product-page": ResolvedPlacement(
                    components: ResolvedComponents(buttonShare: ButtonShareConfig(text: "Share and earn")),
                    targetInteraction: "purchase"
                )
            ],
            components: ResolvedComponents(
                buttonShare: ButtonShareConfig(text: "Share"),
                buttonWallet: ButtonWalletConfig(position: "bottom"),
                openInApp: OpenInAppConfig(text: "Open in app"),
                postPurchase: PostPurchaseConfig(badgeText: "You earned a reward"),
                banner: BannerConfig(referralTitle: "Refer a friend")
            ),
            attribution: AttributionDefaults(utmSource: "acme-web")
        )
        let config = FrakResolvedConfig(
            merchantId: "m1",
            name: "Acme",
            domain: "acme.example",
            sdkConfig: sdkConfig
        )

        #expect(config.sdkConfig?.name == "Acme Shop")
        #expect(config.sdkConfig?.placements["product-page"]?.targetInteraction == "purchase")
        #expect(config.sdkConfig?.components?.banner?.referralTitle == "Refer a friend")
    }

    @Test("two FrakResolvedConfig values built with the same sdkConfig compare equal")
    func resolvedConfigWithSdkConfigRoundTripsThroughEquality() {
        let sdkConfig = ResolvedSdkConfig(name: "Acme Shop", currency: .eur)
        let a = FrakResolvedConfig(merchantId: "m1", name: "Acme", domain: "acme.example", sdkConfig: sdkConfig)
        let b = FrakResolvedConfig(merchantId: "m1", name: "Acme", domain: "acme.example", sdkConfig: sdkConfig)
        let withoutSdkConfig = FrakResolvedConfig(merchantId: "m1", name: "Acme", domain: "acme.example")

        #expect(a == b)
        #expect(a != withoutSdkConfig)
    }

    @Test("a merchant can conform to FrakLogSink and route it through FrakConfig")
    func logSinkIsConstructibleOutsideTheModule() {
        let sink = RecordingLogSink()
        let config = FrakConfig(merchantId: "m1", logLevel: .info, logSink: sink)

        #expect(config.logSink != nil)
        sink.log(level: .info, message: "hello", error: nil)
        #expect(sink.all.count == 1)
        #expect(sink.all[0].message == "hello")
    }

    @Test("all the constructed models compare equal to an identical value")
    func modelsAreEquatable() {
        let amount = TokenAmount(amount: 1000, eurAmount: 10, usdAmount: 11, gbpAmount: 9)
        #expect(amount == TokenAmount(amount: 1000, eurAmount: 10, usdAmount: 11, gbpAmount: 9))
        #expect(amount != TokenAmount(amount: 1, eurAmount: 10, usdAmount: 11, gbpAmount: 9))

        let config = FrakConfig(merchantId: "m1", metadata: FrakMetadata(name: "Acme"))
        #expect(config == FrakConfig(merchantId: "m1", metadata: FrakMetadata(name: "Acme")))
    }

    @Test("a merchant can state every environment, including a custom origin pair")
    func environmentsAreConstructible() {
        #expect(FrakConfig().env.backend == "https://backend.frak.id")
        #expect(FrakEnvironment.development.wallet == "https://wallet-dev.frak.id")

        let local = FrakEnvironment.custom(wallet: "https://localhost:3000", backend: "https://localhost:3030/")
        #expect(local.wallet == "https://localhost:3000")
        #expect(local.backend == "https://localhost:3030")
        #expect(FrakConfig(env: local).env == local)
    }

    @Test("the sharing and tracking inputs are constructible outside the module")
    func sharingAndTrackingInputsAreConstructibleOutsideTheModule() {
        let request = SharingRequest(
            link: "https://acme.example/p",
            products: [
                SharingProduct(
                    title: "Kettle",
                    link: "https://acme.example/p/1",
                    imageURL: "https://acme.example/p/1.png",
                    utmContent: "sku-42",
                    details: ProductDetails(productId: "p1", sku: "sku-42", quantity: 1, unitPrice: 79.9)
                )
            ],
            attribution: AttributionParams(utmSource: "ios-app"),
            targetInteraction: "purchase",
            placement: "product-page"
        )

        #expect(request.products.first?.utmContent == "sku-42")
        #expect(request.products.first?.details?.unitPrice == 79.9)
        #expect(request.attribution?.utmSource == "ios-app")
        #expect(Interaction.sharing() == Interaction.sharing())
        #expect(Interaction.custom("newsletter", data: ["id": "1"]) != Interaction.custom("newsletter"))
    }

    @Test("a referral link decodes without an initialized SDK")
    func referralLinksDecodeWithoutInitialization() throws {
        let context = try #require(
            Frak.parseReferralLink(
                "https://acme.example/p?fCtx=ElUOhADim0HUpxZEZlVEAABl50GAVQ6EAOKbQdSnFkRmVUQAAQ"
            )
        )
        guard case .v2(let v2) = context else {
            Issue.record("expected a v2 context")
            return
        }
        #expect(v2.merchantId == "550e8400-e29b-41d4-a716-446655440000")
        #expect(v2.clientId == "550e8400-e29b-41d4-a716-446655440001")
        #expect(v2.timestamp == 1_709_654_400)
        #expect(Frak.parseReferralLink("https://acme.example/p") == nil)
    }

    @Test("deep-link handling is stateable on FrakConfig")
    func deepLinkIsStateable() {
        let config = FrakConfig(merchantId: "m1", deepLink: .disabled)
        #expect(config.deepLink == .disabled)
        #expect(FrakConfig().deepLink == .manual)
    }

    /// Swift has no ABI dump, so a conformance re-added for convenience would ship unnoticed.
    @Test("no public read model is Decodable")
    func readModelsAreNotDecodable() {
        let readModels: [Any.Type] = [
            FrakResolvedConfig.self, ResolvedSdkConfig.self, ResolvedPlacement.self, ResolvedComponents.self,
            ButtonShareConfig.self, ButtonWalletConfig.self, OpenInAppConfig.self, PostPurchaseConfig.self,
            BannerConfig.self, AttributionDefaults.self, TokenAmount.self, RewardTier.self, EstimatedReward.self,
            Campaign.self, BestReward.self, ProductDetails.self,
        ]

        for model in readModels {
            #expect(!(model is any Decodable.Type), "\(model) leaked a public Decodable conformance")
        }
        // Without this the loop above would pass even if `is any Decodable.Type` matched nothing.
        #expect(FrakCurrency.self is any Decodable.Type)
    }
}
