package id.frak.sdk.core

/** Currency a reward is advertised in. Closed set: backend rejects anything else with a 422. */
public enum class FrakCurrency(
    public val wireValue: String,
) {
    EUR("eur"),
    USD("usd"),
    GBP("gbp"),
}

/** Language for merchant-configured copy. Only `en`/`fr` exist today. */
public enum class FrakLanguage(
    public val wireValue: String,
) {
    EN("en"),
    FR("fr"),
}

/** Logcat verbosity. Default [NONE]. Also gates [FrakConfig.logSink] volume, see [FrakLogSink]. */
public enum class FrakLogLevel {
    NONE,
    ERROR,
    WARN,
    INFO,
    DEBUG,
}

/** Receives SDK diagnostics, gated by [FrakConfig.logLevel]. Replaces logcat once set. */
public fun interface FrakLogSink {
    /** Must not throw (exception is swallowed, not surfaced) and must be thread-safe. */
    public fun log(
        level: FrakLogLevel,
        message: String,
        throwable: Throwable?,
    )
}

/** How inbound links carrying an `fCtx` reach the SDK. */
public enum class DeepLinkHandling {
    /**
     * The SDK watches host activities itself; calling [id.frak.sdk.AppLinkApi.handleReferral]
     * as well double-tracks the arrival. Android-only.
     */
    Automatic,

    /** Merchant calls [id.frak.sdk.AppLinkApi.handleReferral] from their own router. */
    Manual,

    Disabled,
}

/**
 * Static merchant-supplied facts, fixed at build time. Not the resolved backend config, see
 * [id.frak.sdk.config.FrakResolvedConfig].
 */
public class FrakMetadata internal constructor(
    public val name: String?,
    public val currency: FrakCurrency,
    /** Null means "let the backend decide" (falls back to `en`). */
    public val lang: FrakLanguage?,
    public val logoUrl: String?,
    public val homepageLink: String?,
) {
    public class Builder {
        public var name: String? = null

        public var currency: FrakCurrency = FrakCurrency.EUR

        public var lang: FrakLanguage? = null

        public var logoUrl: String? = null

        public var homepageLink: String? = null

        public fun name(name: String?): Builder = apply { this.name = name }

        public fun currency(currency: FrakCurrency): Builder = apply { this.currency = currency }

        public fun lang(lang: FrakLanguage?): Builder = apply { this.lang = lang }

        public fun logoUrl(logoUrl: String?): Builder = apply { this.logoUrl = logoUrl }

        public fun homepageLink(homepageLink: String?): Builder = apply { this.homepageLink = homepageLink }

        public fun build(): FrakMetadata = FrakMetadata(name, currency, lang, logoUrl, homepageLink)
    }
}

/** Kotlin sugar over [FrakMetadata.Builder]. */
public fun FrakMetadata(configure: FrakMetadata.Builder.() -> Unit): FrakMetadata =
    FrakMetadata.Builder().apply(configure).build()

/**
 * Everything the SDK needs to start, supplied once at [id.frak.sdk.Frak.initialize]. Never
 * validated at construction; an unusable config surfaces later as [FrakError.MerchantResolutionFailed].
 */
public class FrakConfig internal constructor(
    /** Optional; when null, merchant is resolved from [packageId] instead. `merchantId` wins if both set. */
    public val merchantId: String?,
    /** Null reads `context.packageName` at [id.frak.sdk.Frak.initialize]. `bundleId` on iOS. */
    public val packageId: String?,
    public val metadata: FrakMetadata,
    /** Merchants never set this; exists for Frak's own dev/local builds. */
    public val env: FrakEnvironment,
    public val deepLink: DeepLinkHandling,
    /**
     * Hard floor for tracking that [id.frak.sdk.FrakClient.setTrackingEnabled] cannot lift at
     * runtime. `false` also stops sharing, but config and reward resolution still run.
     */
    public val trackingEnabled: Boolean,
    public val logLevel: FrakLogLevel,
    public val logSink: FrakLogSink?,
) {
    // See the note atop sharing/SharingRequest.kt.

    /**
     * `Builder()` exists alongside `Builder(merchantId)` because [merchantId] is optional. The empty
     * one is primary: a shared `constructor(String?)` would erase to the same JVM descriptor as
     * `constructor(String)`.
     */
    public class Builder() {
        public constructor(merchantId: String) : this() {
            this.merchantId = merchantId
        }

        public var merchantId: String? = null

        public var packageId: String? = null

        public var metadata: FrakMetadata = FrakMetadata.Builder().build()

        public var env: FrakEnvironment = FrakEnvironment.Production

        public var deepLink: DeepLinkHandling = DeepLinkHandling.Automatic

        public var trackingEnabled: Boolean = true

        public var logLevel: FrakLogLevel = FrakLogLevel.NONE

        public var logSink: FrakLogSink? = null

        public fun merchantId(merchantId: String?): Builder = apply { this.merchantId = merchantId }

        public fun packageId(packageId: String?): Builder = apply { this.packageId = packageId }

        public fun metadata(metadata: FrakMetadata): Builder = apply { this.metadata = metadata }

        public fun env(env: FrakEnvironment): Builder = apply { this.env = env }

        public fun deepLink(deepLink: DeepLinkHandling): Builder = apply { this.deepLink = deepLink }

        public fun trackingEnabled(trackingEnabled: Boolean): Builder = apply { this.trackingEnabled = trackingEnabled }

        public fun logLevel(logLevel: FrakLogLevel): Builder = apply { this.logLevel = logLevel }

        public fun logSink(logSink: FrakLogSink?): Builder = apply { this.logSink = logSink }

        public fun build(): FrakConfig =
            FrakConfig(
                merchantId,
                packageId,
                metadata,
                env,
                deepLink,
                trackingEnabled,
                logLevel,
                logSink,
            )
    }

    /** Not a `data class`: publishing one bakes `copy()`/`componentN()` into the ABI permanently. */
    internal fun withPackageId(packageId: String): FrakConfig =
        FrakConfig(
            merchantId = merchantId,
            packageId = packageId,
            metadata = metadata,
            env = env,
            deepLink = deepLink,
            trackingEnabled = trackingEnabled,
            logLevel = logLevel,
            logSink = logSink,
        )
}

/** Kotlin sugar over [FrakConfig.Builder], for the merchant-id form. */
public fun FrakConfig(
    merchantId: String,
    configure: FrakConfig.Builder.() -> Unit,
): FrakConfig = FrakConfig.Builder(merchantId).apply(configure).build()

/** Merchant id only: the shortest working config. */
public fun FrakConfig(merchantId: String): FrakConfig = FrakConfig.Builder(merchantId).build()

/** Kotlin sugar over [FrakConfig.Builder] for the no-merchant-id form. */
public fun FrakConfig(configure: FrakConfig.Builder.() -> Unit): FrakConfig =
    FrakConfig.Builder().apply(configure).build()
