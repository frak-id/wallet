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
        val url = URL(buildUrl(path, query))
        // Deadline wraps both attempts, else the retry would get its own fresh window.
        return withDeadline {
            try {
                attempt(url, headers, null)
            } catch (retryable: IOException) {
                // One retry: a pooled connection closed server-side while idle fails on next use
                // indistinguishably from a real failure. Safe only because this is GET-only.
                try {
                    attempt(url, headers, null)
                } catch (failed: IOException) {
                    failed.addSuppressed(retryable)
                    throw FrakError.Network(failed)
                }
            }
        }
    }

    /** No retry, unlike [get]: the transport can't tell whether the request was read before dying. */
    suspend fun post(
        path: String,
        body: String,
        headers: Map<String, String> = emptyMap(),
    ): Response {
        val url = URL(baseUrl + path)
        return withDeadline {
            try {
                attempt(url, headers, body)
            } catch (failed: IOException) {
                throw FrakError.Network(failed)
            }
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
        // Error bodies are on errorStream, not inputStream. Drained fully or the pooled connection is poisoned.
        val stream = if (status in 200..399) inputStream else errorStream
        val responseBody = stream?.use { it.readBytes().toString(Charsets.UTF_8) }.orEmpty()
        return Response(status, responseBody, retryAfterSeconds())
    }

    /** Only the delta-seconds form is parsed; the limiter always emits one. */
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
            "$key=${PercentEncoding.encode(value)}"
        }
    }

    companion object {
        /** Generic non-2xx mapping; callers with a route-specific status map that themselves first. */
        fun Response.toServerError(): FrakError.Server =
            FrakError.Server(status, JsonReader.errorCodeOrNull(body), retryAfterSeconds)

        /** LTE radio attach alone can take ~2s, so 10s to connect is not generous. */
        const val CONNECT_TIMEOUT_MILLIS: Int = 10_000
        const val READ_TIMEOUT_MILLIS: Int = 15_000

        /** Wall-clock ceiling for a whole request; readTimeout alone only bounds each read. */
        const val OVERALL_DEADLINE_MILLIS: Long = 20_000

        /** 5 minutes: long enough for any real rate limit, short enough to recover from a bad header. */
        const val MAX_RETRY_AFTER_SECONDS: Long = 300
    }
}
