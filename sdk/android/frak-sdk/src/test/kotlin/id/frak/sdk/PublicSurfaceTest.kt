package id.frak.sdk

import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogSink
import id.frak.sdk.core.FrakMetadata
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.rewards.BestReward
import id.frak.sdk.rewards.Campaign
import id.frak.sdk.rewards.EstimatedReward
import id.frak.sdk.rewards.RewardRequest
import id.frak.sdk.rewards.RewardTier
import id.frak.sdk.rewards.TokenAmount
import id.frak.sdk.sharing.AttributionParams
import id.frak.sdk.sharing.SharingProduct
import id.frak.sdk.sharing.SharingRequest
import id.frak.sdk.tracking.Interaction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Every public input type and reward model is constructible through the real public API. */
class PublicSurfaceTest {
    @Test
    fun `every public reward model is constructible`() {
        val amount = TokenAmount(amount = 1000.0, eurAmount = 10.0, usdAmount = 11.0, gbpAmount = 9.0)
        val tier = RewardTier.Amount(minValue = 0.0, maxValue = 100.0, amount = amount)
        val reward = EstimatedReward.Fixed(amount)
        val campaign = campaign(referrer = reward)
        val best = bestReward()

        assertEquals(0.0, tier.minValue, 0.0)
        assertEquals(reward, campaign.referrer)
        assertEquals("fixed", best.payoutType)
        assertEquals(listOf(ProductDetails { sku = "SHOE-42" }), best.matchedProducts)
    }

    @Test
    fun `the Builder and the Kotlin sugar over it agree field by field`() {
        val built =
            FrakConfig
                .Builder(MERCHANT_ID)
                .metadata(
                    FrakMetadata
                        .Builder()
                        .name("Acme")
                        .currency(FrakCurrency.USD)
                        .lang(FrakLanguage.FR)
                        .logoUrl("https://acme.example/logo.png")
                        .homepageLink("https://acme.example")
                        .build(),
                ).trackingEnabled(false)
                .logLevel(FrakLogLevel.DEBUG)
                .preloadSharing(true)
                .build()

        val sugared =
            FrakConfig(MERCHANT_ID) {
                metadata =
                    FrakMetadata {
                        name = "Acme"
                        currency = FrakCurrency.USD
                        lang = FrakLanguage.FR
                        logoUrl = "https://acme.example/logo.png"
                        homepageLink = "https://acme.example"
                    }
                trackingEnabled = false
                logLevel = FrakLogLevel.DEBUG
                preloadSharing = true
            }

        assertEquals(built.merchantId, sugared.merchantId)
        assertEquals(built.packageId, sugared.packageId)
        assertEquals(built.metadata.name, sugared.metadata.name)
        assertEquals(built.metadata.currency, sugared.metadata.currency)
        assertEquals(built.metadata.lang, sugared.metadata.lang)
        assertEquals(built.metadata.logoUrl, sugared.metadata.logoUrl)
        assertEquals(built.metadata.homepageLink, sugared.metadata.homepageLink)
        assertEquals(built.env, sugared.env)
        assertEquals(built.deepLink, sugared.deepLink)
        assertEquals(built.trackingEnabled, sugared.trackingEnabled)
        assertEquals(built.logLevel, sugared.logLevel)
        assertEquals(built.logSink, sugared.logSink)
        assertEquals(built.preloadSharing, sugared.preloadSharing)

        assertEquals(MERCHANT_ID, FrakConfig(MERCHANT_ID).merchantId)
        assertTrue(FrakConfig(MERCHANT_ID).trackingEnabled)
    }

    @Test
    fun `the merchant-id Builder overload and the no-arg one differ only in that field`() {
        val byId = FrakConfig.Builder(MERCHANT_ID).build()
        val byPackage = FrakConfig.Builder().packageId("com.acme.app").build()

        assertEquals(MERCHANT_ID, byId.merchantId)
        assertNull(byId.packageId)
        assertNull(byPackage.merchantId)
        assertEquals("com.acme.app", byPackage.packageId)
    }

    @Test
    fun `every sharing input type is constructible both ways`() {
        val productDetails =
            ProductDetails
                .Builder()
                .sku("SHOE-42")
                .quantity(2.0)
                .build()
        assertEquals(
            productDetails,
            ProductDetails {
                sku = "SHOE-42"
                quantity = 2.0
            },
        )

        val product =
            SharingProduct
                .Builder("Kettle", "https://acme.example/kettle")
                .imageUrl("https://acme.example/kettle.png")
                .details(productDetails)
                .build()
        val sugaredProduct =
            SharingProduct("Kettle", "https://acme.example/kettle") {
                imageUrl = "https://acme.example/kettle.png"
                // Named `productDetails`: a bare `details` would self-assign the Builder's property.
                details = productDetails
            }

        assertEquals("Kettle", product.title)
        assertEquals("https://acme.example/kettle", product.link)
        assertEquals("https://acme.example/kettle.png", product.imageUrl)
        assertEquals(productDetails, product.details)
        assertEquals(product.title, sugaredProduct.title)
        assertEquals(product.link, sugaredProduct.link)
        assertEquals(product.imageUrl, sugaredProduct.imageUrl)
        assertEquals(product.details, sugaredProduct.details)

        val bareProduct = SharingProduct("Mug", "https://acme.example/mug")
        assertEquals("Mug", bareProduct.title)
        assertNull(bareProduct.imageUrl)

        val attributionParams = AttributionParams.Builder().utmSource("android-app").build()
        assertEquals(attributionParams, AttributionParams { utmSource = "android-app" })

        val request =
            SharingRequest
                .Builder()
                .addProduct(product)
                .attribution(attributionParams)
                .targetInteraction("purchase")
                .placement("product-page")
                .build()

        assertEquals(listOf(product), request.products)
        assertEquals(attributionParams, request.attribution)
        assertEquals("purchase", request.targetInteraction)
        assertEquals("product-page", request.placement)

        val sugaredRequest =
            SharingRequest {
                products = listOf(product)
                // Named `attributionParams`: a bare `attribution` would self-assign the Builder's property.
                attribution = attributionParams
                targetInteraction = "purchase"
                placement = "product-page"
            }

        assertEquals(request.link, sugaredRequest.link)
        assertEquals(request.products, sugaredRequest.products)
        assertEquals(request.attribution, sugaredRequest.attribution)
        assertEquals(request.targetInteraction, sugaredRequest.targetInteraction)
        assertEquals(request.placement, sugaredRequest.placement)
        assertEquals(request.logoUrl, sugaredRequest.logoUrl)

        val bare = SharingRequest { }
        assertNull(bare.link)
        assertEquals(emptyList<SharingProduct>(), bare.products)
    }

    @Test
    fun `RewardRequest is constructible both ways and compares structurally`() {
        val built =
            RewardRequest
                .Builder()
                .targetInteraction("purchase")
                .addProduct(ProductDetails { sku = "SHOE-42" })
                .build()
        val sugared =
            RewardRequest {
                targetInteraction = "purchase"
                products = listOf(ProductDetails { sku = "SHOE-42" })
            }

        assertEquals(built, sugared)
        assertEquals(built.hashCode(), sugared.hashCode())
        assertNotEquals(built, RewardRequest { targetInteraction = "referral" })

        assertEquals(emptyList<ProductDetails>(), RewardRequest { }.products)
        assertEquals(RewardRequest { }, RewardRequest { products = emptyList() })
    }

    @Test
    fun `every Interaction shape is reachable through the public factories`() {
        assertEquals(Interaction.sharing(), Interaction.sharing())
        assertEquals(Interaction.sharing("order-1"), Interaction.sharing(null, "order-1"))
        assertEquals(Interaction.custom("checkout"), Interaction.custom("checkout", emptyMap()))
        assertEquals(
            Interaction.custom("checkout", mapOf("step" to "2"), "key"),
            Interaction.custom("checkout", mapOf("step" to "2"), "key"),
        )
        assertEquals(
            Interaction.arrival("0xwallet", "client", MERCHANT_ID, 1L),
            Interaction.arrival("0xwallet", "client", MERCHANT_ID, 1L),
        )

        assertNotEquals(Interaction.custom("checkout"), Interaction.custom("checkout", mapOf("step" to "2")))
    }

    @Test
    fun `a merchant can state every environment, including a custom origin pair`() {
        assertEquals(
            "https://backend.frak.id",
            FrakConfig
                .Builder()
                .build()
                .env.backend,
        )
        assertEquals("https://wallet-dev.frak.id", FrakEnvironment.Development.wallet)

        val local =
            FrakEnvironment.Custom(
                wallet = "https://localhost:3000",
                // Trailing slash stripped: origins are concatenated with paths verbatim.
                backend = "https://localhost:3030/",
            )
        assertEquals("https://localhost:3000", local.wallet)
        assertEquals("https://localhost:3030", local.backend)
        assertEquals(
            local.backend,
            FrakConfig
                .Builder()
                .env(local)
                .build()
                .env.backend,
        )
    }

    @Test
    fun `a merchant can implement FrakLogSink as a lambda and pass it in a FrakConfig`() {
        val received = mutableListOf<Pair<FrakLogLevel, String>>()
        val sink = FrakLogSink { level, message, _ -> received.add(level to message) }

        val config =
            FrakConfig {
                logLevel = FrakLogLevel.INFO
                logSink = sink
            }

        assertEquals(sink, config.logSink)
        config.logSink?.log(FrakLogLevel.INFO, "merchant-routed", null)
        assertEquals(listOf(FrakLogLevel.INFO to "merchant-routed"), received)
    }

    @Test
    fun `a merchant can name every closed enum on the surface`() {
        // A value added to any of these should show up as a diff here as well as in the .api dump.
        assertEquals("eur", FrakCurrency.EUR.wireValue)
        assertEquals("fr", FrakLanguage.FR.wireValue)
        assertEquals(5, FrakLogLevel.entries.size)
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

    private companion object {
        const val MERCHANT_ID = "b7c2e1a4-1111-4111-8111-111111111111"
    }

    private fun bestReward(): BestReward =
        BestReward(
            formatted = "10\u00a0\u20ac",
            payoutType = "fixed",
            minPurchaseAmount = null,
            minPurchaseValue = null,
            lockupDurationDays = null,
            isProductScoped = true,
            matchedProducts = listOf(ProductDetails { sku = "SHOE-42" }),
        )
}
