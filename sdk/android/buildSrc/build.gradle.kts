// buildSrc exists so `frak-publish.gradle.kts`, a precompiled script plugin, has its own build.
plugins {
    `kotlin-dsl`
}

repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
}

dependencies {
    // Duplicated from gradle/libs.versions.toml: buildSrc can't see the catalog's own accessors.
    implementation("com.android.tools.build:gradle:9.1.1")

    // Configures the `kotlin { }` extension AGP 9 registers on each Android library module
    // (org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension) from frak-publish.gradle.kts.
    // Version matches gradle/libs.versions.toml's `kotlin` entry; buildSrc can't see the catalog.
    implementation("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10")
}
