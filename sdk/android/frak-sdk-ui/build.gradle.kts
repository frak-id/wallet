plugins {
    id("com.android.library") // AGP 9.0 compiles Kotlin itself; no `kotlin.android` plugin needed.
    alias(libs.plugins.kotlin.compose)
    id("frak-publish") // shared POM/signing + shared android {}
}

android {
    namespace = "id.frak.sdk.ui"

    // A library's resources merge into the host app's namespace, where an unprefixed `share` would
    // collide with the merchant's own.
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

// Pin unit-test JVM to 17: newer JDKs' bytecode breaks Robolectric's bundled ASM reader.
tasks.withType<Test>().configureEach {
    javaLauncher.set(
        javaToolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(17)) },
    )
}

dependencies {
    api(project(":frak-sdk")) // merchant code passes FrakConfig/FrakClient types into the sheet

    // The two ship in lockstep, but `api(project(...))` alone publishes a *required* version Gradle
    // may upgrade. A constraint, because a `ProjectDependency` has no `version {}` block.
    constraints {
        api("id.frak.sdk:core") {
            version { strictly(providers.gradleProperty("frak.sdk.version").get()) }
            because(
                "frak-sdk-ui compiles against @InternalFrakApi members of frak-sdk that the ABI " +
                    "gate cannot see, so the pair must resolve exactly",
            )
        }
    }

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)

    // `api`, not `implementation`: `ComponentActivity` is a parameter of
    // `FrakSharing.Builder.build(...)`, and `ComponentDialog` (the sheet's window) ships with it.
    api(libs.androidx.activity)

    // `WindowCompat.enableEdgeToEdge` only, which needs 1.18.0. Declared rather than taken from
    // activity's `api`, so the sheet's window styling does not break on an activity bump.
    implementation(libs.androidx.core)

    // `@MainThread` only. CLASS retention, so consumers need nothing at runtime.
    implementation(libs.androidx.annotation)

    // Only for `addDocumentStartJavaScript`, which styles the hosted page by origin. No type from it
    // is on this module's public surface, so it stays off merchants' compile classpath.
    implementation(libs.androidx.webkit)

    testImplementation(libs.junit)
    testImplementation(libs.json) // test-only: local android.jar stubs org.json to throw
    testImplementation(libs.robolectric) // real JVM Android runtime for WebView/Context behaviour
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.kotlinx.coroutines.test)
}
