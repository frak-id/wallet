plugins {
    `kotlin-dsl`
}

repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
}

dependencies {
    // Versions duplicated from gradle/libs.versions.toml: buildSrc can't see the catalog's accessors.
    implementation("com.android.tools.build:gradle:9.1.1")

    // Provides the `kotlin { }` extension frak-publish.gradle.kts configures on each library module.
    implementation("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10")

    // Declared here, not as a versioned alias, so the root can apply the plugin by id and
    // frak-publish.gradle.kts references the same task classes from one classloader. Pinned
    // deliberately: that wiring uses BCV task types that are not its public API.
    implementation("org.jetbrains.kotlinx:binary-compatibility-validator:0.18.1")

    // BCV's ABI worker needs kotlin-metadata-jvm and ASM at runtime but its POM declares neither,
    // and the worker's classloader falls back to buildSrc's. kotlin-metadata-jvm tracks the compiler
    // version, not BCV's.
    implementation("org.jetbrains.kotlin:kotlin-metadata-jvm:2.4.10")

    // Transitive through AGP today; declared so an AGP bump can't break the ABI gate.
    implementation("org.ow2.asm:asm:9.9")
    implementation("org.ow2.asm:asm-tree:9.9")
}
