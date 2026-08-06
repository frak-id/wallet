// Opted in for `PercentEncoding`, which is `@InternalFrakApi`. Per file, not module-wide, so the
// marker still applies elsewhere.
@file:OptIn(InternalFrakApi::class)

package id.frak.sdk.net

import id.frak.sdk.InternalFrakApi

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
    /** The key match is case-insensitive and the value is percent-decoded; channels mangle both. */
    fun get(key: String): String? =
        parameters
            .firstOrNull { it.first.equals(key, ignoreCase = true) }
            ?.second
            ?.let(::percentDecode)

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

        /** Tolerant by design: a malformed escape is left as written rather than dropping the value. */
        fun percentDecode(value: String): String {
            if ('%' !in value) return value
            val out = java.io.ByteArrayOutputStream(value.length)
            var index = 0
            while (index < value.length) {
                val char = value[index]
                val hex = if (char == '%' && index + 2 < value.length) value.substring(index + 1, index + 3) else null
                val byte = hex?.toIntOrNull(16)
                if (byte == null) {
                    out.write(char.code)
                    index++
                } else {
                    out.write(byte)
                    index += 3
                }
            }
            return out.toString(Charsets.UTF_8.name())
        }
    }
}
