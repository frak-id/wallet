package id.frak.sdk.identity

import id.frak.sdk.config.KeyValueStore
import id.frak.sdk.core.FrakLogger
import java.security.MessageDigest

/**
 * One P-256 keypair per app installation, and the id derived from it:
 * `clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])`.
 *
 * The key is the identity; the id is never read back from storage, only re-derived from the key
 * and memoised. No unprovable fallback: when the platform can't produce key material,
 * [anonymousId] is null (not a random unsigned id) and the SDK behaves as if tracking were off.
 */
internal class AnonymousIdStore(
    private val keyStore: DeviceKeyStore,
    private val store: KeyValueStore,
    private val logger: FrakLogger,
    /** Whatever identifies this merchant in `FrakConfig` — its id when set, its package id otherwise. */
    private val merchantMarker: String,
    private val trackingEnabled: Boolean,
) {
    private class Identity(
        val key: DeviceKey,
        val id: String,
    )

    @Volatile
    private var identity: Identity? = null

    /** First call touches storage; [id.frak.sdk.Frak.initialize] warms it off the main thread. */
    fun anonymousId(): String? = current()?.id

    /** Never throws; callers must treat proofs as always-optional. */
    fun signProof(
        op: ProofOp,
        merchantId: String,
        binding: ByteArray = ByteArray(0),
        ts: Long = System.currentTimeMillis() / 1000,
    ): String? {
        val identity = current() ?: return null
        return try {
            val message = ProofCodec.buildMessage(op, merchantId, identity.id, binding, ts)
            ProofCodec.encodeProof(identity.key.publicKeyUncompressed, ts, identity.key.sign(message))
        } catch (failure: Exception) {
            logger.warn("Could not sign a ${op.wireValue} proof", failure)
            null
        }
    }

    /** Destroys the keypair; caller is responsible for purging anything already queued under the dead id. */
    fun reset() {
        synchronized(this) {
            identity = null
            runCatching { keyStore.delete() }
                .onFailure { logger.warn("Could not destroy the identity keypair", it) }
            store.remove(MERCHANT_MARKER_KEY)
        }
    }

    private fun current(): Identity? {
        if (!trackingEnabled) return null
        identity?.let { return it }
        return synchronized(this) {
            identity ?: load()?.also { identity = it }
        }
    }

    private fun load(): Identity? =
        try {
            // Changed merchant id = different merchant; checked before the key is read so a stale key is never used.
            if (store.getString(MERCHANT_MARKER_KEY).let { it != null && it != merchantMarker }) {
                logger.info("Merchant changed for this install; regenerating the anonymous id.")
                keyStore.delete()
            }
            val key = keyStore.loadOrCreate()
            store.putString(MERCHANT_MARKER_KEY, merchantMarker)
            Identity(key, ProofCodec.deriveClientIdFromHash(sha256(key.publicKeyUncompressed)))
        } catch (failure: Exception) {
            // Keystore generation fails on some devices; losing attribution beats crashing the app.
            logger.error("Could not derive an anonymous id; tracking will be inert.", failure)
            null
        }

    private fun sha256(bytes: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(bytes)

    private companion object {
        const val MERCHANT_MARKER_KEY = "merchant"
    }
}
