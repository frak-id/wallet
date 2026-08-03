package id.frak.sdk

import id.frak.sdk.config.AttributionDefaults
import id.frak.sdk.config.BannerConfig
import id.frak.sdk.config.ButtonShareConfig
import id.frak.sdk.config.ButtonWalletConfig
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.config.OpenInAppConfig
import id.frak.sdk.config.PostPurchaseConfig
import id.frak.sdk.config.ResolvedComponents
import id.frak.sdk.config.ResolvedPlacement
import id.frak.sdk.config.ResolvedSdkConfig
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogSink
import id.frak.sdk.core.FrakResult
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.EstimatedReward
import id.frak.sdk.rewards.RewardAudience
import id.frak.sdk.rewards.RewardTier
import id.frak.sdk.rewards.TokenAmount
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Proves a merchant can construct every public reward/config model and write a fake
 * [FrakClient] with no mocking framework, matching [FrakClient]'s own doc comment.
 *
 * Deliberately references only public API. Unlike Swift's `@testable`, a same-module
 * Kotlin test source set has friend access to `internal` by default, so this file's
 * guarantee rests on not importing anything internal, not on the compiler refusing to
 * resolve one.
 */
class PublicSurfaceTest {
    @Test
    fun `every public reward and config model is constructible`() {
        val amount = TokenAmount(amount = 1000.0, eurAmount = 10.0, usdAmount = 11.0, gbpAmount = 9.0)
        val tier = RewardTier.Amount(minValue = 0.0, maxValue = 100.0, amount = amount)
        val reward = EstimatedReward.Fixed(amount)
        val campaign = campaign(referrer = reward)
        val best = bestReward()
        val config =
            FrakResolvedConfig(
                merchantId = "m1",
                name = "Acme",
                domain = "acme.example",
                lang = FrakLanguage.EN,
                currency = FrakCurrency.EUR,
                sdkConfig = sdkConfig(),
            )

        assertEquals(0.0, tier.minValue, 0.0)
        assertEquals(reward, campaign.referrer)
        assertEquals("fixed", best.payoutType)
        assertEquals("m1", config.merchantId)
        assertEquals(
            "Share",
            config.sdkConfig
                ?.components
                ?.buttonShare
                ?.text,
        )
    }

    @Test
    fun `two independently merchant-built configs with the same nested sdkConfig values compare equal`() {
        // The real equality asymmetry fix (a decoded config now equals a
        // merchant-built one with the same values) is pinned against the actual
        // decoder in FrakResolvedConfigTest, which is allowed friend access to it;
        // this file deliberately references only public API, so it proves the
        // same round-trip using two independently-built public instances instead.
        val first =
            FrakResolvedConfig(
                merchantId = "m1",
                name = "Acme",
                domain = "acme.example",
                lang = FrakLanguage.FR,
                currency = FrakCurrency.EUR,
                sdkConfig = sdkConfig(),
            )
        val second =
            FrakResolvedConfig(
                merchantId = "m1",
                name = "Acme",
                domain = "acme.example",
                lang = FrakLanguage.FR,
                currency = FrakCurrency.EUR,
                sdkConfig = sdkConfig(),
            )

        assertEquals(first, second)
        assertEquals(first.hashCode(), second.hashCode())
    }

    @Test
    fun `a merchant can state every environment, including a custom origin pair`() {
        assertEquals("https://backend.frak.id", FrakConfig().env.backend)
        assertEquals("https://wallet-dev.frak.id", FrakEnvironment.Development.wallet)

        val local =
            FrakEnvironment.Custom(
                wallet = "https://localhost:3000",
                // Trailing slash stripped: origins are concatenated with paths verbatim.
                backend = "https://localhost:3030/",
            )
        assertEquals("https://localhost:3000", local.wallet)
        assertEquals("https://localhost:3030", local.backend)
        assertEquals(local.backend, FrakConfig(env = local).env.backend)
    }

    @Test
    fun `a merchant can implement FrakLogSink as a lambda and pass it in a FrakConfig`() {
        val received = mutableListOf<Pair<FrakLogLevel, String>>()
        val sink = FrakLogSink { level, message, _ -> received.add(level to message) }

        val config = FrakConfig(logLevel = FrakLogLevel.INFO, logSink = sink)

        assertEquals(sink, config.logSink)
        config.logSink?.log(FrakLogLevel.INFO, "merchant-routed", null)
        assertEquals(listOf(FrakLogLevel.INFO to "merchant-routed"), received)
    }

    @Test
    fun `a merchant can substitute a fake FrakClient without a mocking framework`() =
        runTest {
            val config = FrakResolvedConfig(merchantId = "m1", name = "Acme", domain = "acme.example")
            val campaignList = listOf(campaign())
            val best = bestReward()
            val fake: FrakClient = FakeFrakClient(config, campaignList, best)

            assertEquals(config, fake.resolveConfig())
            assertEquals(campaignList, fake.campaigns())
            assertEquals(best, fake.bestReward())
        }

    private fun campaign(referrer: EstimatedReward? = null): Campaign =
        Campaign(
            campaignId = "c1",
            name = "Summer",
            interactionTypeKey = "purchase",
            referrer = referrer,
            referee = null,
            defaultLockupSeconds = null,
            maxRewardsPerUser = null,
            expiresAt = null,
        )

    private fun bestReward(): BestReward =
        BestReward(
            formatted = "10\u00a0\u20ac",
            payoutType = "fixed",
            minPurchaseAmount = null,
            minPurchaseValue = null,
            lockupDurationDays = null,
            isProductScoped = true,
            matchedProducts = listOf(ProductDetails(sku = "SHOE-42")),
        )

    private fun sdkConfig(): ResolvedSdkConfig =
        ResolvedSdkConfig(
            currency = FrakCurrency.EUR,
            lang = FrakLanguage.FR,
            translations = mapOf("sharing.title" to "Partager"),
            components =
                ResolvedComponents(
                    buttonShare = ButtonShareConfig(text = "Share", noRewardText = "Try it", clickAction = "copy"),
                    buttonWallet = ButtonWalletConfig(position = "bottom"),
                    openInApp = OpenInAppConfig(text = "Open in app"),
                    postPurchase = PostPurchaseConfig(badgeText = "New"),
                    banner = BannerConfig(referralTitle = "Refer a friend"),
                ),
            placements =
                mapOf(
                    "product-page" to
                        ResolvedPlacement(
                            components =
                                ResolvedComponents(buttonShare = ButtonShareConfig(text = "Share and earn")),
                        ),
                ),
            attribution = AttributionDefaults(utmSource = "acme-web"),
        )

    private class FakeFrakClient(
        private val config: FrakResolvedConfig,
        private val campaignList: List<Campaign>,
        private val reward: BestReward?,
    ) : FrakClient {
        override val configUpdates: StateFlow<FrakResolvedConfig?> = MutableStateFlow(config).asStateFlow()

        override suspend fun resolveConfig(forceRefresh: Boolean): FrakResolvedConfig = config

        override suspend fun campaigns(forceRefresh: Boolean): List<Campaign> = campaignList

        override suspend fun bestReward(
            targetInteraction: String?,
            audience: RewardAudience?,
            forceRefresh: Boolean,
            products: List<ProductDetails>?,
        ): BestReward? = reward

        override val anonymousId: String? = "256b1be3-2745-41d1-89d4-9121cc87bc45"

        override fun resetAnonymousId() = Unit

        override suspend fun buildSharingLink(request: SharingRequest): String? = null

        override suspend fun track(interaction: Interaction): FrakResult<Unit> = FrakResult.Success(Unit)

        override suspend fun trackPurchase(
            customerId: String,
            orderId: String,
            token: String,
        ): FrakResult<Unit> = FrakResult.Success(Unit)

        override suspend fun handleReferralLink(url: String): Boolean = false

        override fun isFrakAppInstalled(): Boolean = false

        override suspend fun openFrakApp(): OpenAppResult = OpenAppResult.Failed

        override suspend fun installUrl(): String? = null

        // `installPageUrl()` is deliberately absent: this fake exists to prove a merchant can
        // write one against the public surface, so it is also the regression test for that
        // member being defaulted rather than abstract.

        override val environment: FrakEnvironment = FrakEnvironment.Production
    }
}
