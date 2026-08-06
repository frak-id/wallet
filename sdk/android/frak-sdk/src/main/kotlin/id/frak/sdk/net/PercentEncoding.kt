package id.frak.sdk.net

import id.frak.sdk.InternalFrakApi

/**
 * RFC 3986 percent-encoding for a single query-string value. Not `java.net.URLEncoder` (form
 * encoding turns space into `+`), not `android.net.Uri.encode` (throws on the unit-test classpath).
 *
 * `public` only because `:frak-sdk-ui` builds the sharing/install URLs and `internal` does not
 * cross a module boundary. [InternalFrakApi] says so in a form the compiler honours: a Kotlin
 * merchant naming this gets an error. It is also what keeps it out of the `.api` dump, through
 * `nonPublicMarkers` — and this is the only type carrying the marker, so the first `apiDump` is what
 * proves that half works at all. See [InternalFrakApi]. There is nothing here a merchant would want
 * anyway; this is the one type in the SDK that is purely a module-boundary artefact.
 */
@InternalFrakApi
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
