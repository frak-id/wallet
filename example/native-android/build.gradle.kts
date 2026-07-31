plugins {
    id("com.android.application") version "8.3.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    // Bundled with Kotlin from 2.0 on, so the compiler-plugin version tracks the
    // Kotlin version automatically instead of being hand-pinned.
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
    // Resolved by Gradle rather than requiring `brew install ktlint`, so
    // `bun run native:android:lint` works on a clean checkout.
    id("org.jlleitschuh.gradle.ktlint") version "12.1.1"
}

subprojects {
    apply(plugin = "org.jlleitschuh.gradle.ktlint")

    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        version.set("1.2.1")
    }
}
