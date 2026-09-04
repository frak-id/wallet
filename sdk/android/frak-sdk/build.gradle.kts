plugins {
    id("com.android.library")
    // Shared POM, PGP signing, and the android {} config both artifacts must agree on.
    id("frak-publish")
}

android {
    namespace = "id.frak.sdk"

    testOptions {
        unitTests {
            // Robolectric needs this to read res/AndroidManifest.xml at test startup.
            isIncludeAndroidResources = true
        }
    }
}

// Pin unit-test JVM to 17: newer JDKs' bytecode breaks Robolectric's bundled ASM reader.
tasks.withType<Test>().configureEach {
    javaLauncher.set(
        javaToolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(17)) },
    )
}

// explicitApi/jvmTarget/language version/jvmDefault are shared with :frak-sdk-ui and configured
// once by the frak-publish convention plugin applied above.

dependencies {
    // Zero third-party runtime deps except coroutines (first-party to Kotlin).
    // `api` not `implementation`: suspend/StateFlow appear in the public surface.
    api(libs.kotlinx.coroutines.core)

    // Compile-only, so it stays out of the POM: `DeepLinkObserver` uses
    // `OnNewIntentProvider` when the host activity happens to implement it, and degrades to
    // reading `activity.intent` when the class is not on the runtime classpath at all.
    compileOnly(libs.androidx.core)

    testImplementation(libs.androidx.core)
    testImplementation(libs.junit)
    // Real JVM Android runtime: `DeepLinkObserver` handles Intent/Uri, which the stubbed
    // `android.jar` throws on.
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)

    // Test-only (stays out of the published POM). Real org.json needed because the unit
    // test classpath's stubbed android.jar throws on every android.* call.
    testImplementation(libs.json)
}
