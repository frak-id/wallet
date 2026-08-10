package id.frak.sdk.identity

import id.frak.sdk.config.ConfigStore
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.config.MerchantQuery
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
import id.frak.sdk.core.FrakLogger
import id.frak.sdk.core.frakCall
import kotlinx.coroutines.CancellationException

/** How a merchant id resolve failure is handled by [MerchantIdentity]. */
internal enum class MerchantPolicy {
    /** Resolve; a failure escapes as [FrakError]. */
    Required,

    /** Resolve; a failure swallows to null. */
    Optional,

    /** Never touches the network — a referral arrival on a cold start must not block. */
    CachedOnly,
}

/**
 * Owns "which merchant is this, and who is the user" — the SDK's most-used precondition — with
 * the resolve policy as a parameter. Not gated on consent: [AnonymousIdStore.anonymousId] already
 * answers null once consent is withdrawn, which is what makes `openFrakApp` safe today.
 */
internal class MerchantIdentity(
    private val settings: FrakConfig,
    private val identity: AnonymousIdStore,
    private val configStore: ConfigStore,
    private val logger: FrakLogger,
) {
    /** At most one mismatch warning per instance, however many times resolution runs. */
    @Volatile
    private var mismatchWarned = false

    /** The merchant id under [policy]: a cached backend value beats [FrakConfig.merchantId], see [preferBackend]. */
    suspend fun merchant(policy: MerchantPolicy): String? {
        preferBackend(cachedMerchantId())?.let { return it }
        return when (policy) {
            MerchantPolicy.Required -> resolve().merchantId
            MerchantPolicy.Optional -> availableConfig()?.merchantId
            MerchantPolicy.CachedOnly -> null
        }
    }

    /** The (merchantId, anonymousId) pair under [policy], absent when either half is missing. */
    suspend fun pair(policy: MerchantPolicy): Pair<String, String>? {
        val anonymousId = identity.anonymousId() ?: return null
        val merchantId = merchant(policy) ?: return null
        return merchantId to anonymousId
    }

    /** [merchant] under [MerchantPolicy.Optional], for a caller that already resolved the config itself. */
    fun merchantFrom(resolved: FrakResolvedConfig?): String? = preferBackend(resolved?.merchantId)

    /** The resolved config where one is available, null where it is not. A cancellation still propagates. */
    suspend fun availableConfig(): FrakResolvedConfig? =
        try {
            resolve()
        } catch (unavailable: FrakError) {
            null
        }

    /**
     * [backendId] over [FrakConfig.merchantId] — the backend is authoritative. Warns once if the two
     * disagree, since that means the configured id is being silently overridden.
     */
    private fun preferBackend(backendId: String?): String? {
        val configured = settings.merchantId
        if (backendId != null && configured != null) warnOnMismatch(backendId, configured)
        return backendId ?: configured
    }

    private fun warnOnMismatch(
        backendId: String,
        configured: String,
    ) {
        if (mismatchWarned || sameMerchant(backendId, configured)) return
        mismatchWarned = true
        logger.warn(
            "FrakConfig.merchantId '$configured' does not match the backend's '$backendId'; " +
                "ignoring the configured id in favour of the backend's.",
        )
    }

    private fun sameMerchant(
        a: String,
        b: String,
    ): Boolean = a.trim().equals(b.trim(), ignoreCase = true)

    /** No network: [ConfigStore.currentConfig]'s own cache-only read. A query that can't be built means nothing is cached. */
    private suspend fun cachedMerchantId(): String? =
        runCatching { configStore.currentConfig(MerchantQuery.from(settings))?.merchantId }
            .getOrElse { failure ->
                if (failure is CancellationException) throw failure
                null
            }

    /** Through [frakCall] so an unexpected `Throwable` normalises before [availableConfig] swallows it. */
    private suspend fun resolve(): FrakResolvedConfig =
        frakCall {
            configStore.resolve(MerchantQuery.from(settings), forceRefresh = false)
        }
}
