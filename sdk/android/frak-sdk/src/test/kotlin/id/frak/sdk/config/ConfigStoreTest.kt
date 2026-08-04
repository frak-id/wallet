package id.frak.sdk.config

import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
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
 * Pins the stale-while-revalidate policy.
 *
 * [HttpClient] takes an `open: (URL) -> HttpURLConnection` seam, so a fake
 * connection is substituted rather than a fake client. That keeps the real
 * status dispatch, the real header handling and the real stream selection
 * (`inputStream` vs `errorStream`) under test — the parts most likely to be
 * wrong. Only the socket is replaced.
 *
 * The logger is at [FrakLogLevel.NONE] because `android.util.Log` is a throwing
 * stub on this classpath. That is not a workaround: silence is the production
 * default too.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ConfigStoreTest {
    private val query = MerchantQuery.from(FrakConfig(merchantId = MERCHANT_ID))
    private var clock = 0L
    private val store = InMemoryKeyValueStore()
    private val transport = FakeHttpTransport()

    private fun newStore(scope: TestScope) =
        ConfigStore(
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(scope.testScheduler), transport::open),
            store = store,
            logger = FrakLogger(FrakLogLevel.NONE),
            scope = scope,
            // Unconfined: readPersisted/writePersisted's withContext resolves
            // without an explicit advanceUntilIdle, matching the synchronous
            // behaviour these tests relied on before disk I/O was moved off
            // the caller's dispatcher.
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
            // A clock stepped backward after the fetch, or a corrupted/tampered persisted
            // fetchedAtMillis, must not pin the entry as fresh forever (N7): now() - fetchedAtMillis
            // negative is still "less than FRESH_TTL_MILLIS" if only the upper bound is checked.
            val configStore = newStore(this)
            clock = 10_000L
            transport.respond(200, BODY)
            configStore.resolve(query, forceRefresh = false)

            clock = 0L // stepped backward: fetchedAtMillis (10_000) is now in the future
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

            // The caller gets the stale answer rather than waiting — that is the
            // whole point, and the JS `withCache` does the opposite.
            assertEquals("Acme", served.name)
            testScheduler.advanceUntilIdle()
            assertEquals("but a refresh was issued behind it", 2, transport.requests.size)
            assertEquals("Acme Renamed", configStore.resolve(query, forceRefresh = false).name)
        }

    /**
     * C3: [ConfigStore.updates] is this store's own stream, not something forwarded from a
     * caller-side `resolveConfig()` write — so it must reach a subscriber from BACKGROUND
     * revalidation too, the path that never touched it before this finding. Before the fix, only
     * a direct [ConfigStore.resolve] caller ever saw an update; a subscriber sitting on
     * [ConfigStore.updates] alone (the real-world shape: a UI observing config without itself
     * calling `resolve` on every stale hit) never learned the revalidated value existed.
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
     * C4: [ConfigStore.memory]/[ConfigStore.updates]/the persisted disk entry are a single slot
     * shared across every key, not one per key — [SingleFlight] only serialises fetches that
     * share a key, so two DIFFERENT keys' fetches can genuinely run concurrently and race to
     * publish into that one slot. This pins the sequence guard against exactly that: a fetch
     * that started FIRST (and so is intended to be superseded) must not win the race to publish
     * just because its response happened to arrive LAST.
     *
     * Ordering is real, not simulated, but nothing ever blocks a thread the scheduler needs.
     * [ConfigStore] is given its own real [CoroutineScope] backed by [Dispatchers.IO], not this
     * test's own `TestScope`. That distinction is the fix: `open()` runs on [ConfigStore]'s
     * `scope` — via [SingleFlight]'s `scope.launch` — never on [HttpClient]'s `ioDispatcher`, so a
     * previous version of this test that passed `runTest`'s `TestScope` here had a JVM
     * [kotlinx.coroutines.runBlocking] inside `open` block that scope's one virtual thread, which
     * starved the very scheduler the test needed to ever deliver `secondPublished`. With a real
     * background scope backing [ConfigStore], the blocking wait inside `open` is a genuine OS
     * thread park (a second real [Dispatchers.IO] thread), not a squatter on the scheduler thread,
     * and [runTest]'s virtual scheduler is never touched by either fetch.
     */
    @Test
    fun `an older fetch that starts first but lands last does not overwrite a newer publish (C4)`() =
        runTest {
            val firstQuery = MerchantQuery.from(FrakConfig(merchantId = MERCHANT_ID))
            val secondQuery = MerchantQuery.from(FrakConfig(packageId = "com.example.second"))

            val firstStarted = CompletableDeferred<Unit>()
            val secondPublished = CompletableDeferred<Unit>()

            // Two independent fake transports, one per query — not one shared FakeHttpTransport:
            // its response body is a single mutable field read lazily when perform() actually
            // drains the stream, which happens AFTER this test's open() lambda returns. Sharing
            // one instance would let the second query's later respond() call silently rewrite
            // the body the first (still-blocked) connection reads once released.
            val firstTransport = FakeHttpTransport()
            val secondTransport = FakeHttpTransport()
            firstTransport.respond(200, BODY)
            secondTransport.respond(200, BODY.replace("Acme", "Acme Second"))

            // A real background scope, deliberately NOT this test's TestScope — see the doc above.
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
                                    // Blocks a real backgroundScope thread — never the TestScope's
                                    // — until the second key's fetch has published, so this response
                                    // is guaranteed to LAND last despite STARTING first.
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
                // SingleFlight.run always dispatches the actual work via backgroundScope.launch
                // (never the caller's own coroutine), so calling resolve() from runTest's TestScope
                // here is safe — open() for BOTH queries still executes on backgroundScope, and this
                // coroutine only ever suspends waiting for it, never blocks.
                val firstFetch = backgroundScope.async { configStore.resolve(firstQuery, forceRefresh = true) }
                firstStarted.await()

                val secondResult = configStore.resolve(secondQuery, forceRefresh = true)
                secondPublished.complete(Unit)
                val firstResult = firstFetch.await()

                // Each caller still gets ITS OWN fetched config regardless of publish order.
                assertEquals("Acme", firstResult.name)
                assertEquals("Acme Second", secondResult.name)

                // The shared stream slot must reflect the fetch that's supposed to win — the one
                // the sequence guard considers newer — not be clobbered by the older one landing last.
                assertEquals(
                    "the older fetch landing last must not overwrite the newer publish",
                    "Acme Second",
                    configStore.updates.value?.name,
                )
                // The memory cache must agree with the stream: memory = entry lives INSIDE the same
                // sequence guard as the stream/disk publish. Before that fix, memory was written
                // unconditionally above the guard, so it kept the OLDER "Acme" result — re-stamped
                // with a fresh fetchedAtMillis, so isFresh would have served it as current for a
                // full FRESH_TTL_MILLIS window even though a newer config had already published.
                // updates.value alone cannot catch that: it only reads the stream, never memory.
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

            // Blanking here would trade a cosmetic staleness problem for a
            // functional outage on a plane.
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

            // A list rebinding thirty rows must not become thirty requests
            // against a 60-per-minute bucket.
            assertEquals("one request for five callers", 1, transport.requests.size)
            assertTrue(results.all { it.merchantId == MERCHANT_ID })
        }

    @Test
    fun `a 404 is a merchant resolution failure, not a decoding error`() =
        runTest {
            val configStore = newStore(this)
            // text/plain, not the JSON error envelope. A decoder assuming
            // "non-2xx implies JSON" turns the SDK's single most actionable
            // diagnostic into FrakError.Decoding.
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

            // An unclamped value from a misconfigured intermediary would wedge
            // the SDK for as long as it liked.
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

            // First-launch-offline: the backoff is armed and there is no cache to fall back on.
            // Serving that by dialling anyway makes a retry loop one real request per call.
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

            // A new store shares only the KeyValueStore — the same situation as
            // a fresh process. Without persistence the merchant's first paint
            // shows fallback copy on every single launch.
            transport.fail(IOException("offline"))
            val coldStart = newStore(this).resolve(query, forceRefresh = false)

            assertEquals("Acme", coldStart.name)
        }

    /**
     * 3.2 regression: [DefaultFrakClient.handleReferralLink]'s merchant guard resolves
     * `ownMerchantId` from [ConfigStore.currentConfig], not [ConfigStore.updates], precisely so a
     * warm start reached BEFORE anything has called [resolve] in this process — the dominant
     * deep-link case, where the process is launched BY the referral URL — still has a merchant id
     * available. [updates] alone cannot supply it: [fetch] is C3's one publish point, and nothing
     * has called it yet. [currentConfig] hydrates from disk itself now, on demand, rather than
     * only reading whatever [ConfigStore.resolve] already happened to populate.
     */
    @Test
    fun `currentConfig hydrates from disk on its own, without a prior resolve call`() =
        runTest {
            transport.respond(200, BODY)
            newStore(this).resolve(query, forceRefresh = false)

            // A second, independent store instance sharing only the persisted KeyValueStore —
            // the same situation as a fresh process reading what a previous run wrote to disk,
            // and nothing in this test ever calls warmStart.resolve().
            val warmStart = newStore(this)

            val emissions = mutableListOf<String?>()
            val collector = launch { warmStart.updates.collect { emissions.add(it?.name) } }
            advanceUntilIdle()

            // Proven non-network: every request this store's transport could possibly make fails.
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
            val otherQuery = MerchantQuery.from(FrakConfig(packageId = "com.example.other"))
            transport.fail(IOException("currentConfig must not reach the network"))

            assertNull(warmStart.currentConfig(otherQuery))
        }

    @Test
    fun `a persisted entry for a different query is ignored`() =
        runTest {
            transport.respond(200, BODY)
            newStore(this).resolve(query, forceRefresh = false)

            // Resolving by package id is a different merchant lookup and must
            // not be answered from the by-id entry.
            val otherQuery = MerchantQuery.from(FrakConfig(packageId = "com.example.other"))
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

            // The same merchant in a second language is the ordinary case, and
            // it returns different copy. An in-memory slot that ignored the key
            // would serve the first language's config to the second caller with
            // nothing to signal it.
            val frenchQuery =
                MerchantQuery.from(
                    FrakConfig(
                        merchantId = MERCHANT_ID,
                        metadata =
                            id.frak.sdk.core
                                .FrakMetadata(lang = id.frak.sdk.core.FrakLanguage.FR),
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

            // Nothing consumes it server-side yet; a binary already on users'
            // phones cannot be taught to send it later.
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
            // The backend distinguishes an absent parameter from an empty one:
            // `?lang=` would be a 422 while omitting it is fine.
            assertTrue("an unset lang is omitted entirely, was: $url", !url.contains("lang="))
        }

    @Test
    fun `concurrent cache misses for the same key read persisted disk exactly once`() =
        runTest {
            val configStore = newStore(this)
            transport.respond(200, BODY)

            val results = List(5) { async { configStore.resolve(query, forceRefresh = false) } }.awaitAll()

            // Every one of the 5 callers misses both memory and disk at the same
            // time on a cold store; only one of them should actually hydrate from
            // disk, the rest should join that hydration rather than each doing
            // their own read and decode.
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
            val otherQuery = MerchantQuery.from(FrakConfig(packageId = "com.example.other"))
            transport.fail(IOException("offline"))

            repeat(3) {
                runCatching { configStore.resolve(otherQuery, forceRefresh = false) }
            }

            // The first miss for a key with nothing persisted for it is entitled to
            // one disk read; every miss after that must be answered from the
            // negative cache, not by re-reading disk for the rest of the process.
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
