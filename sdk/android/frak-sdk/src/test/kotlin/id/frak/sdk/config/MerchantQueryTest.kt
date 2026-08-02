package id.frak.sdk.config

import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.core.FrakMetadata
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the query the SDK sends to `GET /user/merchant/resolve`.
 *
 * These are wire-contract assertions, not implementation details. Every one of
 * them corresponds to a way the backend answers 400 or silently resolves the
 * wrong merchant.
 */
class MerchantQueryTest {
    @Test
    fun `a merchantId takes precedence over a packageId`() {
        val query =
            MerchantQuery.from(
                FrakConfig(merchantId = MERCHANT_ID, packageId = "com.example.app"),
            )

        val parameters = query.parameters()
        assertEquals("merchantId is sent", MERCHANT_ID, parameters["merchantId"])
        // The backend's own lookup is first-match-wins with merchantId first, so
        // a packageId sent alongside would be inert for lookup — but would still
        // be schema-validated, and without a platform that is a 400 rather than
        // the 200 the caller expects.
        assertNull("packageId is not sent alongside a merchantId", parameters["packageId"])
        assertNull("platform is not sent alongside a merchantId", parameters["platform"])
    }

    @Test
    fun `a packageId is always paired with a platform`() {
        val parameters = MerchantQuery.from(FrakConfig(packageId = "com.example.app")).parameters()

        assertEquals("com.example.app", parameters["packageId"])
        // Unconditional. The backend rejects the pair with
        // 400 INVALID_PACKAGE_ID_PAIRING when platform is missing, and
        // allowed_package_ids entries are platform-prefixed, so an unprefixed
        // lookup matches nothing anyway.
        assertEquals("android", parameters["platform"])
    }

    @Test
    fun `lang is sent only when the merchant configured one`() {
        val withLang =
            MerchantQuery
                .from(
                    FrakConfig(
                        merchantId = MERCHANT_ID,
                        metadata = FrakMetadata(lang = FrakLanguage.FR),
                    ),
                ).parameters()
        assertEquals("fr", withLang["lang"])

        val withoutLang = MerchantQuery.from(FrakConfig(merchantId = MERCHANT_ID)).parameters()
        // Null rather than empty: the backend distinguishes an absent parameter
        // from an empty one, and lets an absent lang fall back to the merchant's
        // own configured language.
        assertNull(withoutLang["lang"])
    }

    @Test
    fun `cache keys separate the two resolution routes`() {
        val byId = MerchantQuery.from(FrakConfig(merchantId = MERCHANT_ID)).cacheKey()
        val byPackage = MerchantQuery.from(FrakConfig(packageId = "com.example.app")).cacheKey()

        assertTrue("id route is prefixed", byId.startsWith("id:"))
        assertTrue("package route is prefixed", byPackage.startsWith("pkg:"))
    }

    @Test
    fun `cache keys separate languages`() {
        val english =
            MerchantQuery
                .from(
                    FrakConfig(merchantId = MERCHANT_ID, metadata = FrakMetadata(lang = FrakLanguage.EN)),
                ).cacheKey()
        val french =
            MerchantQuery
                .from(
                    FrakConfig(merchantId = MERCHANT_ID, metadata = FrakMetadata(lang = FrakLanguage.FR)),
                ).cacheKey()

        // Two languages resolve the same merchant but return different copy.
        // Sharing a cache entry would serve French copy to an English user.
        assertTrue("languages do not share a cache entry", english != french)
    }

    @Test
    fun `package cache keys are case insensitive`() {
        val lower = MerchantQuery.from(FrakConfig(packageId = "com.example.app")).cacheKey()
        val upper = MerchantQuery.from(FrakConfig(packageId = "COM.EXAMPLE.APP")).cacheKey()

        // Mirrors the backend's own normalisation (`normalizePackageId` lowercases),
        // so a cache hit here corresponds to a cache hit there.
        assertEquals(lower, upper)
    }

    @Test
    fun `a config with neither identifier fails with a merchant resolution error`() {
        val failure = runCatching { MerchantQuery.from(FrakConfig()) }.exceptionOrNull()

        assertTrue(
            "expected MerchantResolutionFailed, got $failure",
            failure is FrakError.MerchantResolutionFailed,
        )
    }

    @Test
    fun `blank identifiers are treated as absent`() {
        // A merchant reading an empty BuildConfig field gets "" rather than null,
        // and "" would resolve nothing while looking configured.
        val query = MerchantQuery.from(FrakConfig(merchantId = "   ", packageId = "com.example.app"))

        assertEquals("com.example.app", query.parameters()["packageId"])
    }

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    }
}
