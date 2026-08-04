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
     * The SDK watches host activities itself and calls [id.frak.sdk.AppLinkApi.handleReferral]
     * for every inbound `Intent`. Calling `handleReferral` yourself for the same URL double-tracks
     * the arrival: the observer only guards against its own re-delivery, not a manual call.
     *
     * Android-only: iOS only offers `Manual`/`Disabled`.
     */
    Automatic,

    /** Merchant calls [id.frak.sdk.AppLinkApi.handleReferral] from their own router. */
    Manual,

    Disabled,
}

/** Static merchant-supplied facts, fixed at build time. Not the resolved backend config, see [id.frak.sdk.config.FrakResolvedConfig]. */
public class FrakMetadata(
    public val name: String? = null,
    public val currency: FrakCurrency = FrakCurrency.EUR,
    /** Null means "let the backend decide" (falls back to `en`). */
    public val lang: FrakLanguage? = null,
    public val logoUrl: String? = null,
    public val homepageLink: String? = null,
)

/**
 * Everything the SDK needs to start, supplied once at [id.frak.sdk.Frak.initialize]. Never
 * validated at construction; an unusable config surfaces later as [FrakError.MerchantResolutionFailed].
 */
public class FrakConfig(
    /** Optional; when null, merchant is resolved from [packageId] instead. `merchantId` wins if both set. */
    public val merchantId: String? = null,
    /** Null reads `context.packageName` at [id.frak.sdk.Frak.initialize]. `bundleId` on iOS. */
    public val packageId: String? = null,
    public val metadata: FrakMetadata = FrakMetadata(),
    /** Merchants never set this; exists for Frak's own dev/local builds. */
    public val env: FrakEnvironment = FrakEnvironment.Production,
    public val deepLink: DeepLinkHandling = DeepLinkHandling.Automatic,
    /**
     * Whether tracking may run. `false` means no anonymous id is ever minted and no tracking
     * request is issued; a hard floor [id.frak.sdk.FrakClient.setTrackingEnabled] cannot lift at
     * runtime.
     *
     * Not a whole-SDK off switch: merchant config and reward resolution still run since they
     * carry no user identifier. Sharing does stop, since a share link is the anonymous id.
     * Leave `true` and drive consent through [id.frak.sdk.FrakClient.setTrackingEnabled] instead.
     */
    public val trackingEnabled: Boolean = true,
    public val logLevel: FrakLogLevel = FrakLogLevel.NONE,
    public val logSink: FrakLogSink? = null,
    /** Warms an offscreen `WebView` against [env]'s wallet origin before the sheet is presented. */
    public val preloadSharing: Boolean = false,
) {
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
            preloadSharing = preloadSharing,
        )
}
