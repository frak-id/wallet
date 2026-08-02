package id.frak.sdk.config

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLanguage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the decode of `GET /user/merchant/resolve`.
 *
 * Bodies here are copied from the shape `services/backend/user-openapi.json`
 * declares, not invented. The hostile cases matter more than the happy one: a
 * merchant's binary is frozen the day they ship it while the backend deploys
 * continuously, so what the decoder does with a response it was not built for is
 * the actual contract.
 */
class ResolvedConfigDecoderTest {
    @Test
    fun `decodes a full response`() {
        val config = ResolvedConfigDecoder.decode(FULL_RESPONSE)

        assertEquals("b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f", config.merchantId)
        assertEquals("Acme", config.name)
        assertEquals("acme.example", config.domain)
        assertEquals(FrakCurrency.EUR, config.currency)
        assertEquals(FrakLanguage.FR, config.lang)
    }

    @Test
    fun `decodes a minimal response with no sdkConfig`() {
        val config = ResolvedConfigDecoder.decode(MINIMAL_RESPONSE)

        assertEquals("b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f", config.merchantId)
        // `sdkConfig` is omitted entirely rather than sent as null when a
        // merchant has none, so every field derived from it must degrade.
        assertNull(config.currency)
        assertNull(config.lang)
        assertFalse(config.hidden)
    }

    @Test
    fun `hidden defaults to false when the backend omits it`() {
        // The backend only emits `hidden` when it is true, so absent means false
        // rather than unknown.
        assertFalse(ResolvedConfigDecoder.decode(FULL_RESPONSE).hidden)
    }

    @Test
    fun `an unknown currency degrades to null rather than failing the decode`() {
        val body =
            """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"sdkConfig":{"currency":"chf"}}
            """.trimIndent()

        // A currency added to the backend tomorrow must not brick a binary
        // shipped today.
        assertNull(ResolvedConfigDecoder.decode(body).currency)
    }

    @Test
    fun `unknown fields are ignored`() {
        val body =
            """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"somethingNewTheBackendAdded":{"nested":true}}
            """.trimIndent()

        assertEquals("Acme", ResolvedConfigDecoder.decode(body).name)
    }

    @Test
    fun `a wrong-typed optional field reads as absent`() {
        val body =
            """
            {"merchantId":"m","productId":"0x00","name":"Acme","domain":"acme.example",
             "allowedDomains":[],"sdkConfig":{"logoUrl":42,"lang":"en"}}
            """.trimIndent()

        // A missing logo beats a bricked sheet: the rest of the config still
        // decodes.
        val config = ResolvedConfigDecoder.decode(body)
        assertEquals(FrakLanguage.EN, config.lang)
    }

    @Test
    fun `a missing required field is a decoding error naming it`() {
        val body = """{"productId":"0x00","name":"Acme","domain":"acme.example","allowedDomains":[]}"""

        val failure = runCatching { ResolvedConfigDecoder.decode(body) }.exceptionOrNull()

        assertTrue("expected Decoding, got $failure", failure is FrakError.Decoding)
        assertTrue(
            "the message should name the missing field, was: ${failure?.message}",
            failure?.message?.contains("merchantId") == true,
        )
    }

    @Test
    fun `a text plain body is a decoding error, not a crash`() {
        // What a `404 Merchant not found` looks like if it ever reaches here.
        val failure = runCatching { ResolvedConfigDecoder.decode("Merchant not found") }.exceptionOrNull()

        assertTrue("expected Decoding, got $failure", failure is FrakError.Decoding)
    }

    @Test
    fun `decodes placements and the merchant-global component tier`() {
        val config = ResolvedConfigDecoder.decode(FULL_RESPONSE)
        val sdkConfig = requireNotNull(config.sdkConfig)

        // Placement-level copy takes precedence over the merchant-global default.
        assertEquals(
            "Share and earn {REWARD}",
            sdkConfig.placements["product-page"]
                ?.components
                ?.buttonShare
                ?.text,
        )
        // The merchant-global default itself, for a placement that doesn't override it.
        // A merchant who sets one and sees it ignored has no way to tell that apart
        // from the feature not working.
        assertEquals("Share", sdkConfig.components?.buttonShare?.text)
    }

    @Test
    fun `decodes translations and attribution defaults`() {
        val sdkConfig = requireNotNull(ResolvedConfigDecoder.decode(FULL_RESPONSE).sdkConfig)

        assertEquals("Partager", sdkConfig.translations["sharing.title"])
        assertEquals("acme-web", sdkConfig.attribution?.utmSource)
    }

    private companion object {
        val FULL_RESPONSE =
            """
            {
              "merchantId": "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f",
              "productId": "0xdeadbeef",
              "name": "Acme",
              "domain": "acme.example",
              "allowedDomains": ["acme.example", "shop.acme.example"],
              "sdkConfig": {
                "name": "Acme Shop",
                "logoUrl": "https://acme.example/logo.png",
                "currency": "eur",
                "lang": "fr",
                "translations": { "sharing.title": "Partager" },
                "components": { "buttonShare": { "text": "Share" } },
                "placements": {
                  "product-page": {
                    "targetInteraction": "purchase",
                    "components": { "buttonShare": { "text": "Share and earn {REWARD}" } }
                  }
                },
                "attribution": { "utmSource": "acme-web" }
              }
            }
            """.trimIndent()

        val MINIMAL_RESPONSE =
            """
            {
              "merchantId": "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f",
              "productId": "0xdeadbeef",
              "name": "Acme",
              "domain": "acme.example",
              "allowedDomains": []
            }
            """.trimIndent()
    }
}
