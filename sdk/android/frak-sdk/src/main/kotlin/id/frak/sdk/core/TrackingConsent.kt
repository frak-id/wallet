package id.frak.sdk.core

import id.frak.sdk.config.KeyValueStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Whether the SDK may mint an identity and talk to the backend, as a runtime decision layered
 * over the build-time [FrakConfig.trackingEnabled] floor.
 *
 * `FrakConfig.trackingEnabled = false` is a floor no persisted grant can lift: a build with
 * tracking off must never have `setTrackingEnabled(true)` silently switch it on. The grant is
 * still written to disk, so it takes effect if a later build ships with the flag on; it just
 * cannot lift the floor of the current build. [setEnabled] logs when it is called into that floor.
 *
 * Stored in the identity [KeyValueStore], not the config cache, since the config cache can be
 * thrown away at any time and a consent decision must not be.
 *
 * `suspend`, with an in-memory memo: the backing `SharedPreferences` file is opened lazily on
 * first read, and that disk I/O must not land on whichever thread a merchant called `track()` from.
 */
internal class TrackingConsent(
    private val store: KeyValueStore,
    /** [FrakConfig.trackingEnabled]. A `false` here can never be lifted by a persisted grant. */
    private val configDefault: Boolean,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher,
) {
    private val mutex = Mutex()

    /** Persisted decision once read, so only the first call touches disk. `@Volatile`: the fast path below reads it outside [mutex]. Holds the persisted state only; [configDefault] is applied on every read. */
    @Volatile
    private var persisted: Boolean? = null

    /** Never throws: an unreadable store degrades to the [configDefault], not to an exception. */
    suspend fun isEnabled(): Boolean {
        if (!configDefault) return false
        persisted?.let { return it }
        return mutex.withLock {
            persisted ?: withContext(ioDispatcher) {
                // A read that threw and a key that is absent are not the same thing. Absent means
                // "not decided": follow [configDefault], and memoise. A throw means "we do not
                // know": leave [persisted] alone and answer false, so a read we could not perform
                // is not treated as consent; the next call retries.
                val stored =
                    try {
                        Stored(store.getString(KEY))
                    } catch (cancelled: CancellationException) {
                        // Never swallowed. Not reachable today (getString isn't suspend), but the
                        // catch below is deliberately broad.
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
     * Records the decision. The caller owns the side effects (purging the queue).
     *
     * The memo is updated even if the write fails: the in-process answer must change the moment
     * the user says no, regardless of disk. A withdrawal whose write is lost reverts on the next
     * launch, since the write is `SharedPreferences.apply()`, which is asynchronous and reports
     * nothing.
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
                    "FrakConfig(trackingEnabled = false), which the SDK treats as a hard floor.",
            )
        }
    }

    private companion object {
        const val KEY = "tracking-consent"
        const val GRANTED = "granted"
        const val DENIED = "denied"
    }
}
