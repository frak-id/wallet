package id.frak.sdk

import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.core.DefaultFrakClient
import id.frak.sdk.core.FrakError
import kotlinx.coroutines.flow.StateFlow

/** Config resolution. Obtained from [FrakClient.config]. */
public class ConfigApi internal constructor(
    private val core: DefaultFrakClient,
) {
    /** Latest resolved config, or null before the first resolve. Conflated [StateFlow]. */
    public val updates: StateFlow<FrakResolvedConfig?> get() = core.configUpdates

    /** Stale-while-revalidate; only call that reliably 404s on a bad merchant id. */
    @Throws(FrakError::class)
    public suspend fun resolve(forceRefresh: Boolean = false): FrakResolvedConfig = core.resolveConfig(forceRefresh)
}
