package id.frak.sdk.net

/**
 * Minimal query-string editing over a URL string.
 *
 * Not `android.net.Uri` (throws on the JVM unit-test classpath, where this is
 * tested) and not `java.net.URI` (which offers no way to edit a query without
 * re-serialising the whole thing through a builder that re-encodes what is
 * already encoded). Only what the SDK actually needs: read, set and remove a
 * parameter, preserving everything else exactly as the merchant wrote it.
 *
 * Existing parameters are never re-encoded. A merchant's URL is theirs, and
 * normalising it would silently change links they have already published.
 */
internal class UrlQuery private constructor(
    private val base: String,
    private val fragment: String,
    private val parameters: MutableList<Pair<String, String>>,
) {
    /**
     * The decoded value at [key], or null.
     *
     * Case-insensitive on the key: some channels lowercase query keys in
     * transit, so `fCtx` can arrive as `fctx`. Percent-decoded on the value,
     * because a channel that re-encodes a link turns `-` into `%2D` and the
     * base64url payload would then fail to decode — the web reads these through
     * `URLSearchParams`, which decodes first.
     */
    fun get(key: String): String? =
        parameters
            .firstOrNull { it.first.equals(key, ignoreCase = true) }
            ?.second
            ?.let(::percentDecode)

    fun remove(key: String): UrlQuery =
        apply {
            parameters.removeAll { it.first.equals(key, ignoreCase = true) }
        }

    /** Appends [key] only when it is absent — gap-fill, so a merchant's own value always wins. */
    fun fillIfAbsent(
        key: String,
        value: String?,
    ): UrlQuery =
        apply {
            if (value.isNullOrEmpty()) return@apply
            if (get(key) != null) return@apply
            parameters += key to PercentEncoding.encode(value)
        }

    /** Replaces [key], preserving position-independent ordering by appending. */
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
