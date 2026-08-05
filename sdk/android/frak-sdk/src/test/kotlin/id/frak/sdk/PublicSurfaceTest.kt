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
import id.frak.sdk.rewards.RewardTier
import id.frak.sdk.rewards.TokenAmount
import id.frak.sdk.sharing.AttributionParams
import id.frak.sdk.sharing.SharingProduct
import id.frak.sdk.sharing.SharingRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Proves a merchant can construct every public input type and every public reward model, through the
 * real public API, and states what this file can and cannot prove.
 *
 * **What it proves:** the reward models below are merchant-constructible — a merchant writing a
 * preview screen, or a test double over `rewards.best`, needs to build one — and that every input
 * type is reachable through both of its entry points, the `Builder` and the Kotlin sugar over it.
 * Deliberately does not use `core/CoreInputFixtures.kt` or `sharing/SharingInputFixtures.kt`: the rest
 * of the suite reaches for those, so this file is the one place the raw shape is written out.
 *
 * **Where the two entry points are actually compared:** only where the type has `equals`
 * (`ProductDetails`, `AttributionParams`), because that is the only comparison that can fail on a
 * field. `FrakConfig`, `FrakMetadata`, `SharingProduct` and `SharingRequest` have no `equals`, so
 * asserting one against the other would compare by identity and pass whatever the sugar did. Their
 * per-field wiring is pinned in `BuilderWiringTest` instead, which is also where the defaults, the
 * `build()` snapshot and the product-list copy live — one file, distinct values, no fixtures.
 *
 * **What it no longer covers, deliberately:** the resolved-config tree. Its constructors are
 * `internal` now (see the note at the top of `config/FrakResolvedConfig.kt`): it is a read model the
 * SDK hands you, and a public constructor on it would freeze an arity that the backend adds fields
 * to. Merchants still *read* every field of it; they just do not build one. `FrakResolvedConfigTest`
 * covers the tree from inside, with friend access.
 *
 * **What this file cannot prove, and never could:** that anything here is genuinely public. Unlike
 * Swift's `@testable`, a same-module Kotlin test source set has friend access to `internal` by
 * default, so the guarantee rests on this file not importing anything internal — a convention, not a
 * compiler check. `ConfigTreeFixtures.kt` in this same source set builds the config tree through
 * exactly that friend access, which is the clearest possible demonstration of the hole. The check
 * that cannot be defeated this way is the committed `.api` dump; the compile-time check that cannot
 * be defeated is a Java source file in the test source set — which `:frak-sdk-ui` has
 * (`JavaCallSiteFixture.java`) and this module does not, yet. It arrives with the `*Async` twins;
 * see `docs/plans/native-sdk/09-android-api-surface.md` §6.
 */
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
            FrakConfig.Builder(MERCHANT_ID)
                .metadata(
                    FrakMetadata.Builder()
                        .name("Acme")
                        .currency(FrakCurrency.USD)
                        .lang(FrakLanguage.FR)
                        .logoUrl("https://acme.example/logo.png")
                        .homepageLink("https://acme.example")
                        .build(),
                )
                .trackingEnabled(false)
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

        // `FrakConfig` has no `equals`, so `assertEquals(built, sugared)` would compare identity and
        // pass regardless. Every field, then — including the four the Builder was not asked to set,
        // since a sugar function that dropped the lambda would still get those right and must not be
        // able to hide behind them.
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

        // And the no-lambda overload, which is the shortest working config there is.
        assertEquals(MERCHANT_ID, FrakConfig(MERCHANT_ID).merchantId)
        assertTrue(FrakConfig(MERCHANT_ID).trackingEnabled)
    }

    @Test
    fun `the merchant-id Builder overload and the no-arg one differ only in that field`() {
        // The no-arg overload exists because merchantId is genuinely optional — with none, the
        // merchant is resolved from the package id. Losing it to a required constructor argument
        // would delete that integration path.
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
            ProductDetails.Builder()
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
            SharingProduct.Builder("Kettle", "https://acme.example/kettle")
                .imageUrl("https://acme.example/kettle.png")
                .details(productDetails)
                .build()
        val sugaredProduct =
            SharingProduct("Kettle", "https://acme.example/kettle") {
                imageUrl = "https://acme.example/kettle.png"
                // Named `productDetails`, not `details`: inside a `Builder`-receiver lambda a bare
                // `details` on the right-hand side would resolve to the Builder's own property, and
                // `details = details` would silently assign it to itself.
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

        // The no-lambda overload, for a product with nothing optional to say.
        val bareProduct = SharingProduct("Mug", "https://acme.example/mug")
        assertEquals("Mug", bareProduct.title)
        assertNull(bareProduct.imageUrl)

        val attributionParams = AttributionParams.Builder().utmSource("android-app").build()
        assertEquals(attributionParams, AttributionParams { utmSource = "android-app" })

        val request =
            SharingRequest.Builder()
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
                // `attributionParams`, not `attribution`: inside a `Builder`-receiver lambda a bare
                // `attribution` on the right would resolve to the Builder's own property and
                // silently self-assign. Same trap as `details` above.
                attribution = attributionParams
                targetInteraction = "purchase"
                placement = "product-page"
            }

        // `SharingRequest` has no `equals`, so field by field, same as `FrakConfig` above.
        assertEquals(request.link, sugaredRequest.link)
        assertEquals(request.products, sugaredRequest.products)
        assertEquals(request.attribution, sugaredRequest.attribution)
        assertEquals(request.targetInteraction, sugaredRequest.targetInteraction)
        assertEquals(request.placement, sugaredRequest.placement)
        assertEquals(request.logoUrl, sugaredRequest.logoUrl)

        // The bare request is a real one: it shares the merchant's homepage.
        val bare = SharingRequest { }
        assertNull(bare.link)
        assertEquals(emptyList<SharingProduct>(), bare.products)
    }

    @Test
    fun `a merchant can state every environment, including a custom origin pair`() {
        assertEquals("https://backend.frak.id", FrakConfig.Builder().build().env.backend)
        assertEquals("https://wallet-dev.frak.id", FrakEnvironment.Development.wallet)

        val local =
            FrakEnvironment.Custom(
                wallet = "https://localhost:3000",
                // Trailing slash stripped: origins are concatenated with paths verbatim.
                backend = "https://localhost:3030/",
            )
        assertEquals("https://localhost:3000", local.wallet)
        assertEquals("https://localhost:3030", local.backend)
        assertEquals(local.backend, FrakConfig.Builder().env(local).build().env.backend)
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
        // These are the enums a merchant supplies or matches on. Named here so a value added to one
        // shows up as a diff in this file as well as in the `.api` dump.
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
