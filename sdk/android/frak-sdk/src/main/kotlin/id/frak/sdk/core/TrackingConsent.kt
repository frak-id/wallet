package id.frak.sdk.core

import id.frak.sdk.config.KeyValueStore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Whether the SDK may mint an identity and talk to the backend, as a **runtime** decision
 * (S6a/C7) rather than the build-time-only [FrakConfig.trackingEnabled] it replaces at the read
 * sites.
 *
 * Tri-state on purpose, and the third state is not "unset means off":
 *
 * | persisted | [FrakConfig.trackingEnabled] | [isEnabled] |
 * |---|---|---|
 * | absent    | true  | **true**  — every integration shipped before this class existed behaves exactly as it did |
 * | absent    | false | false |
 * | `granted` | true  | true |
 * | `granted` | false | **false** — the compile-time flag is a hard floor, see below |
 * | `denied`  | true  | false |
 * | `denied`  | false | false |
 *
 * **The compile-time `false` is a floor no persisted value can lift.** A merchant who shipped
 * `FrakConfig(trackingEnabled = false)` — a staged rollout, a build for a market they have not
 * cleared legally, a debug variant — must not discover that a `setTrackingEnabled(true)` call
 * somewhere in their app silently switched the SDK on. The grant is still written to disk, so it
 * takes effect if they later ship a build with the flag on; it simply cannot take effect against
 * a build that says no. [setEnabled] logs when it is called into that floor, because a silent
 * no-op is the failure mode this whole class exists to remove.
 *
 * Stored in the **identity** [KeyValueStore], never the config cache: the config cache is
 * the SDK's own cache of someone else's data and is safe to throw away at any time, whereas a
 * consent decision is the only record that the user was ever asked. They are already separate files
 * so a corrupt write to the hot one cannot take identity with it; the same reasoning puts the
 * consent decision on the side that is not disposable.
 *
 * `suspend`, with an in-memory memo, for the same reason [id.frak.sdk.identity.AnonymousIdStore]
 * is (4.5): the backing `SharedPreferences` file is opened lazily on first read, and that first
 * read is disk I/O that must not land on whichever thread a merchant happened to call
 * `track()` from.
 */
internal class TrackingConsent(
    private val store: KeyValueStore,
    /** [FrakConfig.trackingEnabled]. A `false` here can never be lifted by a persisted grant. */
    private val configDefault: Boolean,
    private val logger: FrakLogger,
    private val ioDispatcher: CoroutineDispatcher,
) {
    private val mutex = Mutex()

    /**
     * The persisted decision once read, so only the first call touches disk. `@Volatile` because
     * the fast path below reads it outside [mutex]. Holds the *persisted* state only — the
     * [configDefault] floor is applied on every read, never baked into this value, so the memo
     * stays correct regardless of which of the two inputs is being consulted.
     */
    @Volatile
    private var persisted: Boolean? = null

    /** Never throws: an unreadable store degrades to the [configDefault], not to an exception. */
    suspend fun isEnabled(): Boolean {
        if (!configDefault) return false
        persisted?.let { return it }
        return mutex.withLock {
            persisted ?: withContext(ioDispatcher) {
                // A read that THREW and a key that is ABSENT are deliberately not the same thing.
                //
                // Absent means "not decided": follow [configDefault], and memoise, because a corrupt
                // or partially-written *value* must fail towards the behaviour the merchant compiled
                // in rather than towards a silently dead SDK.
                //
                // A throw means "we do not know": `SharedPreferences` can fail on a corrupted entry,
                // on a locked direct-boot user, or on an OS-level failure opening the file. Falling
                // back to [configDefault] for THAT would turn a recorded denial into "tracking on" —
                // and memoising it would make one transient failure permanent for the process. So
                // this leaves [persisted] alone and answers `false`: a read we could not perform is
                // not consent. The next call retries, exactly as
                // [id.frak.sdk.identity.AnonymousIdStore] refuses to cache a keystore refusal.
                val stored =
                    try {
                        Stored(store.getString(KEY))
                    } catch (cancelled: CancellationException) {
                        // Never swallowed, per this codebase's rule (see `frakCall` and
                        // `handleReferralLink`). Not reachable today — [KeyValueStore.getString] is
                        // not a suspend function — but the catch below is deliberately broad, and
                        // `kotlinx.coroutines.CancellationException` is an `Exception`.
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
     * Records the decision. The caller — [DefaultFrakClient.setTrackingEnabled] — owns the side
     * effects (purging the queue).
     *
     * **The memo is updated even if the write fails**, deliberately: the in-process answer must
     * change the moment the user says no, whether or not the disk agreed. The cost is that a
     * withdrawal whose write is lost reverts on the next launch — and the write is
     * `SharedPreferences.apply()` (`KeyValueStore.kt`), which is asynchronous and reports nothing,
     * so the `catch` below only ever sees a synchronous `edit()` failure. Making a consent
     * withdrawal durable against a process kill needs a committing write this store does not
     * expose; that is recorded as an open row rather than papered over here.
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
