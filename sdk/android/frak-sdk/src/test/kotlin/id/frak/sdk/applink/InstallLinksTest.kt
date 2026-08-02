package id.frak.sdk.applink

import id.frak.sdk.sharing.FrakContext
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
        val own = FrakContext.V2(MERCHANT_ID, TIMESTAMP, clientId = CLIENT_ID)
        assertTrue(ReferralArrival.isSelfReferral(own, CLIENT_ID))
    }

    @Test
    fun `treats someone else's link as a referral`() {
        val other = FrakContext.V2(MERCHANT_ID, TIMESTAMP, clientId = OTHER_CLIENT_ID)
        assertFalse(ReferralArrival.isSelfReferral(other, CLIENT_ID))
    }

    @Test
    fun `cannot self-refer with no identity, or from a v1 link`() {
        val context = FrakContext.V2(MERCHANT_ID, TIMESTAMP, clientId = CLIENT_ID)
        assertFalse(ReferralArrival.isSelfReferral(context, null))
        // A native app has no wallet, so the wallet comparison the web makes
        // has nothing to compare against.
        assertFalse(ReferralArrival.isSelfReferral(FrakContext.V1(WALLET), CLIENT_ID))
    }

    @Test
    fun `carries every field a v2 context knows into the arrival`() {
        val arrival =
            ReferralArrival.arrivalFrom(
                FrakContext.V2(MERCHANT_ID, TIMESTAMP, clientId = OTHER_CLIENT_ID, wallet = WALLET),
            )
        assertEquals(OTHER_CLIENT_ID, arrival.referrerClientId)
        assertEquals(MERCHANT_ID, arrival.referrerMerchantId)
        assertEquals(WALLET, arrival.referrerWallet)
        assertEquals(TIMESTAMP, arrival.referralTimestamp)
    }

    @Test
    fun `carries only the wallet from a v1 context`() {
        val arrival: Interaction.Arrival = ReferralArrival.arrivalFrom(FrakContext.V1(WALLET))
        assertEquals(WALLET, arrival.referrerWallet)
        assertNull(arrival.referrerMerchantId)
        assertNull(arrival.referralTimestamp)
    }
}

private const val MERCHANT_ID = "550e8400-e29b-41d4-a716-446655440000"
private const val CLIENT_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
private const val OTHER_CLIENT_ID = "550e8400-e29b-41d4-a716-446655440001"
private const val WALLET = "0x1234567890123456789012345678901234567890"
private const val TIMESTAMP = 1_709_654_400L
