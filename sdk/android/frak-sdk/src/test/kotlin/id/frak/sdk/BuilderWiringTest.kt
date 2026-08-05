package id.frak.sdk

import id.frak.sdk.core.DeepLinkHandling
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakEnvironment
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogSink
import id.frak.sdk.core.FrakMetadata
import id.frak.sdk.core.ProductDetails
import id.frak.sdk.sharing.AttributionParams
import id.frak.sdk.sharing.SharingProduct
import id.frak.sdk.sharing.SharingRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Every `Builder` setter, called with a value distinguishable from every other field's, and every
 * resulting property asserted.
 *
 * This test exists because the move from constructors to Builders introduced a failure mode that did
 * not previously exist. A constructor cannot assign a parameter to the wrong property — the compiler
 * does it. A hand-written setter can: `fun homepageLink(v: String?) = apply { this.logoUrl = v }`
 * compiles, type-checks, and is wrong. The rest of the suite reaches for the defaulted fixture
 * helpers, which call every setter but almost always with `null` or the default enum, and a
 * `null`-for-`null` swap is invisible. So: distinct values, one assertion per field, no defaults.
 *
 * The `build()`-snapshot and list-copy contracts are pinned here too, for the same reason — they are
 * properties of the Builder rather than of any one field.
 */
class BuilderWiringTest {
    @Test
    fun `FrakMetadata Builder carries every field to the right property`() {
        val metadata =
            FrakMetadata.Builder()
                .name("metadata-name")
                .currency(FrakCurrency.GBP)
                .lang(FrakLanguage.FR)
                .logoUrl("https://acme.example/logo.png")
                .homepageLink("https://acme.example/home")
                .build()

        assertEquals("metadata-name", metadata.name)
        assertEquals(FrakCurrency.GBP, metadata.currency)
        assertEquals(FrakLanguage.FR, metadata.lang)
        assertEquals("https://acme.example/logo.png", metadata.logoUrl)
        assertEquals("https://acme.example/home", metadata.homepageLink)
    }

    @Test
    fun `FrakConfig Builder carries every field to the right property`() {
        val metadata = FrakMetadata.Builder().name("acme").build()
        val sink = FrakLogSink { _, _, _ -> }
        val environment = FrakEnvironment.Custom("https://wallet.test", "https://backend.test")

        val config =
            FrakConfig.Builder()
                .merchantId("merchant-id")
                .packageId("com.acme.app")
                .metadata(metadata)
                .env(environment)
                .deepLink(DeepLinkHandling.Manual)
                .trackingEnabled(false)
                .logLevel(FrakLogLevel.WARN)
                .logSink(sink)
                .preloadSharing(true)
                .build()

        assertEquals("merchant-id", config.merchantId)
        assertEquals("com.acme.app", config.packageId)
        assertSame(metadata, config.metadata)
        assertSame(environment, config.env)
        assertEquals(DeepLinkHandling.Manual, config.deepLink)
        assertFalse(config.trackingEnabled)
        assertEquals(FrakLogLevel.WARN, config.logLevel)
        assertSame(sink, config.logSink)
        assertTrue(config.preloadSharing)
    }

    @Test
    fun `an untouched Builder produces the documented defaults`() {
        // Every default has exactly one home, the Builder. This is what fails if one moves or drifts.
        val config = FrakConfig.Builder().build()

        assertNull(config.merchantId)
        assertNull(config.packageId)
        assertEquals(FrakEnvironment.Production, config.env)
        assertEquals(DeepLinkHandling.Automatic, config.deepLink)
        assertTrue(config.trackingEnabled)
        assertEquals(FrakLogLevel.NONE, config.logLevel)
        assertNull(config.logSink)
        assertFalse(config.preloadSharing)

        // FrakMetadata's own five defaults, which `FrakConfig.Builder` starts from.
        assertNull(config.metadata.name)
        assertEquals(FrakCurrency.EUR, config.metadata.currency)
        assertNull(config.metadata.lang)
        assertNull(config.metadata.logoUrl)
        assertNull(config.metadata.homepageLink)

        val product = SharingProduct.Builder("t", "l").build()
        assertNull(product.imageUrl)
        assertNull(product.utmContent)
        assertNull(product.details)

        val request = SharingRequest.Builder().build()
        assertNull(request.link)
        assertEquals(emptyList<SharingProduct>(), request.products)
        assertNull(request.attribution)
        assertNull(request.targetInteraction)
        assertNull(request.placement)
        assertNull(request.logoUrl)

        assertEquals(ProductDetails.Builder().build(), ProductDetails { })
        assertEquals(AttributionParams.Builder().build(), AttributionParams { })
    }

    @Test
    fun `ProductDetails Builder carries every field to the right property`() {
        val details =
            ProductDetails.Builder()
                .productId("product-id")
                .sku("sku")
                .name("product-name")
                .quantity(1.0)
                .unitPrice(2.0)
                .totalPrice(3.0)
                .build()

        assertEquals("product-id", details.productId)
        assertEquals("sku", details.sku)
        assertEquals("product-name", details.name)
        // Three distinct values, so a quantity/unitPrice/totalPrice swap in the Builder fails here.
        assertEquals(1.0, requireNotNull(details.quantity), 0.0)
        assertEquals(2.0, requireNotNull(details.unitPrice), 0.0)
        assertEquals(3.0, requireNotNull(details.totalPrice), 0.0)
    }

    @Test
    fun `AttributionParams Builder carries every field to the right property`() {
        val attribution =
            AttributionParams.Builder()
                .utmSource("source")
                .utmMedium("medium")
                .utmCampaign("campaign")
                .utmContent("content")
                .utmTerm("term")
                .via("via")
                .ref("ref")
                .build()

        assertEquals("source", attribution.utmSource)
        assertEquals("medium", attribution.utmMedium)
        assertEquals("campaign", attribution.utmCampaign)
        assertEquals("content", attribution.utmContent)
        assertEquals("term", attribution.utmTerm)
        assertEquals("via", attribution.via)
        assertEquals("ref", attribution.ref)
    }

    @Test
    fun `SharingProduct Builder carries every field to the right property`() {
        val details = ProductDetails { sku = "sku" }
        val product =
            SharingProduct.Builder("product-title", "https://acme.example/p")
                .imageUrl("https://acme.example/p.png")
                .utmContent("content")
                .details(details)
                .build()

        assertEquals("product-title", product.title)
        assertEquals("https://acme.example/p", product.link)
        assertEquals("https://acme.example/p.png", product.imageUrl)
        assertEquals("content", product.utmContent)
        assertSame(details, product.details)
    }

    @Test
    fun `SharingRequest Builder carries every field to the right property`() {
        val product = SharingProduct("product-title", "https://acme.example/p")
        val attribution = AttributionParams { utmSource = "source" }
        val request =
            SharingRequest.Builder()
                .link("https://acme.example/request")
                .products(listOf(product))
                .attribution(attribution)
                .targetInteraction("purchase")
                .placement("product-page")
                .logoUrl("https://acme.example/logo.png")
                .build()

        assertEquals("https://acme.example/request", request.link)
        assertEquals(listOf(product), request.products)
        assertSame(attribution, request.attribution)
        assertEquals("purchase", request.targetInteraction)
        assertEquals("product-page", request.placement)
        assertEquals("https://acme.example/logo.png", request.logoUrl)
    }

    @Test
    fun `addProduct appends to whatever products already holds`() {
        val first = SharingProduct("first", "https://acme.example/1")
        val second = SharingProduct("second", "https://acme.example/2")

        val request =
            SharingRequest.Builder()
                .products(listOf(first))
                .addProduct(second)
                .build()

        assertEquals(listOf(first, second), request.products)
    }

    @Test
    fun `build snapshots, so a Builder reused or mutated afterwards does not reach back`() {
        val builder = SharingRequest.Builder().link("https://acme.example/first")
        val first = builder.build()

        builder.link = "https://acme.example/second"
        val second = builder.build()

        assertEquals("https://acme.example/first", first.link)
        assertEquals("https://acme.example/second", second.link)
    }

    @Test
    @Suppress("UNCHECKED_CAST")
    fun `products is copied out of the caller's list and is not mutable through the getter`() {
        // Two separate contracts, one fix. Without the copy, a caller holding the list it passed in
        // could change a request already built; and `getProducts()` would hand Java a list whose
        // mutability depended on whether `products` or `addProduct` built it.
        val mutable = mutableListOf(SharingProduct("first", "https://acme.example/1"))
        val request = SharingRequest.Builder().products(mutable).build()

        mutable.add(SharingProduct("second", "https://acme.example/2"))

        assertEquals(1, request.products.size)
        assertThrows(UnsupportedOperationException::class.java) {
            (request.products as MutableList<SharingProduct>).add(SharingProduct("third", "https://acme.example/3"))
        }
    }
}
