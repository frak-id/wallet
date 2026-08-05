package id.frak.sdk

/** Version of this SDK build, sent on every request. */
public object FrakSdkVersion {
    /** Keep in step with `version` in `build.gradle.kts`. */
    public const val CURRENT: String = "0.0.1"
    public const val HEADER_NAME: String = "x-frak-sdk-version"
    public const val QUERY_PARAMETER_NAME: String = "sdkv"
}
