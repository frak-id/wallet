package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SharingPageUrlTest {
    /** The wallet's own `sanitizeReturnScheme`. A scheme it rejects means every callback is dropped, silently. */
    private val walletPattern = Regex("^frak-[a-z0-9._-]{1,60}$")

    @Test
    fun `derives a return scheme the wallet accepts`() {
        assertEquals("frak-com.groupeseb.moulinex.food", SharingPageUrl.returnScheme("com.groupeseb.moulinex.food"))
        assertTrue(walletPattern.matches(SharingPageUrl.returnScheme("com.Acme.App")))
        // Package ids can carry characters the wallet's pattern rejects.
        assertTrue(walletPattern.matches(SharingPageUrl.returnScheme("com.acme:remote")))
    }

    @Test
    fun `stays within the wallet's length bound`() {
        val scheme = SharingPageUrl.returnScheme("a".repeat(200))
        assertTrue(walletPattern.matches(scheme))
        assertEquals("frak-".length + 60, scheme.length)
    }

    @Test
    fun `falls back rather than emitting a bare prefix`() {
        // "frak-" alone does not match the wallet's pattern, which needs at
        // least one trailing character.
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

        assertTrue(url.startsWith("https://wallet.frak.id/sharing?native=1"))
        assertTrue(url.contains("&merchantId=$MERCHANT_ID"))
        assertTrue(url.contains("&clientId=$CLIENT_ID"))
        assertTrue(url.contains("&returnScheme=frak-com.acme.app"))
        assertTrue(url.contains("&sid=42"))
        assertTrue(url.contains("&sdkv="))
        assertTrue(url.contains("&appName=Acme%20Store"))
        // The merchant's link is a value here, so its separators must be
        // encoded or they become separators of the page's own query.
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
        assertFalse(url.contains("&r="))
        assertFalse(url.contains("products"))
        assertFalse(url.contains("confirmed"))
        assertFalse("absent means the page keeps doing what it does today", url.contains("cornerRadius"))
    }

    /**
     * The sheet stopped clipping the web view (a round-rect clip cannot be handed to the WebView
     * draw functor, so HWUI paid for an offscreen pass every frame) and asks the page to round
     * itself instead. Absent on iOS, whose system sheet already clips.
     */
    @Test
    fun `carries the host corner radius when one is asked for`() {
        val url =
            SharingPageUrl.build(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
                sessionId = "1",
                cornerRadius = 28,
            )
        assertTrue(url.contains("&cornerRadius=28"))
    }

    /**
     * Both halves or neither: `SharingSheetState.build` rebuilds the warm URL to compare against
     * what the pool actually loaded, and a radius on one side only makes every session decide the
     * warm page is a different document and pay for a full load instead of a fragment activation.
     */
    @Test
    fun `the warm url carries the same corner radius as the session url`() {
        val warm =
            SharingPageUrl.warm(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
                cornerRadius = 28,
            )
        assertTrue(warm.contains("&cornerRadius=28"))

        val cold =
            SharingPageUrl.warm(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                clientId = CLIENT_ID,
                packageId = "com.acme.app",
            )
        assertFalse(cold.contains("cornerRadius"))
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
        assertTrue(url.endsWith("&confirmed=1"))
    }

    private companion object {
        const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
        const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
    }
}
