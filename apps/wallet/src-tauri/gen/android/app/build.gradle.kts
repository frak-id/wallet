import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

val keyProperties = Properties().apply {
    val propFile = file("../key.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Variant selection: pass `-PappVariant=dev` (or `ORG_GRADLE_PROJECT_appVariant=dev`)
// to build the dev wallet (id.frak.wallet.dev / "Frak Wallet Dev"). Defaults to prod.
val appVariant = (project.findProperty("appVariant") as? String) ?: "prod"
val isDevVariant = appVariant == "dev"
val appName = if (isDevVariant) "Frak Wallet Dev" else "Frak Wallet"
val appLinkHost = if (isDevVariant) "wallet-dev.frak.id" else "wallet.frak.id"
val deepLinkScheme = if (isDevVariant) "frakwallet-dev" else "frakwallet"

android {
    compileSdk = 36
    ndkVersion = "29.0.14206865"
    namespace = "id.frak.wallet"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = if (isDevVariant) "id.frak.wallet.dev" else "id.frak.wallet"
        minSdk = 28
        targetSdk = 36
        versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")

        // Variant-aware resources & manifest placeholders (replace the corresponding strings.xml entries).
        resValue("string", "app_name", appName)
        resValue("string", "main_activity_title", appName)
        resValue(
            "string",
            "asset_statements",
            """[{\"include\": \"https://$appLinkHost/.well-known/assetlinks.json\"}]"""
        )
        manifestPlaceholders["appLinkHost"] = appLinkHost
        manifestPlaceholders["deepLinkScheme"] = deepLinkScheme
    }
    signingConfigs {
        create("release") {
            storeFile = file(keyProperties.getProperty("storeFile", "../upload-keystore.jks"))
            storePassword = keyProperties.getProperty("storePassword", "")
            keyAlias = keyProperties.getProperty("keyAlias", "upload")
            keyPassword = keyProperties.getProperty("keyPassword", "")
        }
    }
    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            signingConfig = signingConfigs.getByName("release")
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                jniLibs.keepDebugSymbols.add("*/x86/*.so")
                jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            signingConfig = signingConfigs.getByName("release")
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    buildFeatures {
        buildConfig = true
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.4")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.0")
}

apply(from = "tauri.build.gradle.kts")
apply(plugin = "com.google.gms.google-services")
apply(plugin = "com.google.firebase.crashlytics")