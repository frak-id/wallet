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
    // they drop out of the dump. Its targets are load-bearing — BCV only sees annotations that reach
    // the class file, so a member-level marker needs PROPERTY/FUNCTION, not just CLASS.
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

// Packs both modules into one Central Portal deployment bundle.
//
// The Portal takes a zipped Maven-layout tree over REST rather than a Maven deploy, so the
// publish path is: each module publishes to the shared local `centralBundle` repository
// (`frak-publish.gradle.kts`), then this zips the result. Uploading is deliberately not done
// here — `.github/workflows/release-android-sdk.yml` owns that, so the token never reaches a
// Gradle process and the bundle stays inspectable without credentials.
//
// One zip may carry several components, and `:core` and `:ui` ship in lockstep behind a
// `strictly` constraint, so they must go up together: publishing them as two deployments could
// land `ui` on Central pointing at a `core` that failed validation.
val centralBundle =
    tasks.register<Zip>("centralBundle") {
        group = "publishing"
        description = "Zips both artifacts into a Central Portal deployment bundle."

        dependsOn(subprojects.map { "${it.path}:publishAllPublicationsToCentralBundleRepository" })

        from(layout.buildDirectory.dir("central-bundle")) {
            // Gradle writes these for a Maven repository; they describe a repository rather than a
            // component, and the Portal rejects a bundle containing paths it cannot map to one.
            exclude("**/maven-metadata.xml*")
        }

        archiveFileName.set("central-bundle.zip")
        destinationDirectory.set(layout.buildDirectory)
    }

// Guards the one failure mode that otherwise reaches Central: `signing` is opt-in
// (`isRequired = signingKey != null`), so without credentials the build happily produces an
// unsigned bundle and the Portal is the first thing to notice, after the upload.
tasks.register("checkCentralBundle") {
    group = "verification"
    description = "Fails if the bundle is missing signatures or checksums."

    dependsOn(centralBundle)

    val bundleDir = layout.buildDirectory.dir("central-bundle")
    outputs.upToDateWhen { false }

    doLast {
        val root = bundleDir.get().asFile
        val artifacts =
            root
                .walkTopDown()
                .filter { it.isFile }
                .filterNot { it.name.startsWith("maven-metadata") }
                .filterNot { it.name.substringAfterLast('.') in setOf("asc", "md5", "sha1", "sha256", "sha512") }
                .toList()

        check(artifacts.isNotEmpty()) { "No artifacts staged in $root — did the publish task run?" }

        val missing =
            artifacts.flatMap { artifact ->
                listOf("asc", "md5", "sha1").mapNotNull { ext ->
                    "${artifact.name}.$ext".takeUnless { File(artifact.parentFile, it).exists() }
                }
            }

        check(missing.isEmpty()) {
            "Central requires a signature and md5/sha1 for every artifact. Missing:\n" +
                missing.joinToString("\n") { "  $it" } +
                "\n\nIf every .asc is missing, signing was skipped: set " +
                "ORG_GRADLE_PROJECT_signingInMemoryKey (case-sensitive) and its password."
        }

        logger.lifecycle("Bundle OK: ${artifacts.size} artifacts, each signed and checksummed.")
    }
}
