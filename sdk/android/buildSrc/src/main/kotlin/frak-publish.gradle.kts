import kotlinx.validation.KotlinApiBuildTask
import kotlinx.validation.KotlinApiCompareTask
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
    // binary-compatibility-validator is NOT applied here, deliberately — it would register nothing.
    // It is applied to the root project (which owns the `apiValidation` extension) and its tasks are
    // wired per module at the bottom of this file. See the long comment there for why by hand.
}

val sdkVersion: String =
    providers.gradleProperty("frak.sdk.version").get()

// Composite-build substitution (`includeBuild("…/sdk/android")`) matches on `project.group`,
// not the `MavenPublication`'s `groupId` below — without this, a consumer falls through to
// "cannot resolve id.frak:frak-sdk" instead of resolving it locally.
group = "id.frak"

// Everything both artifacts must agree on; they ship in lockstep, so a value that differs
// between them is a bug, not a choice.
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

// Both artifacts publish public API, so explicitApi/jvmTarget/language version/jvmDefault are
// identical across both and belong here rather than duplicated per module.
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
                            // the identity proof-of-possession scheme.
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

// ---------------------------------------------------------------------------- ABI gate
//
// `api/<module>.api` is the frozen public surface. `apiCheck` fails the build when the compiled
// surface differs from it; `apiDump` rewrites it, and that rewrite is the reviewable diff in which
// an ABI change becomes a decision instead of an accident.
//
// **Hand-rolled, and it has to be.** binary-compatibility-validator registers its own `apiDump` and
// `apiCheck` only when one of `kotlin-android`, `kotlin` or `kotlin-multiplatform` is applied — and
// AGP 9 compiles Kotlin itself and *blocks* `org.jetbrains.kotlin.android`, so BCV's Android hook
// never fires and it silently does nothing (Kotlin/binary-compatibility-validator#312). The
// documented migration path, KGP's built-in `kotlin { abiValidation { } }`, is closed for the same
// reason: that DSL lives on the extension the standalone Kotlin plugin registers, not on the one AGP
// provides (KT-78025, open and unscheduled). So neither the plugin nor its replacement covers this
// build, and the choice is between wiring BCV's own task types by hand and having no gate at all.
//
// The approach is the one okhttp and elastic/apm-agent-android took for the same AGP 9 gap: feed
// `KotlinApiBuildTask` from the compile tasks' outputs. `KotlinApiBuildTask`/`KotlinApiCompareTask`
// are internal to BCV rather than public API, which is why its version is pinned in
// `buildSrc/build.gradle.kts` and not floated.
//
// Named `apiDump`/`apiCheck`, not `releaseApiDump`/`releaseApiCheck`, so the commands are the ones
// BCV's own documentation gives. If a future BCV or KGP starts registering them for this setup, this
// build fails loudly with "a task with that name already exists" — which is exactly the signal to
// delete this block, and much better than silently running two gates.
//
// Release variant only. That is the variant a merchant consumes, and it is the only one published
// (`singleVariant("release")` above). An API difference confined to `debug` would go unnoticed; there
// are no debug-only sources in either module, and adding one would be the thing to reconsider this
// over.
val apiFile = layout.projectDirectory.file("api/${project.name}.api")

val apiBuild =
    tasks.register<KotlinApiBuildTask>("apiBuild") {
        // No `group`, so it stays out of `./gradlew tasks`. BCV withholds one from its own equivalent
        // for the same reason: it is plumbing for `apiCheck`/`apiDump`, not something to run.
        description = "Extracts the public ABI of the release variant."

        // These two `tasks.named` calls must stay *inside* this configuration action. Gradle runs it
        // at task realisation, long after AGP's own `afterEvaluate` has created the variant's compile
        // tasks; hoisting them to locals above `register` — the obvious readability refactor — would
        // evaluate them during script execution instead, and `named` fails eagerly on a name that does
        // not exist yet. It is why this needs no `afterEvaluate` of its own.
        //
        // Both halves, Kotlin *and* Java. `:frak-sdk-ui`'s `JavaCallSiteFixture` is test-only so it
        // never reaches here, but a merchant-facing Java source file would, and a dump that silently
        // omitted it would be worse than no dump.
        inputClassesDirs.from(tasks.named("compileReleaseKotlin").map { it.outputs.files })
        inputClassesDirs.from(tasks.named("compileReleaseJavaWithJavac").map { it.outputs.files })
        outputApiFile.set(layout.buildDirectory.file("bcv/${project.name}.api"))
        // `nonPublicMarkers` and friends are not set here: BCV's own task base reads them from the
        // `apiValidation` extension by walking up to the root project, which is where they live.
        //
        // `runtimeClasspath` is likewise left unset, which makes the worker fall back to buildSrc's
        // classpath — and that is exactly why `kotlin-metadata-jvm` and ASM are declared there. BCV
        // normally injects them itself, from a hook AGP 9's built-in Kotlin never fires.
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

// Gating `check` means CI's `bun run --cwd sdk/android check` is the gate, and a contributor who
// widens the surface without running `apiDump` finds out locally. Until the first dump is committed
// this fails with BCV's own message telling you to run `apiDump` — which is the correct state for a
// build whose surface has just been reshaped and not yet ratified.
tasks.named("check") { dependsOn(apiCheck) }
