plugins {
    id("com.android.application") version "9.1.1" apply false
    // No `org.jetbrains.kotlin.android`: AGP 9.0 ships built-in Kotlin and
    // registers its own `kotlin` extension, so applying the JetBrains plugin
    // alongside it fails outright. The Compose compiler plugin below is separate
    // and is still applied.
    //
    // Bundled with Kotlin from 2.0 on, so the compiler-plugin version tracks the
    // Kotlin version automatically instead of being hand-pinned.
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.10" apply false
    // Resolved by Gradle rather than requiring `brew install ktlint`, so
    // `bun run native:android:lint` works on a clean checkout.
    id("org.jlleitschuh.gradle.ktlint") version "14.2.0"
}

subprojects {
    apply(plugin = "org.jlleitschuh.gradle.ktlint")

    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        version.set("1.8.0")
    }
}
