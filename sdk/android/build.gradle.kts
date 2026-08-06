// AGP not declared here: buildSrc's `frak-publish` plugin puts it on the classpath
// unversioned; a versioned alias(...) here would conflict. Pinned in buildSrc/build.gradle.kts.
plugins {
    // No `kotlin.android` alias: AGP 9.0's built-in Kotlin owns compilation now.
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ktlint)
}

// binary-compatibility-validator, applied by id and unversioned for the same reason as AGP: the
// version lives in buildSrc/build.gradle.kts, which is what puts it on this script's classpath.
//
// Applied to the root and nowhere else. It registers no tasks here — there is no Kotlin plugin on
// the root project — but it does two things that matter: it creates the `apiValidation` extension
// below, and BCV's own task types read that extension by walking up the project hierarchy, so the
// per-module tasks `frak-publish.gradle.kts` registers pick up `nonPublicMarkers` from here without
// being told.
apply(plugin = "org.jetbrains.kotlinx.binary-compatibility-validator")

configure<kotlinx.validation.ApiValidationExtension> {
    // `@InternalFrakApi` marks declarations that are `public` only because a second Gradle module
    // has to see them. Everything annotated with it drops out of the dump entirely, which is the
    // point: `public` in Kotlin means both "a merchant may call this" and "the sibling artifact may
    // call this", and only the first belongs in a compatibility contract.
    //
    // `@Target(CLASS)` on the marker is load-bearing for this to work — a marker on a property never
    // reaches the class file as a Java annotation, so BCV cannot see it. See the annotation's KDoc.
    nonPublicMarkers.add("id.frak.sdk.InternalFrakApi")
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
