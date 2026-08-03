import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    // Kotlin is compiled by AGP's built-in support since AGP 9.0 — see the root
    // build. Only the Compose compiler plugin is applied by hand.
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "id.frak.example.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "id.frak.example.android"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }
}

kotlin {
    // Was `android { kotlinOptions {} }`, which AGP 9.0's built-in Kotlin removes.
    compilerOptions {
        jvmTarget = JvmTarget.JVM_17
    }
}

dependencies {
    // Ceilings for `compileSdk 36`, not the newest published. androidx AARs carry a
    // `minCompileSdk` and AGP fails the build below it: core 1.19.0 and
    // lifecycle 2.11.0 both require compileSdk 37. Raising these means raising
    // compileSdk first — and android-37 is not a platform contributors have today.
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.activity:activity-compose:1.13.0")

    implementation(platform("androidx.compose:compose-bom:2026.06.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")

    // Coordinates, not a project(...) reference: this is what a merchant actually writes. The
    // `../../sdk/android` includeBuild in settings.gradle.kts intercepts these two coordinates
    // and substitutes the source modules, so this line resolves against a local build today and
    // will resolve unchanged against Maven Central once frak-sdk/frak-sdk-ui are published —
    // this app's dependency declaration doesn't need to know which is happening.
    implementation("id.frak:frak-sdk:0.0.1")
    implementation("id.frak:frak-sdk-ui:0.0.1")

    testImplementation("junit:junit:4.13.2")
}
