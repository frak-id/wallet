package id.frak.sdk.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** The guards [SharingHost.present] runs before it opens a window. */
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

    @Test
    fun `an unavailable host wins over an active session`() {
        assertEquals(
            SharingPresentDecision.Ignore,
            decide(hostUnavailable = true, sessionActive = true),
        )
    }
}
