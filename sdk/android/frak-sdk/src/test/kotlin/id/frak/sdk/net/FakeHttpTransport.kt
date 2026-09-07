package id.frak.sdk.net

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

internal const val FAKE_BASE_URL = "https://backend.example"

internal class RecordedRequest(
    val url: URL,
    val method: String,
    val headers: Map<String, String>,
    val instanceFollowRedirects: Boolean,
    val useCaches: Boolean,
    val body: String?,
)

/**
 * A fake [HttpURLConnection] behind [HttpClient]'s `open: (URL) -> HttpURLConnection` seam, so the
 * real status dispatch, header handling and stream selection stay under test — only the socket is
 * replaced.
 */
internal class FakeHttpTransport {
    val requests = mutableListOf<RecordedRequest>()

    private var status = 200
    private var body = ""
    private var retryAfter: String? = null
    private var failure: IOException? = null
    private var declaredContentLength: Long? = null

    /** Scripted statuses, consumed one per request; the last one repeats. */
    private var statuses = ArrayDeque<Int>()

    fun respond(
        status: Int,
        body: String,
        retryAfter: String? = null,
        /** Null means "derive it from [body]", the truthful default. Set explicitly to simulate a
         *  lying or absent Content-Length header without actually allocating an oversized body. */
        declaredContentLength: Long? = null,
    ) {
        this.status = status
        this.body = body
        this.retryAfter = retryAfter
        this.failure = null
        this.declaredContentLength = declaredContentLength
    }

    /** Answers each request with the next status, repeating the last once exhausted. */
    fun respondEach(vararg statuses: Int) {
        this.statuses = ArrayDeque(statuses.toList())
        this.body = ""
        this.failure = null
        this.declaredContentLength = null
    }

    fun fail(error: IOException) {
        failure = error
    }

    fun open(url: URL): HttpURLConnection = Connection(url)

    private inner class Connection(
        url: URL,
    ) : HttpURLConnection(url) {
        private val sent = HashMap<String, String>()
        private val written = java.io.ByteArrayOutputStream()

        override fun setRequestProperty(
            key: String,
            value: String?,
        ) {
            if (value != null) sent[key] = value
        }

        override fun connect() = Unit

        override fun disconnect() = Unit

        override fun usingProxy(): Boolean = false

        override fun getResponseCode(): Int {
            // instanceFollowRedirects/useCaches are protected fields on HttpURLConnection, not
            // properties with an overridable setter — only readable from inside a subclass.
            requests +=
                RecordedRequest(
                    url = url,
                    method = requestMethod,
                    headers = sent.toMap(),
                    instanceFollowRedirects = instanceFollowRedirects,
                    useCaches = useCaches,
                    body = if (doOutput) written.toString(Charsets.UTF_8.name()) else null,
                )
            failure?.let { throw it }
            if (statuses.isNotEmpty()) {
                status = if (statuses.size == 1) statuses.first() else statuses.removeFirst()
            }
            return status
        }

        override fun getOutputStream() = written

        // The real HttpURLConnection throws for 204/205/304 rather than returning an empty
        // stream; they never carry a body by spec.
        override fun getInputStream() =
            when {
                status == 204 || status == 205 || status == 304 -> {
                    throw IOException("no input stream, status $status never carries a body")
                }

                status in 200..399 -> {
                    body.byteInputStream()
                }

                else -> {
                    throw IOException("no input stream")
                }
            }

        override fun getErrorStream() = if (status in 200..399) null else body.byteInputStream()

        override fun getHeaderField(name: String): String? =
            if (name.equals("Retry-After", ignoreCase = true)) retryAfter else null

        override fun getContentLengthLong(): Long =
            declaredContentLength ?: body.toByteArray(Charsets.UTF_8).size.toLong()
    }
}
