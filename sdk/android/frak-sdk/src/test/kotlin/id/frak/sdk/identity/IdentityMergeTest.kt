package id.frak.sdk.identity

import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

/**
 * Delivery (proof minting, the POST, response classification) is exercised end-to-end in
 * `id.frak.sdk.tracking.MergeSenderTest`; this file covers what stays purely in this class: the
 * once-per-process claim, the token parse, and the stateless wire-contract helpers.
 */
class IdentityMergeTest {
    @Test
    fun `claims a given token only once`() =
        runTest {
            val merge = IdentityMerge()

            assertTrue(merge.claim(TOKEN))
            assertFalse("a replayed intent is not a second merge", merge.claim(TOKEN))
            assertFalse("an empty token is never claimable", merge.claim(""))
        }

    @Test
    fun `reads the token out of an inbound url and ignores links without one`() {
        assertEquals(TOKEN, IdentityMerge.parseToken("https://shop.example/p?fmt=$TOKEN"))
        assertEquals(TOKEN, IdentityMerge.parseToken("https://shop.example/p?fCtx=abc&fmt=$TOKEN&utm_source=frak"))
        assertNull(IdentityMerge.parseToken("https://shop.example/p?fCtx=abc"))
        assertNull(IdentityMerge.parseToken("https://shop.example/p?fmt="))
        assertNull(IdentityMerge.parseToken("not-a-url"))
    }

    @Test
    fun `binds the proof to the sha256 of the merge token, matching the backend's hash`() {
        val expected = MessageDigest.getInstance("SHA-256").digest(TOKEN.toByteArray(Charsets.UTF_8))
        assertTrue(expected.contentEquals(IdentityMerge.binding(TOKEN)))
    }

    @Test
    fun `builds the wire body with every field the execute route expects`() {
        val body = IdentityMerge.body(TOKEN, ANONYMOUS_ID, MERCHANT_ID, "proof-bytes")

        assertEquals(TOKEN, body.getString("mergeToken"))
        assertEquals(ANONYMOUS_ID, body.getString("targetAnonymousId"))
        assertEquals(MERCHANT_ID, body.getString("merchantId"))
        assertEquals("proof-bytes", body.getString("proof"))
    }

    private companion object {
        const val MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
        const val ANONYMOUS_ID = "256b1be3-2745-41d1-89d4-9121cc87bc45"
        const val TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VHcm91cElkIjoiYWJjIn0.c2lnbmF0dXJl"
    }
}
