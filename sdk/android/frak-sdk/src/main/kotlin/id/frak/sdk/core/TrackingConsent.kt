package id.frak.sdk.core

import id.frak.sdk.config.KeyValueStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Whether the SDK may mint an identity and talk to the backend: a persisted runtime decision
 * layered over the build-time [FrakConfig.trackingEnabled] floor, which no grant can lift.
 * Stored in the identity [KeyValueStore], not the config cache, which can be dropped at any time.
 */
internal class TrackingConsent(
    private val store: KeyValueStore,
    /** [FrakConfig.trackingEnabled]. A `false` here can never be lifted by a persisted grant. */
    private val configDefault: Boolean,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher,
) {
    private val mutex = Mutex()

    /** Persisted decision once read. `@Volatile`: the fast path below reads it outside [mutex]. */
    @Volatile
    private var persisted: Boolean? = null

    /** Never throws: an unreadable store degrades to the [configDefault], not to an exception. */
    suspend fun isEnabled(): Boolean {
        if (!configDefault) return false
        persisted?.let { return it }
        return mutex.withLock {
            persisted ?: withContext(ioDispatcher) {
                // Absent means "not decided", so follow [configDefault] and memoise; a failed read
                // answers false without memoising, so it is never treated as consent.
                val stored =
                    try {
                        Stored(store.getString(KEY))
                    } catch (cancelled: CancellationException) {
                        // Never swallowed; the catch below is deliberately broad.
                        throw cancelled
                    } catch (unreadable: Exception) {
                        logger.error(
                            "Could not read the tracking consent decision; treating this call as no consent",
                            unreadable,
                        )
                        null
                    }
                if (stored == null) {
                    false
                } else {
                    val enabled = stored.value != DENIED
                    persisted = enabled
                    enabled
                }
            }
        }
    }

    /** Distinguishes "read returned null (absent)" from "read failed", which a bare `String?` cannot. */
    private class Stored(
        val value: String?,
    )

    /**
     * Records the decision; the caller owns the side effects. The memo updates even if the write
     * fails, so the in-process answer changes the moment the user says no.
     */
    suspend fun setEnabled(enabled: Boolean) {
        mutex.withLock {
            withContext(ioDispatcher) {
                try {
                    store.putString(KEY, if (enabled) GRANTED else DENIED)
                } catch (cancelled: CancellationException) {
                    throw cancelled // Never swallowed; see [isEnabled]'s twin of this catch.
                } catch (unwritable: Exception) {
                    logger.error("Could not persist the tracking consent decision", unwritable)
                }
            }
            persisted = enabled
        }
        if (enabled && !configDefault) {
            logger.warn(
                "setTrackingEnabled(true) was recorded but has no effect: this build ships " +
                    "FrakConfig.Builder(...).trackingEnabled(false), which the SDK treats as a hard floor.",
            )
        }
    }

    private companion object {
        const val KEY = "tracking-consent"
        const val GRANTED = "granted"
        const val DENIED = "denied"
    }
}
