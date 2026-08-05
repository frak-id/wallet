package id.frak.sdk.core

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import kotlin.random.Random

/**
 * Direct coverage for [Hex]: both current callers ([Uuid] and [id.frak.sdk.sharing.FrakContextCodec])
 * validate their input before decoding, so [Hex.decodeOrNull]'s odd-length and non-hex-character
 * branches are otherwise unreached by any test in the suite.
 */
class HexTest {
    @Test
    fun `encodes as lowercase`() {
        assertEquals("00", Hex.encode(byteArrayOf(0x00)))
        assertEquals("ff", Hex.encode(byteArrayOf(0xFF.toByte())))
        assertEquals("deadbeef", Hex.encode(byteArrayOf(0xDE.toByte(), 0xAD.toByte(), 0xBE.toByte(), 0xEF.toByte())))
    }

    @Test
    fun `encode honours offset and length`() {
        val bytes = byteArrayOf(0x00, 0xDE.toByte(), 0xAD.toByte(), 0x00)
        assertEquals("dead", Hex.encode(bytes, offset = 1, length = 2))
    }

    @Test
    fun `decodes both cases and round-trips through encode`() {
        assertArrayEquals(byteArrayOf(0xDE.toByte(), 0xAD.toByte()), Hex.decodeOrNull("dead"))
        assertArrayEquals(byteArrayOf(0xDE.toByte(), 0xAD.toByte()), Hex.decodeOrNull("DEAD"))
        assertArrayEquals(byteArrayOf(0xDE.toByte(), 0xAD.toByte()), Hex.decodeOrNull("DeAd"))

        val random = Random(20240301)
        for (size in 0..32) {
            val bytes = random.nextBytes(size)
            assertArrayEquals(bytes, Hex.decodeOrNull(Hex.encode(bytes)))
        }
    }

    @Test
    fun `rejects an odd length`() {
        assertNull(Hex.decodeOrNull("a"))
        assertNull(Hex.decodeOrNull("abc"))
    }

    @Test
    fun `rejects a non-hex character anywhere in the string`() {
        assertNull(Hex.decodeOrNull("gg"))
        assertNull(Hex.decodeOrNull("0g"))
        assertNull(Hex.decodeOrNull("g0"))
        assertNull(Hex.decodeOrNull("de ad"))
        assertNull(Hex.decodeOrNull("déad"))
    }

    @Test
    fun `empty string decodes to empty bytes`() {
        assertArrayEquals(byteArrayOf(), Hex.decodeOrNull(""))
    }

    @Test
    fun `writeInto writes at the given offset without touching the rest of the buffer`() {
        val out = ByteArray(4) { 0x11 }
        Hex.writeInto("dead", out, offset = 1)
        assertArrayEquals(byteArrayOf(0x11, 0xDE.toByte(), 0xAD.toByte(), 0x11), out)
    }
}
