package id.frak.sdk.net

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.core.FrakError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Pins the transport behaviours that fail silently rather than loudly.
 *
 * The retry, the deadline and the cancellation arm are all things that look
 * correct by reading and are wrong in the field. The gzip and stream-selection
 * assertions exist because `HttpURLConnection` changes behaviour depending on
 * whether you set a header it would otherwise manage itself.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HttpClientTest {
    private val transport = FakeHttpTransport()

    @Test
    fun `a transient IOException is retried once`() =
        runTest {
            var attempts = 0
            val client =
                newClient { url ->
                    attempts++
                    // A pooled connection the server closed while idle fails on
                    // the *next* use exactly like this.
                    if (attempts == 1) throw IOException("unexpected end of stream")
                    transport.respond(200, "{}")
                    transport.open(url)
                }

            assertEquals(200, client.get("/x").status)
            assertEquals("the first failure was retried", 2, attempts)
        }

    @Test
    fun `a persistent IOException becomes a network error carrying both failures`() =
        runTest {
            var attempts = 0
            val client =
                newClient {
                    attempts++
                    throw IOException("no route to host")
                }

            val failure = runCatching { client.get("/x") }.exceptionOrNull()

            assertTrue("expected Network, got $failure", failure is FrakError.Network)
            assertEquals("retried exactly once, not forever", 2, attempts)
            assertTrue(
                "the first failure is preserved for diagnosis",
                failure?.cause?.suppressed?.isNotEmpty() == true,
            )
        }

    @Test
    fun `caller cancellation propagates rather than becoming a FrakError`() =
        runTest {
            val client = newClient { throw CancellationException("caller went away") }

            val failure = runCatching { client.get("/x") }.exceptionOrNull()

            // Wrapping this would break structured concurrency: the parent never
            // learns the child cancelled, and `withTimeout` silently stops
            // working. Only TimeoutCancellationException is translated.
            assertTrue("expected CancellationException, got $failure", failure is CancellationException)
        }

    @Test
    fun `cancellation disconnects the socket rather than merely returning`() =
        runTest {
            val gate = CompletableDeferred<Unit>()
            var disconnected = false
            transport.respond(200, "{}")
            val stub =
                object : HttpURLConnection(URL(FAKE_BASE_URL)) {
                    override fun connect() = Unit

                    override fun usingProxy(): Boolean = false

                    override fun getResponseCode(): Int {
                        // Stands in for a blocking socket read: a server that
                        // accepts and never answers.
                        gate.complete(Unit)
                        Thread.sleep(BLOCKED_READ_MILLIS)
                        return 200
                    }

                    override fun disconnect() {
                        disconnected = true
                    }
                }

            // A real dispatcher, not the test one: this asserts that a *blocked
            // thread* is released, and a virtual-time dispatcher cannot express
            // being blocked.
            val client = HttpClient(FAKE_BASE_URL, Dispatchers.IO) { stub }
            val job = launch(Dispatchers.Default) { runCatching { client.get("/x") } }
            gate.await()
            job.cancelAndJoin()

            // `Thread.interrupt()` does not unblock a socket read; only
            // `disconnect()` does. Without this the coroutine *returns* while a
            // thread sits on a 15s read holding a socket, and repeated
            // presentations exhaust the SDK's limited dispatcher until every
            // call hangs.
            assertTrue("cancellation must reach the connection", disconnected)
        }

    @Test
    fun `non-2xx statuses are returned rather than thrown`() =
        runTest {
            // Only the caller knows whether a 404 means "no merchant" or an
            // ordinary server error, so the mapping is not this layer's job.
            transport.respond(404, "Merchant not found")
            val response = newClient().get("/x")

            assertEquals(404, response.status)
            assertEquals("Merchant not found", response.body)
        }

    @Test
    fun `an error body is read from errorStream, not inputStream`() =
        runTest {
            // Reading `inputStream` on a >= 400 throws FileNotFoundException, so
            // getting this wrong turns every structured backend error into a
            // generic transport failure.
            transport.respond(400, """{"success":false,"error":"nope","code":"BAD"}""")

            assertEquals("BAD", JsonReader.errorCodeOrNull(newClient().get("/x").body))
        }

    @Test
    fun `Accept-Encoding is left unset so the platform inflates transparently`() =
        runTest {
            transport.respond(200, "{}")
            newClient().get("/x")

            // Setting it by hand switches the response to raw deflate with no
            // warning, and we would then have to inflate it ourselves. Both
            // halves or neither.
            val headers = transport.requests.single().headers
            assertTrue(
                "Accept-Encoding must not be set, was: $headers",
                headers.keys.none { it.equals("Accept-Encoding", ignoreCase = true) },
            )
        }

    @Test
    fun `the sdk version header rides on every request`() =
        runTest {
            transport.respond(200, "{}")
            newClient().get("/x")

            assertEquals(FrakSdkVersion.CURRENT, transport.requests.single().headers[FrakSdkVersion.HEADER_NAME])
        }

    @Test
    fun `redirects are declined`() =
        runTest {
            transport.respond(200, "{}")
            newClient().get("/x")

            // Every URL this client builds is one we own, so a redirect is a
            // misconfiguration to surface rather than to follow — and following
            // one across hosts silently drops headers.
            assertTrue("instanceFollowRedirects must be false", !transport.requests.single().instanceFollowRedirects)
        }

    @Test
    fun `a host cache cannot serve our responses`() =
        runTest {
            transport.respond(200, "{}")
            newClient().get("/x")

            // A merchant with a global HttpResponseCache installed would
            // otherwise answer our config requests from their cache.
            assertTrue("useCaches must be false", !transport.requests.single().useCaches)
        }

    @Test
    fun `query values are percent-encoded and nulls are omitted`() =
        runTest {
            transport.respond(200, "{}")
            newClient().get("/x", mapOf("name" to "Acme Ltd", "lang" to null))

            val url =
                transport.requests
                    .single()
                    .url
                    .toString()
            // A space must be %20, not `+`. `URLEncoder` produces `+`, which is
            // form-encoding and wrong in a query string.
            assertTrue("space must be %20, was: $url", url.contains("name=Acme%20Ltd"))
            assertTrue("a null value is omitted entirely, was: $url", !url.contains("lang"))
        }

    @Test
    fun `an implausible Retry-After is clamped`() =
        runTest {
            transport.respond(429, "Too Many Requests", retryAfter = "99999999")

            assertEquals(HttpClient.MAX_RETRY_AFTER_SECONDS, newClient().get("/x").retryAfterSeconds)
        }

    @Test
    fun `an unparseable Retry-After is ignored rather than fatal`() =
        runTest {
            transport.respond(429, "Too Many Requests", retryAfter = "Wed, 21 Oct 2026 07:28:00 GMT")

            // Only the delta-seconds form is parsed; the limiter emits integer
            // seconds unconditionally, so a date form means something unexpected
            // is in the path and the backoff falls back to its own schedule.
            assertEquals(null, newClient().get("/x").retryAfterSeconds)
        }

    private fun kotlinx.coroutines.test.TestScope.newClient(open: (URL) -> HttpURLConnection = transport::open) =
        HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), open)

    private companion object {
        /** Long enough that the assertion cannot pass by the read simply finishing. */
        const val BLOCKED_READ_MILLIS = 10_000L
    }
}
