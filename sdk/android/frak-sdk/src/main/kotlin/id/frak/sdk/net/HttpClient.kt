// Opted in for `PercentEncoding`, which is `@InternalFrakApi`. Per file, not module-wide, so the
// marker still applies elsewhere.
@file:OptIn(InternalFrakApi::class)

package id.frak.sdk.net

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.InternalFrakApi
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
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
 * A response body exceeded [HttpClient.MAX_RESPONSE_BODY_BYTES]. [total] is the bytes read so far,
 * or the advertised Content-Length when that alone was enough to reject the response.
 */
internal class ResponseTooLargeException(
    val total: Long,
) : IOException("Response body exceeded the maximum of ${HttpClient.MAX_RESPONSE_BODY_BYTES} bytes (was $total)")

/** GET/POST over [HttpURLConnection]; no OkHttp, zero runtime deps. */
internal class HttpClient(
    private val baseUrl: String,
    private val ioDispatcher: CoroutineDispatcher,
    private val open: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
    // Built as a DefaultFrakClient constructor default, before its init body runs; null is silent.
    private val logger: FrakLogger? = null,
    /** Fed the `Date` header of every response; null when nothing in this client's tree signs proofs. */
    private val serverClock: ServerClock? = null,
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
            // Inside the deadline block so a malformed origin surfaces as FrakError.Network.
            val url = urlOrThrow(buildUrl(path, query))
            try {
                attempt(url, headers, null)
            } catch (retryable: IOException) {
                if (!isTransient(retryable)) throw FrakError.Network(retryable)
                // One retry, safe only because this is GET-only: an idle pooled connection closed
                // server-side fails on next use indistinguishably from a real failure.
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

    /** [java.net.UnknownHostException] is an [IOException], not a [java.net.SocketException] — hence its own arm. */
    private fun isTransient(error: IOException): Boolean =
        error is java.net.SocketException ||
            error is java.io.EOFException ||
            error is java.io.InterruptedIOException ||
            error is java.net.UnknownHostException

    /** Jittered: every client retrying in lockstep recreates the spike it reacted to. */
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
    ): Response {
        val method = if (body == null) "GET" else "POST"
        val startMillis = System.currentTimeMillis()
        return try {
            val response = attemptUnlogged(url, headers, body)
            logResult(method, url, response.status, startMillis)
            response
        } catch (thrown: Exception) {
            // Exception, not Throwable: a JVM Error must propagate untouched
            logResult(method, url, status = null, startMillis)
            throw thrown
        }
    }

    /** DEBUG-level only. Never logs the query string or a header value — both can carry identifiers. */
    private fun logResult(
        method: String,
        url: URL,
        status: Int?,
        startMillis: Long,
    ) {
        if (logger == null) return
        val durationMillis = System.currentTimeMillis() - startMillis
        val statusText = status?.toString() ?: "error"
        logger.debug("Frak $method ${url.host}${url.path} -> $statusText (${durationMillis}ms)")
    }

    private suspend fun attemptUnlogged(
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
        setRequestProperty(FrakSdkVersion.HEADER_NAME, FrakSdkVersion.HEADER_VALUE)
        headers.forEach { (name, value) -> setRequestProperty(name, value) }

        if (body != null) {
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            val bytes = body.toByteArray(Charsets.UTF_8)
            setFixedLengthStreamingMode(bytes.size)
            outputStream.use { it.write(bytes) }
        }

        val status = responseCode
        // Free on every response, and the only clock the SDK can trust for proof timestamps.
        serverClock?.observe(getHeaderFieldDate("Date", 0L))
        // Fail fast on an advertised size; the read below caps chunked or lying responses too.
        if (contentLengthLong > MAX_RESPONSE_BODY_BYTES) {
            // Nothing was read, so disconnect() is the only way back to a clean pooled state.
            runCatching { errorStream?.close() }
            runCatching { inputStream?.close() }
            runCatching { disconnect() }
            throw FrakError.Network(ResponseTooLargeException(contentLengthLong))
        }
        // 204/205/304 carry no body, and inputStream throws for them rather than returning null
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

    /** Bounded read, since Content-Length can be absent or wrong. Throws rather than truncating. */
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
                // Aborting mid-read leaves the stream undrained, so drop the connection.
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

        /** Sized so two attempts plus [retryDelayMillis] fit inside [OVERALL_DEADLINE_MILLIS]. */
        const val CONNECT_TIMEOUT_MILLIS: Int = 3_000
        const val READ_TIMEOUT_MILLIS: Int = 5_000

        /** Wall-clock ceiling for a whole request; readTimeout alone only bounds each read. */
        const val OVERALL_DEADLINE_MILLIS: Long = 20_000

        const val RETRY_DELAY_BASE_MILLIS: Long = 100
        const val RETRY_DELAY_JITTER_MILLIS: Long = 200

        /** 5 minutes: long enough for any real rate limit, short enough to recover from a bad header. */
        const val MAX_RETRY_AFTER_SECONDS: Long = 300

        /** 1 MiB — generous headroom over the small JSON payloads this client reads. */
        const val MAX_RESPONSE_BODY_BYTES: Long = 1024L * 1024L
    }
}
