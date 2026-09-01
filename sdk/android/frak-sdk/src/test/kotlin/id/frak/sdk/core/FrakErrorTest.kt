package id.frak.sdk.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class FrakErrorTest {
    private val allErrors =
        listOf(
            FrakError.NotInitialized(),
            FrakError.Network(IOException("offline")),
            FrakError.BackingOff(1.5),
            FrakError.Server(500),
            FrakError.Decoding("bad body"),
            FrakError.TrackingDisabled(),
            FrakError.MerchantResolutionFailed("no merchant"),
            FrakError.AlreadyPresenting(),
            FrakError.InternalFailure("boom"),
        )

    @Test
    fun `every arm maps to its own kind, and every kind is reachable`() {
        val kinds = allErrors.map { it.kind }

        assertEquals("two arms share a kind", kinds.size, kinds.toSet().size)
        assertEquals(FrakError.Kind.entries.toSet(), kinds.toSet())
    }

    /** Spelled out, not derived: nothing but this test and its Swift twin keeps the two in step. */
    @Test
    fun `kind wire values are the strings iOS also emits`() {
        assertEquals("notInitialized", FrakError.Kind.NOT_INITIALIZED.wireValue)
        assertEquals("network", FrakError.Kind.NETWORK.wireValue)
        assertEquals("backingOff", FrakError.Kind.BACKING_OFF.wireValue)
        assertEquals("server", FrakError.Kind.SERVER.wireValue)
        assertEquals("decoding", FrakError.Kind.DECODING.wireValue)
        assertEquals("trackingDisabled", FrakError.Kind.TRACKING_DISABLED.wireValue)
        assertEquals("alreadyPresenting", FrakError.Kind.ALREADY_PRESENTING.wireValue)
        assertEquals("merchantResolutionFailed", FrakError.Kind.MERCHANT_RESOLUTION_FAILED.wireValue)
        assertEquals("internalFailure", FrakError.Kind.INTERNAL_FAILURE.wireValue)
    }

    @Test
    fun `every arm carries a message`() {
        allErrors.forEach { assertTrue("${it.kind} has no message", !it.message.isNullOrEmpty()) }
    }
}
