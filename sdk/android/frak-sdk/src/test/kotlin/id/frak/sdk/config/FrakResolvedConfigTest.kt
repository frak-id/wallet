package id.frak.sdk.config

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakLanguage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Pins `equals`/`hashCode`, hand-written because this is deliberately not a `data class`.
 * Without them, `StateFlow` conflation in [id.frak.sdk.core.DefaultFrakClient] falls back to
 * identity equality and emits on every resolve, cache hit or not.
 *
 * Also pins [FrakResolvedConfig.displayName]/[FrakResolvedConfig.displayLogoUrl], the two derived
 * properties `:frak-sdk-ui` reads instead of walking the tree itself. They live here rather than in
 * that module because building a tree needs the `internal` constructors, which friend access
 * reaches only from this source set.
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
    fun `an SDK-decoded config equals a hand-built one with the same values`() {
        // The whole tree is reachable through one constructor per class, so a hand-built fixture
        // can equal a decoded response instead of always differing on the nested field.
        val decoded = ResolvedConfigDecoder.decode(FULL_BODY)
        val handBuilt =
            build(
                sdkConfig = resolvedSdkConfig(currency = FrakCurrency.EUR, lang = FrakLanguage.FR),
            )

        assertEquals(decoded, handBuilt)
        assertEquals(decoded.hashCode(), handBuilt.hashCode())
    }

    @Test
    fun `displayName prefers the sdkConfig override and falls back to the top-level name`() {
        assertEquals("Acme", build(name = "Acme", sdkConfig = null).displayName)
        assertEquals("Acme", build(name = "Acme", sdkConfig = resolvedSdkConfig(name = null)).displayName)
        assertEquals(
            "Acme Store",
            build(name = "Acme", sdkConfig = resolvedSdkConfig(name = "Acme Store")).displayName,
        )
    }

    @Test
    fun `displayLogoUrl reads through to the sdkConfig and is null without one`() {
        assertNull(build(sdkConfig = null).displayLogoUrl)
        assertNull(build(sdkConfig = resolvedSdkConfig()).displayLogoUrl)
        assertEquals(
            "https://acme.example/logo.png",
            build(sdkConfig = resolvedSdkConfig(logoUrl = "https://acme.example/logo.png")).displayLogoUrl,
        )
    }

    @Test
    fun `a decoded response exposes the same two derived values the sharing sheet reads`() {
        // The sheet folds nothing itself; these two properties are the whole contract between the
        // resolved tree and `:frak-sdk-ui`.
        val decoded = ResolvedConfigDecoder.decode(BRANDED_BODY)

        assertEquals("Acme Store", decoded.displayName)
        assertEquals("https://acme.example/logo.png", decoded.displayLogoUrl)
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

    @Test
    fun `every node of the tree distinguishes itself on its own fields`() {
        // One assertion per class, because every `equals`/`hashCode` in the tree is hand-written:
        // ten of them, none compiler-generated, and a field left out of one is invisible from the
        // enclosing config's own equality test as long as some *other* field differs. `sdkConfig()`
        // populates the whole tree so the end-to-end tests above reach these too.
        assertNotEquals(buttonShareConfig(text = "a"), buttonShareConfig(text = "b"))
        assertNotEquals(buttonWalletConfig(position = "top"), buttonWalletConfig(position = "bottom"))
        assertNotEquals(openInAppConfig(text = "a"), openInAppConfig(text = "b"))
        assertNotEquals(postPurchaseConfig(badgeText = "a"), postPurchaseConfig(badgeText = "b"))
        assertNotEquals(bannerConfig(referralTitle = "a"), bannerConfig(referralTitle = "b"))
        assertNotEquals(attributionDefaults(utmSource = "a"), attributionDefaults(utmSource = "b"))
        assertNotEquals(
            resolvedPlacement(targetInteraction = "purchase"),
            resolvedPlacement(targetInteraction = "referral"),
        )
        assertNotEquals(
            resolvedComponents(banner = bannerConfig(referralTitle = "a")),
            resolvedComponents(banner = bannerConfig(referralTitle = "b")),
        )
        assertNotEquals(resolvedSdkConfig(homepageLink = "a"), resolvedSdkConfig(homepageLink = "b"))

        // And the other half of the contract: identical values compare equal and agree on a hash.
        assertEquals(postPurchaseConfig(badgeText = "a"), postPurchaseConfig(badgeText = "a"))
        assertEquals(
            bannerConfig(referralTitle = "a").hashCode(),
            bannerConfig(referralTitle = "a").hashCode(),
        )
        assertEquals(attributionDefaults(ref = "r").hashCode(), attributionDefaults(ref = "r").hashCode())
    }

    private fun build(
        merchantId: String = MERCHANT_ID,
        name: String = "Acme",
        domain: String = "acme.example",
        lang: FrakLanguage? = FrakLanguage.FR,
        currency: FrakCurrency? = FrakCurrency.EUR,
        hidden: Boolean = false,
        sdkConfig: ResolvedSdkConfig? = null,
    ): FrakResolvedConfig = resolvedConfig(merchantId, name, domain, lang, currency, hidden, sdkConfig)

    /**
     * A fully populated tree: every one of the nine nested classes, a non-empty `translations` map
     * and a `placements` entry.
     *
     * Deliberately not the minimal thing the enclosing assertions need. The tree's ten
     * `equals`/`hashCode` implementations are hand-written, and a fixture that only reaches
     * `ButtonShareConfig` leaves the other eight unexecuted — which is what a narrower version of
     * this helper did, silently, while the file's name still promised equality was pinned.
     */
    private fun sdkConfig(buttonShareText: String = "Share"): ResolvedSdkConfig =
        resolvedSdkConfig(
            name = "Acme Store",
            logoUrl = "https://acme.example/logo.png",
            homepageLink = "https://acme.example",
            currency = FrakCurrency.EUR,
            lang = FrakLanguage.FR,
            translations = mapOf("sharing.title" to "Partager"),
            placements =
                mapOf(
                    "product-page" to
                        resolvedPlacement(
                            components = resolvedComponents(buttonShare = buttonShareConfig(text = "Share and earn")),
                            targetInteraction = "purchase",
                            translations = mapOf("sharing.cta" to "Partager"),
                        ),
                ),
            components =
                resolvedComponents(
                    buttonShare =
                        buttonShareConfig(text = buttonShareText, noRewardText = "Try it", clickAction = "copy"),
                    buttonWallet = buttonWalletConfig(position = "bottom"),
                    openInApp = openInAppConfig(text = "Open in app"),
                    postPurchase = postPurchaseConfig(badgeText = "New", ctaText = "Share"),
                    banner = bannerConfig(referralTitle = "Refer a friend", inappCta = "Open"),
                ),
            attribution = attributionDefaults(utmSource = "acme-web", utmMedium = "referral"),
        )

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        val FULL_BODY =
            """
            {"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example",
             "sdkConfig":{"currency":"eur","lang":"fr","hidden":false}}
            """.trimIndent()
        val MINIMAL_BODY = """{"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example"}"""
        val BRANDED_BODY =
            """
            {"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example",
             "sdkConfig":{"name":"Acme Store","logoUrl":"https://acme.example/logo.png"}}
            """.trimIndent()
    }
}
