package id.frak.sdk

/**
 * Version of this SDK build, sent on every request. `@JvmStatic val` rather than `const val`: a
 * `const` is inlined into the merchant's bytecode and would report their compile-time version.
 */
public object FrakSdkVersion {
    /** Keep in step with `frak.sdk.version` in `gradle.properties`; the build checks it. */
    @JvmStatic
    public val CURRENT: String = "0.0.1"

    /** Wire plumbing for `HttpClient`; not merchant API. */
    @JvmStatic
    @InternalFrakApi
    public val HEADER_NAME: String = "x-frak-sdk-version"

    /** Wire plumbing for `:frak-sdk-ui`'s page URLs; not merchant API. */
    @JvmStatic
    @InternalFrakApi
    public val QUERY_PARAMETER_NAME: String = "sdkVersion"
}
