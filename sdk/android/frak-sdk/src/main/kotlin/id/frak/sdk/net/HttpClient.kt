package id.frak.sdk.net

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.core.FrakError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import java.io.IOException
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL
import kotlin.random.Random

/**
 * A response body exceeded [HttpClient.MAX_RESPONSE_BODY_BYTES]. Reported as [total] bytes read
 * so far when the cap was hit mid-stream (Content-Length absent or lying), or as the advertised
 * Content-Length itself when the header alone was enough to reject the response.
 *
 * Declared as an [IOException] because it genuinely is one (a transport-layer read was aborted),
 * not to route it through [HttpClient.get]'s `catch (retryable: IOException)`. It never reaches
 * that catch: both throw sites wrap it in [FrakError.Network] before it leaves [perform], and
 * `FrakError.Network` is not itself an `IOException`, so it always skips the retry. That is
 * deliberate, not an accident of the wrapping — retrying an oversized body repeats the same cost
 * for the same guaranteed-to-fail-again outcome, unlike a transient connection drop.
 */
internal class ResponseTooLargeException(
    val total: Long,
) : IOException("Response body exceeded the maximum of ${HttpClient.MAX_RESPONSE_BODY_BYTES} bytes (was $total)")

/** GET/POST over [HttpURLConnection] (no OkHttp, zero runtime deps). See inline comments for footguns. */
internal class HttpClient(
    private val baseUrl: String,
    private val ioDispatcher: CoroutineDispatcher,
    private val open: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    data class Response(
        val status: Int,
        val body: String,
        val retryAfterSeconds: Long?,
    ) {
        val isSuccess: Boolean get() = status in 200..299
    }

    /** Non-2xx statuses are returned, not thrown; null query values are dropped, not sent empty. */
    suspend fun get(
        path: String,
        query: Map<String, String?> = emptyMap(),
        headers: Map<String, String> = emptyMap(),
    ): Response {
        // Deadline wraps both attempts, else the retry would get its own fresh window.
        return withDeadline {
            // Inside the deadline block so a malformed FrakEnvironment.Custom origin surfaces as
            // FrakError.Network, not a raw MalformedURLException out of a FrakResult method.
            val url = urlOrThrow(buildUrl(path, query))
            try {
                attempt(url, headers, null)
            } catch (retryable: IOException) {
                if (!isTransient(retryable)) throw FrakError.Network(retryable)
                // One retry: a pooled connection closed server-side while idle fails on next use
                // indistinguishably from a real failure. Safe only because this is GET-only.
                // Narrowed to SocketException/EOFException/InterruptedIOException (N6): an SSL
                // trust failure or a malformed response will just fail identically again, so
                // retrying only wastes the deadline's remaining budget on a guaranteed repeat.
                // A ResponseTooLargeException never lands here: perform() always wraps it in
                // FrakError.Network before it escapes, which is not an IOException, so an
                // oversized response is deliberately never retried — see ResponseTooLargeException's
                // doc.
                delay(retryDelayMillis())
                try {
                    attempt(url, headers, null)
                } catch (failed: IOException) {
                    failed.addSuppressed(retryable)
                    throw FrakError.Network(failed)
                }
            }
        }
    }

    /**
     * A dropped/reset connection, a timeout, or a DNS lookup failure is worth one retry;
     * anything else will just fail again. [java.net.UnknownHostException] is a plain
     * [IOException], not a [java.net.SocketException] subtype, so it needs its own arm to match
     * iOS's `isTransient`, which retries `.cannotFindHost`/`.dnsLookupFailed` (N6 parity).
     */
    private fun isTransient(error: IOException): Boolean =
        error is java.net.SocketException ||
            error is java.io.EOFException ||
            error is java.io.InterruptedIOException ||
            error is java.net.UnknownHostException

    /** Short and jittered (N6): a regional blip retried instantly, in lockstep, by every client
     * recreates the load spike it was reacting to. 100-300ms leaves ample room for a retry
     * inside the per-attempt timeout budget below. */
    private fun retryDelayMillis(): Long = RETRY_DELAY_BASE_MILLIS + Random.nextLong(RETRY_DELAY_JITTER_MILLIS)

    /** No retry, unlike [get]: the transport can't tell whether the request was read before dying. */
    suspend fun post(
        path: String,
        body: String,
        headers: Map<String, String> = emptyMap(),
    ): Response =
        withDeadline {
            val url = urlOrThrow(baseUrl + path)
            try {
                attempt(url, headers, body)
            } catch (failed: IOException) {
                throw FrakError.Network(failed)
            }
        }

    /** Only [TimeoutCancellationException] is mapped; a real `CancellationException` propagates untouched. */
    private suspend fun withDeadline(block: suspend () -> Response): Response =
        try {
            withTimeout(OVERALL_DEADLINE_MILLIS) { block() }
        } catch (expired: TimeoutCancellationException) {
            throw FrakError.Network(expired)
        }

    /** Runs as a child coroutine so cancellation can reach a blocked socket read via disconnect(). */
    private suspend fun attempt(
        url: URL,
        headers: Map<String, String>,
        body: String?,
    ): Response =
        coroutineScope {
            val connection = open(url)
            val work = async(ioDispatcher) { connection.perform(headers, body) }
            try {
                work.await()
            } catch (cancelled: CancellationException) {
                runCatching { connection.disconnect() }
                throw cancelled
            }
            // No disconnect() on success: draining and closing the stream returns it to the pool.
        }

    private fun HttpURLConnection.perform(
        headers: Map<String, String>,
        body: String?,
    ): Response {
        requestMethod = if (body == null) "GET" else "POST"
        connectTimeout = CONNECT_TIMEOUT_MILLIS
        readTimeout = READ_TIMEOUT_MILLIS
        // Every URL here is ours, so a redirect means misconfiguration, not something to follow.
        instanceFollowRedirects = false
        useCaches = false
        setRequestProperty("Accept", "application/json")
        setRequestProperty(FrakSdkVersion.HEADER_NAME, FrakSdkVersion.CURRENT)
        headers.forEach { (name, value) -> setRequestProperty(name, value) }

        if (body != null) {
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            val bytes = body.toByteArray(Charsets.UTF_8)
            setFixedLengthStreamingMode(bytes.size)
            outputStream.use { it.write(bytes) }
        }

        val status = responseCode
        // Fail fast on an advertised size before opening the stream at all. Not sufficient alone:
        // a chunked or lying response has no (or a false) Content-Length, so the read below is
        // capped independently.
        if (contentLengthLong > MAX_RESPONSE_BODY_BYTES) {
            // Neither stream was read, so there is nothing to drain: close() alone would leave the
            // connection poisoned for the pool exactly like the mid-read abort below, disconnect()
            // is the only way back to a clean state.
            runCatching { errorStream?.close() }
            runCatching { inputStream?.close() }
            runCatching { disconnect() }
            throw FrakError.Network(ResponseTooLargeException(contentLengthLong))
        }
        // 204/205/304 never carry a body by spec; HttpURLConnection.inputStream *throws*
        // IOException for them rather than returning null, which without this short-circuit
        // gets misread by get()'s retry logic as a transient transport failure (N5).
        if (status == 204 || status == 205 || status == 304) {
            runCatching { inputStream?.close() }
            runCatching { errorStream?.close() }
            return Response(status, "", retryAfterSeconds())
        }
        // Error bodies are on errorStream, not inputStream. Drained fully or the pooled connection is poisoned.
        val stream = if (status in 200..399) inputStream else errorStream
        val responseBody = stream?.use { readBytesUpTo(it, MAX_RESPONSE_BODY_BYTES) }.orEmpty()
        return Response(status, responseBody, retryAfterSeconds())
    }

    /**
     * Like [java.io.InputStream.readBytes], but aborts once more than [limit] bytes have been
     * read instead of buffering an unbounded body — the advertised Content-Length above can be
     * absent or wrong, so this is the backstop that actually bounds memory and what ends up
     * persisted into SharedPreferences. Never truncates silently: a body over the limit is a
     * thrown [ResponseTooLargeException], not a partial [String].
     */
    private fun HttpURLConnection.readBytesUpTo(
        stream: java.io.InputStream,
        limit: Long,
    ): String {
        val buffer = java.io.ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        var total = 0L
        while (true) {
            val read = stream.read(chunk)
            if (read == -1) break
            total += read
            if (total > limit) {
                // Aborting mid-read never leaves a clean, fully-drained stream behind — same
                // poisoned-connection risk the Content-Length pre-check above avoids by never
                // opening the stream at all.
                runCatching { disconnect() }
                throw FrakError.Network(ResponseTooLargeException(total))
            }
            buffer.write(chunk, 0, read)
        }
        return buffer.toString(Charsets.UTF_8.name())
    }

    /** Only the delta-seconds form is parsed; the limiter always emits one. */
    private fun HttpURLConnection.retryAfterSeconds(): Long? =
        getHeaderField("Retry-After")
            ?.trim()
            ?.toLongOrNull()
            ?.coerceIn(1L, MAX_RETRY_AFTER_SECONDS)

    private fun urlOrThrow(spec: String): URL =
        try {
            URL(spec)
        } catch (malformed: MalformedURLException) {
            throw FrakError.Network(malformed)
        }

    /** Builds the request URL. Values are percent-encoded; keys are compile-time constants and are not. */
    private fun buildUrl(
        path: String,
        query: Map<String, String?>,
    ): String {
        val present = query.mapNotNull { (key, value) -> value?.let { key to it } }
        if (present.isEmpty()) return baseUrl + path
        return present.joinToString(separator = "&", prefix = "$baseUrl$path?") { (key, value) ->
            "$key=${PercentEncoding.encode(value)}"
        }
    }

    companion object {
        /** Generic non-2xx mapping; callers with a route-specific status map that themselves first. */
        fun Response.toServerError(): FrakError.Server =
            FrakError.Server(status, JsonReader.errorCodeOrNull(body), retryAfterSeconds)

        /**
         * Sized so two attempts plus [retryDelayMillis] fit inside [OVERALL_DEADLINE_MILLIS] with
         * room to spare (N4): worst case per attempt is connect (3s) + read (5s) = 8s; two
         * attempts plus up to 300ms of jittered delay is 16.3s, leaving 3.7s of slack under the
         * 20s wall clock for scheduling/DNS/TLS overhead `connectTimeout`/`readTimeout` don't
         * account for. The previous 10s connect + 15s read per attempt (25s) already exceeded the
         * 20s deadline on a single attempt alone, let alone two.
         */
        const val CONNECT_TIMEOUT_MILLIS: Int = 3_000
        const val READ_TIMEOUT_MILLIS: Int = 5_000

        /** Wall-clock ceiling for a whole request; readTimeout alone only bounds each read. */
        const val OVERALL_DEADLINE_MILLIS: Long = 20_000

        const val RETRY_DELAY_BASE_MILLIS: Long = 100
        const val RETRY_DELAY_JITTER_MILLIS: Long = 200

        /** 5 minutes: long enough for any real rate limit, short enough to recover from a bad header. */
        const val MAX_RETRY_AFTER_SECONDS: Long = 300

        /**
         * 1 MiB. Both responses this client ever reads — a merchant config resolve and a
         * rewards list — are small JSON; the entire 67-case golden rewards fixture, packing
         * every reward kind and currency this SDK supports, is under 100 KB (`golden-rewards.json`).
         * 1 MiB is generous headroom above any real payload while still bounding memory and what
         * an oversized or misbehaving response could force into SharedPreferences (S5).
         */
        const val MAX_RESPONSE_BODY_BYTES: Long = 1024L * 1024L
    }
}
