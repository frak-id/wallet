plugins {
    id("com.android.library") // AGP 9.0 compiles Kotlin itself; no `kotlin.android` plugin needed.
    alias(libs.plugins.kotlin.compose)
    id("frak-publish") // shared POM/signing + shared android {}, see buildSrc/src/main/kotlin/frak-publish.gradle.kts
}

android {
    namespace = "id.frak.sdk.ui"

    // Every resource here is already named frak_* by convention (see values/strings.xml's own
    // comment on why: unprefixed merges into the host app's namespace and can collide). This
    // makes that convention a lint failure (ResourceName) instead of a reviewer's memory, for
    // whichever resource is added next.
    resourcePrefix = "frak_"

    buildFeatures {
        compose = true
    }

    testOptions {
        unitTests {
            // Robolectric needs this to read res/AndroidManifest.xml at test startup.
            isIncludeAndroidResources = true
        }
    }
}

// explicitApi/jvmTarget/language version/jvmDefault (this module publishes `public sealed
// interface SharingResult`, so it needs the same guarantee as :frak-sdk) are shared and
// configured once by the frak-publish convention plugin applied above.

// Pin unit-test JVM to 17: newer JDKs' bytecode breaks Robolectric's bundled ASM reader.
tasks.withType<Test>().configureEach {
    javaLauncher.set(
        javaToolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(17)) },
    )
}

dependencies {
    api(project(":frak-sdk")) // merchant code passes FrakConfig/FrakClient types into the sheet

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)

    // Chrome Custom Tabs deliberately absent: can't embed in a bottom sheet, no
    // native footer, no reliable load-failure detection, no origin-pinned
    // interception. Transport is an embedded WebView instead.

    testImplementation(libs.junit)
    testImplementation(libs.json) // test-only: local android.jar stubs org.json to throw
    testImplementation(libs.robolectric) // real JVM Android runtime for WebView/Context behaviour
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
