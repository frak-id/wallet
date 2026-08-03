package id.frak.sdk.sharing

import id.frak.sdk.core.Base64Url
import id.frak.sdk.core.Hex
import id.frak.sdk.core.Uuid

/**
 * The `fCtx` binary codec.
 * ```text
 * byte  0        header: bits0-3 version(=2), bit4 has_c, bit5 has_w, bits6-7 reserved(=0)
 * bytes 1..16    merchant UUID   (16 bytes, mandatory)
 * bytes 17..20   timestamp       (uint32 BIG-endian, unix seconds)
 * bytes 21..36   client UUID     (16 bytes, if has_c)
 * bytes 37..56   wallet address  (20 bytes, if has_w)
 * ```
 * Sizes are 37/41/57, and V1 is exactly 20 bytes, so the two layouts are disambiguated purely
 * on decoded length. Nothing throws; every entry point returns null for unparseable input.
 */
internal object FrakContextCodec {
    private const val VERSION_V2 = 0x02
    private const val VERSION_MASK = 0x0F
    private const val FLAG_HAS_C = 1 shl 4
    private const val FLAG_HAS_W = 1 shl 5
    private const val RESERVED_MASK = 0xC0

    private const val HEADER_BYTES = 1
    private const val UUID_BYTES = 16
    private const val TIMESTAMP_BYTES = 4
    private const val ADDRESS_BYTES = 20

    private const val V1_BYTES = ADDRESS_BYTES

    private const val MAX_TIMESTAMP = 0xFFFF_FFFFL

    // Shared with the identity proof layout (5.6/8.6) via core.Uuid: both codecs read/write raw
    // UUID bytes, but neither codec depends on the other — see core/Uuid.kt.
    private val UUID_REGEX = Uuid.REGEX

    /** Shape only, no EIP-55 checksum: every consumer treats addresses case-insensitively. */
    private val ADDRESS_REGEX = Regex("^0x[0-9a-fA-F]{40}$")

    /** Encodes to the wire bytes, or null when the context cannot be represented. */
    fun encode(context: FrakContext.V2): ByteArray? {
        if (!UUID_REGEX.matches(context.merchantId)) return null
        if (context.timestamp < 0 || context.timestamp > MAX_TIMESTAMP) return null

        val clientId = context.clientId?.takeIf { it.isNotEmpty() }
        val wallet = context.wallet?.takeIf { ADDRESS_REGEX.matches(it) }
        if (clientId == null && wallet == null) return null
        if (clientId != null && !UUID_REGEX.matches(clientId)) return null

        val out =
            ByteArray(
                HEADER_BYTES + UUID_BYTES + TIMESTAMP_BYTES +
                    (if (clientId != null) UUID_BYTES else 0) +
                    (if (wallet != null) ADDRESS_BYTES else 0),
            )

        var offset = 0
        out[offset++] =
            (
                VERSION_V2 or
                    (if (clientId != null) FLAG_HAS_C else 0) or
                    (if (wallet != null) FLAG_HAS_W else 0)
            ).toByte()

        Hex.writeInto(context.merchantId.replace("-", ""), out, offset)
        offset += UUID_BYTES

        for (index in 0 until TIMESTAMP_BYTES) {
            out[offset + index] = (context.timestamp ushr ((TIMESTAMP_BYTES - 1 - index) * 8) and 0xFF).toByte()
        }
        offset += TIMESTAMP_BYTES

        if (clientId != null) {
            Hex.writeInto(clientId.replace("-", ""), out, offset)
            offset += UUID_BYTES
        }
        if (wallet != null) {
            Hex.writeInto(wallet.substring(2), out, offset)
        }

        return out
    }

    /** Decodes wire bytes, or null when they are not a well-formed V2 payload. */
    fun decode(bytes: ByteArray): FrakContext.V2? {
        if (bytes.size < HEADER_BYTES + UUID_BYTES + TIMESTAMP_BYTES) return null

        val header = bytes[0].toInt() and 0xFF
        if (header and VERSION_MASK != VERSION_V2) return null
        // Refusing reserved bits stops a future version being read with this version's offsets.
        if (header and RESERVED_MASK != 0) return null

        val hasClient = header and FLAG_HAS_C != 0
        val hasWallet = header and FLAG_HAS_W != 0
        if (!hasClient && !hasWallet) return null

        val expected =
            HEADER_BYTES + UUID_BYTES + TIMESTAMP_BYTES +
                (if (hasClient) UUID_BYTES else 0) +
                (if (hasWallet) ADDRESS_BYTES else 0)
        if (bytes.size != expected) return null

        var offset = HEADER_BYTES
        val merchantId = readUuid(bytes, offset)
        offset += UUID_BYTES

        var timestamp = 0L
        for (index in 0 until TIMESTAMP_BYTES) {
            timestamp = timestamp shl 8 or (bytes[offset + index].toLong() and 0xFF)
        }
        offset += TIMESTAMP_BYTES

        var clientId: String? = null
        if (hasClient) {
            clientId = readUuid(bytes, offset)
            offset += UUID_BYTES
        }

        var wallet: String? = null
        if (hasWallet) {
            wallet = "0x" + Hex.encode(bytes, offset, ADDRESS_BYTES)
        }

        return FrakContext.V2(merchantId, timestamp, clientId, wallet)
    }

    /** The `fCtx` value for a context, or null when it cannot be encoded. */
    fun compress(context: FrakContext.V2): String? = encode(context)?.let(Base64Url::encode)

    /** V1 is recognised purely by its 20-byte decoded length; every other length goes to V2. */
    fun decompress(value: String): FrakContext? {
        if (value.isEmpty()) return null
        val bytes = Base64Url.decodeOrNull(value) ?: return null
        if (bytes.size == V1_BYTES) return FrakContext.V1("0x" + Hex.encode(bytes, 0, ADDRESS_BYTES))
        return decode(bytes)
    }

    // Shared with the identity proof layout (5.6/8.6) via core.Uuid: both codecs format the same
    // 16 raw bytes as a lowercase hyphenated UUID, but neither codec depends on the other.
    private fun readUuid(
        bytes: ByteArray,
        offset: Int,
    ): String = Uuid.fromBytes(bytes, offset)
}
