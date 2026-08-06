package id.frak.sdk.applink

import id.frak.sdk.sharing.frakContextV1
import id.frak.sdk.sharing.frakContextV2
import id.frak.sdk.tracking.Interaction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InstallLinksTest {
    @Test
    fun `builds the wallet deep link the install route expects`() {
        assertEquals(
            "frakwallet://install?m=$MERCHANT_ID&a=$CLIENT_ID",
            InstallLinks.deepLink("frakwallet", MERCHANT_ID, CLIENT_ID),
        )
    }

    /**
     * `?p=`, not the `#p=` the hosted install page uses: the wallet's deep-link router navigates
     * in-app, so a fragment is gone before `/install` renders. `routeResolvers.install` forwards
     * the search param for exactly this reason — the two have to agree or the proof is dropped
     * on every already-installed device, which is the one path with no Play referrer to fall
     * back on.
     */
    @Test
    fun `carries the install proof as a search param the deep-link router forwards`() {
        assertEquals(
            "frakwallet://install?m=$MERCHANT_ID&a=$CLIENT_ID&p=AQR-_x",
            InstallLinks.deepLink("frakwallet", MERCHANT_ID, CLIENT_ID, installProof = "AQR-_x"),
        )
    }

    /**
     * `embed=native` is the one marker of a host-embedded page, and it is the same spelling
     * `/sharing` uses. The sharing sheet navigates its one web view from `/sharing` to here, so a
     * route that read the marker differently rendered differently mid-flow — which is exactly what
     * happened while `/install` inferred a host from the presence of `returnScheme` instead.
     */
    @Test
    fun `marks the hosted install page as host-embedded, the same way the sharing url does`() {
        val url =
            InstallLinks.installPage(
                walletOrigin = "https://wallet.frak.id",
                merchantId = MERCHANT_ID,
                anonymousId = CLIENT_ID,
                returnScheme = "frak-com.acme.app",
                sessionId = "session-1",
                proof = null,
            )

        assertEquals(
            "https://wallet.frak.id/install?embed=native&m=$MERCHANT_ID&a=$CLIENT_ID" +
                "&returnScheme=frak-com.acme.app&sid=session-1",
            url,
        )
        // No corner radius, and nothing else about how the sheet looks: presentation reaches the
        // page as CSS custom properties injected by origin, so every route gets it at once.
        assertEquals(false, url.contains("cornerRadius"))
    }

    @Test
    fun `nests the play install referrer as one encoded value`() {
        val url = InstallLinks.playStore("id.frak.wallet", MERCHANT_ID, CLIENT_ID)

        // The referrer's own separators must be encoded, or Play reads them as
        // separators of the outer query and the pair never reaches the wallet.
        assertEquals(
            "https://play.google.com/store/apps/details?id=id.frak.wallet" +
                "&referrer=merchantId%3D$MERCHANT_ID%26anonymousId%3D$CLIENT_ID",
            url,
        )
    }

    @Test
    fun `appends the install proof when there is one`() {
        val url = InstallLinks.playStore("id.frak.wallet", MERCHANT_ID, CLIENT_ID, installProof = "AQR-_x")
        assertTrue(url.endsWith("%26proof%3DAQR-_x"))
    }
}

class ReferralArrivalTest {
    @Test
    fun `treats a link this device produced as a self-referral`() {
        val own = frakContextV2(MERCHANT_ID, TIMESTAMP, clientId = CLIENT_ID)
        assertTrue(ReferralArrival.shouldIgnoreArrival(own, CLIENT_ID))
    }

    @Test
    fun `treats someone else's link as a referral`() {
        val other = frakContextV2(MERCHANT_ID, TIMESTAMP, clientId = OTHER_CLIENT_ID)
        assertFalse(ReferralArrival.shouldIgnoreArrival(other, CLIENT_ID))
    }

    @Test
    fun `cannot self-refer with no identity, or from a v1 link`() {
        val context = frakContextV2(MERCHANT_ID, TIMESTAMP, clientId = CLIENT_ID)
        assertFalse(ReferralArrival.shouldIgnoreArrival(context, null))
        // A native app has no wallet, so the wallet comparison the web makes has nothing to
        // compare against.
        assertFalse(ReferralArrival.shouldIgnoreArrival(frakContextV1(WALLET), CLIENT_ID))
    }

    @Test
    fun `ignores a v2 link minted for a different merchant, even from another device`() {
        val foreign = frakContextV2(OTHER_MERCHANT_ID, TIMESTAMP, clientId = OTHER_CLIENT_ID)
        assertTrue(ReferralArrival.shouldIgnoreArrival(foreign, CLIENT_ID, ownMerchantId = MERCHANT_ID))
    }

    @Test
    fun `lets a v2 link through when this SDK instance has not resolved its own merchant yet`() {
        val other = frakContextV2(OTHER_MERCHANT_ID, TIMESTAMP, clientId = OTHER_CLIENT_ID)
        assertFalse(ReferralArrival.shouldIgnoreArrival(other, CLIENT_ID, ownMerchantId = null))
    }

    @Test
    fun `carries every field a v2 context knows into the arrival`() {
        // `Interaction` is opaque by design (see its KDoc), so this reaches through the `internal`
        // `Kind` — friend access, same module. There is no public way to read an interaction back and
        // there is not meant to be; what a merchant does with one is hand it to `track`.
        val arrival =
            ReferralArrival.arrivalFrom(
                frakContextV2(MERCHANT_ID, TIMESTAMP, clientId = OTHER_CLIENT_ID, wallet = WALLET),
            ).kind as Interaction.Kind.Arrival

        assertEquals(OTHER_CLIENT_ID, arrival.referrerClientId)
        assertEquals(MERCHANT_ID, arrival.referrerMerchantId)
        assertEquals(WALLET, arrival.referrerWallet)
        assertEquals(TIMESTAMP, arrival.referralTimestamp)
    }

    @Test
    fun `carries only the wallet from a v1 context`() {
        val arrival = ReferralArrival.arrivalFrom(frakContextV1(WALLET)).kind as Interaction.Kind.Arrival

        assertEquals(WALLET, arrival.referrerWallet)
        assertNull(arrival.referrerClientId)
        assertNull(arrival.referrerMerchantId)
        assertNull(arrival.referralTimestamp)
    }
}

private const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
private const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
private const val OTHER_CLIENT_ID = "550e8400-e29b-41d4-a716-446655440001"
private const val OTHER_MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440002"
private const val WALLET = "0x1234567890123456789012345678901234567890"
private const val TIMESTAMP = 1_709_654_400L
