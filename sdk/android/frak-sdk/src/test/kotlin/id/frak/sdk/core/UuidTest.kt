package id.frak.sdk.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/**
 * [Uuid] is the single source of truth two independent frozen wire formats depend on
 * ([id.frak.sdk.identity.ProofCodec] and [id.frak.sdk.sharing.FrakContextCodec]) — see the class
 * doc for why it lives in `core` rather than either codec (5.6/8.6).
 */
class UuidTest {
    @Test
    fun `formats 16 raw bytes as a lowercase hyphenated UUID`() {
        val bytes =
            byteArrayOf(
                0x12,
                0x34.toByte(),
                0x56,
                0x78,
                0x9A.toByte(),
                0xBC.toByte(),
                0xDE.toByte(),
                0xF0.toByte(),
                0x11,
                0x22,
                0x33,
                0x44,
                0x55,
                0x66,
                0x77,
                0x88.toByte(),
            )
        assertEquals("12345678-9abc-def0-1122-334455667788", Uuid.fromBytes(bytes))
    }

    @Test
    fun `fromBytes honours a non-zero offset`() {
        val bytes = ByteArray(4) + ByteArray(16)
        assertEquals("00000000-0000-0000-0000-000000000000", Uuid.fromBytes(bytes, offset = 4))
    }

    @Test
    fun `toBytes parses without lowercasing first, and rejects a shape mismatch`() {
        val upper = Uuid.toBytes("12345678-9ABC-DEF0-1122-334455667788", "id")
        val lower = Uuid.toBytes("12345678-9abc-def0-1122-334455667788", "id")
        assertEquals(Uuid.fromBytes(upper), Uuid.fromBytes(lower))

        assertThrows(IllegalArgumentException::class.java) { Uuid.toBytes("not-a-uuid", "id") }
        assertThrows(IllegalArgumentException::class.java) {
            Uuid.toBytes("12345678-9abc-def0-1122-33445566778", "id") // one hex digit short
        }
    }

    @Test
    fun `REGEX is anchored and case-insensitive`() {
        assertTrue(Uuid.REGEX.matches("12345678-9abc-def0-1122-334455667788"))
        assertTrue(Uuid.REGEX.matches("12345678-9ABC-DEF0-1122-334455667788"))
        assertTrue(!Uuid.REGEX.matches(" 12345678-9abc-def0-1122-334455667788"))
        assertTrue(!Uuid.REGEX.matches("12345678-9abc-def0-1122-334455667788 "))
        assertTrue(!Uuid.REGEX.matches("12345678-9abc-def0-1122-33445566778g"))
    }

    @Test
    fun `round-trips random bytes through fromBytes and toBytes`() {
        val random = Random(20240301)
        repeat(64) {
            val bytes = random.nextBytes(16)
            assertEquals(bytes.toList(), Uuid.toBytes(Uuid.fromBytes(bytes), "id").toList())
        }
    }
}
