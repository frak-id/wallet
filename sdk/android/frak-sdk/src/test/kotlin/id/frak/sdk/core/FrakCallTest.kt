package id.frak.sdk.core

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/** Pins the error-normalisation contract every public entry point relies on. */
class FrakCallTest {
    @Test
    fun `a successful call returns its value untouched`() {
        assertEquals(42, frakCall { 42 })
    }

    @Test
    fun `a FrakError passes through unchanged`() {
        val original = FrakError.MerchantResolutionFailed("no merchant")

        val thrown = runCatching { frakCall { throw original } }.exceptionOrNull()

        // Identity, not just type: wrapping would bury the message the merchant needs.
        assertSame(original, thrown)
    }

    @Test
    fun `CancellationException propagates untouched`() {
        val original = CancellationException("caller went away")

        val thrown = runCatching { frakCall { throw original } }.exceptionOrNull()

        // The cancellation arm must come first in frakCall, or a catch-all above it would
        // swallow this and break structured concurrency.
        assertSame(original, thrown)
    }

    @Test
    fun `an unexpected throwable is wrapped rather than escaping`() {
        val thrown = runCatching { frakCall { throw IllegalStateException("bug") } }.exceptionOrNull()

        assertTrue("expected a FrakError, got $thrown", thrown is FrakError)
        assertTrue("the cause is preserved", thrown?.cause is IllegalStateException)
    }

    @Test
    fun `a raw IOException does not escape as itself`() =
        runTest {
            val thrown = runCatching { frakCall { throw IOException("raw") } }.exceptionOrNull()

            assertTrue("expected a FrakError, got $thrown", thrown is FrakError)
        }
}
