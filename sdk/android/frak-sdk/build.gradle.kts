plugins {
    id("com.android.library")
    // Shared POM, PGP signing, and the android {} config both artifacts must agree on.
    id("frak-publish")
}

android {
    namespace = "id.frak.sdk"
}

// explicitApi/jvmTarget/language version/jvmDefault are shared with :frak-sdk-ui and configured
// once by the frak-publish convention plugin applied above.

dependencies {
    // Zero third-party runtime deps except coroutines (first-party to Kotlin).
    // `api` not `implementation`: suspend/StateFlow appear in the public surface.
    api(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)

    // Test-only (stays out of the published POM). Real org.json needed because the unit
    // test classpath's stubbed android.jar throws on every android.* call.
    testImplementation(libs.json)
}
