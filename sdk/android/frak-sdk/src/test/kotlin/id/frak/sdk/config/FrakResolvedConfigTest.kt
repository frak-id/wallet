package id.frak.sdk.config

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakLanguage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

/**
 * Pins `equals`/`hashCode`, hand-written because this is deliberately not a
 * `data class` (see the class doc). Without them, `StateFlow` conflation in
 * [id.frak.sdk.core.DefaultFrakClient] falls back to identity equality and
 * emits on every resolve, cache hit or not — see [id.frak.sdk.core.DefaultFrakClientTest].
 */
class FrakResolvedConfigTest {
    @Test
    fun `two structurally identical configs are equal and share a hash code`() {
        val a = build()
        val b = build()

        assertEquals(a, b)
        assertEquals(a.hashCode(), b.hashCode())
    }

    @Test
    fun `a different name is not equal`() {
        assertNotEquals(build(), build(name = "Other"))
    }

    @Test
    fun `a different sdkConfig is not equal`() {
        val withConfig = ResolvedConfigDecoder.decode(FULL_BODY)
        val withoutConfig = ResolvedConfigDecoder.decode(MINIMAL_BODY)

        assertNotEquals(withConfig, withoutConfig)
    }

    @Test
    fun `two configs decoded from the same body are equal`() {
        assertEquals(ResolvedConfigDecoder.decode(FULL_BODY), ResolvedConfigDecoder.decode(FULL_BODY))
    }

    @Test
    fun `an SDK-decoded config equals a merchant-built one with the same values`() {
        // Pins the equality-asymmetry fix: sdkConfig is now public, so the public
        // constructor can set it, and a merchant-built fixture can equal a
        // decoded response instead of always differing on this field.
        val decoded = ResolvedConfigDecoder.decode(FULL_BODY)
        val merchantBuilt =
            build(
                sdkConfig = ResolvedSdkConfig(currency = FrakCurrency.EUR, lang = FrakLanguage.FR, hidden = false),
            )

        assertEquals(decoded, merchantBuilt)
        assertEquals(decoded.hashCode(), merchantBuilt.hashCode())
    }

    @Test
    fun `equal sdkConfig trees make the enclosing configs equal end to end`() {
        val a = build(sdkConfig = sdkConfig())
        val b = build(sdkConfig = sdkConfig())

        assertEquals(a, b)
        assertEquals(a.hashCode(), b.hashCode())
    }

    @Test
    fun `a single differing field deep in the sdkConfig tree makes the enclosing configs unequal`() {
        val a = build(sdkConfig = sdkConfig())
        val b = build(sdkConfig = sdkConfig(buttonShareText = "Different"))

        assertNotEquals(a, b)
    }

    private fun build(
        merchantId: String = MERCHANT_ID,
        name: String = "Acme",
        domain: String = "acme.example",
        lang: FrakLanguage? = FrakLanguage.FR,
        currency: FrakCurrency? = FrakCurrency.EUR,
        hidden: Boolean = false,
        sdkConfig: ResolvedSdkConfig? = null,
    ): FrakResolvedConfig = FrakResolvedConfig(merchantId, name, domain, lang, currency, hidden, sdkConfig)

    private fun sdkConfig(buttonShareText: String = "Share"): ResolvedSdkConfig =
        ResolvedSdkConfig(
            currency = FrakCurrency.EUR,
            lang = FrakLanguage.FR,
            components = ResolvedComponents(buttonShare = ButtonShareConfig(text = buttonShareText)),
        )

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        val FULL_BODY =
            """
            {"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example",
             "sdkConfig":{"currency":"eur","lang":"fr","hidden":false}}
            """.trimIndent()
        val MINIMAL_BODY = """{"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example"}"""
    }
}
