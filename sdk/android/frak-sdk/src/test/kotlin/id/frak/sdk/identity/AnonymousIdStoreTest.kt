package id.frak.sdk.identity

import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AnonymousIdStoreTest {
    private fun store(
        keyStore: DeviceKeyStore = FakeDeviceKeyStore(),
        values: InMemoryKeyValueStore = InMemoryKeyValueStore(),
        merchantMarker: String = MERCHANT_ID,
        trackingEnabled: Boolean = true,
    ) = AnonymousIdStore(keyStore, values, FrakLogger(FrakLogLevel.NONE, null), merchantMarker, trackingEnabled)

    @Test
    fun `derives a stable id and generates the key exactly once`() {
        val keyStore = FakeDeviceKeyStore()
        val subject = store(keyStore)

        val first = subject.anonymousId()
        assertEquals(first, subject.anonymousId())
        assertEquals(1, keyStore.creations)
        assertEquals(36, first?.length)
    }

    @Test
    fun `returns null and touches no key material when tracking is disabled`() {
        val keyStore = FakeDeviceKeyStore()
        assertNull(store(keyStore, trackingEnabled = false).anonymousId())
        assertNull(store(keyStore, trackingEnabled = false).signProof(ProofOp.Ensure, MERCHANT_ID))
        assertEquals(0, keyStore.creations)
    }

    @Test
    fun `returns null rather than an unprovable id when the platform refuses`() {
        val subject = store(FakeDeviceKeyStore(failOnCreate = true))
        assertNull(subject.anonymousId())
        assertNull(subject.signProof(ProofOp.Ensure, MERCHANT_ID))
    }

    /**
     * Pins the decision not to cache the failure. A keystore can refuse for reasons that pass —
     * it is unavailable across parts of an OS upgrade — so caching would turn a transient
     * refusal into an install that never tracks again.
     */
    @Test
    fun `a keystore that recovers gets an id, without a restart`() {
        val keyStore = FakeDeviceKeyStore(failOnCreate = true)
        val subject = store(keyStore)
        assertNull(subject.anonymousId())

        keyStore.failOnCreate = false

        assertNotNull(subject.anonymousId())
    }

    @Test
    fun `reset mints a new identity`() {
        val keyStore = FakeDeviceKeyStore()
        val subject = store(keyStore)

        val before = subject.anonymousId()
        assertTrue(subject.resetAndRead())
        assertNotEquals(before, subject.anonymousId())
        assertEquals(2, keyStore.creations)
    }

    /** Pins 4fp: a throwing keystore delete must not be mistaken for a successful rotation. */
    @Test
    fun `a keystore delete that throws leaves the identity unchanged and reports failure`() {
        val keyStore = FakeDeviceKeyStore(failOnDelete = true)
        val subject = store(keyStore)

        val before = subject.anonymousId()
        assertFalse(subject.resetAndRead())
        assertEquals(
            "the old key material is still in the keystore, so the same id is re-derived",
            before,
            subject.anonymousId(),
        )
        assertEquals(1, keyStore.creations)
    }

    @Test
    fun `regenerates when the merchant changed under an existing install`() {
        val keyStore = FakeDeviceKeyStore()
        val values = InMemoryKeyValueStore()

        val before = store(keyStore, values).anonymousId()
        val after = store(keyStore, values, merchantMarker = "other-merchant").anonymousId()

        assertNotEquals(before, after)
        assertEquals(2, keyStore.creations)
    }

    @Test
    fun `keeps the identity across restarts for the same merchant`() {
        val keyStore = FakeDeviceKeyStore()
        val values = InMemoryKeyValueStore()

        assertEquals(store(keyStore, values).anonymousId(), store(keyStore, values).anonymousId())
        assertEquals(1, keyStore.creations)
    }

    @Test
    fun `signs a proof the id can be checked against`() {
        val subject = store()
        val proof = subject.signProof(ProofOp.Ensure, MERCHANT_ID, ts = 1_700_000_000)

        // 138 raw bytes, unpadded base64url.
        assertEquals(184, proof?.length)
    }

    private fun AnonymousIdStore.resetAndRead(): Boolean {
        val erased = reset()
        anonymousId()
        return erased
    }

    private companion object {
        const val MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
    }
}
