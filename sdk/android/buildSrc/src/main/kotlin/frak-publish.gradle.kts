import org.gradle.kotlin.dsl.support.serviceOf
import org.gradle.process.ExecOperations

// Shared publishing setup for both artifacts, so their POM/licence/SCM cannot drift apart.

plugins {
    id("com.android.library")
    `maven-publish`
    signing
    // No binary-compatibility-validator yet: the public shape isn't frozen. Re-add before first publish.
}

val sdkVersion: String =
    providers.gradleProperty("frak.sdk.version").get()

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
                            name.set("GNU General Public License v3.0")
                            url.set("https://www.gnu.org/licenses/gpl-3.0.txt")
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
