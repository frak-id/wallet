import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

plugins {
    id("com.android.library") // AGP 9.0 compiles Kotlin itself; no `kotlin.android` plugin needed.
    alias(libs.plugins.kotlin.compose)
    id("frak-publish") // shared POM/signing, see buildSrc/src/main/kotlin/frak-publish.gradle.kts
}

android {
    namespace = "id.frak.sdk.ui"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = false
        compose = true
    }

    testOptions {
        unitTests {
            // Robolectric needs this to read res/AndroidManifest.xml at test startup.
            isIncludeAndroidResources = true
        }
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
            withJavadocJar() // Central requires the artifact to exist; content isn't validated
        }
    }
}

kotlin {
    explicitApi()

    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
        apiVersion = KotlinVersion.KOTLIN_2_2
        languageVersion = KotlinVersion.KOTLIN_2_2
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
