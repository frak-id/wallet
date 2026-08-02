package id.frak.sdk.config

import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.net.FAKE_BASE_URL
import id.frak.sdk.net.FakeHttpTransport
import id.frak.sdk.net.HttpClient
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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
