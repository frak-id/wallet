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

/**
 * Static merchant-supplied facts, fixed at build time. Not the resolved backend config, see
 * [id.frak.sdk.config.FrakResolvedConfig].
 *
 * Build with [Builder], or `FrakMetadata { }` from Kotlin. See the note at the top of
 * `sharing/SharingRequest.kt` for why this carries no default arguments.
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
 *
 * ```java
 * // Java — the canonical form; the Builder is the implementation
 * FrakConfig config = new FrakConfig.Builder("merchant-id")
 *         .metadata(new FrakMetadata.Builder().name("Acme").build())
 *         .logLevel(FrakLogLevel.DEBUG)
 *         .build();
 * ```
 *
 * ```kotlin
 * // Kotlin — sugar over the same Builder
 * val config = FrakConfig("merchant-id") {
 *     metadata = FrakMetadata { name = "Acme" }
 *     logLevel = FrakLogLevel.DEBUG
 * }
 * ```
 *
 * This type is the reason the whole SDK banned default arguments: it went from 8 to 9 parameters
 * (`preloadSharing`) after the last `.api` dump was taken, which would have been a
 * `NoSuchMethodError` on every already-shipped merchant binary. Full reasoning at the top of
 * `sharing/SharingRequest.kt`.
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
     * Whether tracking may run. `false` means no anonymous id is ever minted and no tracking
     * request is issued; a hard floor [id.frak.sdk.FrakClient.setTrackingEnabled] cannot lift at
     * runtime.
     *
     * Not a whole-SDK off switch: merchant config and reward resolution still run since they
     * carry no user identifier. Sharing does stop, since a share link is the anonymous id.
     * Leave `true` and drive consent through [id.frak.sdk.FrakClient.setTrackingEnabled] instead.
     */
    public val trackingEnabled: Boolean,
    public val logLevel: FrakLogLevel,
    public val logSink: FrakLogSink?,
    /** Warms an offscreen `WebView` against [env]'s wallet origin before the sheet is presented. */
    public val preloadSharing: Boolean,
) {
    /**
     * Two constructors, both explicit, neither defaulted.
     *
     * `Builder(merchantId)` is the form to reach for, and the one every example uses: a merchant id
     * resolves without depending on what the app's `applicationId` happens to be. `Builder()` exists
     * because [merchantId] is genuinely optional — with no id, the merchant is resolved from
     * [packageId] (or, failing that, `context.packageName`), and a required constructor argument
     * would have deleted that integration path.
     *
     * The empty one is the primary, and that is not cosmetic: a `private constructor(String?)`
     * shared by both would erase to the same JVM descriptor as `constructor(String)` — nullability
     * is an annotation, not part of the signature — and the two would collide.
     *
     * [merchantId] also has a setter, like every other option. The two constructors are ergonomics
     * for the two shapes a call site actually takes, not an attempt to make the field unreachable
     * any other way.
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

        public var preloadSharing: Boolean = false

        public fun merchantId(merchantId: String?): Builder = apply { this.merchantId = merchantId }

        public fun packageId(packageId: String?): Builder = apply { this.packageId = packageId }

        public fun metadata(metadata: FrakMetadata): Builder = apply { this.metadata = metadata }

        public fun env(env: FrakEnvironment): Builder = apply { this.env = env }

        public fun deepLink(deepLink: DeepLinkHandling): Builder = apply { this.deepLink = deepLink }

        public fun trackingEnabled(trackingEnabled: Boolean): Builder = apply { this.trackingEnabled = trackingEnabled }

        public fun logLevel(logLevel: FrakLogLevel): Builder = apply { this.logLevel = logLevel }

        public fun logSink(logSink: FrakLogSink?): Builder = apply { this.logSink = logSink }

        public fun preloadSharing(preloadSharing: Boolean): Builder = apply { this.preloadSharing = preloadSharing }

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
                preloadSharing,
            )
    }

    /**
     * Not a `data class`: publishing one bakes `copy()`/`componentN()` into the ABI permanently.
     * Uses the `internal` primary constructor rather than the Builder, so a field added to this type
     * fails to compile here instead of being silently dropped.
     */
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

/**
 * Kotlin sugar over [FrakConfig.Builder], for the merchant-id form. See [FrakConfig] for an example.
 */
public fun FrakConfig(
    merchantId: String,
    configure: FrakConfig.Builder.() -> Unit,
): FrakConfig = FrakConfig.Builder(merchantId).apply(configure).build()

/**
 * Merchant id only, which is the shortest working config: no `{ }` to write when there is nothing
 * else to set. An explicit overload rather than a default lambda — it takes exactly the one required
 * field, so a new option never changes its signature.
 */
public fun FrakConfig(merchantId: String): FrakConfig = FrakConfig.Builder(merchantId).build()

/**
 * Kotlin sugar over [FrakConfig.Builder] for the no-merchant-id form, where the merchant is resolved
 * from the package id instead.
 */
public fun FrakConfig(configure: FrakConfig.Builder.() -> Unit): FrakConfig =
    FrakConfig.Builder().apply(configure).build()
