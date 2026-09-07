plugins {
    id("com.android.application") version "9.1.1" apply false
    // No `org.jetbrains.kotlin.android`: AGP 9.0 ships built-in Kotlin and registers its own
    // `kotlin` extension; applying the JetBrains plugin too fails outright.
    //
    // Compiler-plugin version is bundled with Kotlin from 2.0 on, tracking the Kotlin version.
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.10" apply false
    // Resolved by Gradle, not `brew install ktlint`, so lint works on a clean checkout.
    id("org.jlleitschuh.gradle.ktlint") version "14.2.0"
}

subprojects {
    apply(plugin = "org.jlleitschuh.gradle.ktlint")

    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        version.set("1.8.0")
    }
}
