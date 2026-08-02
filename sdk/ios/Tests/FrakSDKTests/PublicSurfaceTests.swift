import Foundation
// Deliberately a plain import, not `@testable`. `@testable` would let this file reach
// internal declarations and hide the exact bug it exists to catch: that a merchant
// building against the compiled module cannot construct these types at all.
import FrakSDK
import Testing

/// A hand-written fake, the way a merchant would write one — no mocking framework,
/// matching `FrakClient`'s own doc comment.
private struct FakeFrakClient: FrakClient {
    let config: FrakResolvedConfig
    let campaignList: [Campaign]
    let reward: BestReward?

    var currentConfig: FrakResolvedConfig? {
        get async { config }
    }

    var configUpdates: AsyncStream<FrakResolvedConfig> {
        get async {
            AsyncStream { continuation in
                continuation.yield(config)
                continuation.finish()
            }
        }
    }

    func resolveConfig(forceRefresh: Bool) async throws -> FrakResolvedConfig {
        config
    }

    func campaigns(forceRefresh: Bool) async throws -> [Campaign] {
        campaignList
    }

    func bestReward(
        targetInteraction: String?,
        audience: RewardAudience?,
        forceRefresh: Bool
    ) async throws -> BestReward? {
        reward
    }
}

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

        // Trailing slash stripped: origins are concatenated with paths verbatim.
        let local = FrakEnvironment.custom(wallet: "https://localhost:3000", backend: "https://localhost:3030/")
        #expect(local.wallet == "https://localhost:3000")
        #expect(local.backend == "https://localhost:3030")
        #expect(FrakConfig(env: local).env == local)
    }

    @Test("a merchant can substitute a fake FrakClient without a mocking framework")
    func fakeClientConformsWithoutMockingFramework() async throws {
        let config = FrakResolvedConfig(merchantId: "m1", name: "Acme", domain: "acme.example")
        let campaign = Campaign(campaignId: "c1", name: "Summer", interactionTypeKey: "purchase")
        let best = BestReward(formatted: "10\u{00a0}€", payoutType: "fixed")
        let fake: any FrakClient = FakeFrakClient(config: config, campaignList: [campaign], reward: best)

        #expect(try await fake.resolveConfig() == config)
        #expect(try await fake.campaigns() == [campaign])
        #expect(try await fake.bestReward() == best)
        #expect(await fake.currentConfig == config)
    }
}
