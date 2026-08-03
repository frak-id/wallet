package id.frak.sdk.identity

import java.security.GeneralSecurityException

/** [DeviceKeyStore] over a real JDK-generated P-256 key, standing in for off-device `AndroidKeyStore`. */
internal class FakeDeviceKeyStore(
    var failOnCreate: Boolean = false,
    var failOnDelete: Boolean = false,
) : DeviceKeyStore {
    /** How many keypairs have been minted, so a test can pin regeneration. */
    var creations: Int = 0
        private set

    private var key: DeviceKey? = null

    override fun loadOrCreate(): DeviceKey {
        if (failOnCreate) throw GeneralSecurityException("keystore unavailable")
        return key ?: TestKeys.generate().also {
            key = it
            creations++
        }
    }

    override fun delete() {
        if (failOnDelete) throw GeneralSecurityException("keystore delete unavailable")
        key = null
    }
}
