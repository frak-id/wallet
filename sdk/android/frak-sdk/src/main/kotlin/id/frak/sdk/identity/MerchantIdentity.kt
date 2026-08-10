package id.frak.sdk.identity

import id.frak.sdk.config.ConfigStore
import id.frak.sdk.config.FrakResolvedConfig
import id.frak.sdk.config.MerchantQuery
import id.frak.sdk.core.FrakConfig
import id.frak.sdk.core.FrakError
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
) {
    /** The merchant id under [policy]. [FrakConfig.merchantId], when set, always wins over a resolve. */
    suspend fun merchant(policy: MerchantPolicy): String? =
        settings.merchantId ?: when (policy) {
            MerchantPolicy.Required -> {
                resolve().merchantId
            }

            MerchantPolicy.Optional -> {
                availableConfig()?.merchantId
            }

            // currentConfig, not configStore.updates: a cold start launched by this very referral
            // link never called resolve(). Must never throw.
            MerchantPolicy.CachedOnly -> {
                runCatching { configStore.currentConfig(MerchantQuery.from(settings))?.merchantId }
                    .getOrElse { failure ->
                        if (failure is CancellationException) throw failure
                        null
                    }
            }
        }

    /** The (merchantId, anonymousId) pair under [policy], absent when either half is missing. */
    suspend fun pair(policy: MerchantPolicy): Pair<String, String>? {
        val anonymousId = identity.anonymousId() ?: return null
        val merchantId = merchant(policy) ?: return null
        return merchantId to anonymousId
    }

    /** [merchant] under [MerchantPolicy.Optional], for the caller that needs the config itself too. */
    fun merchantFrom(resolved: FrakResolvedConfig?): String? = settings.merchantId ?: resolved?.merchantId

    /** The resolved config where one is available, null where it is not. A cancellation still propagates. */
    suspend fun availableConfig(): FrakResolvedConfig? =
        try {
            resolve()
        } catch (unavailable: FrakError) {
            null
        }

    /** Through [frakCall] so an unexpected `Throwable` normalises before [availableConfig] swallows it. */
    private suspend fun resolve(): FrakResolvedConfig =
        frakCall {
            configStore.resolve(MerchantQuery.from(settings), forceRefresh = false)
        }
}
