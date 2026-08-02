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
}
