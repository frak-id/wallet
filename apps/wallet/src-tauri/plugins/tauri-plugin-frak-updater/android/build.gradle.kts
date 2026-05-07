plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    compileSdk = 34
    namespace = "id.frak.updater"
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
    implementation("androidx.core:core-ktx:1.13.1")
    // Play In-App Updates: drives the FLEXIBLE soft-update flow (background
    // download + "Restart" prompt) and reports whether a Play release is
    // newer than the installed APK. `app-update-ktx` adds the Kotlin
    // extensions used here (`requestAppUpdateInfo`, `Task<AppUpdateInfo>`).
    implementation("com.google.android.play:app-update:2.1.0")
    implementation("com.google.android.play:app-update-ktx:2.1.0")
}
