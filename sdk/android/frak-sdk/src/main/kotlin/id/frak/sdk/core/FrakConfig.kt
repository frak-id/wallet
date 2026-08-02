package id.frak.sdk.core

/**
 * Currency a reward is advertised in. Closed rather than a free `String`: the
 * backend accepts exactly these three and rejects anything else with a 422.
 *
 * This is the SDK's configured currency, not the device's — it also drives the
 * formatting locale (`eur` always formats as `fr-FR`), independent of where the
 * phone is.
 */
public enum class FrakCurrency(
    public val wireValue: String,
) {
    EUR("eur"),
    USD("usd"),
    GBP("gbp"),
}

/**
 * Language for merchant-configured copy. Only `en` and `fr` exist today,
 * matching the hosted `/sharing` page's i18n bundles.
 */
public enum class FrakLanguage(
    public val wireValue: String,
) {
    EN("en"),
    FR("fr"),
}

/**
 * How verbose the SDK is in logcat. Default is [NONE] — silent unless raised for integration
 * debugging.
 *
 * Also gates [FrakConfig.logSink]: the level is applied first, so [NONE] delivers nothing to
 * a configured sink either, and lowering this reduces the sink's volume exactly as it reduces
 * logcat's. See [FrakLogSink].
 */
public enum class FrakLogLevel {
    NONE,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

/**
 * Receives SDK diagnostics so a merchant can route them into their own logging — Timber, a
 * crash reporter's breadcrumb trail, or their own analytics.
 *
 * Only messages that pass [FrakConfig.logLevel] are ever delivered: the level gate is applied
 * before the sink is consulted, so `logLevel` still controls volume, and [FrakLogLevel.NONE]
 * reaches the sink exactly as it reaches logcat — not at all.
 *
 * When a sink is set, it replaces logcat rather than supplementing it: a merchant with a sink
 * can stop Frak's own lines reaching logcat at all, which matters because logcat is harvested
 * by crash reporters. A `fun interface` so a merchant can pass a lambda.
 */
public fun interface FrakLogSink {
    /**
     * Called for one SDK log line that already passed [FrakConfig.logLevel]. [level] is never
     * [FrakLogLevel.NONE]. [throwable] is present only when the call site provided one.
     *
     * Must not throw. An implementation that throws will not crash the host, but the exception
     * is swallowed rather than surfaced anywhere — see [FrakLogger]. Implementations must also
     * be thread-safe: the same sink instance is called concurrently from multiple threads (the
     * caller's thread from [id.frak.sdk.Frak.initialize], the SDK's own background dispatcher,
     * and background revalidation), with no serialization guaranteed between calls.
     */
    public fun log(
        level: FrakLogLevel,
        message: String,
        throwable: Throwable?,
    )
}

/**
 * Static merchant-supplied facts about the app, fixed at build time. Not the
 * resolved backend config — see [id.frak.sdk.config.FrakResolvedConfig] for that.
 */
public class FrakMetadata(
    /** Display name of the merchant, used where the SDK renders copy locally. */
    public val name: String? = null,
    /** Currency every reward amount is advertised in. */
    public val currency: FrakCurrency = FrakCurrency.EUR,
    /** Language for merchant copy. Null means "let the backend decide" (falls back to `en`). */
    public val lang: FrakLanguage? = null,
    /** Merchant logo, used as the native sheet header in a later increment. */
    public val logoUrl: String? = null,
    /** Merchant homepage, used in locally-rendered copy. */
    public val homepageLink: String? = null,
)

/**
 * Everything the SDK needs to start, supplied once at [id.frak.sdk.Frak.initialize].
 *
 * `initialize()` never throws, so nothing here is validated at construction; an
 * unusable config (no [merchantId], no resolvable [packageId]) surfaces later as
 * [FrakError.MerchantResolutionFailed].
 */
public class FrakConfig(
    /**
     * Server-issued merchant UUID, from the Frak dashboard. Optional — when
     * null, the merchant is resolved from [packageId] instead. When both are
     * present, `merchantId` wins and the package id is ignored.
     */
    public val merchantId: String? = null,
    /**
     * Application id of the host app, as registered in the merchant's
     * `allowed_package_ids`. Null reads it from the `Context` at
     * [id.frak.sdk.Frak.initialize] (`context.packageName`).
     *
     * Named `packageId` on Android and `bundleId` on iOS — a deliberate,
     * platform-idiomatic naming break.
     */
    public val packageId: String? = null,
    /** Static facts about the merchant — see [FrakMetadata]. */
    public val metadata: FrakMetadata = FrakMetadata(),
    /**
     * The stage the SDK talks to — see [FrakEnvironment]. Merchants never set
     * this; it exists for Frak's own dev and local builds.
     */
    public val env: FrakEnvironment = FrakEnvironment.Production,
    /** Master switch. When false, the SDK generates no anonymous id and issues no network request. */
    public val trackingEnabled: Boolean = true,
    /** See [FrakLogLevel]. Silent by default. Also gates [logSink]. */
    public val logLevel: FrakLogLevel = FrakLogLevel.NONE,
    /**
     * Receives SDK diagnostics that pass [logLevel], instead of logcat. Null (the default)
     * keeps diagnostics in logcat, as before this existed. See [FrakLogSink].
     */
    public val logSink: FrakLogSink? = null,
) {
    /**
     * Returns a copy with [packageId] replaced.
     *
     * Not a `data class`: a published `data class` bakes `copy()`/`componentN()`
     * into the ABI, so it could never gain a field without breaking already-compiled
     * consumers. This method is `internal` and carries no such commitment.
     */
    internal fun withPackageId(packageId: String): FrakConfig =
        FrakConfig(
            merchantId = merchantId,
            packageId = packageId,
            metadata = metadata,
            env = env,
            trackingEnabled = trackingEnabled,
            logLevel = logLevel,
            logSink = logSink,
        )
}
