package id.frak.sdk.sharing

import id.frak.sdk.config.attributionDefaults
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SharingLinkBuilderTest {
    private val context =
        FrakContext.V2(
            merchantId = "550e8400-e29b-41d4-a716-446655440000",
            timestamp = 1_709_654_400,
            clientId = "550e8400-e29b-41d4-a716-446655440001",
        )

    /** The `c-only` golden fixture's `fCtx`, so this file and the codec agree by construction. */
    private val expectedContext = "ElUOhADim0HUpxZEZlVEAABl50GAVQ6EAOKbQdSnFkRmVUQAAQ"

    @Test
    fun `attaches the context and the default source`() {
        assertEquals(
            "https://acme.example/p/1?fCtx=$expectedContext&utm_source=frak",
            SharingLinkBuilder.build("https://acme.example/p/1", context, null, null),
        )
    }

    @Test
    fun `preserves the merchant's own query and fragment`() {
        val link =
            SharingLinkBuilder.build(
                "https://acme.example/p?size=XL&utm_source=newsletter#reviews",
                context,
                null,
                null,
            )
        assertEquals(
            "https://acme.example/p?size=XL&utm_source=newsletter&fCtx=$expectedContext#reviews",
            link,
        )
    }

    @Test
    fun `replaces an existing context whatever case it arrived in`() {
        val link = SharingLinkBuilder.build("https://acme.example/p?fctx=stale&a=1", context, null, null)
        assertEquals("https://acme.example/p?a=1&fCtx=$expectedContext&utm_source=frak", link)
    }

    @Test
    fun `lets per-call attribution win over merchant defaults`() {
        val link =
            SharingLinkBuilder.build(
                baseUrl = "https://acme.example/p",
                context = context,
                attribution = AttributionParams(utmSource = "android-app"),
                defaults = attributionDefaults(utmSource = "web", utmMedium = "referral"),
            )
        assertTrue(link!!.contains("utm_source=android-app"))
        assertTrue(link.contains("utm_medium=referral"))
    }

    @Test
    fun `takes utm_content from the product, never from merchant defaults`() {
        val link =
            SharingLinkBuilder.build(
                baseUrl = "https://acme.example/p",
                context = context,
                attribution = AttributionParams(utmContent = "per-call"),
                defaults = attributionDefaults(utmSource = "web"),
                productUtmContent = "sku-42",
            )
        assertTrue(link!!.contains("utm_content=sku-42"))
    }

    @Test
    fun `percent-encodes attribution values per RFC 3986`() {
        val link =
            SharingLinkBuilder.build(
                baseUrl = "https://acme.example/p",
                context = context,
                attribution = AttributionParams(utmCampaign = "spring sale&more"),
                defaults = null,
            )
        // A space is %20, not `+`: this is a query string, not a form body.
        assertTrue(link!!.contains("utm_campaign=spring%20sale%26more"))
    }

    @Test
    fun `refuses a context with no identity and a base that is not a url`() {
        assertNull(SharingLinkBuilder.build("https://acme.example", context.withoutIdentity(), null, null))
        assertNull(SharingLinkBuilder.build("acme.example/p", context, null, null))
    }

    @Test
    fun `parses a context back out of a link it built`() {
        val link = SharingLinkBuilder.build("https://acme.example/p", context, null, null)!!
        assertEquals(context, SharingLinkBuilder.parse(link))
    }

    @Test
    fun `parses a context from a lowercased parameter key`() {
        assertEquals(context, SharingLinkBuilder.parse("https://acme.example/p?fctx=$expectedContext"))
    }

    @Test
    fun `parses a context a channel percent-encoded in transit`() {
        // Messaging apps re-encode links; `-` and `_` are base64url characters
        // that survive as `%2D` / `%5F`, which would otherwise fail to decode.
        val encoded = expectedContext.replace("-", "%2D").replace("_", "%5F")
        assertEquals(context, SharingLinkBuilder.parse("https://acme.example/p?fCtx=$encoded"))
    }

    @Test
    fun `yields null for a link carrying no context or a corrupt one`() {
        assertNull(SharingLinkBuilder.parse("https://acme.example/p?a=1"))
        assertNull(SharingLinkBuilder.parse("https://acme.example/p?fCtx=not-a-context"))
    }

    private fun FrakContext.V2.withoutIdentity() = FrakContext.V2(merchantId, timestamp)
}
