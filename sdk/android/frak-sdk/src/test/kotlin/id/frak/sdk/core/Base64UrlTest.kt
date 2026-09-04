package id.frak.sdk.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlin.random.Random

class Base64UrlTest {
    @Test
    fun `encodes the RFC 4648 vectors without padding`() {
        // The standard test vectors, minus the `=` the URL-safe unpadded
        // variant drops — which is the one thing a hand-rolled encoder is
        // likely to get wrong.
        assertEquals("", Base64Url.encode(byteArrayOf()))
        assertEquals("Zg", Base64Url.encode("f".toByteArray()))
        assertEquals("Zm8", Base64Url.encode("fo".toByteArray()))
        assertEquals("Zm9v", Base64Url.encode("foo".toByteArray()))
        assertEquals("Zm9vYg", Base64Url.encode("foob".toByteArray()))
        assertEquals("Zm9vYmE", Base64Url.encode("fooba".toByteArray()))
        assertEquals("Zm9vYmFy", Base64Url.encode("foobar".toByteArray()))
    }

    @Test
    fun `uses the URL-safe alphabet`() {
        // 0xFB 0xFF encodes to the two characters standard base64 spells `+/`.
        assertEquals("-_8", Base64Url.encode(byteArrayOf(0xFB.toByte(), 0xFF.toByte())))
        assertArrayEquals(byteArrayOf(0xFB.toByte(), 0xFF.toByte()), Base64Url.decodeOrNull("-_8"))
    }

    @Test
    fun `round-trips every length up to a full block boundary`() {
        val random = Random(20240301)
        for (size in 0..64) {
            val bytes = random.nextBytes(size)
            assertArrayEquals(bytes, Base64Url.decodeOrNull(Base64Url.encode(bytes)))
        }
    }

    @Test
    fun `rejects padding, foreign characters and impossible lengths`() {
        assertNull(Base64Url.decodeOrNull("Zm9vYg=="))
        assertNull(Base64Url.decodeOrNull("Zm9v+g"))
        assertNull(Base64Url.decodeOrNull("Zm9v/g"))
        assertNull(Base64Url.decodeOrNull("Zm9 v"))
        assertNull(Base64Url.decodeOrNull("Zm9vé"))
        // A remainder of one character cannot terminate any valid encoding.
        assertNull(Base64Url.decodeOrNull("Zm9vY"))
    }

    @Test
    fun `rejects a tail carrying bits no byte claims`() {
        // "Zh" would decode to the same single byte as "Zg", so accepting it
        // would make two distinct strings decode identically — and a link that
        // round-trips through a mangling channel would stop being detectable.
        assertArrayEquals(byteArrayOf(0x66), Base64Url.decodeOrNull("Zg"))
        assertNull(Base64Url.decodeOrNull("Zh"))
    }
}
