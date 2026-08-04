package id.frak.sdk.ui

import androidx.compose.runtime.mutableStateOf
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [FrakSharingLauncher]'s own state machine, independent of composition. Touches only
 * `androidx.compose.runtime` (a plain-JVM snapshot-state API, not `android.*`), so this runs as
 * an ordinary JUnit test with no Robolectric runner, unlike [SharingSheetStateTest] next to it.
 *
 * [rememberFrakSharingLauncher] itself — `remember`, `rememberUpdatedState`, hosting
 * [WarmSharingWebView] and [id.frak.sdk.ui.FrakSharingSheet] — needs a real composition and has
 * no coverage here; that would need `androidx.compose.ui.test` with a `createComposeRule` host,
 * i.e. an instrumented/`androidTest` run, not a JVM unit test.
 */
class FrakSharingLauncherTest {
    private fun newLauncher(onResult: (SharingResult) -> Unit = {}) = FrakSharingLauncher(mutableStateOf(onResult))

    @Test
    fun `no request is active until launch is called`() {
        val launcher = newLauncher()
        assertNull(launcher.active)
    }

    @Test
    fun `launch makes the request active`() {
        val launcher = newLauncher()
        val request = SharingRequest(link = "https://acme.example/p")

        launcher.launch(request)

        assertEquals(request, launcher.active)
    }

    @Test
    fun `a second launch while one is active reports AlreadyPresenting instead of replacing it`() {
        val results = mutableListOf<SharingResult>()
        val launcher = newLauncher { results += it }
        val first = SharingRequest(link = "https://acme.example/first")
        val second = SharingRequest(link = "https://acme.example/second")

        launcher.launch(first)
        launcher.launch(second)

        assertEquals("the first request must not be replaced", first, launcher.active)
        assertEquals(1, results.size)
        assertTrue(results.single() is SharingResult.Failed)
        assertTrue((results.single() as SharingResult.Failed).error is FrakError.AlreadyPresenting)
    }

    @Test
    fun `finish clears the active request and reports the result`() {
        val results = mutableListOf<SharingResult>()
        val launcher = newLauncher { results += it }
        launcher.launch(SharingRequest())

        launcher.finish(SharingResult.Shared("https://acme.example/p"))

        assertNull(launcher.active)
        assertEquals(1, results.size)
        assertTrue(results.single() is SharingResult.Shared)
    }

    @Test
    fun `finish with nothing active reports nothing`() {
        val results = mutableListOf<SharingResult>()
        val launcher = newLauncher { results += it }

        launcher.finish(SharingResult.Dismissed)

        assertTrue("no session was active; finish must be a no-op", results.isEmpty())
    }

    @Test
    fun `launch is possible again once the previous session finished`() {
        val launcher = newLauncher()
        launcher.launch(SharingRequest(link = "https://acme.example/first"))
        launcher.finish(SharingResult.Dismissed)

        val second = SharingRequest(link = "https://acme.example/second")
        launcher.launch(second)

        assertEquals(second, launcher.active)
    }
}
