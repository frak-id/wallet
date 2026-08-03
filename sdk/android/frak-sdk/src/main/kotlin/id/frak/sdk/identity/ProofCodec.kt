package id.frak.sdk.identity

import id.frak.sdk.core.Base64Url
import id.frak.sdk.core.Uuid

/** Domain-separated proof operations: a signature for one op must never verify for another. */
internal enum class ProofOp(
    val wireValue: String,
) {
    Ensure("frak-ensure-v1"),
    Install("frak-install-v1"),
    Merge("frak-merge-v1"),
}

/**
 * Frozen wire format for identity proof-of-possession, fixed-width byte copies (no JSON):
 * ```text
 * msg      := op ‖ merchantId(16) ‖ anonymousId(16) ‖ binding(32) ‖ ts(8)
 * envelope := v(1) ‖ pk(65) ‖ ts(8) ‖ sig(64)
 * proof    := base64url(envelope), unpadded
 * ```
 * UUIDs signed as raw 16 bytes, never the 36-char text form.
 */
internal object ProofCodec {
    const val ENVELOPE_VERSION: Int = 1

    const val UUID_BYTES: Int = 16
    const val BINDING_BYTES: Int = 32
    const val TS_BYTES: Int = 8

    /** `0x04` prefix plus two 32-byte coordinates. */
    const val PUBKEY_BYTES: Int = 65

    /** Raw `r‖s` ECDSA; low-S normalisation not guaranteed. */
    const val SIG_BYTES: Int = 64

    /** Parses (not lowercases) so signed bytes never depend on the caller's case formatting. */
    fun uuidToBytes(
        value: String,
        label: String,
    ): ByteArray = Uuid.toBytes(value, label)

    /** Formats 16 raw bytes as a lowercase hyphenated UUID. */
    fun bytesToUuid(
        bytes: ByteArray,
        offset: Int = 0,
    ): String = Uuid.fromBytes(bytes, offset)

    /** First 16 bytes of the SHA-256 digest, RFC-4122 version/variant bits overwritten. */
    fun deriveClientIdFromHash(hash: ByteArray): String {
        require(hash.size >= UUID_BYTES) {
            "deriveClientIdFromHash requires at least $UUID_BYTES bytes, got ${hash.size}"
        }
        val bytes = hash.copyOf(UUID_BYTES)
        bytes[6] = ((bytes[6].toInt() and 0x0F) or 0x40).toByte()
        bytes[8] = ((bytes[8].toInt() and 0x3F) or 0x80).toByte()
        return bytesToUuid(bytes)
    }

    /** [binding] must be empty (written as 32 zero bytes) or exactly [BINDING_BYTES]. */
    fun buildMessage(
        op: ProofOp,
        merchantId: String,
        anonymousId: String,
        binding: ByteArray,
        ts: Long,
    ): ByteArray {
        require(binding.isEmpty() || binding.size == BINDING_BYTES) {
            "binding must be empty or $BINDING_BYTES bytes, got ${binding.size}"
        }

        val opBytes = op.wireValue.toByteArray(Charsets.US_ASCII)
        val out = ByteArray(opBytes.size + UUID_BYTES * 2 + BINDING_BYTES + TS_BYTES)

        var offset = 0
        opBytes.copyInto(out, offset)
        offset += opBytes.size
        uuidToBytes(merchantId, "merchantId").copyInto(out, offset)
        offset += UUID_BYTES
        uuidToBytes(anonymousId, "anonymousId").copyInto(out, offset)
        offset += UUID_BYTES
        binding.copyInto(out, offset)
        offset += BINDING_BYTES
        writeUint64Be(out, offset, ts)

        return out
    }

    fun encodeProof(
        publicKey: ByteArray,
        ts: Long,
        signature: ByteArray,
    ): String {
        require(publicKey.size == PUBKEY_BYTES) { "pk must be $PUBKEY_BYTES bytes, got ${publicKey.size}" }
        require(signature.size == SIG_BYTES) { "sig must be $SIG_BYTES bytes, got ${signature.size}" }

        val out = ByteArray(1 + PUBKEY_BYTES + TS_BYTES + SIG_BYTES)
        out[0] = ENVELOPE_VERSION.toByte()
        publicKey.copyInto(out, 1)
        writeUint64Be(out, 1 + PUBKEY_BYTES, ts)
        signature.copyInto(out, 1 + PUBKEY_BYTES + TS_BYTES)
        return Base64Url.encode(out)
    }

    private fun writeUint64Be(
        target: ByteArray,
        offset: Int,
        value: Long,
    ) {
        require(value >= 0) { "ts must be a non-negative integer: $value" }
        for (index in 0 until TS_BYTES) {
            target[offset + index] = (value ushr ((TS_BYTES - 1 - index) * 8) and 0xFF).toByte()
        }
    }
}
