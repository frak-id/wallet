plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    compileSdk = 34
    namespace = "com.plugin.recovery_hint"
    defaultConfig {
        minSdk = 28
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(project(":tauri-android"))
    // Google Block Store — tiny encrypted KV that survives uninstall and
    // is restored on new-device setup when the user signs back into Google.
    implementation("com.google.android.gms:play-services-auth-blockstore:16.4.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")
}
