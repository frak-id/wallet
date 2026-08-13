package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharingPageUrlTest {
    /** Mirrors the wallet's own `sanitizeReturnScheme`; a scheme it rejects drops every callback. */
    private val walletPattern = Regex("^frak-[a-z0-9._-]{1,60}$")

    @Test
    fun `derives a return scheme the wallet accepts`() {
        assertEquals("frak-com.groupeseb.moulinex.food", SharingPageUrl.returnScheme("com.groupeseb.moulinex.food"))
        assertTrue(walletPattern.matches(SharingPageUrl.returnScheme("com.Acme.App")))
        assertTrue(walletPattern.matches(SharingPageUrl.returnScheme("com.acme:remote")))
    }

    @Test
    fun `stays within the wallet's length bound`() {
        val scheme = SharingPageUrl.returnScheme("a".repeat(200))
        assertTrue(walletPattern.matches(scheme))
        assertEquals("frak-".length + 60, scheme.length)
    }

    @Test
    fun `strips non-ascii digits the wallet's ascii-only pattern would reject`() {
        // Devanagari 1-2-3: Character.isDigit accepts them, the wallet's `[a-z0-9._-]` does not.
        assertEquals("frak-app", SharingPageUrl.returnScheme("\u0967\u0968\u0969"))
        assertTrue(walletPattern.matches(SharingPageUrl.returnScheme("com.acme.\u0967app")))
    }

    @Test
    fun `falls back rather than emitting a bare prefix`() {
        assertTrue(walletPattern.matches(SharingPageUrl.returnScheme("///")))
    }

    @Test
    fun `builds the page url with everything native mode needs`() {
        val url =
            SharingPageUrl.build(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
                sessionId = "42",
                appName = "Acme Store",
                link = "https://acme.example/p?a=1",
            )

        assertTrue(url.startsWith("https://wallet.frak.id/sharing?embed=native"))
        assertTrue(url.contains("&merchantId=$MERCHANT_ID"))
        assertTrue(url.contains("&clientId=$CLIENT_ID"))
        assertTrue(url.contains("&returnScheme=frak-com.acme.app"))
        assertTrue(url.contains("&sid=42"))
        assertTrue(url.contains("&sdkVersion="))
        assertTrue(url.contains("&appName=Acme%20Store"))
        assertTrue(url.contains("&link=https%3A%2F%2Facme.example%2Fp%3Fa%3D1"))
    }

    @Test
    fun `forwards products as a json value the page can parse`() {
        val url =
            SharingPageUrl.build(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
                sessionId = "1",
                products = """[{"title":"Cookeo"}]""",
            )
        assertTrue(url.contains("&products=%5B%7B%22title%22%3A%22Cookeo%22%7D%5D"))
    }

    @Test
    fun `omits absent optional params entirely`() {
        val url = SharingPageUrl.build("https://wallet.frak.id", MERCHANT_ID, CLIENT_ID, "com.acme.app", "1")
        assertFalse(url.contains("appName"))
        assertFalse(url.contains("logoUrl"))
        assertFalse(url.contains("&seedReward="))
        assertFalse(url.contains("products"))
        assertFalse(url.contains("confirmed"))
    }

    @Test
    fun `carries no presentation params`() {
        val url =
            SharingPageUrl.build(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
                sessionId = "1",
            )
        val warm =
            SharingPageUrl.warm(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
            )
        for (candidate in listOf(url, warm)) {
            assertFalse("presentation must not ride the URL: $candidate", candidate.contains("cornerRadius"))
            assertFalse("presentation must not ride the URL: $candidate", candidate.contains("radius"))
        }
    }

    @Test
    fun `appends the confirmation flag without disturbing the rest`() {
        val url =
            SharingPageUrl.build(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
                sessionId = "1",
                confirmed = true,
            )
        assertTrue(url.endsWith("&view=confirmation"))
    }

    private companion object {
        const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
        const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
    }
}
