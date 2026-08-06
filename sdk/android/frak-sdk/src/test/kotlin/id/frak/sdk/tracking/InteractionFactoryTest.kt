package id.frak.sdk.tracking

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The [Interaction] factories, and the one thing an opaque type makes easy to get wrong.
 *
 * `Interaction` has no public way to read a value back — that is the point (see its KDoc) — so a
 * factory that dropped an argument, or an overload that forwarded the wrong default, would be
 * invisible from the outside. `InteractionTrackerTest` catches some of it downstream, through the JSON
 * body, but only for the fields it happens to assert. This reaches through the `internal` `Kind` and
 * checks every argument of every overload lands where it should, which is the same guard
 * `BuilderWiringTest` provides for the Builders.
 */
class InteractionFactoryTest {
    @Test
    fun `arrival carries all four fields`() {
        val kind =
            Interaction
                .arrival(
                    referrerWallet = "0xwallet",
                    referrerClientId = "client",
                    referrerMerchantId = "merchant",
                    referralTimestamp = 1_709_654_400,
                ).kind as Interaction.Kind.Arrival

        assertEquals("0xwallet", kind.referrerWallet)
        assertEquals("client", kind.referrerClientId)
        assertEquals("merchant", kind.referrerMerchantId)
        assertEquals(1_709_654_400L, kind.referralTimestamp)
    }

    @Test
    fun `the no-argument sharing overload is the two-argument one with both absent`() {
        val bare = Interaction.sharing().kind as Interaction.Kind.Sharing

        assertNull(bare.sharingTimestamp)
        assertNull(bare.purchaseId)

        val explicit =
            Interaction.sharing(sharingTimestamp = 42, purchaseId = "order-1").kind
                as Interaction.Kind.Sharing

        assertEquals(42L, explicit.sharingTimestamp)
        assertEquals("order-1", explicit.purchaseId)

        // The purchase-only overload: the common merchant call, "they shared, after this order".
        assertEquals(
            Interaction.sharing(sharingTimestamp = null, purchaseId = "order-1"),
            Interaction.sharing("order-1"),
        )
        assertEquals(Interaction.sharing(), Interaction.sharing(purchaseId = null))
    }

    @Test
    fun `equality is structural over the whole payload`() {
        // The value is write-only, but the code that *builds* one is ordinary merchant code that
        // wants a test, and without this the only available assertion is reference identity. iOS's
        // twin is `Hashable` and pins the same thing.
        assertEquals(Interaction.sharing(), Interaction.sharing())
        assertEquals(Interaction.sharing().hashCode(), Interaction.sharing().hashCode())
        assertEquals(
            Interaction.custom("newsletter", mapOf("id" to "1")),
            Interaction.custom("newsletter", mapOf("id" to "1")),
        )

        assertNotEquals(Interaction.custom("newsletter", mapOf("id" to "1")), Interaction.custom("newsletter"))
        assertNotEquals(Interaction.custom("newsletter"), Interaction.sharing())
        assertNotEquals(
            Interaction.arrival("0xa", null, null, null),
            Interaction.arrival("0xb", null, null, null),
        )

        // And it prints its payload, because an interaction a merchant cannot log is one they cannot
        // debug. The exact text is not a contract; containing the shape and a field is.
        val printed = Interaction.custom("newsletter").toString()
        assertTrue(printed, printed.contains("Custom") && printed.contains("newsletter"))
    }

    @Test
    fun `each custom overload defaults exactly what it omits`() {
        val bare = Interaction.custom("checkout").kind as Interaction.Kind.Custom

        assertEquals("checkout", bare.customType)
        assertEquals(emptyMap<String, String>(), bare.data)
        assertNull(bare.idempotencyKey)

        val withData = Interaction.custom("checkout", mapOf("step" to "2")).kind as Interaction.Kind.Custom

        assertEquals(mapOf("step" to "2"), withData.data)
        assertNull(withData.idempotencyKey)

        val withKey =
            Interaction.custom("checkout", mapOf("step" to "2"), "merchant-key").kind
                as Interaction.Kind.Custom

        assertEquals(mapOf("step" to "2"), withKey.data)
        assertEquals("merchant-key", withKey.idempotencyKey)
    }

    @Test
    fun `custom copies the data map out of the caller's hands`() {
        // The event outlives the call: it goes onto a durable queue and is read back by a drain that
        // may run after the caller has returned. A caller mutating the map it passed in would
        // otherwise change an event already enqueued.
        val mutable = mutableMapOf("step" to "2")
        val kind = Interaction.custom("checkout", mutable).kind as Interaction.Kind.Custom

        mutable["step"] = "3"
        mutable["extra"] = "added"

        assertEquals(mapOf("step" to "2"), kind.data)
        assertNotSame(mutable, kind.data)
    }
}
