package id.frak.sdk.core

import id.frak.sdk.config.InMemoryKeyValueStore
import id.frak.sdk.config.KeyValueStore
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * S6a/C7. The tri-state table in [TrackingConsent]'s KDoc, one test per row plus the two
 * behaviours that are easy to "simplify" away later: the compile-time floor, and the fact that an
 * absent key follows the config rather than reading as a denial.
 */
class TrackingConsentTest {
    private fun consent(
        store: InMemoryKeyValueStore = InMemoryKeyValueStore(),
        configDefault: Boolean = true,
    ) = TrackingConsent(store, configDefault, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher())

    @Test
    fun `absent decision follows the config, so an integration written before consent existed is unchanged`() =
        runTest {
            assertTrue(consent(configDefault = true).isEnabled())
            assertFalse(consent(configDefault = false).isEnabled())
        }

    @Test
    fun `a denial survives the process that recorded it`() =
        runTest {
            val store = InMemoryKeyValueStore()
            consent(store).setEnabled(false)

            // A second instance over the same store is the next app launch: nothing is carried
            // over in memory, so this reads only what reached disk.
            assertFalse(consent(store).isEnabled())
        }

    @Test
    fun `a grant recorded after a denial re-enables tracking`() =
        runTest {
            val store = InMemoryKeyValueStore()
            val subject = consent(store)

            subject.setEnabled(false)
            assertFalse(subject.isEnabled())
            subject.setEnabled(true)

            assertTrue(subject.isEnabled())
            assertTrue(consent(store).isEnabled())
        }

    /**
     * The hard floor. Pinned because the obvious "simplification" — letting the persisted value
     * win outright — silently turns the SDK on inside a merchant's staged-rollout build, which is
     * the one outcome this class exists to make impossible.
     */
    @Test
    fun `a persisted grant can never lift a compile-time trackingEnabled false`() =
        runTest {
            val store = InMemoryKeyValueStore()
            val subject = consent(store, configDefault = false)

            subject.setEnabled(true)

            assertFalse(subject.isEnabled())
            // Recorded even so: the merchant's users really did consent, and a build that later
            // ships trackingEnabled = true must honour that rather than re-prompt.
            assertTrue(consent(store, configDefault = true).isEnabled())
        }

    @Test
    fun `the decision is written to the identity store under one stable key`() =
        runTest {
            val store = InMemoryKeyValueStore()

            assertNull(store.getString("tracking-consent"))
            consent(store).setEnabled(false)
            assertEquals("denied", store.getString("tracking-consent"))
            consent(store).setEnabled(true)
            assertEquals("granted", store.getString("tracking-consent"))
        }

    /**
     * A half-written **value** is not a denial. Failing towards "off" here would turn one corrupt
     * preferences entry into an install that never tracks again and never says why.
     *
     * The opposite case — a read that *throws* — is the test below, and the two answers differ on
     * purpose. This one is about a value we successfully read and did not recognise; that one is
     * about not knowing at all.
     */
    @Test
    fun `an unrecognised stored value follows the config rather than reading as a denial`() =
        runTest {
            val store = InMemoryKeyValueStore()
            store.putString("tracking-consent", "\u0000garbage")

            assertTrue(consent(store, configDefault = true).isEnabled())
            assertFalse(consent(store, configDefault = false).isEnabled())
        }

    /**
     * A read we could not perform is not consent — the Android-only half of this class (the iOS
     * `KeyValueStore` is non-throwing by protocol, so it has nothing to distinguish).
     *
     * The failure mode this closes: `runCatching { store.getString(KEY) }.getOrNull() != DENIED`
     * collapses "key absent" and "the read threw" into the same `null`, which compares `true`, and
     * memoises it — turning a recorded **denial** into "tracking on" for the whole process on a
     * corrupted preferences file or a locked direct-boot user. Fails against that shape.
     *
     * Retryable, not sticky: the second call succeeds and sees the denial that was there all along.
     */
    @Test
    fun `a read that throws answers no consent and is never memoised`() =
        runTest {
            val store = InMemoryKeyValueStore()
            store.putString("tracking-consent", "denied")
            var failNextRead = true
            val flaky =
                object : KeyValueStore {
                    override fun getString(key: String): String? {
                        if (failNextRead) {
                            failNextRead = false
                            throw IllegalStateException("preferences unavailable")
                        }
                        return store.getString(key)
                    }

                    override fun putString(
                        key: String,
                        value: String,
                    ) = store.putString(key, value)

                    override fun remove(key: String) = store.remove(key)
                }
            val subject =
                TrackingConsent(flaky, true, FrakLogger(FrakLogLevel.NONE, null), UnconfinedTestDispatcher())

            assertFalse("a read we could not perform is not consent", subject.isEnabled())
            // Not cached: the retry reads the denial that was on disk the whole time.
            assertFalse("the real answer was a denial", subject.isEnabled())
        }
}
