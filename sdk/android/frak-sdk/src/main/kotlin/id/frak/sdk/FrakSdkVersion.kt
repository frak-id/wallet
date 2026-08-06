package id.frak.sdk

/**
 * Version of this SDK build, sent on every request.
 *
 * `@JvmStatic val`, not `const val`, for all three. A `public const val` is inlined into the calling
 * bytecode, so a merchant who reads [CURRENT] gets the value they *compiled against*, frozen, and no
 * SDK upgrade can correct it. For a field whose whole job is to report which SDK is talking that is
 * not a stylistic preference — it is the difference between a version number and a lie. Reading it
 * through a getter costs a method call once per request.
 *
 * Same reasoning as `FrakSharingDefaults.HEIGHT_FRACTION`, and the rule is written down in
 * `docs/plans/native-sdk/09-android-api-surface.md` §5.
 *
 * `@JvmStatic` so a Java caller writes `FrakSdkVersion.getCURRENT()` rather than
 * `FrakSdkVersion.INSTANCE.getCURRENT()`.
 */
public object FrakSdkVersion {
    /**
     * Keep in step with `frak.sdk.version` in `gradle.properties`; `checkSdkVersionMatchesArtifact`
     * fails the build when they disagree, because a shipped binary that reports a version never
     * published cannot be corrected after the fact.
     */
    @JvmStatic
    public val CURRENT: String = "0.0.1"

    @JvmStatic
    public val HEADER_NAME: String = "x-frak-sdk-version"

    @JvmStatic
    public val QUERY_PARAMETER_NAME: String = "sdkVersion"
}
