import org.gradle.kotlin.dsl.support.serviceOf
import org.gradle.process.ExecOperations
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

// Shared publishing setup for both artifacts, so their POM/licence/SCM cannot drift apart.

plugins {
    id("com.android.library")
    `maven-publish`
    signing
    // No binary-compatibility-validator yet: the public shape isn't frozen. Re-add before first publish.
}

val sdkVersion: String =
    providers.gradleProperty("frak.sdk.version").get()

// Composite-build dependency substitution (`includeBuild("…/sdk/android")`) matches on
// `project.group`, not the `MavenPublication`'s `groupId` below — without this, a consumer
// doing that falls through to "cannot resolve id.frak:frak-sdk from Maven Central" instead of
// being substituted locally. The publication keeps its own explicit `groupId` too, so the
// published POM stays pinned even if this ever needs to diverge.
group = "id.frak"

// Everything both artifacts must agree on. Kept here rather than in each module because the
// two ship in lockstep: a value that differs between them is a bug, not a choice.
android {
    compileSdk = 36

    defaultConfig {
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        // SDK version lives in FrakSdkVersion.kt as a reviewable constant instead.
        buildConfig = false
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
            // Central requires a javadoc artifact to exist but never opens it; near-empty jar is fine.
            withJavadocJar()
        }
    }
}

// Both artifacts publish public API (:frak-sdk-ui publishes `public sealed interface
// SharingResult`, among others), so explicitApi/jvmTarget/language version/jvmDefault are
// identical across both and belong here rather than duplicated per module. A module needing a
// genuinely different value would configure `kotlin { }` again itself — the last configuration
// wins — but none currently does.
extensions.configure<KotlinAndroidProjectExtension> {
    // Published library: explicit visibility/return type on every public symbol,
    // so nothing silently widens the frozen API.
    explicitApi()

    compilerOptions {
        jvmTarget = JvmTarget.JVM_17

        // Raised from 1.9: Kotlin 2.4 dropped the K1 compiler that guarantee needed.
        // 2.2 not 2.0/2.1: those are already deprecated in 2.4.
        apiVersion = KotlinVersion.KOTLIN_2_2
        languageVersion = KotlinVersion.KOTLIN_2_2

        // Real JVM default methods, not synthetic DefaultImpls: adding an interface method
        // must not AbstractMethodError merchants on an older artifact version.
        jvmDefault = JvmDefaultMode.NO_COMPATIBILITY
    }
}

// afterEvaluate required: AGP registers the `release` component only after its own evaluation.
afterEvaluate {
    extensions.configure<PublishingExtension> {
        publications {
            register<MavenPublication>("release") {
                groupId = "id.frak"
                artifactId = project.name
                version = sdkVersion

                from(components["release"])

                pom {
                    // name/description are per-module; everything below is identical across artifacts.
                    name.set(project.findProperty("frak.pom.name") as String?)
                    description.set(
                        project.findProperty("frak.pom.description") as String?,
                    )
                    url.set("https://frak.id")

                    licenses {
                        license {
                            // Apache-2.0, not the monorepo's GPL-3.0: merchants statically link
                            // this into closed-source store binaries, and the patent grant covers
                            // the identity proof-of-possession scheme. See sdk/android/LICENSE.
                            name.set("The Apache License, Version 2.0")
                            url.set("https://www.apache.org/licenses/LICENSE-2.0.txt")
                        }
                    }

                    developers {
                        developer {
                            id.set("frak-labs")
                            name.set("Frak Labs")
                            url.set("https://frak.id")
                        }
                    }

                    scm {
                        url.set("https://github.com/frak-id/wallet")
                        connection.set(
                            "scm:git:https://github.com/frak-id/wallet.git",
                        )
                        developerConnection.set(
                            "scm:git:ssh://git@github.com/frak-id/wallet.git",
                        )
                    }
                }
            }
        }
    }

    extensions.configure<SigningExtension> {
        // Signing skipped entirely when credentials are absent, so local builds/CI don't need a key.
        // Read via providers, not System.getenv, so Gradle tracks them as configuration inputs.
        val signingKey =
            providers.environmentVariable("ORG_GRADLE_PROJECT_signingInMemoryKey")
                .orElse(providers.gradleProperty("signingInMemoryKey"))
                .orNull
        val signingPassword =
            providers.environmentVariable(
                "ORG_GRADLE_PROJECT_signingInMemoryKeyPassword",
            ).orElse(providers.gradleProperty("signingInMemoryKeyPassword"))
                .orNull

        // Opt-in by key presence: no way to accidentally publish unsigned or be forced to hold a key to build.
        isRequired = signingKey != null

        if (signingKey != null) {
            // Must run before sign(...), or the publication has no signatory yet.
            useInMemoryPgpKeys(signingKey, signingPassword.orEmpty())
            sign(
                extensions.getByType<PublishingExtension>()
                    .publications["release"],
            )
        }
    }
}

// FrakSdkVersion.CURRENT is sent on the wire; it must match the published artifact coordinate,
// or a shipped binary reports a version that was never published and cannot be corrected.
val checkSdkVersionMatchesArtifact =
    tasks.register("checkSdkVersionMatchesArtifact") {
        group = "verification"
        description =
            "Fails if FrakSdkVersion.CURRENT disagrees with frak.sdk.version."

        val source =
            rootProject.file(
                "frak-sdk/src/main/kotlin/id/frak/sdk/FrakSdkVersion.kt",
            )
        val expected = sdkVersion

        inputs.file(source)
        inputs.property("expected", expected)
        // Marker output keeps the task cacheable rather than re-running every build.
        outputs.file(layout.buildDirectory.file("frak-version-check.txt"))

        doLast {
            val declared =
                Regex("""CURRENT:\s*String\s*=\s*"([^"]+)"""")
                    .find(source.readText())
                    ?.groupValues
                    ?.get(1)
                    ?: error("Could not find FrakSdkVersion.CURRENT in $source")

            check(declared == expected) {
                "FrakSdkVersion.CURRENT is \"$declared\" but frak.sdk.version is \"$expected\". " +
                    "These must match the published coordinate."
            }

            outputs.files.singleFile.writeText("ok: $declared\n")
        }
    }

tasks.named("check") { dependsOn(checkSdkVersionMatchesArtifact) }

// Budget measured against dex, not the AAR: the AAR carries debug info/metadata that never
// reaches a device and reads ~25% high. d8 without R8: the SDK's own pessimistic cost.
val checkDexSizeBudget =
    tasks.register("checkDexSizeBudget") {
        group = "verification"
        description = "Fails if the release dex exceeds the per-platform size budget."

        val aar =
            layout.buildDirectory.file("outputs/aar/${project.name}-release.aar")
        val budgetKb =
            (project.findProperty("frak.sdk.dexBudgetKb") as String?)?.toInt()
                ?: error("frak.sdk.dexBudgetKb is not set in gradle.properties")
        val workDir = layout.buildDirectory.dir("dex-size-check")

        // Read at configuration time: inside doLast a bare `project` is deprecated/errors in Gradle 9/10.
        val moduleName = project.name
        val sdkDir = androidComponents.sdkComponents.sdkDirectory

        // Project.exec {} removed in Gradle 9; ExecOperations resolved here since doLast can't inject services.
        val execOps = serviceOf<ExecOperations>()

        dependsOn("assembleRelease")
        inputs.file(aar)
        inputs.property("budgetKb", budgetKb)
        outputs.file(layout.buildDirectory.file("dex-size-check/result.txt"))

        doLast {
            // Newest build-tools wins: d8 is backward compatible; pinning a version would break other machines.
            val d8 =
                File(sdkDir.get().asFile, "build-tools").listFiles()
                    ?.filter { File(it, "d8").canExecute() }
                    ?.maxByOrNull { it.name }
                    ?.let { File(it, "d8") }
                    ?: error("No build-tools with d8 found in ${sdkDir.get().asFile}.")

            val out = workDir.get().asFile.apply { deleteRecursively(); mkdirs() }
            val classes = File(out, "classes.jar")
            copy {
                from(zipTree(aar.get().asFile)) { include("classes.jar") }
                into(out)
            }

            // A resource-only module has no classes.jar; that's a pass, not a failure.
            if (!classes.exists()) {
                outputs.files.singleFile.writeText("ok: no classes.jar\n")
                return@doLast
            }

            execOps.exec {
                commandLine(
                    d8.absolutePath, "--release", "--min-api", "24",
                    "--output", out.absolutePath, classes.absolutePath,
                )
            }

            val dexBytes =
                out.listFiles().orEmpty()
                    .filter { it.name.endsWith(".dex") }
                    .sumOf { it.length() }
            val dexKb = dexBytes / 1024

            check(dexKb <= budgetKb) {
                "$moduleName release dex is ${dexKb} KB, over the ${budgetKb} KB budget. " +
                    "Either cut it or change the budget deliberately."
            }

            logger.lifecycle("[$moduleName] dex ${dexKb} KB / ${budgetKb} KB budget")
            outputs.files.singleFile.writeText("ok: ${dexKb} KB\n")
        }
    }

tasks.named("check") { dependsOn(checkDexSizeBudget) }
