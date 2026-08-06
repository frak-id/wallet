package id.frak.sdk

import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakError
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.CompletableFuture

/**
 * Config resolution. Obtained from [FrakClient.config].
 *
 * Every suspending member has a `*Async` twin returning a [CompletableFuture], because a Java caller
 * cannot name a `Continuation` and therefore cannot call a `suspend` function at all. The twins are
 * the same work on the same scope — see [DefaultFrakClient.asFuture] for the threading contract and
 * what happens after `Frak.shutdown()`. A `FrakError` reaches a Java caller through
 * `whenComplete`/`exceptionally`, wrapped in a `CompletionException` (or an `ExecutionException` from
 * `get()`), exactly as it would from any other future.
 */
public class ConfigApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Latest resolved config, or null before the first resolve. Conflated [StateFlow]. */
    public val updates: StateFlow<FrakResolvedConfig?> get() = core.configUpdates

    /** Stale-while-revalidate; only call that reliably 404s on a bad merchant id. */
    @Throws(FrakError::class)
    public suspend fun resolve(): FrakResolvedConfig = core.resolveConfig(forceRefresh = false)

    /**
     * @param forceRefresh skips the cache-freshness check and the backoff, and re-fetches. An explicit
     *   overload rather than a defaulted parameter: a Kotlin default compiles to a `$default` bridge
     *   that freezes this signature's arity forever (see the note at the top of
     *   `sharing/SharingRequest.kt`).
     */
    @Throws(FrakError::class)
    public suspend fun resolve(forceRefresh: Boolean): FrakResolvedConfig = core.resolveConfig(forceRefresh)

    /**
     * [resolve] for Java.
     *
     * Both overloads exist because the suspending pair does: the twins mirror the members they
     * shadow, so a Java caller reading the Kotlin docs finds the same shape. **Never `get()` or
     * `join()` this on the main thread** — completion needs a main-looper turn, and a blocked main
     * thread never gives it one. See [DefaultFrakClient.asFuture].
     */
    public fun resolveAsync(): CompletableFuture<FrakResolvedConfig> = resolveAsync(false)

    /** [resolve] for Java. */
    public fun resolveAsync(forceRefresh: Boolean): CompletableFuture<FrakResolvedConfig> =
        core.asFuture { resolve(forceRefresh) }
}
