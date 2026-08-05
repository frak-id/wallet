plugins {
    id("com.android.library") // AGP 9.0 compiles Kotlin itself; no `kotlin.android` plugin needed.
    alias(libs.plugins.kotlin.compose)
    id("frak-publish") // shared POM/signing + shared android {}, see buildSrc/src/main/kotlin/frak-publish.gradle.kts
}

android {
    namespace = "id.frak.sdk.ui"

    // A library's resources merge into the host app's namespace, where an unprefixed `share`
    // would collide with the merchant's own. Prefixing also lets a merchant override one by
    // declaring the same name in their app; the merger takes theirs.
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

// explicitApi/jvmTarget/language version/jvmDefault are shared and configured once by the
// frak-publish convention plugin applied above.

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

    // `api`, not `implementation`: `ComponentActivity` is a parameter of
    // `FrakSharing.Builder.build(...)`, so a merchant cannot call the public API without it on
    // their own compile classpath. `ComponentDialog` — the sheet's hosting window — ships in the
    // same artifact.
    api(libs.androidx.activity)

    // `@MainThread` only. CLASS retention, so consumers need nothing at runtime.
    implementation(libs.androidx.annotation)

    // One API: `addDocumentStartJavaScript`. It is what lets the sheet style the hosted page by
    // origin instead of by route — see `SharingHostStyle`. `implementation`, not `api`: no type
    // from it appears on this module's public surface, so it stays off merchants' compile
    // classpath and cannot conflict with a webkit version they pull in themselves.
    implementation(libs.androidx.webkit)

    // Chrome Custom Tabs deliberately absent: can't embed in a bottom sheet or intercept the
    // page's own Share/Copy. Transport is an embedded WebView instead.

    testImplementation(libs.junit)
    testImplementation(libs.json) // test-only: local android.jar stubs org.json to throw
    testImplementation(libs.robolectric) // real JVM Android runtime for WebView/Context behaviour
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
