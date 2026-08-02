package id.frak.sdk.rewards

import id.frak.sdk.core.FrakCurrency
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

    private companion object {
        const val MERCHANT_ID = "b3d5e5b8-9b1a-4c0e-8f5a-1a2b3c4d5e6f"
        const val EMPTY = """{"rewards":[]}"""
    }
}
