package id.frak.sdk

import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakError
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.CompletableFuture

/**
 * Config resolution. Obtained from [FrakClient.config].
 *
 * Every suspending member has a `*Async` twin returning a [CompletableFuture] for Java callers; a
 * [FrakError] surfaces there wrapped in a `CompletionException`.
 */
public class ConfigApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Latest resolved config, or null before the first resolve. Conflated [StateFlow]. */
    public val updates: StateFlow<FrakResolvedConfig?> get() = core.configUpdates

    /** Stale-while-revalidate; only call that reliably 404s on a bad merchant id. */
    @Throws(FrakError::class)
    public suspend fun resolve(): FrakResolvedConfig = core.resolveConfig(forceRefresh = false)

    /** @param forceRefresh skips the cache-freshness check and the backoff. */
    @Throws(FrakError::class)
    public suspend fun resolve(forceRefresh: Boolean): FrakResolvedConfig = core.resolveConfig(forceRefresh)

    /** [resolve] for Java. Never `get()`/`join()` it on the main thread — completion needs a main-looper turn. */
    public fun resolveAsync(): CompletableFuture<FrakResolvedConfig> = resolveAsync(false)

    /** [resolve] for Java. */
    public fun resolveAsync(forceRefresh: Boolean): CompletableFuture<FrakResolvedConfig> =
        core.asFuture { resolve(forceRefresh) }
}
