package id.frak.sdk.identity

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.GeneralSecurityException
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/**
 * The keypair, in the platform keystore. Private key non-exportable (proof-of-possession), and
 * entries die with the app install.
 *
 * Untested by the JVM suite, and untestable by it: the stubbed `android.jar` throws on every
 * `android.*` call, and Robolectric ships no `AndroidKeyStore` provider. The damaged-entry
 * recovery in [load] therefore has no executed coverage on any machine short of a device.
 */
internal class AndroidKeystoreDeviceKeyStore(
    private val alias: String = KEY_ALIAS,
) : DeviceKeyStore {
    override fun loadOrCreate(): DeviceKey = load() ?: create()

    override fun delete() {
        keyStore().deleteEntry(alias)
    }

    /**
     * Null both when there is no entry and when the entry is damaged, so [loadOrCreate]'s `?:`
     * reaches [create] either way. `getKey` throws rather than returning null for an entry an OS
     * upgrade left unreadable, and that throw used to escape [loadOrCreate] — leaving the install
     * with no identity for its lifetime and the poisoned entry still in place.
     *
     * Opening the keystore is deliberately outside the `try`: a provider that will not load is
     * unavailable, not damaged, and must reach [AnonymousIdStore] as a failure to retry rather
     * than be answered by minting over the user's key. For the same reason there is no explicit
     * delete here — [create] targets the same alias, so a replacement is generated in one step
     * instead of destroying the entry first and hoping the mint that follows succeeds.
     */
    private fun load(): DeviceKey? {
        val keyStore = keyStore()
        return try {
            val privateKey = keyStore.getKey(alias, null)
            val publicKey = keyStore.getCertificate(alias)?.publicKey as? ECPublicKey
            if (privateKey == null || publicKey == null) {
                null
            } else {
                JcaDeviceKey(privateKey as java.security.PrivateKey, publicKey)
            }
        } catch (damaged: GeneralSecurityException) {
            null
        }
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
