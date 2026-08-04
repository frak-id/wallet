package id.frak.sdk.net

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogSink
import id.frak.sdk.core.FrakLogger
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.currentTime
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
                    // A pooled connection the server closed while idle fails on the next use
                    // exactly like this: a transient EOFException, one of the types
                    // HttpClient.isTransient retries.
                    if (attempts == 1) throw java.io.EOFException("unexpected end of stream")
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
                    // A SocketException subtype: still transient and worth retrying once, just
                    // unlucky both times here.
                    throw java.net.NoRouteToHostException("no route to host")
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
    fun `a non-transient IOException, like an SSL trust failure, is not retried`() =
        runTest {
            var attempts = 0
            val client =
                newClient {
                    attempts++
                    // Not in HttpClient.isTransient's allowlist: a trust failure fails identically
                    // again, so retrying only burns the deadline's budget.
                    throw javax.net.ssl.SSLHandshakeException("PKIX path building failed")
                }

            val failure = runCatching { client.get("/x") }.exceptionOrNull()

            assertTrue("expected Network, got $failure", failure is FrakError.Network)
            assertEquals("never retried", 1, attempts)
        }

    @Test
    fun `a DNS lookup failure is retried, matching iOS's cannotFindHost-dnsLookupFailed`() =
        runTest {
            var attempts = 0
            val client =
                newClient { url ->
                    attempts++
                    // UnknownHostException is a plain IOException, not a SocketException subtype:
                    // needs its own arm in isTransient, or this silently stops being retried.
                    if (attempts == 1) throw java.net.UnknownHostException("backend.frak.id")
                    transport.respond(200, "{}")
                    transport.open(url)
                }

            client.get("/x")

            assertEquals("retried once", 2, attempts)
        }

    @Test
    fun `the retry is delayed, not immediate`() =
        runTest {
            var attempts = 0
            val client =
                newClient { url ->
                    attempts++
                    if (attempts == 1) throw java.io.EOFException("unexpected end of stream")
                    transport.respond(200, "{}")
                    transport.open(url)
                }

            client.get("/x")

            // The virtual clock only advances past a delay() once one is scheduled and run, so
            // this proves the jittered delay actually executed, not just that time could have
            // passed.
            assertTrue(
                "expected a jittered 100-300ms delay before the retry, was ${currentTime}ms",
                currentTime in 100..300,
            )
        }

    @Test
    fun `caller cancellation propagates rather than becoming a FrakError`() =
        runTest {
            val client = newClient { throw CancellationException("caller went away") }

            val failure = runCatching { client.get("/x") }.exceptionOrNull()

            // Wrapping this would break structured concurrency: the parent would never learn
            // the child cancelled. Only TimeoutCancellationException is translated.
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
                        // Stands in for a blocking socket read: a server that accepts and never
                        // answers.
                        gate.complete(Unit)
                        Thread.sleep(BLOCKED_READ_MILLIS)
                        return 200
                    }

                    override fun disconnect() {
                        disconnected = true
                    }
                }

            // A real dispatcher, not the test one: this asserts a blocked thread is released,
            // and a virtual-time dispatcher cannot express being blocked.
            val client = HttpClient(FAKE_BASE_URL, Dispatchers.IO, open = { stub })
            val job = launch(Dispatchers.Default) { runCatching { client.get("/x") } }
            gate.await()
            job.cancelAndJoin()

            // `Thread.interrupt()` does not unblock a socket read; only `disconnect()` does.
            assertTrue("cancellation must reach the connection", disconnected)
        }

    @Test
    fun `non-2xx statuses are returned rather than thrown`() =
        runTest {
            transport.respond(404, "Merchant not found")
            val response = newClient().get("/x")

            assertEquals(404, response.status)
            assertEquals("Merchant not found", response.body)
        }

    @Test
    fun `an error body is read from errorStream, not inputStream`() =
        runTest {
            // inputStream on a >= 400 response throws FileNotFoundException; getting this wrong
            // turns every structured backend error into a generic transport failure.
            transport.respond(400, """{"success":false,"error":"nope","code":"BAD"}""")

            assertEquals("BAD", JsonReader.errorCodeOrNull(newClient().get("/x").body))
        }

    @Test
    fun `Accept-Encoding is left unset so the platform inflates transparently`() =
        runTest {
            transport.respond(200, "{}")
            newClient().get("/x")

            // Setting it by hand switches the response to raw deflate with no warning, and we
            // would then have to inflate it ourselves.
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

            // A redirect is a misconfiguration to surface, not follow: crossing hosts silently
            // drops headers.
            assertTrue("instanceFollowRedirects must be false", !transport.requests.single().instanceFollowRedirects)
        }

    @Test
    fun `a host cache cannot serve our responses`() =
        runTest {
            transport.respond(200, "{}")
            newClient().get("/x")

            // A merchant with a global HttpResponseCache installed would otherwise answer our
            // config requests from theirs.
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
            // A space must be %20, not `+`: `URLEncoder` produces `+`, which is form-encoding
            // and wrong in a query string.
            assertTrue("space must be %20, was: $url", url.contains("name=Acme%20Ltd"))
            assertTrue("a null value is omitted entirely, was: $url", !url.contains("lang"))
        }

    @Test
    fun `204, 205 and 304 are read as an empty body rather than misread as a transport failure`() =
        runTest {
            for (status in listOf(204, 205, 304)) {
                transport.respond(status, "")

                val response = newClient().get("/x")

                assertEquals("status $status", status, response.status)
                assertEquals("status $status has no body", "", response.body)
            }
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

            // Only the delta-seconds form is parsed; a date form means something unexpected is
            // in the path, and the backoff falls back to its own schedule.
            assertEquals(null, newClient().get("/x").retryAfterSeconds)
        }

    @Test
    fun `a body at the size cap is read in full`() =
        runTest {
            val body = "x".repeat(HttpClient.MAX_RESPONSE_BODY_BYTES.toInt())
            transport.respond(200, body)

            assertEquals(body.length, newClient().get("/x").body.length)
        }

    @Test
    fun `a Content-Length over the cap is rejected before the stream is read`() =
        runTest {
            // The real body is small; only the advertised header lies, proving the pre-check
            // runs off Content-Length alone.
            transport.respond(200, "{}", declaredContentLength = HttpClient.MAX_RESPONSE_BODY_BYTES + 1)

            val failure = runCatching { newClient().get("/x") }.exceptionOrNull()

            assertTrue("expected Network, got $failure", failure is FrakError.Network)
            assertTrue(
                "expected ResponseTooLargeException, got ${failure?.cause}",
                failure?.cause is ResponseTooLargeException,
            )
        }

    @Test
    fun `a body over the cap with no advertised Content-Length is rejected during the read, not truncated`() =
        runTest {
            val oversized = "x".repeat(HttpClient.MAX_RESPONSE_BODY_BYTES.toInt() + 1)
            // declaredContentLength = -1 stands in for "absent", what HttpURLConnection reports
            // for a server that sends no Content-Length header (e.g. chunked transfer).
            transport.respond(200, oversized, declaredContentLength = -1)

            val failure = runCatching { newClient().get("/x") }.exceptionOrNull()

            assertTrue("expected Network, got $failure", failure is FrakError.Network)
            assertTrue(
                "expected ResponseTooLargeException, got ${failure?.cause}",
                failure?.cause is ResponseTooLargeException,
            )
        }

    @Test
    fun `a request is logged at debug level without the query string or header values (D3)`() =
        runTest {
            transport.respond(200, "{}")
            val sink = RecordingLogSink()
            val logger = FrakLogger(FrakLogLevel.DEBUG, sink)

            newClient(logger = logger).get(
                "/user/merchant/resolve",
                query = mapOf("merchantId" to "super-secret-merchant-id"),
                headers = mapOf("Authorization" to "Bearer super-secret-token"),
            )

            assertEquals("exactly one debug line", 1, sink.messages.size)
            val line = sink.messages.single()
            assertTrue("names the path: $line", line.contains("/user/merchant/resolve"))
            assertTrue("names the status: $line", line.contains("200"))
            assertTrue("never the query string: $line", !line.contains("super-secret-merchant-id"))
            assertTrue("never a header value: $line", !line.contains("super-secret-token"))
        }

    @Test
    fun `nothing is logged when no logger is configured (D3)`() =
        runTest {
            transport.respond(200, "{}")

            assertEquals(200, newClient().get("/x").status)
        }

    @Test
    fun `a failed attempt is logged too, without a status (D3)`() =
        runTest {
            transport.fail(java.io.EOFException("boom"))
            val sink = RecordingLogSink()
            val logger = FrakLogger(FrakLogLevel.DEBUG, sink)

            // EOFException is transient: both the original attempt and its retry fail and are
            // each logged once.
            runCatching { newClient(logger = logger).get("/x") }

            assertEquals("both the original attempt and its retry are logged", 2, sink.messages.size)
            sink.messages.forEach { line ->
                assertTrue("no status on a failed attempt: $line", line.contains("error"))
            }
        }

    private class RecordingLogSink : FrakLogSink {
        val messages = mutableListOf<String>()

        override fun log(
            level: FrakLogLevel,
            message: String,
            throwable: Throwable?,
        ) {
            messages += message
        }
    }

    /**
     * [open] is deliberately last: call sites here pass it as a trailing lambda, and Kotlin binds
     * a trailing lambda to the final parameter. Add future parameters ahead of [open].
     */
    private fun kotlinx.coroutines.test.TestScope.newClient(
        logger: FrakLogger? = null,
        open: (URL) -> HttpURLConnection = transport::open,
    ) = HttpClient(FAKE_BASE_URL, UnconfinedTestDispatcher(testScheduler), open, logger)

    private companion object {
        /** Long enough that the assertion cannot pass by the read simply finishing. */
        const val BLOCKED_READ_MILLIS = 10_000L
    }
}
