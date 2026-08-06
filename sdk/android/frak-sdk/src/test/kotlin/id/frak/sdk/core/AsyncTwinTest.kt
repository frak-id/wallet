package id.frak.sdk.core

import id.frak.sdk.applink.FakeAppLauncher
import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.identity.FakeDeviceKeyStore
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import id.frak.sdk.tracking.EventQueue
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import kotlin.coroutines.ContinuationInterceptor
import kotlin.coroutines.CoroutineContext
import kotlin.coroutines.coroutineContext

/**
 * The dispatcher the calling coroutine is running on. Must stay a real suspend function: reading
 * `coroutineContext` inline in a suspend lambda binds to the enclosing scope, not to where it runs.
 */
private suspend fun currentInterceptor(): ContinuationInterceptor? = coroutineContext[ContinuationInterceptor]

/** The threading and lifetime contract of `DefaultFrakClient.asFuture`, which every `*Async` twin uses. */
@OptIn(ExperimentalCoroutinesApi::class)
class AsyncTwinTest {
    @get:Rule
    val temporaryFolder: TemporaryFolder = TemporaryFolder()

    /** Records whether a block is currently running inside one of its own dispatches. */
    private class RecordingDispatcher : CoroutineDispatcher() {
        var dispatching: Boolean = false
            private set

        var dispatches: Int = 0
            private set

        override fun dispatch(
            context: CoroutineContext,
            block: Runnable,
        ) {
            dispatches++
            dispatching = true
            try {
                block.run()
            } finally {
                dispatching = false
            }
        }
    }

    @Test
    fun `the future completes on the main dispatcher and the body runs on the IO one`() =
        runTest {
            val main = RecordingDispatcher()
            val io = StandardTestDispatcher(testScheduler)
            val client = newClient(testScheduler, io, main)

            // The inner `withContext(ioDispatcher)` is what keeps the body off the main dispatcher.
            var bodyInterceptor: Any? = null
            val future = client.asFuture { bodyInterceptor = currentInterceptor() }

            var completedInsideMainDispatch = false
            future.whenComplete { _, _ -> completedInsideMainDispatch = main.dispatching }

            advanceUntilIdle()

            assertTrue("the future must complete", future.isDone)
            assertSame("body must run on the IO dispatcher", io, bodyInterceptor)
            assertTrue("completion must be signalled from the main dispatcher", completedInsideMainDispatch)
            assertTrue("the main dispatcher must actually have been used", main.dispatches > 0)
        }

    @Test
    fun `a twin called after shutdown returns an already-finished, failed future rather than hanging`() =
        runTest {
            val main = RecordingDispatcher()
            val client = newClient(testScheduler, StandardTestDispatcher(testScheduler), main)

            client.shutdown()

            // The weaker assertion: the contract owes a Java caller only a finished, unsuccessful future.
            val future = client.asFuture { "should never run" }
            advanceUntilIdle()

            assertTrue("must not hang after shutdown", future.isDone)
            assertTrue("must not report success", future.isCompletedExceptionally)
            // At most one: what must not happen is a stream of dispatches, i.e. work after shutdown.
            assertTrue("teardown must not keep dispatching", main.dispatches <= 1)
        }

    @Test
    fun `a FrakError from the body completes the future exceptionally`() =
        runTest {
            val main = RecordingDispatcher()
            val client = newClient(testScheduler, StandardTestDispatcher(testScheduler), main)

            val future = client.asFuture<Unit> { throw FrakError.MerchantResolutionFailed("no merchant") }
            advanceUntilIdle()

            assertTrue(future.isCompletedExceptionally)
            val failure = runCatching { future.join() }.exceptionOrNull()
            // `join()` wraps in `CompletionException`; the `FrakError` is the cause either way.
            assertTrue("cause must be the FrakError", failure?.cause is FrakError.MerchantResolutionFailed)
        }

    private fun newClient(
        testScheduler: TestCoroutineScheduler,
        ioDispatcher: CoroutineDispatcher,
        mainDispatcher: CoroutineDispatcher,
    ): DefaultFrakClient {
        val logger = FrakLogger(FrakLogLevel.NONE)
        val identityStore = InMemoryKeyValueStore()
        val consent = TrackingConsent(identityStore, true, logger, ioDispatcher)
        return DefaultFrakClient(
            settings = frakConfig(merchantId = MERCHANT_ID),
            store = InMemoryKeyValueStore(),
            queue =
                EventQueue(
                    File(temporaryFolder.root, "events.jsonl"),
                    logger,
                    UnconfinedTestDispatcher(testScheduler),
                ),
            identity =
                AnonymousIdStore(
                    keyStore = FakeDeviceKeyStore(),
                    store = identityStore,
                    logger = logger,
                    merchantMarker = MERCHANT_ID,
                    consent = consent,
                    ioDispatcher = ioDispatcher,
                ),
            consent = consent,
            launcher = FakeAppLauncher(),
            logger = logger,
            ioDispatcher = ioDispatcher,
            mainDispatcher = mainDispatcher,
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), FakeHttpTransport()::open),
        )
    }

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
    }
}
