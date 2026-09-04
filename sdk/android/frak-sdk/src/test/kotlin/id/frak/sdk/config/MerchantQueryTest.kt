package id.frak.sdk.config

import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.core.frakConfig
import id.frak.sdk.core.frakMetadata
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Pins the query the SDK sends to `GET /user/merchant/resolve`; these are wire-contract assertions. */
class MerchantQueryTest {
    @Test
    fun `a packageId takes precedence over a merchantId`() {
        val query =
            MerchantQuery.from(
                frakConfig(merchantId = MERCHANT_ID, packageId = "com.example.app"),
            )

        val parameters = query.parameters()
        assertEquals("packageId is sent", "com.example.app", parameters["packageId"])
        assertEquals("platform is sent alongside a packageId", "android", parameters["platform"])
        // A merchantId alongside a packageId is inert.
        assertNull("merchantId is not sent alongside a packageId", parameters["merchantId"])
    }

    @Test
    fun `a packageId is always paired with a platform`() {
        val parameters = MerchantQuery.from(frakConfig(packageId = "com.example.app")).parameters()

        assertEquals("com.example.app", parameters["packageId"])
        // The backend answers 400 INVALID_PACKAGE_ID_PAIRING when platform is missing.
        assertEquals("android", parameters["platform"])
    }

    @Test
    fun `lang is sent only when the merchant configured one`() {
        val withLang =
            MerchantQuery
                .from(
                    frakConfig(
                        merchantId = MERCHANT_ID,
                        metadata = frakMetadata(lang = FrakLanguage.FR),
                    ),
                ).parameters()
        assertEquals("fr", withLang["lang"])

        val withoutLang = MerchantQuery.from(frakConfig(merchantId = MERCHANT_ID)).parameters()
        // Null rather than empty: an absent lang falls back to the merchant's configured language.
        assertNull(withoutLang["lang"])
    }

    @Test
    fun `cache keys separate the two resolution routes`() {
        val byId = MerchantQuery.from(frakConfig(merchantId = MERCHANT_ID)).cacheKey()
        val byPackage = MerchantQuery.from(frakConfig(packageId = "com.example.app")).cacheKey()

        assertTrue("id route is prefixed", byId.startsWith("id:"))
        assertTrue("package route is prefixed", byPackage.startsWith("pkg:"))
    }

    @Test
    fun `cache keys separate languages`() {
        val english =
            MerchantQuery
                .from(
                    frakConfig(merchantId = MERCHANT_ID, metadata = frakMetadata(lang = FrakLanguage.EN)),
                ).cacheKey()
        val french =
            MerchantQuery
                .from(
                    frakConfig(merchantId = MERCHANT_ID, metadata = frakMetadata(lang = FrakLanguage.FR)),
                ).cacheKey()

        assertTrue("languages do not share a cache entry", english != french)
    }

    @Test
    fun `package cache keys are case insensitive`() {
        val lower = MerchantQuery.from(frakConfig(packageId = "com.example.app")).cacheKey()
        val upper = MerchantQuery.from(frakConfig(packageId = "COM.EXAMPLE.APP")).cacheKey()

        // Mirrors the backend's own normalisation (`normalizePackageId` lowercases).
        assertEquals(lower, upper)
    }

    @Test
    fun `a config with neither identifier fails with a merchant resolution error`() {
        val failure = runCatching { MerchantQuery.from(frakConfig()) }.exceptionOrNull()

        assertTrue(
            "expected MerchantResolutionFailed, got $failure",
            failure is FrakError.MerchantResolutionFailed,
        )
    }

    @Test
    fun `a blank packageId is treated as absent, falling back to merchantId`() {
        // A merchant reading an empty BuildConfig field gets "" rather than null.
        val query = MerchantQuery.from(frakConfig(merchantId = MERCHANT_ID, packageId = "   "))

        assertEquals(MERCHANT_ID, query.parameters()["merchantId"])
    }

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    }
}
