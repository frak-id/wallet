package id.frak.sdk.net

import id.frak.sdk.FrakSdkVersion
import id.frak.sdk.core.FrakError
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withTimeout
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * The SDK's networking layer: one GET, over [HttpURLConnection] (no OkHttp —
 * zero runtime deps; HttpURLConnection is backed by the same stack on Android
 * 4.4+ anyway). See inline comments for the footguns this class works around:
 * errorStream vs inputStream, disconnect() vs connection pooling, per-read
 * timeouts, gzip headers, and response caching.
 */
internal class HttpClient(
    private val baseUrl: String,
    private val ioDispatcher: CoroutineDispatcher,
    private val open: (URL) -> HttpURLConnection = { it.openConnection() as HttpURLConnection },
) {
    /** A response that made it back, whatever its status. */
    data class Response(
        val status: Int,
        val body: String,
        val retryAfterSeconds: Long?,
    ) {
        val isSuccess: Boolean get() = status in 200..299
    }

    /**
     * Issues a GET and returns the raw response, successful or not — non-2xx
     * statuses are returned, not thrown, since only the caller knows whether a
     * given status is expected for that route.
     *
     * @param path leading slash included, e.g. `/user/merchant/resolve`.
     * @param query null values are dropped rather than sent empty; the backend
     *   distinguishes the two (omitting `domain` is fine, `?domain=` is a 422).
     * @throws FrakError.Network on any transport failure, including the overall
     *   deadline expiring.
     */
    suspend fun get(
        path: String,
        query: Map<String, String?> = emptyMap(),
    ): Response {
        val url = URL(buildUrl(path, query))
        // Deadline wraps both attempts; inside attempt() it would give the retry
        // its own fresh window, doubling the worst-case wait.
        return try {
            withTimeout(OVERALL_DEADLINE_MILLIS) {
                try {
                    attempt(url)
                } catch (retryable: IOException) {
                    // One retry: a pooled connection closed server-side while idle
                    // fails on next use with "unexpected end of stream", indistinguishable
                    // from a real failure. Safe only because this is GET-only.
                    try {
                        attempt(url)
                    } catch (failed: IOException) {
                        failed.addSuppressed(retryable)
                        throw FrakError.Network(failed)
                    }
                }
            }
        } catch (expired: TimeoutCancellationException) {
            // Caught outside withTimeout so it covers either attempt. Only this
            // subtype is mapped: a real CancellationException must propagate untouched,
            // or the caller's scope would look cancelled instead of timed out.
            throw FrakError.Network(expired)
        }
    }

    /**
     * Runs the connection on [ioDispatcher] as a child coroutine so cancellation
     * can reach a blocked socket read via disconnect() — Thread.interrupt() alone
     * cannot unblock one, and a job parked on a socket never completes, so
     * invokeOnCompletion doesn't fire either. Without this, a flaky network
     * exhausts the SDK's IO dispatcher and every later call hangs.
     */
    private suspend fun attempt(url: URL): Response =
        coroutineScope {
            val connection = open(url)
            val work = async(ioDispatcher) { connection.perform() }
            try {
                work.await()
            } catch (cancelled: CancellationException) {
                // Runs on the caller's thread while the IO thread is still parked;
                // this is what unparks it.
                runCatching { connection.disconnect() }
                throw cancelled
            }
            // No disconnect() on the success path: draining and closing the stream
            // returns the connection to the pool.
        }

    private fun HttpURLConnection.perform(): Response {
        requestMethod = "GET"
        connectTimeout = CONNECT_TIMEOUT_MILLIS
        readTimeout = READ_TIMEOUT_MILLIS
        // Every URL here is ours, so a redirect means misconfiguration, not something to follow.
        instanceFollowRedirects = false
        useCaches = false
        setRequestProperty("Accept", "application/json")
        setRequestProperty(FrakSdkVersion.HEADER_NAME, FrakSdkVersion.CURRENT)

        val status = responseCode
        // Error bodies (carrying our `code` field) are on errorStream, not inputStream.
        // Always drained fully — a half-read stream poisons the pooled connection.
        val stream = if (status in 200..399) inputStream else errorStream
        val body = stream?.use { it.readBytes().toString(Charsets.UTF_8) }.orEmpty()
        return Response(status, body, retryAfterSeconds())
    }

    /**
     * `Retry-After` in seconds, clamped, or null. Only the delta-seconds form is
     * parsed — the limiter that sets this header always emits one.
     */
    private fun HttpURLConnection.retryAfterSeconds(): Long? =
        getHeaderField("Retry-After")
            ?.trim()
            ?.toLongOrNull()
            ?.coerceIn(1L, MAX_RETRY_AFTER_SECONDS)

    /** Builds the request URL. Values are percent-encoded; keys are compile-time constants and are not. */
    private fun buildUrl(
        path: String,
        query: Map<String, String?>,
    ): String {
        val present = query.mapNotNull { (key, value) -> value?.let { key to it } }
        if (present.isEmpty()) return baseUrl + path
        return present.joinToString(separator = "&", prefix = "$baseUrl$path?") { (key, value) ->
            "$key=${percentEncode(value)}"
        }
    }

    /**
     * Percent-encodes a query value per RFC 3986. Not `URLEncoder.encode`, which
     * implements `application/x-www-form-urlencoded` and turns a space into `+`,
     * wrong for a query string.
     */
    private fun percentEncode(value: String): String =
        buildString(value.length) {
            for (byte in value.toByteArray(Charsets.UTF_8)) {
                val code = byte.toInt() and 0xFF
                val char = code.toChar()
                val isUnreserved = char in 'A'..'Z' || char in 'a'..'z' || char in '0'..'9' || char in "-._~"
                if (isUnreserved) {
                    append(char)
                } else {
                    append('%').append(HEX[code shr 4]).append(HEX[code and 0xF])
                }
            }
        }

    companion object {
        /**
         * The generic non-2xx mapping: status, backend error code (if any), and Retry-After.
         * Callers with a route-specific status (e.g. a 404 meaning something particular) map
         * that status themselves and fall back to this for everything else.
         */
        fun Response.toServerError(): FrakError.Server =
            FrakError.Server(status, JsonReader.errorCodeOrNull(body), retryAfterSeconds)

        /** LTE radio attach alone can take ~2s, so 10s to connect is not generous. */
        const val CONNECT_TIMEOUT_MILLIS: Int = 10_000
        const val READ_TIMEOUT_MILLIS: Int = 15_000

        /** Wall-clock ceiling for a whole request; readTimeout alone only bounds each read. */
        const val OVERALL_DEADLINE_MILLIS: Long = 20_000

        /** 5 minutes: long enough for any real rate limit, short enough to recover from a bad header. */
        const val MAX_RETRY_AFTER_SECONDS: Long = 300

        private const val HEX = "0123456789ABCDEF"
    }
}
