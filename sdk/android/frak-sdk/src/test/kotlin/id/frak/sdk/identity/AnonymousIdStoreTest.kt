package id.frak.sdk.identity

import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.core.FrakLogLevel
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.TrackingConsent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AnonymousIdStoreTest {
    /**
     * [AnonymousIdStore.startEagerGeneration] runs immediately, mirroring
     * [id.frak.sdk.core.DefaultFrakClient]'s `init`. `UnconfinedTestDispatcher` means the
     * `scope.launch { current() }` it starts completes eagerly rather than racing the assertions
     * below, except where a test controls timing itself.
     */
    private fun store(
        keyStore: DeviceKeyStore = FakeDeviceKeyStore(),
        values: InMemoryKeyValueStore = InMemoryKeyValueStore(),
        merchantMarker: String = MERCHANT_ID,
        trackingEnabled: Boolean = true,
    ): AnonymousIdStore {
        val dispatcher = UnconfinedTestDispatcher()
        val logger = FrakLogger(FrakLogLevel.NONE, null)
        val subject =
            AnonymousIdStore(
                keyStore,
                values,
                logger,
                merchantMarker,
                // Built over the same `values` store the identity uses, as `Frak.initialize` wires it.
                TrackingConsent(values, trackingEnabled, logger, dispatcher),
                dispatcher,
            )
        subject.startEagerGeneration(CoroutineScope(dispatcher))
        return subject
    }

    @Test
    fun `derives a stable id and generates the key exactly once`() =
        runTest {
            val keyStore = FakeDeviceKeyStore()
            val subject = store(keyStore)

            val first = subject.anonymousId()
            assertEquals(first, subject.anonymousId())
            assertEquals(1, keyStore.creations)
            assertEquals(36, first?.length)
        }

    @Test
    fun `returns null and touches no key material when tracking is disabled`() =
        runTest {
            val keyStore = FakeDeviceKeyStore()
            assertNull(store(keyStore, trackingEnabled = false).anonymousId())
            assertNull(store(keyStore, trackingEnabled = false).signProof(ProofOp.Ensure, MERCHANT_ID))
            assertEquals(0, keyStore.creations)
        }

    @Test
    fun `returns null rather than an unprovable id when the platform refuses`() =
        runTest {
            val subject = store(FakeDeviceKeyStore(failOnCreate = true))
            assertNull(subject.anonymousId())
            assertNull(subject.signProof(ProofOp.Ensure, MERCHANT_ID))
        }

    /**
     * A keystore can refuse for reasons that pass — unavailable across parts of an OS upgrade —
     * so caching the failure would turn a transient refusal into an install that never tracks
     * again.
     */
    @Test
    fun `a keystore that recovers gets an id, without a restart`() =
        runTest {
            val keyStore = FakeDeviceKeyStore(failOnCreate = true)
            val subject = store(keyStore)
            assertNull(subject.anonymousId())

            keyStore.failOnCreate = false

            assertNotNull(subject.anonymousId())
        }

    /**
     * A refusal is memoised too, but only conditionally: a recovered mint is cached exactly once
     * (one [FakeDeviceKeyStore.creations]), and the earlier failed attempt costs zero extra key
     * generations.
     */
    @Test
    fun `does not cache a transient refusal, and the eventual mint is still memoised`() =
        runTest {
            val keyStore = FakeDeviceKeyStore(failOnCreate = true)
            val subject = store(keyStore)

            assertNull(subject.anonymousId())
            assertNull(subject.anonymousId())
            assertEquals(0, keyStore.creations)

            keyStore.failOnCreate = false

            val first = subject.anonymousId()
            val second = subject.anonymousId()

            assertNotNull(first)
            assertEquals(first, second)
            assertEquals(1, keyStore.creations)
        }

    @Test
    fun `reset mints a new identity`() =
        runTest {
            val keyStore = FakeDeviceKeyStore()
            val subject = store(keyStore)

            val before = subject.anonymousId()
            assertTrue(subject.reset())
            assertNotEquals(before, subject.anonymousId())
            assertEquals(2, keyStore.creations)
        }

    /** A throwing keystore delete must not be mistaken for a successful rotation. */
    @Test
    fun `a keystore delete that throws leaves the identity unchanged and reports failure`() =
        runTest {
            val keyStore = FakeDeviceKeyStore(failOnDelete = true)
            val subject = store(keyStore)

            val before = subject.anonymousId()
            assertFalse(subject.reset())
            assertEquals(
                "the old key material is still in the keystore, so the same id is re-derived",
                before,
                subject.anonymousId(),
            )
            assertEquals(1, keyStore.creations)
        }

    @Test
    fun `regenerates when the merchant changed under an existing install`() =
        runTest {
            val keyStore = FakeDeviceKeyStore()
            val values = InMemoryKeyValueStore()

            val before = store(keyStore, values).anonymousId()
            val after = store(keyStore, values, merchantMarker = "other-merchant").anonymousId()

            assertNotEquals(before, after)
            assertEquals(2, keyStore.creations)
        }

    @Test
    fun `keeps the identity across restarts for the same merchant`() =
        runTest {
            val keyStore = FakeDeviceKeyStore()
            val values = InMemoryKeyValueStore()

            assertEquals(store(keyStore, values).anonymousId(), store(keyStore, values).anonymousId())
            assertEquals(1, keyStore.creations)
        }

    @Test
    fun `signs a proof the id can be checked against`() =
        runTest {
            val subject = store()
            val proof = subject.signProof(ProofOp.Ensure, MERCHANT_ID, ts = 1_700_000_000)

            // 138 raw bytes, unpadded base64url.
            assertEquals(184, proof?.length)
        }

    /**
     * Two callers racing [AnonymousIdStore.anonymousId] — one via eager generation, one calling
     * directly — must await the same in-flight generation rather than each re-entering
     * [FakeDeviceKeyStore.loadOrCreate]. Two key generations would mean a racing caller minted a
     * second identity.
     */
    @Test
    fun `a caller racing eager generation shares it instead of minting a second identity`() =
        runTest {
            val keyStore = FakeDeviceKeyStore()
            val dispatcher = UnconfinedTestDispatcher(testScheduler)
            val values = InMemoryKeyValueStore()
            val logger = FrakLogger(FrakLogLevel.NONE, null)
            val subject =
                AnonymousIdStore(
                    keyStore,
                    values,
                    logger,
                    MERCHANT_ID,
                    TrackingConsent(values, configDefault = true, logger = logger, ioDispatcher = dispatcher),
                    dispatcher,
                )
            val scope = CoroutineScope(dispatcher)
            subject.startEagerGeneration(scope)

            // Racing the warm-up rather than after it: both resolve through the one Deferred
            // startEagerGeneration already started, never a second one of their own.
            val racer = scope.async { subject.anonymousId() }

            assertNotNull(racer.await())
            assertEquals(1, keyStore.creations)
        }

    private companion object {
        const val MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
    }
}
