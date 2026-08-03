package id.frak.sdk.rewards

import id.frak.sdk.core.FrakCurrency
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogSink
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.ProductDetails
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/**
 * Pins the query sent to `GET /user/merchant/estimated-rewards` and the cache
 * around it.
 *
 * The query assertions are the important ones: three of the five parameters are
 * ones the backend rejects or silently ignores if sent wrong, and the failure in
 * each case is a reward that renders as absent rather than an error.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class RewardRepositoryTest {
    private var clock = 0L
    private val transport = FakeHttpTransport()

    private fun newRepository(scope: TestScope) =
        RewardRepository(
            http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(scope.testScheduler), transport::open),
            logger = FrakLogger(FrakLogLevel.NONE),
            scope = scope,
            now = { clock },
        )

    @Test
    fun `formatted is sent as the literal string 1`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)

            // The backend declares this `t.Literal("1")`, not a boolean: "true"
            // and "0" are both 422s. And without it the `best` object is simply
            // absent, which looks exactly like "no rewards".
            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            assertTrue("was: $url", url.contains("formatted=1"))
        }

    @Test
    fun `currency comes from config, never from the caller`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(MERCHANT_ID, FrakCurrency.GBP, null, null, forceRefresh = false)

            // A caller-supplied currency invites drift — the same campaign
            // advertised at different amounts on two of a merchant's surfaces.
            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            assertTrue("was: $url", url.contains("currency=gbp"))
        }

    @Test
    fun `unset narrowing parameters are omitted entirely`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            assertTrue("targetInteraction omitted, was: $url", !url.contains("targetInteraction"))
            assertTrue("audience omitted, was: $url", !url.contains("audience"))
        }

    @Test
    fun `narrowing parameters are sent when supplied`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                targetInteraction = "purchase",
                audience = RewardAudience.REFERRER,
                forceRefresh = false,
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            assertTrue("was: $url", url.contains("targetInteraction=purchase"))
            assertTrue("was: $url", url.contains("audience=referrer"))
        }

    @Test
    fun `an unknown merchant returns an empty list rather than an error`() =
        runTest {
            // This endpoint NEVER 404s. A typo'd merchantId is a permanently
            // successful call returning nothing — indistinguishable from a real
            // merchant between campaigns, which is why the diagnosis lives on
            // resolveConfig().
            transport.respond(200, EMPTY)

            val result = newRepository(this).fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)

            assertTrue(result.campaigns.isEmpty())
            assertNull(result.best)
        }

    @Test
    fun `a repeat within the cache window does not dial`() =
        runTest {
            val repository = newRepository(this)
            transport.respond(200, EMPTY)

            repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)
            clock += RewardRepository.CACHE_TTL_MILLIS - 1
            repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)

            assertEquals(1, transport.requests.size)
        }

    @Test
    fun `an expired entry is refetched rather than served stale`() =
        runTest {
            val repository = newRepository(this)
            transport.respond(200, EMPTY)

            repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)
            clock += RewardRepository.CACHE_TTL_MILLIS
            repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)

            // Unlike the config cache, which serves stale indefinitely: a reward
            // amount must not be shown when we are not sure of it.
            assertEquals(2, transport.requests.size)
        }

    @Test
    fun `queries differing only in audience do not share a cache entry`() =
        runTest {
            val repository = newRepository(this)
            transport.respond(200, EMPTY)

            repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, RewardAudience.REFERRER, forceRefresh = false)
            repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, RewardAudience.REFEREE, forceRefresh = false)

            // `best` is selected server-side FROM the query, so these return
            // genuinely different answers. Sharing an entry would show a
            // referrer's reward to a referee — the right number for the wrong
            // role, which is worse than showing nothing.
            assertEquals(2, transport.requests.size)
        }

    @Test
    fun `queries differing only in products do not share a cache entry`() =
        runTest {
            val repository = newRepository(this)
            transport.respond(200, EMPTY)

            repository.fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products = listOf(ProductDetails(sku = "SHOE-42")),
            )
            repository.fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products = listOf(ProductDetails(sku = "SHIRT-1")),
            )

            // Same reasoning as the audience case above: a scoped selection for one basket must
            // never be served back for a different one.
            assertEquals(2, transport.requests.size)
        }

    @Test
    fun `products encode to the golden base64url vector and reach the wire`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products =
                    listOf(
                        ProductDetails(
                            productId = "p1",
                            sku = "SHOE-42",
                            name = "Kettle",
                            quantity = 2.0,
                            unitPrice = 79.9,
                            totalPrice = 159.8,
                        ),
                    ),
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            // Pinned against sdk/core's compressJsonToB64([{"name":"Kettle","productId":"p1",
            // "quantity":2,"sku":"SHOE-42","totalPrice":159.8,"unitPrice":79.9}]) — see the
            // product-scope contract's golden vectors. Both platforms and the backend must
            // agree on this exact string.
            assertTrue(
                "was: $url",
                url.contains(
                    "products=W3sibmFtZSI6IktldHRsZSIsInByb2R1Y3RJZCI6InAxIiwicXVhbnRpdHkiOjIsInNrdSI6IlNIT0UtNDIiLCJ0b3RhbFByaWNlIjoxNTkuOCwidW5pdFByaWNlIjo3OS45fV0",
                ),
            )
        }

    @Test
    fun `a product with a non-ASCII name encodes to the golden vector`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products = listOf(ProductDetails(name = "Babies camel cuir velours bout carré")),
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            // Raw UTF-8, not \u-escaped: JSON.stringify emits raw UTF-8 for non-ASCII text, and a
            // native encoder that escapes it instead produces a different (still valid) string
            // that fails this vector.
            assertTrue(
                "was: $url",
                url.contains(
                    "products=W3sibmFtZSI6IkJhYmllcyBjYW1lbCBjdWlyIHZlbG91cnMgYm91dCBjYXJyw6kifV0",
                ),
            )
        }

    /**
     * RFC 8259 §7 forbids a raw control character inside a JSON string, and merchant catalogue
     * data carries stray newlines and tabs. An unescaped one made the whole payload unparseable,
     * so the backend dropped the entire basket's scope context over a single bad character.
     * Vector generated from `sdk/core`'s `compressJsonToB64`.
     */
    @Test
    fun `control characters in a product name are escaped, not emitted raw`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products = listOf(ProductDetails(name = "Line1\nLine2\tEnd")),
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            // [{"name":"Line1\nLine2\tEnd"}] with the escapes JSON.stringify writes.
            assertTrue("was: $url", url.contains("products=W3sibmFtZSI6IkxpbmUxXG5MaW5lMlx0RW5kIn1d"))
        }

    /**
     * NaN/Infinity have no JSON literal: emitting `toString()` would put `NaN` in the payload and
     * make it unparseable. `JSON.stringify` writes `null` there, which the backend's
     * `sanitizeProductDetailsList` discards — dropping the field reaches the same place.
     */
    @Test
    fun `a non-finite price is dropped rather than emitted as an invalid JSON token`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products =
                    listOf(
                        ProductDetails(
                            sku = "SHOE-42",
                            quantity = Double.NaN,
                            unitPrice = Double.POSITIVE_INFINITY,
                        ),
                    ),
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            // The sku-only golden vector: [{"sku":"SHOE-42"}]
            assertTrue("was: $url", url.contains("products=W3sic2t1IjoiU0hPRS00MiJ9XQ"))
        }

    /** `JSON.stringify(-0)` writes `0`; the encoded form must not carry a sign. */
    @Test
    fun `negative zero encodes the way JSON stringify writes it`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products = listOf(ProductDetails(quantity = -0.0)),
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            // [{"quantity":0}]
            assertTrue("was: $url", url.contains("products=W3sicXVhbnRpdHkiOjB9XQ"))
        }

    @Test
    fun `an empty products list omits the parameter entirely`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products = emptyList(),
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            assertTrue("was: $url", !url.contains("products"))
        }

    @Test
    fun `a product with every scope field null contributes nothing and the parameter is omitted`() =
        runTest {
            transport.respond(200, EMPTY)
            newRepository(this).fetch(
                MERCHANT_ID,
                FrakCurrency.EUR,
                null,
                null,
                forceRefresh = false,
                products = listOf(ProductDetails()),
            )

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            assertTrue("was: $url", !url.contains("products"))
        }

    @Test
    fun `an oversized encoded payload is dropped and warns rather than failing the call`() =
        runTest {
            transport.respond(200, EMPTY)
            // A sink, not FrakLogLevel.WARN with the default logcat sink: android.util.Log is a
            // stubbed method on this JVM unit-test classpath and throws unless mocked (see
            // FrakLoggerTest's doc) — no mocking framework runs in this test tier.
            val warnings = mutableListOf<String>()
            val logger = FrakLogger(FrakLogLevel.WARN, FrakLogSink { _, message, _ -> warnings.add(message) })
            val repository =
                RewardRepository(
                    http = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(this.testScheduler), transport::open),
                    logger = logger,
                    scope = this,
                    now = { clock },
                )
            // 400 distinct skus comfortably exceeds the 8192-character budget once JSON-encoded
            // and base64url-expanded (4/3 overhead).
            val huge = (1..400).map { ProductDetails(sku = "SKU-$it-${"x".repeat(40)}") }

            repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false, products = huge)

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            assertTrue("was: $url", !url.contains("products"))
            assertTrue("expected a warning, got: $warnings", warnings.isNotEmpty())
        }

    @Test
    fun `concurrent callers share one request`() =
        runTest {
            val repository = newRepository(this)
            transport.respond(200, EMPTY)

            List(10) {
                async { repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false) }
            }.awaitAll()

            // A LazyColumn rendering ten product rows calls this ten times in one
            // frame, against a 60-per-minute per-IP bucket.
            assertEquals(1, transport.requests.size)
        }

    @Test
    fun `a transport failure surfaces as a network error`() =
        runTest {
            transport.fail(IOException("offline"))

            val failure =
                runCatching {
                    newRepository(this).fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false)
                }.exceptionOrNull()

            assertTrue("expected Network, got $failure", failure is FrakError.Network)
        }

    @Test
    fun `repeated failures back off instead of dialling every time`() =
        runTest {
            val repository = newRepository(this)
            transport.fail(IOException("offline"))

            runCatching { repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false) }
            val afterFirst = transport.requests.size
            runCatching { repository.fetch(MERCHANT_ID, FrakCurrency.EUR, null, null, forceRefresh = false) }

            // The HTTP layer retries once internally, so `afterFirst` is 2. The
            // point is that the second call adds nothing.
            assertEquals("the second call was suppressed by backoff", afterFirst, transport.requests.size)
        }

    /**
     * Backoff must not be keyed by products. It was, briefly: because the products string is
     * part of the cache key, folding it into the backoff key too meant every product page
     * minted a fresh key with a zero failure count, so a merchant browsing a catalogue would
     * hammer a failing backend once per product instead of backing off.
     */
    @Test
    fun `a backed-off backend stays backed off for a different product set`() =
        runTest {
            val repository = newRepository(this)
            transport.fail(IOException("offline"))

            runCatching {
                repository.fetch(
                    MERCHANT_ID,
                    FrakCurrency.EUR,
                    null,
                    null,
                    forceRefresh = false,
                    products = listOf(ProductDetails(sku = "SHOE-42")),
                )
            }
            val afterFirst = transport.requests.size

            runCatching {
                repository.fetch(
                    MERCHANT_ID,
                    FrakCurrency.EUR,
                    null,
                    null,
                    forceRefresh = false,
                    products = listOf(ProductDetails(sku = "SHIRT-1")),
                )
            }

            assertEquals(
                "a different product set must not mint a fresh backoff key",
                afterFirst,
                transport.requests.size,
            )
        }

    /**
     * The cache key carries an up-to-4KB caller-controlled products string, so entries must not
     * accumulate for the process's lifetime the way a merchant/currency-keyed map safely could.
     */
    @Test
    fun `expired entries are swept, so browsing a catalogue cannot grow the cache forever`() =
        runTest {
            val repository = newRepository(this)

            repeat(5) { index ->
                transport.respond(200, EMPTY)
                repository.fetch(
                    MERCHANT_ID,
                    FrakCurrency.EUR,
                    null,
                    null,
                    forceRefresh = false,
                    products = listOf(ProductDetails(sku = "SKU-$index")),
                )
                // Past the 30s TTL, so every previous entry is dead by the next insert.
                clock += RewardRepository.CACHE_TTL_MILLIS + 1
            }

            assertEquals(1, repository.cachedEntryCount())
        }

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        const val EMPTY = """{"rewards":[]}"""
    }
}
