package id.frak.sdk.ui

import id.frak.sdk.core.FrakError
import org.junit.Assert.assertEquals
import org.junit.Test

class SharingResultTest {
    private val allResults =
        listOf(
            SharingResult.Shared("https://example.com"),
            SharingResult.Copied("https://example.com"),
            SharingResult.InstallStarted,
            SharingResult.WalletOpened,
            SharingResult.Dismissed,
            SharingResult.Failed(FrakError.InternalFailure("boom")),
        )

    @Test
    fun `every arm maps to its own kind, and every kind is reachable`() {
        val kinds = allResults.map { it.kind }

        assertEquals("two arms share a kind", kinds.size, kinds.toSet().size)
        assertEquals(SharingResult.Kind.entries.toSet(), kinds.toSet())
    }

    /** Spelled out, not derived: nothing but this test and its Swift twin keeps the two in step. */
    @Test
    fun `kind wire values are the strings iOS also emits`() {
        assertEquals("shared", SharingResult.Kind.SHARED.wireValue)
        assertEquals("copied", SharingResult.Kind.COPIED.wireValue)
        assertEquals("installStarted", SharingResult.Kind.INSTALL_STARTED.wireValue)
        assertEquals("walletOpened", SharingResult.Kind.WALLET_OPENED.wireValue)
        assertEquals("dismissed", SharingResult.Kind.DISMISSED.wireValue)
        assertEquals("failed", SharingResult.Kind.FAILED.wireValue)
    }

    /** The order the sheet resolves competing outcomes in; [significance] is what `record` compares. */
    @Test
    fun `outcomes rank walletOpened above install, above share, above dismissal, above failure`() {
        val ordered = allResults.sortedBy { it.significance }.map { it.kind }

        assertEquals(SharingResult.Kind.FAILED, ordered.first())
        assertEquals(SharingResult.Kind.WALLET_OPENED, ordered.last())
    }
}
