plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    compileSdk = 36
    namespace = "com.plugin.frak_firebase"
    defaultConfig {
        minSdk = 28
        consumerProguardFiles("consumer-rules.pro")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(project(":tauri-android"))

    // Single Firebase BoM pinning FCM + Crashlytics + NDK Crashlytics to the
    // same internal Firebase version. Bumping this single coordinate keeps
    // the surface coherent across the FCM and Crashlytics halves of this plugin.
    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))

    // FCM — push notifications token + topic + send.
    implementation("com.google.firebase:firebase-messaging-ktx")

    // Java/Kotlin uncaught-exception handler + custom keys/logs/recordError.
    implementation("com.google.firebase:firebase-crashlytics-ktx")

    // Native (C/C++/Rust) signal handler. Captures SIGABRT/SIGSEGV from the
    // Tauri Rust binary; symbols are best-effort until ./gradlew
    // uploadCrashlyticsSymbolFile{Variant} runs in CI.
    implementation("com.google.firebase:firebase-crashlytics-ndk")

    // FCM permission-callback helpers + notification builder.
    implementation("androidx.core:core-ktx:1.13.1")
}
