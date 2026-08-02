package id.frak.sdk.core

import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.identity.AnonymousIdStore
import id.frak.sdk.identity.FakeDeviceKeyStore
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Pins [DefaultFrakClient.configUpdates] conflation: a `StateFlow` conflates via
 * `equals`, so [id.frak.sdk.config.FrakResolvedConfig] must have one, or every
 * `resolveConfig()` call — including a cache hit — emits a fresh value.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DefaultFrakClientTest {
    private val transport = FakeHttpTransport()
    private val store = InMemoryKeyValueStore()

    @Test
    fun `a repeat resolve with an unchanged in-memory cache does not re-emit`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)

            val emissions = mutableListOf<String?>()
            val collector = launch { client.configUpdates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            client.resolveConfig()
            advanceUntilIdle()
            client.resolveConfig() // FRESH_TTL not elapsed: served from the same in-memory Entry
            advanceUntilIdle()

            collector.cancel()
            assertEquals("a same-reference cache hit must not re-emit", listOf(null, "Acme"), emissions)
        }

    @Test
    fun `two independently-fetched but byte-identical configs conflate to one emission`() =
        runTest {
            // ConfigStore hands back the very same object reference for an
            // in-memory hit, so that path conflates even under identity equality.
            // A background-revalidated or forced refetch does not: it decodes a
            // brand new object every time, so this is the path that actually
            // depends on FrakResolvedConfig.equals. forceRefresh with an
            // unchanged body is the simplest way to force two distinct decodes.
            val client = newClient(testScheduler)
            transport.respond(200, BODY)

            val emissions = mutableListOf<String?>()
            val collector = launch { client.configUpdates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            client.resolveConfig(forceRefresh = true)
            advanceUntilIdle()
            client.resolveConfig(forceRefresh = true) // same body, a fresh decode, a new object
            advanceUntilIdle()

            collector.cancel()
            assertEquals(
                "two structurally-equal but distinct objects must conflate to one emission",
                listOf(null, "Acme"),
                emissions,
            )
        }

    @Test
    fun `a genuinely changed config still emits`() =
        runTest {
            val client = newClient(testScheduler)
            transport.respond(200, BODY)

            val emissions = mutableListOf<String?>()
            val collector = launch { client.configUpdates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            client.resolveConfig()
            advanceUntilIdle()
            transport.respond(200, BODY.replace("Acme", "Acme Renamed"))
            client.resolveConfig(forceRefresh = true)
            advanceUntilIdle()

            collector.cancel()
            assertEquals(listOf(null, "Acme", "Acme Renamed"), emissions)
        }

    // ioDispatcher (governs DefaultFrakClient's own background scope, including
    // SingleFlight and ConfigStore's disk I/O) is Standard, not Unconfined:
    // this file's assertions rely on background
    // work (revalidation, SingleFlight's shared coroutine) landing only at an
    // explicit advanceUntilIdle(), not eagerly mid-call the way Unconfined
    // would run it. SingleFlight itself no longer has a dispatcher constraint —
    // it registers with ConcurrentHashMap.putIfAbsent rather than mutating the
    // map from inside computeIfAbsent, so it no longer risks the "Recursive
    // update" crash a completed Job's invokeOnCompletion used to cause on a
    // real multi-threaded dispatcher. The HttpClient's own dispatcher stays
    // Unconfined, matching ConfigStoreTest.
    private fun newClient(testScheduler: kotlinx.coroutines.test.TestCoroutineScheduler): DefaultFrakClient =
        DefaultFrakClient(
            config = FrakConfig(merchantId = MERCHANT_ID),
            store = store,
            identity =
                AnonymousIdStore(
                    keyStore = FakeDeviceKeyStore(),
                    store = InMemoryKeyValueStore(),
                    logger = FrakLogger(FrakLogLevel.NONE),
                    merchantMarker = MERCHANT_ID,
                    trackingEnabled = true,
                ),
            logger = FrakLogger(FrakLogLevel.NONE),
            ioDispatcher = kotlinx.coroutines.test.StandardTestDispatcher(testScheduler),
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), transport::open),
        )

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        const val BODY = """{"merchantId":"$MERCHANT_ID","name":"Acme","domain":"acme.example"}"""
    }
}
