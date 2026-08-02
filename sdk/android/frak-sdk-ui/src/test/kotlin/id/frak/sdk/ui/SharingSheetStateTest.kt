package id.frak.sdk.ui

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import id.frak.sdk.Frak
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.sharing.SharingRequest
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.IOException

/**
 * The sheet's sequencing rules. Robolectric because [SharingSheetState] reaches
 * `Intent.createChooser`/`startActivity`, which throw on the plain `android.jar` stub.
 * `TestScope` so the 1.5s budget is exercised via virtual time, not sleeping.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
@OptIn(ExperimentalCoroutinesApi::class)
class SharingSheetStateTest {
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    @Before
    fun initializeFrak() {
        // `prepare` guards on Frak.isInitialized; only that boolean is used, the real client isn't.
        Frak.initialize(context, FrakConfig(merchantId = "b7c2e1a4-1111-4111-8111-111111111111"))
    }

    private fun TestScope.newState(
        client: FakeFrakClient,
        onFinished: (SharingResult) -> Unit = {},
    ) = SharingSheetState(
        scope = this,
        context = context,
        sessionId = "test-session",
        onFinished = onFinished,
        onCopyConfirmed = {},
        client = { client },
    )

    @Test
    fun `a resolved config produces a session with a page to show`() =
        runTest {
            val client = FakeFrakClient()
            val state = newState(client)

            state.prepare(SharingRequest())
            advanceUntilIdle()

            val session = state.session
            assertNotNull("expected a session", session)
            assertTrue("a resolved config must yield a page", session!!.hasPage)
            assertNull(state.failure)
        }

    /** Regression: a failed config resolve must not discard the local link. */
    @Test
    fun `a failed config resolve still shares, from the local link`() =
        runTest {
            val client = FakeFrakClient()
            client.resolveFailure = FrakError.Network(IOException("offline"))
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            assertNull("a resolve failure is not a sheet failure", state.failure)
            assertNull("a page-less session must not reach the composable", state.session)
            assertTrue("expected the native share to have fired", result is SharingResult.Shared)
            assertEquals("the share must be attributed exactly once", 1, client.trackCount)
        }

    /** The one case tier 3 genuinely cannot rescue: there was never a link. */
    @Test
    fun `no link means Failed, not a silent tier 3`() =
        runTest {
            val client = FakeFrakClient()
            client.link = null
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            assertNull(state.session)
            assertTrue(state.failure is FrakError.MerchantResolutionFailed)
            assertEquals(0, client.trackCount)
            assertNull("the sheet reports this through `failure`, not `onFinished`", result)
        }

    /** Regression: budget must still fire when build was fast and the page itself hangs. */
    @Test
    fun `a fast build followed by a page that never loads still hits the deadline`() =
        runTest {
            val client = FakeFrakClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()
            assertTrue("precondition: build succeeded with a page", state.session?.hasPage == true)

            val gate = launchDeadline(state) // page is now "loading" and never calls onPageReady
            advanceUntilIdle()

            assertTrue("the budget must bound the page load too", result is SharingResult.Shared)
            assertEquals(1, client.trackCount)
            gate.join()
        }

    /** The other half: a build slow enough to blow the budget before a session exists. */
    @Test
    fun `a build slower than the budget falls back once it finally returns`() =
        runTest {
            val client = FakeFrakClient()
            val resolveGate = CompletableDeferred<Unit>()
            client.resolveGate = resolveGate
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            val gate = launchDeadline(state)
            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS + 1)

            // Deadline passed with no session yet.
            assertNull(state.session)
            assertNull(result)

            resolveGate.complete(Unit) // must not publish a session the deadline already gave up on
            advanceUntilIdle()

            assertTrue("a late build must land on tier 3", result is SharingResult.Shared)
            assertEquals(1, client.trackCount)
            gate.join()
        }

    /** A page that arrives inside the budget must not be pre-empted by it. */
    @Test
    fun `a page that loads in time is left alone`() =
        runTest {
            val client = FakeFrakClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            val gate = launchDeadline(state)
            // runCurrent, not advanceUntilIdle: the latter would also fire the deadline under test.
            runCurrent()
            state.onPageReady()

            advanceTimeBy(SHEET_LOAD_DEADLINE_MILLIS * 2)
            advanceUntilIdle()

            assertNull("the budget was met; nothing should have fired", result)
            assertEquals("a page that loaded is not a share", 0, client.trackCount)
            gate.join()
        }

    /** Offline, the deadline and the page's own main-frame error both fire; must fall back once. */
    @Test
    fun `the deadline and a page error together still fall back only once`() =
        runTest {
            val client = FakeFrakClient()
            var finishedCount = 0
            val state = newState(client) { finishedCount++ }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.onLoadDeadline()
            state.onPageUnavailable()
            advanceUntilIdle()

            assertEquals("exactly one attribution per share", 1, client.trackCount)
            assertEquals("exactly one outcome reported", 1, finishedCount)
        }

    /** `onFinished` is the merchant's callback: it fires once, with the best outcome. */
    @Test
    fun `only the most significant outcome is reported, once`() =
        runTest {
            val client = FakeFrakClient()
            val results = mutableListOf<SharingResult>()
            val state = newState(client) { results += it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.share()
            advanceUntilIdle()
            state.dismiss()
            state.dismiss()
            advanceUntilIdle()

            assertEquals(1, results.size)
            assertTrue("a completed share outranks the dismissal that follows it", results[0] is SharingResult.Shared)
        }

    /** The install action is the SDK's own step; the merchant hears about it once it ran. */
    @Test
    fun `the install action opens the wallet before reporting`() =
        runTest {
            val client = FakeFrakClient()
            var result: SharingResult? = null
            val state = newState(client) { result = it }

            state.prepare(SharingRequest())
            advanceUntilIdle()

            state.onPageAction(SharingPageAction.Install)
            advanceUntilIdle()

            assertEquals(1, client.openFrakAppCount)
            assertEquals(SharingResult.InstallStarted, result)
        }

    private fun TestScope.launchDeadline(state: SharingSheetState) =
        launch { state.awaitLoadDeadline(SHEET_LOAD_DEADLINE_MILLIS) }

    private companion object {
        /** Mirrors `FrakSharingSheet`'s own constant. */
        const val SHEET_LOAD_DEADLINE_MILLIS = 1_500L
    }
}
