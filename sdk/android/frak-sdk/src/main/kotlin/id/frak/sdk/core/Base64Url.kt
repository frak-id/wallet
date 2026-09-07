package id.frak.sdk.core

/**
 * base64url without padding, RFC 4648 §5. Hand-rolled: `android.util.Base64` throws on the
 * unit-test classpath, `java.util.Base64` needs API 26 against `minSdk 24`.
 */
internal object Base64Url {
    private const val ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

    /** Reverse lookup, -1 for anything outside the alphabet. */
    private val DECODE =
        IntArray(128) { -1 }.also { table ->
            ALPHABET.forEachIndexed { index, char -> table[char.code] = index }
        }

    fun encode(bytes: ByteArray): String {
        val out = StringBuilder((bytes.size * 4 + 2) / 3)
        var index = 0
        while (index + 2 < bytes.size) {
            val chunk =
                (bytes[index].toInt() and 0xFF shl 16) or
                    (bytes[index + 1].toInt() and 0xFF shl 8) or
                    (bytes[index + 2].toInt() and 0xFF)
            out.append(ALPHABET[chunk ushr 18 and 0x3F])
            out.append(ALPHABET[chunk ushr 12 and 0x3F])
            out.append(ALPHABET[chunk ushr 6 and 0x3F])
            out.append(ALPHABET[chunk and 0x3F])
            index += 3
        }
        // Tail: 1 byte -> 2 chars, 2 bytes -> 3 chars, no padding.
        when (bytes.size - index) {
            1 -> {
                val chunk = bytes[index].toInt() and 0xFF shl 16
                out.append(ALPHABET[chunk ushr 18 and 0x3F])
                out.append(ALPHABET[chunk ushr 12 and 0x3F])
            }

            2 -> {
                val chunk =
                    (bytes[index].toInt() and 0xFF shl 16) or
                        (bytes[index + 1].toInt() and 0xFF shl 8)
                out.append(ALPHABET[chunk ushr 18 and 0x3F])
                out.append(ALPHABET[chunk ushr 12 and 0x3F])
                out.append(ALPHABET[chunk ushr 6 and 0x3F])
            }
        }
        return out.toString()
    }

    /** Null (not throw) for anything invalid: callers parse untrusted input where that's normal. */
    fun decodeOrNull(value: String): ByteArray? {
        // A remainder of 1 char cannot terminate any valid encoding.
        if (value.length % 4 == 1) return null

        val out = ByteArray(value.length * 3 / 4)
        var accumulator = 0
        var bits = 0
        var written = 0

        for (char in value) {
            val code = char.code
            val sextet = if (code < 128) DECODE[code] else -1
            if (sextet < 0) return null
            accumulator = accumulator shl 6 or sextet
            bits += 6
            if (bits >= 8) {
                bits -= 8
                out[written++] = (accumulator ushr bits and 0xFF).toByte()
            }
        }

        // Leftover bits must be zero, or the input encoded something this decoder would drop.
        if (bits > 0 && (accumulator and ((1 shl bits) - 1)) != 0) return null
        return out
    }
}
