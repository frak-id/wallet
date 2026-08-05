package id.frak.sdk.identity

import java.security.PrivateKey
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECPoint

/** The device-held P-256 keypair the anonymous id is derived from. Interface: no off-device `AndroidKeyStore` provider. */
internal interface DeviceKey {
    /** Uncompressed public key: 65 bytes, `0x04` prefix. What the id is hashed from. */
    val publicKeyUncompressed: ByteArray

    /** ECDSA over SHA-256([message]), as a raw `r‖s` 64-byte signature. */
    fun sign(message: ByteArray): ByteArray
}

/** Creates, loads and destroys the keypair. Every method touches storage. */
internal interface DeviceKeyStore {
    /** The existing keypair, generating one on first use. */
    fun loadOrCreate(): DeviceKey

    /** Destroys the keypair. The next [loadOrCreate] mints a fresh identity. */
    fun delete()
}

/** A [DeviceKey] over standard JCA: `Signature.getInstance` routes to the keystore provider automatically. */
internal class JcaDeviceKey(
    private val privateKey: PrivateKey,
    publicKey: ECPublicKey,
) : DeviceKey {
    override val publicKeyUncompressed: ByteArray = encodePoint(publicKey.w)

    override fun sign(message: ByteArray): ByteArray {
        val signature = Signature.getInstance(SIGNATURE_ALGORITHM)
        signature.initSign(privateKey)
        signature.update(message)
        return derToRawSignature(signature.sign())
    }

    companion object {
        const val SIGNATURE_ALGORITHM: String = "SHA256withECDSA"

        /** `0x04 ‖ X(32) ‖ Y(32)`, the SEC 1 uncompressed point encoding. */
        fun encodePoint(point: ECPoint): ByteArray {
            val out = ByteArray(ProofCodec.PUBKEY_BYTES)
            out[0] = 0x04
            writeFixedWidth(point.affineX.toByteArray(), out, 1)
            writeFixedWidth(point.affineY.toByteArray(), out, 33)
            return out
        }

        /**
         * JCA hands back DER `SEQUENCE { INTEGER r, INTEGER s }`; wire format is the two
         * coordinates raw and fixed-width. DER integers are signed, so a high top bit adds a
         * leading `0x00` that must be stripped.
         */
        fun derToRawSignature(der: ByteArray): ByteArray {
            require(der.size >= 8 && der[0] == SEQUENCE_TAG) { "not a DER SEQUENCE" }
            var offset = 1
            val sequenceLength = der[offset++].toInt() and 0xFF
            require(sequenceLength < 0x80 && offset + sequenceLength == der.size) {
                "unexpected DER SEQUENCE length"
            }

            val out = ByteArray(ProofCodec.SIG_BYTES)
            for (coordinate in 0..1) {
                require(der[offset++] == INTEGER_TAG) { "expected a DER INTEGER" }
                val length = der[offset++].toInt() and 0xFF
                require(offset + length <= der.size) { "DER INTEGER overruns the buffer" }
                writeFixedWidth(der, offset, length, out, coordinate * 32)
                offset += length
            }
            require(offset == der.size) { "trailing bytes after the DER signature" }
            return out
        }

        private const val SEQUENCE_TAG: Byte = 0x30
        private const val INTEGER_TAG: Byte = 0x02

        /** Right-aligns a big-endian magnitude into 32 bytes, dropping DER's sign byte. */
        private fun writeFixedWidth(
            value: ByteArray,
            out: ByteArray,
            offset: Int,
        ) = writeFixedWidth(value, 0, value.size, out, offset)

        private fun writeFixedWidth(
            value: ByteArray,
            valueOffset: Int,
            valueLength: Int,
            out: ByteArray,
            offset: Int,
        ) {
            var start = valueOffset
            var length = valueLength
            while (length > 1 && value[start] == 0.toByte()) {
                start++
                length--
            }
            require(length <= 32) { "coordinate wider than 32 bytes" }
            value.copyInto(out, offset + 32 - length, start, start + length)
        }
    }
}
