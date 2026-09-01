// Opted in for `PercentEncoding`, which is `@InternalFrakApi`. Per file, not module-wide, so the
// marker still applies elsewhere.
@file:OptIn(InternalFrakApi::class)

package id.frak.sdk.net

import id.frak.sdk.InternalFrakApi
import id.frak.sdk.core.Hex

/**
 * Minimal query-string editing over a URL string. Not `android.net.Uri` (throws on the JVM
 * unit-test classpath) and not `java.net.URI` (re-encodes what is already encoded). Existing
 * parameters are never re-encoded, so links a merchant has already published are unchanged.
 */
internal class UrlQuery private constructor(
    private val base: String,
    private val fragment: String,
    private val parameters: MutableList<Pair<String, String>>,
) {
    /**
     * The value is percent-decoded, and the key match falls back to case-insensitive because
     * channels mangle casing — but an exact match wins, so `?fctx=stale&fCtx=real` resolves to
     * `real`, as `sdk/core/src/utils/url/queryParams.ts` does.
     */
    fun get(key: String): String? =
        (
            parameters.firstOrNull { it.first == key }
                ?: parameters.firstOrNull { it.first.equals(key, ignoreCase = true) }
        )?.second
            ?.let(::percentDecode)

    /**
     * Exact-key lookup, for parameters the web client reads through `URLSearchParams.get`. `fCtx`
     * tolerates mangled casing; `fmt` authorises an identity merge, so it matches web or not at all.
     */
    fun getExact(key: String): String? = parameters.firstOrNull { it.first == key }?.second?.let(::percentDecode)

    fun remove(key: String): UrlQuery =
        apply {
            parameters.removeAll { it.first.equals(key, ignoreCase = true) }
        }

    /** Gap-fill: a merchant's own value always wins. */
    fun fillIfAbsent(
        key: String,
        value: String?,
    ): UrlQuery =
        apply {
            if (value.isNullOrEmpty()) return@apply
            if (get(key) != null) return@apply
            parameters += key to PercentEncoding.encode(value)
        }

    fun set(
        key: String,
        value: String,
    ): UrlQuery =
        apply {
            remove(key)
            parameters += key to PercentEncoding.encode(value)
        }

    override fun toString(): String =
        buildString {
            append(base)
            parameters.forEachIndexed { index, (key, value) ->
                append(if (index == 0) '?' else '&')
                append(key)
                if (value.isNotEmpty()) append('=').append(value)
            }
            append(fragment)
        }

    companion object {
        private const val PERCENT_BYTE: Byte = '%'.code.toByte()
        private const val PLUS_BYTE: Byte = '+'.code.toByte()

        /** Null when [url] has no scheme separator — anything else is treated as an opaque base. */
        fun parse(url: String): UrlQuery? {
            if (!url.contains("://")) return null

            val fragmentAt = url.indexOf('#')
            val fragment = if (fragmentAt >= 0) url.substring(fragmentAt) else ""
            val withoutFragment = if (fragmentAt >= 0) url.substring(0, fragmentAt) else url

            val queryAt = withoutFragment.indexOf('?')
            val base = if (queryAt >= 0) withoutFragment.substring(0, queryAt) else withoutFragment
            val query = if (queryAt >= 0) withoutFragment.substring(queryAt + 1) else ""

            val parameters =
                query
                    .split('&')
                    .filter { it.isNotEmpty() }
                    .map {
                        val separator = it.indexOf('=')
                        if (separator < 0) it to "" else it.substring(0, separator) to it.substring(separator + 1)
                    }.toMutableList()

            return UrlQuery(base, fragment, parameters)
        }

        /**
         * Tolerant by design: a malformed escape is left as written rather than dropping the value.
         * Decodes over UTF-8 bytes, so a non-ASCII character alongside an escape survives verbatim,
         * and `+` decodes to a space as `URLSearchParams` does on the web.
         */
        fun percentDecode(value: String): String {
            if ('%' !in value && '+' !in value) return value
            val bytes = value.toByteArray(Charsets.UTF_8)
            val out = java.io.ByteArrayOutputStream(bytes.size)
            var index = 0
            while (index < bytes.size) {
                val byte = bytes[index]
                val decoded =
                    if (byte == PERCENT_BYTE && index + 2 < bytes.size) {
                        hexByte(bytes[index + 1], bytes[index + 2])
                    } else {
                        null
                    }
                when {
                    decoded != null -> {
                        out.write(decoded)
                        index += 3
                    }

                    byte == PLUS_BYTE -> {
                        out.write(' '.code)
                        index++
                    }

                    else -> {
                        out.write(byte.toInt())
                        index++
                    }
                }
            }
            return out.toString(Charsets.UTF_8.name())
        }

        /** Null unless both bytes are ASCII hex digits: a `toIntOrNull(16)` here accepts a sign, so `%-1` decoded to `0xFF`. */
        private fun hexByte(
            high: Byte,
            low: Byte,
        ): Int? {
            val highNibble = Hex.nibble(high.toInt().toChar()) ?: return null
            val lowNibble = Hex.nibble(low.toInt().toChar()) ?: return null
            return (highNibble shl 4) or lowNibble
        }
    }
}
