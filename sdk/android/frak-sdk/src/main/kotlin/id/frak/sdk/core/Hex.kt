package id.frak.sdk.core

/**
 * Lowercase hex, both directions. Shared by the identity proof layout ([id.frak.sdk.identity.ProofCodec])
 * and the FrakContext v2 codec ([id.frak.sdk.sharing.FrakContextCodec]). Mirrors iOS's `Hex.swift`.
 * UUID formatting built on top of this lives in [Uuid], not here or in either codec.
 */
internal object Hex {
    private const val DIGITS = "0123456789abcdef"

    fun encode(
        bytes: ByteArray,
        offset: Int = 0,
        length: Int = bytes.size - offset,
    ): String {
        val out = StringBuilder(length * 2)
        for (index in 0 until length) {
            val byte = bytes[offset + index].toInt() and 0xFF
            out.append(DIGITS[byte ushr 4]).append(DIGITS[byte and 0xF])
        }
        return out.toString()
    }

    /** Null on an odd length or any non-hex character; never throws. */
    fun decodeOrNull(value: String): ByteArray? {
        if (value.length % 2 != 0) return null
        val out = ByteArray(value.length / 2)
        for (index in out.indices) {
            val high = nibble(value[index * 2]) ?: return null
            val low = nibble(value[index * 2 + 1]) ?: return null
            out[index] = ((high shl 4) or low).toByte()
        }
        return out
    }

    /** Writes [hex] (already validated even-length hex) into [out] at [offset]. */
    fun writeInto(
        hex: String,
        out: ByteArray,
        offset: Int,
    ) {
        for (index in 0 until hex.length / 2) {
            out[offset + index] = hex.substring(index * 2, index * 2 + 2).toInt(16).toByte()
        }
    }

    fun nibble(char: Char): Int? =
        when (char) {
            in '0'..'9' -> char - '0'
            in 'a'..'f' -> char - 'a' + 10
            in 'A'..'F' -> char - 'A' + 10
            else -> null
        }
}
