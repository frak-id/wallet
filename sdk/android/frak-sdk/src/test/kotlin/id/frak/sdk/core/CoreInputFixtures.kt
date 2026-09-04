package id.frak.sdk.core

/*
 * Defaulted helpers for the merchant-facing input types, for the tests that only care about one or
 * two fields. The types themselves take no default arguments on purpose: a defaulted public
 * constructor freezes an arity. Every helper goes through the public `Builder`, not the constructor.
 */

internal fun frakMetadata(
    name: String? = null,
    currency: FrakCurrency = FrakCurrency.EUR,
    lang: FrakLanguage? = null,
    logoUrl: String? = null,
    homepageLink: String? = null,
): FrakMetadata =
    FrakMetadata
        .Builder()
        .name(name)
        .currency(currency)
        .lang(lang)
        .logoUrl(logoUrl)
        .homepageLink(homepageLink)
        .build()

internal fun frakConfig(
    merchantId: String? = null,
    packageId: String? = null,
    metadata: FrakMetadata = frakMetadata(),
    env: FrakEnvironment = FrakEnvironment.Production,
    deepLink: DeepLinkHandling = DeepLinkHandling.Automatic,
    trackingEnabled: Boolean = true,
    logLevel: FrakLogLevel = FrakLogLevel.NONE,
    logSink: FrakLogSink? = null,
): FrakConfig =
    FrakConfig
        .Builder()
        .merchantId(merchantId)
        .packageId(packageId)
        .metadata(metadata)
        .env(env)
        .deepLink(deepLink)
        .trackingEnabled(trackingEnabled)
        .logLevel(logLevel)
        .logSink(logSink)
        .build()

internal fun productDetails(
    productId: String? = null,
    sku: String? = null,
    name: String? = null,
    quantity: Double? = null,
    unitPrice: Double? = null,
    totalPrice: Double? = null,
): ProductDetails =
    ProductDetails
        .Builder()
        .productId(productId)
        .sku(sku)
        .name(name)
        .quantity(quantity)
        .unitPrice(unitPrice)
        .totalPrice(totalPrice)
        .build()
