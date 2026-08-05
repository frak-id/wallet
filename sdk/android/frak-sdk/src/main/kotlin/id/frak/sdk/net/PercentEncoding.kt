package id.frak.sdk.net

/**
 * RFC 3986 percent-encoding for a single query-string value. Not `java.net.URLEncoder` (form
 * encoding turns space into `+`), not `android.net.Uri.encode` (throws on the unit-test classpath).
 * Public only because `:frak-sdk-ui` needs it; not part of the merchant-facing surface.
 */
public object PercentEncoding {
    /** Percent-encodes every byte outside RFC 3986's unreserved set. */
    public fun encode(value: String): String =
        buildString(value.length) {
            for (byte in value.toByteArray(Charsets.UTF_8)) {
                val code = byte.toInt() and 0xFF
                val char = code.toChar()
                val unreserved =
                    char in 'A'..'Z' || char in 'a'..'z' || char in '0'..'9' || char in "-._~"
                if (unreserved) {
                    append(char)
                } else {
                    append('%').append(HEX[code shr 4]).append(HEX[code and 0xF])
                }
            }
        }

    private const val HEX = "0123456789ABCDEF"
}
