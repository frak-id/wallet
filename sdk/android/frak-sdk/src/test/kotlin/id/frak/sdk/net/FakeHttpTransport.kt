package id.frak.sdk.net

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

internal const val FAKE_BASE_URL = "https://backend.example"

internal class RecordedRequest(
    val url: URL,
    val headers: Map<String, String>,
    val instanceFollowRedirects: Boolean,
    val useCaches: Boolean,
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

    fun respond(
        status: Int,
        body: String,
        retryAfter: String? = null,
    ) {
        this.status = status
        this.body = body
        this.retryAfter = retryAfter
        this.failure = null
    }

    fun fail(error: IOException) {
        failure = error
    }

    fun open(url: URL): HttpURLConnection = Connection(url)

    private inner class Connection(url: URL) : HttpURLConnection(url) {
        private val sent = HashMap<String, String>()

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
            requests += RecordedRequest(url, sent.toMap(), instanceFollowRedirects, useCaches)
            failure?.let { throw it }
            return status
        }

        override fun getInputStream() =
            if (status in 200..399) body.byteInputStream() else throw IOException("no input stream")

        override fun getErrorStream() = if (status in 200..399) null else body.byteInputStream()

        override fun getHeaderField(name: String): String? =
            if (name.equals("Retry-After", ignoreCase = true)) retryAfter else null
    }
}
