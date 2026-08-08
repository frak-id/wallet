import kotlinx.validation.KotlinApiBuildTask
import kotlinx.validation.KotlinApiCompareTask
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
// `id.frak.sdk` and not `id.frak`: the verified Central namespace is `id.frak.sdk`, and Sonatype
// grants authorization downwards only — it covers `id.frak.sdk.*`, never the parent.
group = "id.frak.sdk"

// The Gradle module name is not the published artifact name. Modules keep their `frak-sdk` names
// because the ABI gate keys its dump path off `project.name` (`api/<project.name>.api`, below),
// and renaming them would churn both committed dumps for a cosmetic win.
val artifactName: String =
    when (project.name) {
        "frak-sdk" -> "core"
        "frak-sdk-ui" -> "ui"
        else -> error("frak-publish applied to an unmapped module: ${project.name}")
    }

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
                groupId = "id.frak.sdk"
                artifactId = artifactName
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
