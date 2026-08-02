package id.frak.sdk.identity

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/**
 * The keypair, in the platform keystore. Private key non-exportable (proof-of-possession), and
 * entries die with the app install. Untested by the JVM suite (no off-device provider); logic
 * lives in [JcaDeviceKey]/[ProofCodec] instead, this class is only generation and lookup.
 */
internal class AndroidKeystoreDeviceKeyStore(
    private val alias: String = KEY_ALIAS,
) : DeviceKeyStore {
    override fun loadOrCreate(): DeviceKey = load() ?: create()

    override fun delete() {
        keyStore().deleteEntry(alias)
    }

    private fun load(): DeviceKey? {
        val keyStore = keyStore()
        val privateKey = keyStore.getKey(alias, null) ?: return null
        val publicKey = keyStore.getCertificate(alias)?.publicKey as? ECPublicKey ?: return null
        return JcaDeviceKey(privateKey as java.security.PrivateKey, publicKey)
    }

    private fun create(): DeviceKey {
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVIDER)
        generator.initialize(
            KeyGenParameterSpec
                .Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec(CURVE))
                .setDigests(KeyProperties.DIGEST_SHA256)
                // No setUserAuthenticationRequired: id is used on background paths with no user present.
                .build(),
        )
        val pair = generator.generateKeyPair()
        return JcaDeviceKey(pair.private, pair.public as ECPublicKey)
    }

    private fun keyStore(): KeyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }

    companion object {
        private const val PROVIDER = "AndroidKeyStore"
        private const val CURVE = "secp256r1"

        private const val KEY_ALIAS = "id.frak.sdk.identity"
    }
}
