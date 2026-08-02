// AGP not declared here: buildSrc's `frak-publish` plugin puts it on the classpath
// unversioned; a versioned alias(...) here would conflict. Pinned in buildSrc/build.gradle.kts.
plugins {
    // No `kotlin.android` alias: AGP 9.0's built-in Kotlin owns compilation now.
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ktlint)
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
