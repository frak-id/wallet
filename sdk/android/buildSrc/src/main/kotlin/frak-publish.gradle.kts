import kotlinx.validation.KotlinApiBuildTask
import kotlinx.validation.KotlinApiCompareTask
import org.gradle.kotlin.dsl.support.serviceOf
import org.gradle.process.ExecOperations
import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

plugins {
    id("com.android.library")
    `maven-publish`
    signing
    // binary-compatibility-validator is applied to the root project; wired per module below.
}

val sdkVersion: String =
    providers.gradleProperty("frak.sdk.version").get()

// Composite-build substitution matches on `project.group`, not the publication's `groupId` below.
group = "id.frak"

// Not redundant with the MavenPublication's `version`: without this `project.version` is
// "unspecified", so `:frak-sdk-ui`'s strict constraint can't match the sibling project.
version = sdkVersion

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

extensions.configure<KotlinAndroidProjectExtension> {
    explicitApi()

    compilerOptions {
        jvmTarget = JvmTarget.JVM_17

        // 2.2, not 1.9: Kotlin 2.4 dropped the K1 compiler 1.9 needed, and 2.0/2.1 are deprecated in 2.4.
        apiVersion = KotlinVersion.KOTLIN_2_2
        languageVersion = KotlinVersion.KOTLIN_2_2

        // Real JVM default methods: adding an interface method must not break older consumers.
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
                    name.set(project.findProperty("frak.pom.name") as String?)
                    description.set(
                        project.findProperty("frak.pom.description") as String?,
                    )
                    url.set("https://frak.id")

                    licenses {
                        license {
                            // Apache-2.0, not the monorepo's GPL-3.0: merchants link this
                            // into closed-source store binaries.
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
        // Skipped when credentials are absent. Read via providers so Gradle tracks them as inputs.
        val signingKey =
            providers.environmentVariable("ORG_GRADLE_PROJECT_signingInMemoryKey")
                .orElse(providers.gradleProperty("signingInMemoryKey"))
                .orNull
        val signingPassword =
            providers.environmentVariable(
                "ORG_GRADLE_PROJECT_signingInMemoryKeyPassword",
            ).orElse(providers.gradleProperty("signingInMemoryKeyPassword"))
                .orNull

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

// FrakSdkVersion.CURRENT is sent on the wire; it must match the published artifact coordinate.
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

// Measured against dex, not the AAR, which carries debug info/metadata and reads ~25% high.
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

// ABI gate: `api/<module>.api` is the frozen public surface. Wired by hand from BCV's task types
// because BCV (and KGP's `abiValidation` replacement) only hooks the standalone Kotlin plugins,
// which AGP 9 blocks — Kotlin/binary-compatibility-validator#312, KT-78025. Release variant only.
val apiFile = layout.projectDirectory.file("api/${project.name}.api")

val apiBuild =
    tasks.register<KotlinApiBuildTask>("apiBuild") {
        // No `group`, so it stays out of `./gradlew tasks`: plumbing for `apiCheck`/`apiDump`.
        description = "Extracts the public ABI of the release variant."

        // These `tasks.named` calls must stay inside this configuration action: it runs at task
        // realisation, after AGP created the compile tasks, and `named` fails eagerly otherwise.
        inputClassesDirs.from(tasks.named("compileReleaseKotlin").map { it.outputs.files })
        inputClassesDirs.from(tasks.named("compileReleaseJavaWithJavac").map { it.outputs.files })
        outputApiFile.set(layout.buildDirectory.file("bcv/${project.name}.api"))
        // `nonPublicMarkers`/`runtimeClasspath` are unset on purpose: BCV reads the former from the
        // root `apiValidation` extension, and the worker's classloader falls back to buildSrc's.
    }

val apiCheck =
    tasks.register<KotlinApiCompareTask>("apiCheck") {
        group = "verification"
        description = "Fails if the public ABI differs from the committed api/*.api dump."

        projectApiFile.set(apiFile)
        generatedApiFile.set(apiBuild.flatMap { it.outputApiFile })
    }

tasks.register<FrakApiDumpTask>("apiDump") {
    group = "verification"
    description = "Rewrites the committed api/*.api dump from the current sources."

    generatedApiFile.set(apiBuild.flatMap { it.outputApiFile })
    committedApiFile.set(apiFile)
}

// Gates `check`, so a surface widened without running `apiDump` fails locally and in CI.
tasks.named("check") { dependsOn(apiCheck) }
