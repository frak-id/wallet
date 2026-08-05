package id.frak.sdk.config

import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLanguage
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.frakConfig
import id.frak.sdk.core.frakMetadata
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/**
 * Fakes only the `open: (URL) -> HttpURLConnection` seam on [HttpClient]; status dispatch,
 * header handling and stream selection run for real. Logger is [FrakLogLevel.NONE] because
 * `android.util.Log` throws on this classpath, matching the production default.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ConfigStoreTest {
    private val query = MerchantQuery.from(frakConfig(merchantId = MERCHANT_ID))
    private var clock = 0L
    private val store = InMemoryKeyValueStore()
    private val transport = FakeHttpTransport()

    private fun newStore(scope: TestScope) =
        ConfigStore(
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(scope.testScheduler), transport::open),
            store = store,
            logger = FrakLogger(FrakLogLevel.NONE),
            scope = scope,
            // Unconfined: readPersisted/writePersisted's withContext resolves without an
            // explicit advanceUntilIdle.
            ioDispatcher = UnconfinedTestDispatcher(scope.testScheduler),
            now = { clock },
        )

    @Test
    fun `a fresh cache is served without a network call`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)

            configStore.resolve(query, forceRefresh = false)
            clock += ConfigStore.FRESH_TTL_MILLIS - 1
            configStore.resolve(query, forceRefresh = false)

            assertEquals("the second read should not have dialled", 1, transport.requests.size)
        }

    @Test
    fun `a cache fetched in the future relative to now is treated as stale, not fresh forever`() =
        runTest {
            val configStore = newStore(this)
            clock = 10_000L
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            clock = 0L // stepped backward: fetchedAtMillis is now in the future
            transport.respond(200, BODY.replace("Acme", "Acme Renamed"))
            configStore.resolve(query, forceRefresh = false)
            testScheduler.advanceUntilIdle()

            assertEquals("a future-dated entry must revalidate, not read as fresh", 2, transport.requests.size)
        }

    @Test
    fun `a stale cache is served immediately and revalidated in the background`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            clock += ConfigStore.FRESH_TTL_MILLIS + 1
            transport.respond(200, BODY.replace("Acme", "Acme Renamed"))
            val served = configStore.resolve(query, forceRefresh = false)

            assertEquals("Acme", served.name)
            testScheduler.advanceUntilIdle()
            assertEquals("but a refresh was issued behind it", 2, transport.requests.size)
            assertEquals("Acme Renamed", configStore.resolve(query, forceRefresh = false).name)
        }

    /**
     * [ConfigStore.updates] must receive background-revalidation updates too, not just what
     * direct [ConfigStore.resolve] callers see — a subscriber that never calls resolve() again
     * still needs the revalidated value.
     */
    @Test
    fun `background revalidation reaches the updates stream, not just memory (C3)`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)

            val emissions = mutableListOf<String?>()
            val collector = launch { configStore.updates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            configStore.resolve(query, forceRefresh = false)
            advanceUntilIdle()

            clock += ConfigStore.FRESH_TTL_MILLIS + 1
            transport.respond(200, BODY.replace("Acme", "Acme Renamed"))
            configStore.resolve(query, forceRefresh = false) // stale: served from cache, revalidates behind it
            advanceUntilIdle()

            collector.cancel()
            assertEquals(
                "a subscriber must see the revalidated value even though it never called resolve() again",
                listOf(null, "Acme", "Acme Renamed"),
                emissions,
            )
        }

    /**
     * [ConfigStore.memory]/[ConfigStore.updates]/the persisted disk entry are one slot shared
     * across every key. [SingleFlight] only serialises fetches sharing a key, so two different
     * keys can race to publish into that slot; a fetch that started first must not win just
     * because its response arrives last.
     *
     * [ConfigStore] runs on its own real [CoroutineScope] backed by [Dispatchers.IO] here, not
     * this test's `TestScope`: blocking inside `open()` on the TestScope's single virtual thread
     * would starve the scheduler the test needs to ever deliver `secondPublished`.
     */
    @Test
    fun `an older fetch that starts first but lands last does not overwrite a newer publish (C4)`() =
        runTest {
            val firstQuery = MerchantQuery.from(frakConfig(merchantId = MERCHANT_ID))
            val secondQuery = MerchantQuery.from(frakConfig(packageId = "com.example.second"))

            val firstStarted = CompletableDeferred<Unit>()
            val secondPublished = CompletableDeferred<Unit>()

            // Two transports, not one shared FakeHttpTransport: its body is a single mutable
            // field read lazily during perform(), so a shared instance risks the second
            // respond() rewriting the body the first, still-blocked, connection reads.
            val firstTransport = FakeHttpTransport()
            val secondTransport = FakeHttpTransport()
            firstTransport.respond(200, BODY)
            secondTransport.respond(200, BODY.replace("Acme", "Acme Second"))

            val backgroundScope = CoroutineScope(Dispatchers.IO)
            val configStore =
                ConfigStore(
                    http =
                        HttpClient(
                            FAKE_BASE_URL,
                            Dispatchers.IO,
                            open = { url ->
                                val isFirstQuery = url.query?.contains("merchantId=$MERCHANT_ID") == true
                                if (isFirstQuery) {
                                    firstStarted.complete(Unit)
                                    // Blocks a real backgroundScope thread until the second fetch
                                    // publishes, so this response lands last despite starting first.
                                    kotlinx.coroutines.runBlocking { secondPublished.await() }
                                    firstTransport.open(url)
                                } else {
                                    secondTransport.open(url)
                                }
                            },
                        ),
                    store = store,
                    logger = FrakLogger(FrakLogLevel.NONE),
                    scope = backgroundScope,
                    ioDispatcher = Dispatchers.IO,
                    now = { clock },
                )

            try {
                // SingleFlight.run dispatches via backgroundScope.launch, never the caller's own
                // coroutine, so calling resolve() from runTest's TestScope here is safe.
                val firstFetch = backgroundScope.async { configStore.resolve(firstQuery, forceRefresh = true) }
                firstStarted.await()

                val secondResult = configStore.resolve(secondQuery, forceRefresh = true)
                secondPublished.complete(Unit)
                val firstResult = firstFetch.await()

                assertEquals("Acme", firstResult.name)
                assertEquals("Acme Second", secondResult.name)

                assertEquals(
                    "the older fetch landing last must not overwrite the newer publish",
                    "Acme Second",
                    configStore.updates.value?.name,
                )
                assertEquals(
                    "the memory cache must not disagree with the stream it feeds",
                    "Acme Second",
                    configStore.currentConfig(secondQuery)?.name,
                )
            } finally {
                backgroundScope.cancel()
            }
        }

    @Test
    fun `an expired cache is still served rather than blanked`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            // A week later, offline.
            clock += 7 * 24 * 60 * 60 * 1_000L
            transport.fail(IOException("offline"))

            assertEquals("Acme", configStore.resolve(query, forceRefresh = false).name)
        }

    @Test
    fun `forceRefresh bypasses a fresh cache`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            transport.respond(200, BODY.replace("Acme", "Acme Renamed"))
            val refreshed = configStore.resolve(query, forceRefresh = true)

            assertEquals("Acme Renamed", refreshed.name)
            assertEquals(2, transport.requests.size)
        }

    @Test
    fun `concurrent callers share one request`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)

            val results = List(5) { async { configStore.resolve(query, forceRefresh = false) } }.awaitAll()

            assertEquals("one request for five callers", 1, transport.requests.size)
            assertTrue(results.all { it.merchantId == MERCHANT_ID })
        }

    @Test
    fun `a 404 is a merchant resolution failure, not a decoding error`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(404, "Merchant not found")

            val failure = runCatching { configStore.resolve(query, forceRefresh = false) }.exceptionOrNull()

            assertTrue("expected MerchantResolutionFailed, got $failure", failure is FrakError.MerchantResolutionFailed)
        }

    @Test
    fun `a 429 surfaces its Retry-After`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(429, "Too Many Requests", retryAfter = "42")

            val failure = runCatching { configStore.resolve(query, forceRefresh = false) }.exceptionOrNull()

            assertTrue("expected Server, got $failure", failure is FrakError.Server)
            assertEquals(42L, (failure as FrakError.Server).retryAfterSeconds)
        }

    @Test
    fun `an implausible Retry-After is clamped`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(429, "Too Many Requests", retryAfter = "999999")

            val failure = runCatching { configStore.resolve(query, forceRefresh = false) }.exceptionOrNull()

            assertEquals(HttpClient.MAX_RETRY_AFTER_SECONDS, (failure as FrakError.Server).retryAfterSeconds)
        }

    @Test
    fun `a 400 surfaces the backend error code`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(
                400,
                """{"success":false,"error":"platform is required","code":"INVALID_PACKAGE_ID_PAIRING"}""",
            )

            val failure = runCatching { configStore.resolve(query, forceRefresh = false) }.exceptionOrNull()

            assertEquals("INVALID_PACKAGE_ID_PAIRING", (failure as FrakError.Server).code)
        }

    @Test
    fun `a transport failure becomes a network error`() =
        runTest {
            val configStore = newStore(this)
            transport.fail(IOException("no route to host"))

            val failure = runCatching { configStore.resolve(query, forceRefresh = false) }.exceptionOrNull()

            assertTrue("expected Network, got $failure", failure is FrakError.Network)
        }

    @Test
    fun `backing off with nothing cached fails instead of dialling again`() =
        runTest {
            val configStore = newStore(this)
            transport.fail(IOException("no route to host"))
            runCatching { configStore.resolve(query, forceRefresh = false) }
            val afterFirst = transport.requests.size

            repeat(3) {
                val failure = runCatching { configStore.resolve(query, forceRefresh = false) }.exceptionOrNull()
                assertTrue("expected Network, got $failure", failure is FrakError.Network)
            }

            assertEquals(afterFirst, transport.requests.size)
        }

    @Test
    fun `the config survives a cold start through persistence`() =
        runTest {
            transport.respond(200, BODY)
            newStore(this).resolve(query, forceRefresh = false)

            // A new store shares only the KeyValueStore, like a fresh process.
            transport.fail(IOException("offline"))
            val coldStart = newStore(this).resolve(query, forceRefresh = false)

            assertEquals("Acme", coldStart.name)
        }

    /**
     * [DefaultFrakClient.handleReferralLink]'s merchant guard reads `ownMerchantId` from
     * [ConfigStore.currentConfig], not [ConfigStore.updates], so a warm start reached before
     * anything has called [resolve] in this process — the deep-link launch case — still has a
     * merchant id. [currentConfig] hydrates from disk on demand for that reason.
     */
    @Test
    fun `currentConfig hydrates from disk on its own, without a prior resolve call`() =
        runTest {
            transport.respond(200, BODY)
            newStore(this).resolve(query, forceRefresh = false)

            // A second store sharing only the persisted KeyValueStore, like a fresh process;
            // warmStart.resolve() is never called.
            val warmStart = newStore(this)

            val emissions = mutableListOf<String?>()
            val collector = launch { warmStart.updates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            // Proven non-network: the transport fails on any request.
            transport.fail(IOException("currentConfig must not reach the network"))
            assertEquals("Acme", warmStart.currentConfig(query)?.name)

            collector.cancel()
            assertEquals(
                "currentConfig's disk hydration must not publish to the stream — only fetch() does (C3)",
                listOf<String?>(null),
                emissions,
            )
        }

    @Test
    fun `currentConfig returns null for a key nothing was ever persisted under`() =
        runTest {
            transport.respond(200, BODY)
            newStore(this).resolve(query, forceRefresh = false)

            val warmStart = newStore(this)
            val otherQuery = MerchantQuery.from(frakConfig(packageId = "com.example.other"))
            transport.fail(IOException("currentConfig must not reach the network"))

            assertNull(warmStart.currentConfig(otherQuery))
        }

    @Test
    fun `a persisted entry for a different query is ignored`() =
        runTest {
            transport.respond(200, BODY)
            newStore(this).resolve(query, forceRefresh = false)

            val otherQuery = MerchantQuery.from(frakConfig(packageId = "com.example.other"))
            transport.fail(IOException("offline"))
            val failure =
                runCatching {
                    newStore(this).resolve(otherQuery, forceRefresh = false)
                }.exceptionOrNull()

            assertTrue("expected a network failure, got $failure", failure is FrakError.Network)
        }

    @Test
    fun `the in-memory cache does not answer a different query`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            val frenchQuery =
                MerchantQuery.from(
                    frakConfig(
                        merchantId = MERCHANT_ID,
                        metadata = frakMetadata(lang = FrakLanguage.FR),
                    ),
                )
            transport.respond(200, BODY.replace("Acme", "Acme FR"))

            assertEquals("Acme FR", configStore.resolve(frenchQuery, forceRefresh = false).name)
            assertEquals("two queries mean two requests", 2, transport.requests.size)
        }

    @Test
    fun `an unreadable persisted entry is discarded rather than fatal`() =
        runTest {
            store.putString("resolved-config", "{ this is not json")
            transport.respond(200, BODY)

            assertEquals("Acme", newStore(this).resolve(query, forceRefresh = false).name)
        }

    @Test
    fun `the sdk version header is sent on every request`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            assertNotNull(transport.requests.first().headers[id.frak.sdk.FrakSdkVersion.HEADER_NAME])
        }

    @Test
    fun `query parameters are percent-encoded, and nulls are dropped`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            val url =
                transport.requests
                    .first()
                    .url
                    .toString()
            assertTrue("merchantId is sent, was: $url", url.contains("merchantId=$MERCHANT_ID"))
            // `?lang=` is a 422 server-side; omitting it is fine.
            assertTrue("an unset lang is omitted entirely, was: $url", !url.contains("lang="))
        }

    @Test
    fun `concurrent cache misses for the same key read persisted disk exactly once`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)

            val results = List(5) { async { configStore.resolve(query, forceRefresh = false) } }.awaitAll()

            assertEquals("one persisted read for five concurrent misses", 1, store.getStringCalls)
            assertTrue(results.all { it.merchantId == MERCHANT_ID })
        }

    @Test
    fun `a repeated miss with nothing persisted for the key does not keep re-reading disk`() =
        runTest {
            transport.respond(200, BODY)
            newStore(this).resolve(query, forceRefresh = false)
            val callsAfterFirstResolve = store.getStringCalls

            val configStore = newStore(this)
            val otherQuery = MerchantQuery.from(frakConfig(packageId = "com.example.other"))
            transport.fail(IOException("offline"))

            repeat(3) {
                runCatching { configStore.resolve(otherQuery, forceRefresh = false) }
            }

            assertEquals(
                "only the first miss for the key may read disk",
                callsAfterFirstResolve + 1,
                store.getStringCalls,
            )
        }

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        val BODY =
            """
            {"merchantId":"$MERCHANT_ID","productId":"0x00","name":"Acme",
             "domain":"acme.example","allowedDomains":["acme.example"]}
            """.trimIndent()
    }
}
