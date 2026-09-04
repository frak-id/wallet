package id.frak.sdk.identity

import java.math.BigInteger
import java.security.AlgorithmParameters
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.PublicKey
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec

/**
 * Real P-256 key material for the JVM suite, from the JDK's own provider.
 *
 * `AndroidKeyStore` does not exist off-device, so [AndroidKeystoreDeviceKeyStore]
 * cannot be exercised here — which is exactly why it holds no logic. Everything
 * it would delegate to lives in [JcaDeviceKey] and [ProofCodec] and is covered
 * against the same interfaces the platform provider implements.
 */
internal object TestKeys {
    private val CURVE: ECParameterSpec =
        AlgorithmParameters
            .getInstance("EC")
            .apply { init(ECGenParameterSpec("secp256r1")) }
            .getParameterSpec(ECParameterSpec::class.java)

    fun generate(): DeviceKey {
        val generator = KeyPairGenerator.getInstance("EC")
        generator.initialize(ECGenParameterSpec("secp256r1"))
        val pair = generator.generateKeyPair()
        return JcaDeviceKey(pair.private, pair.public as ECPublicKey)
    }

    fun publicKeyFromUncompressed(bytes: ByteArray): PublicKey {
        require(bytes.size == ProofCodec.PUBKEY_BYTES && bytes[0] == 0x04.toByte()) {
            "expected a 65-byte uncompressed point"
        }
        val point =
            ECPoint(
                BigInteger(1, bytes.copyOfRange(1, 33)),
                BigInteger(1, bytes.copyOfRange(33, 65)),
            )
        return KeyFactory.getInstance("EC").generatePublic(ECPublicKeySpec(point, CURVE))
    }

    /** The inverse of [JcaDeviceKey.derToRawSignature] — only a verifier needs it. */
    fun rawToDerSignature(raw: ByteArray): ByteArray {
        require(raw.size == ProofCodec.SIG_BYTES) { "expected a 64-byte raw signature" }
        val r = derInteger(raw.copyOfRange(0, 32))
        val s = derInteger(raw.copyOfRange(32, 64))
        return byteArrayOf(0x30, (r.size + s.size).toByte()) + r + s
    }

    private fun derInteger(magnitude: ByteArray): ByteArray {
        val trimmed = BigInteger(1, magnitude).toByteArray()
        return byteArrayOf(0x02, trimmed.size.toByte()) + trimmed
    }

    fun hexToBytes(hex: String): ByteArray =
        ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
}
