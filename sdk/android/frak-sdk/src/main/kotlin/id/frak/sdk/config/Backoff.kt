package id.frak.sdk.config

import id.frak.sdk.core.FrakError
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.math.min
import kotlin.random.Random

/**
 * Per-key failure backoff: exponential, jittered (full range `[delay/2, delay]`),
 * `Retry-After`-aware. Suppresses the network, not the answer; cached data still served. Not
 * thread-safe by itself; callers hold it behind their own mutex.
 */
internal class Backoff(
    private val now: () -> Long = System::currentTimeMillis,
    private val random: Random = Random.Default,
) {
    private val state = HashMap<String, Entry>()

    private data class Entry(
        val failureCount: Int,
        val retryAtMillis: Long,
    )

    /** True when [key] is inside its backoff window and must not be dialled. */
    fun isBackingOff(key: String): Boolean = remainingMillis(key) != null

    /**
     * What is left of [key]'s backoff window, or null when it isn't backing off. Callers surface
     * this as [FrakError.BackingOff.retryAfterMillis]; it is always positive.
     */
    fun remainingMillis(key: String): Long? {
        val entry = state[key] ?: return null
        val remaining = entry.retryAtMillis - now()
        if (remaining <= 0L) {
            // Dropped on read rather than swept, so the map can't grow unbounded over a session.
            state.remove(key)
            return null
        }
        return remaining
    }

    /** `Retry-After` is a floor, not a replacement: the exponential must still grow past it. */
    fun recordFailure(
        key: String,
        error: Throwable?,
    ) {
        val failureCount = (state[key]?.failureCount ?: 0) + 1
        val exponential = MIN_DELAY_MILLIS shl min(failureCount - 1, MAX_SHIFT)
        val capped = min(exponential, MAX_DELAY_MILLIS)
        val serverFloor = (error as? FrakError.Server)?.retryAfterSeconds?.times(1_000L) ?: 0L
        val delay = maxOf(capped, serverFloor)
        state[key] = Entry(failureCount, now() + jitter(delay))
    }

    /** Clears the window for [key]. Called on every success. */
    fun recordSuccess(key: String) {
        state.remove(key)
    }

    /**
     * Runs [request], recording a failure against [key] under [mutex] and rethrowing. Callers
     * still record their own success, since that happens alongside writing their own cache entry.
     */
    suspend fun <T> runOrRecordFailure(
        mutex: Mutex,
        key: String,
        request: suspend () -> T,
    ): T =
        try {
            request()
        } catch (failure: FrakError) {
            mutex.withLock { recordFailure(key, failure) }
            throw failure
        }

    /** Records [error] against [key] under [mutex] and throws it. For a non-2xx already mapped to a [FrakError]. */
    suspend fun recordFailureAndThrow(
        mutex: Mutex,
        key: String,
        error: FrakError,
    ): Nothing {
        mutex.withLock { recordFailure(key, error) }
        throw error
    }

    private fun jitter(delayMillis: Long): Long {
        if (delayMillis <= 0L) return 0L
        val half = delayMillis / 2
        return half + random.nextLong(half + 1)
    }

    companion object {
        const val MIN_DELAY_MILLIS: Long = 1_000
        const val MAX_DELAY_MILLIS: Long = 60_000

        /** Caps the shift so `1s shl n` cannot overflow before the cap bites. */
        private const val MAX_SHIFT = 6
    }
}
