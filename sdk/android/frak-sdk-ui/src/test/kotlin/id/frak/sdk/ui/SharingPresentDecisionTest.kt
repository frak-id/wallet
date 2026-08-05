package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The guards [SharingHost.present] runs before it opens a window.
 *
 * These exist because the sheet no longer lives in the merchant's composition. Compose used to
 * make most of them unreachable — a composable cannot present from a destroyed Activity, and
 * disposal tore the sheet down on the SDK's behalf — and with a `ComponentDialog` every one of
 * them is now this SDK's to enforce. A `Dialog.show()` on a window token that has gone throws
 * `BadTokenException` in the merchant's process.
 *
 * Split out of [SharingHost] precisely so they are decidable without a window: showing a real
 * dialog and composing into it is not something a JVM unit test can pin.
 */
class SharingPresentDecisionTest {
    private fun decide(
        hostDestroyed: Boolean = false,
        hostUnavailable: Boolean = false,
        lifecycleStarted: Boolean = true,
        sessionActive: Boolean = false,
    ) = sharingPresentDecision(
        hostDestroyed = hostDestroyed,
        hostUnavailable = hostUnavailable,
        lifecycleStarted = lifecycleStarted,
        sessionActive = sessionActive,
    )

    @Test
    fun `a live host with no session presents`() {
        assertEquals(SharingPresentDecision.Present, decide())
    }

    @Test
    fun `a destroyed host is ignored rather than reported`() {
        assertEquals(SharingPresentDecision.Ignore, decide(hostDestroyed = true))
    }

    @Test
    fun `a finishing or destroyed activity is ignored`() {
        assertEquals(SharingPresentDecision.Ignore, decide(hostUnavailable = true))
    }

    /** Below STARTED there is no window token to hang a dialog off. */
    @Test
    fun `a host that is not started is ignored`() {
        assertEquals(SharingPresentDecision.Ignore, decide(lifecycleStarted = false))
    }

    @Test
    fun `a second present while one is up is refused, not queued`() {
        assertEquals(SharingPresentDecision.Refuse, decide(sessionActive = true))
    }

    /**
     * Ordering matters: a merchant whose screen is going away gets silence, not an
     * `AlreadyPresenting` failure for a sheet they can no longer see. Nothing is left to deliver
     * a callback to.
     */
    @Test
    fun `an unavailable host wins over an active session`() {
        assertEquals(
            SharingPresentDecision.Ignore,
            decide(hostUnavailable = true, sessionActive = true),
        )
    }
}
