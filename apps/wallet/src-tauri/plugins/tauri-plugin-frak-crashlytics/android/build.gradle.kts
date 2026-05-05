plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    compileSdk = 34
    namespace = "com.plugin.frak_crashlytics"
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
    // Pin firebase-bom so Crashlytics, NDK Crashlytics and the Messaging
    // plugin (already on classpath via tauri-plugin-fcm) all align on the
    // same internal Firebase version. Bumping this single coordinate keeps
    // the surface coherent.
    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    // Java/Kotlin uncaught-exception handler + custom keys/logs/recordError.
    implementation("com.google.firebase:firebase-crashlytics-ktx")
    // Native (C/C++/Rust) signal handler. Captures SIGABRT/SIGSEGV from the
    // Tauri Rust binary; symbols are best-effort until ./gradlew
    // uploadCrashlyticsSymbolFile{Variant} runs in CI.
    implementation("com.google.firebase:firebase-crashlytics-ndk")
}
