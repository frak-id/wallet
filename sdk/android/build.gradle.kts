// AGP is deliberately not declared here: buildSrc's `frak-publish` plugin puts it on the classpath
// unversioned, and a versioned `alias(...)` here would conflict. Pinned in buildSrc/build.gradle.kts.
plugins {
    // No `kotlin.android` alias: AGP 9.0's built-in Kotlin owns compilation now.
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ktlint)
}

// binary-compatibility-validator, unversioned for the same reason as AGP. Applied to the root only:
// it registers no tasks here, but it owns the `apiValidation` extension below, which the per-module
// tasks registered by frak-publish.gradle.kts read by walking up the project hierarchy.
apply(plugin = "org.jetbrains.kotlinx.binary-compatibility-validator")

configure<kotlinx.validation.ApiValidationExtension> {
    // `@InternalFrakApi` marks declarations that are public only so the sibling module can see them;
    // they drop out of the dump. Its `@Target(CLASS)` is load-bearing — BCV only sees annotations
    // that reach the class file.
    nonPublicMarkers.add("id.frak.sdk.InternalFrakApi")

    // Compose emits this per-file holder `public` though its only member is `internal`. Its name is
    // keyed off the file name, so freezing it would make renaming the file an ABI break.
    ignoredClasses.add("id.frak.sdk.ui.ComposableSingletons\$FrakSharingSheetKt")
}

// `libs` catalog accessor only exists on this project, not the subproject receiver below.
val ktlintEngineVersion =
    libs.versions.ktlint.engine
        .get()

subprojects {
    apply(plugin = "org.jlleitschuh.gradle.ktlint")

    configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
        version.set(ktlintEngineVersion)
    }
}
