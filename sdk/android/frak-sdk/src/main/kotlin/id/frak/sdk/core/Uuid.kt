package id.frak.sdk.core

/**
 * UUID <-> raw-16-bytes, shared by two independent frozen wire formats that both read and emit
 * UUIDs as raw bytes rather than the 36-char text form: the identity proof envelope
 * ([id.frak.sdk.identity.ProofCodec], `golden-identity-proofs.json`) and the FrakContext v2 codec
 * ([id.frak.sdk.sharing.FrakContextCodec], `golden-context.json`). Kept in `core`, alongside
 * [Hex], rather than in either codec, so neither format depends on the other's module — a change
 * to one's UUID handling must not silently reshape the other (5.6/8.6). Mirrors iOS, where
 * `Core/Hex.swift` is the only thing both Swift codecs share and neither imports the other.
 */
internal object Uuid {
    const val BYTES: Int = 16

    val REGEX = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

    /** Parses (not lowercases) so signed/encoded bytes never depend on the caller's case formatting. */
    fun toBytes(
        value: String,
        label: String,
    ): ByteArray {
        require(REGEX.matches(value)) { "$label must be a UUID string, got: $value" }
        return requireNotNull(Hex.decodeOrNull(value.replace("-", ""))) {
            "$label matched Uuid.REGEX but failed to decode as hex: $value"
        }
    }

    /** Formats 16 raw bytes as a lowercase hyphenated UUID. */
    fun fromBytes(
        bytes: ByteArray,
        offset: Int = 0,
    ): String {
        val hex = Hex.encode(bytes, offset, BYTES)
        return "${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-" +
            "${hex.substring(16, 20)}-${hex.substring(20, 32)}"
    }
}
