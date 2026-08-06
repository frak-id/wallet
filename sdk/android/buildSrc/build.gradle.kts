// buildSrc exists so `frak-publish.gradle.kts`, a precompiled script plugin, has its own build.
plugins {
    `kotlin-dsl`
}

repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
}

dependencies {
    // Duplicated from gradle/libs.versions.toml: buildSrc can't see the catalog's own accessors.
    implementation("com.android.tools.build:gradle:9.1.1")

    // Configures the `kotlin { }` extension AGP 9 registers on each Android library module
    // (org.jetbrains.kotlin.gradle.dsl.KotlinAndroidProjectExtension) from frak-publish.gradle.kts.
    // Version matches gradle/libs.versions.toml's `kotlin` entry; buildSrc can't see the catalog.
    implementation("org.jetbrains.kotlin:kotlin-gradle-plugin:2.4.10")

    // binary-compatibility-validator. Declared here rather than as a versioned `alias(...)` in the
    // root build for the same reason AGP is: a buildSrc `implementation` dependency joins the build
    // script classpath of every project, so the root can apply the plugin by id and
    // `frak-publish.gradle.kts` can reference its task types — one classloader, one identity for
    // `KotlinApiBuildTask`. Two declarations would give two, and a `KotlinApiBuildTask` registered
    // from here would not be the same class the plugin configures.
    //
    // Version matches gradle/libs.versions.toml's `bcv` entry. Pinned deliberately: the wiring in
    // frak-publish.gradle.kts uses BCV's task types directly, and those are not its public API.
    implementation("org.jetbrains.kotlinx:binary-compatibility-validator:0.18.1")

    // BCV's ABI worker needs these three at runtime and its POM declares neither — it publishes
    // exactly one dependency, java-diff-utils. Normally BCV's own plugin injects them when it
    // configures a Kotlin plugin (`withKotlinPluginVersion { }`), and that hook is precisely what AGP
    // 9's built-in Kotlin never triggers, so the wiring in frak-publish.gradle.kts has to bring them.
    //
    // `KotlinApiBuildTask` runs its work in a classloader-isolated worker whose classpath falls back
    // to buildSrc's, so declaring them here is what puts them in front of the worker. Without
    // kotlin-metadata-jvm the first `apiBuild` dies with `NoClassDefFoundError: kotlin/metadata/jvm/…`
    // — it is how BCV reads `@Metadata` to tell a Kotlin `internal` from a JVM `public`, which is most
    // of what the dump is for.
    //
    // kotlin-metadata-jvm tracks the *compiler* version, not BCV's: it parses metadata this build's
    // Kotlin emitted, and BCV itself resolves it from the Kotlin plugin version when it can.
    implementation("org.jetbrains.kotlin:kotlin-metadata-jvm:2.4.10")

    // ASM arrives transitively through AGP today (asm-analysis -> asm-tree -> asm). Declared anyway:
    // an AGP bump that stops leaking it would break the ABI gate with a NoClassDefFoundError that
    // looks nothing like a dependency problem, and a gate that fails for an unrelated reason is worse
    // than no gate.
    implementation("org.ow2.asm:asm:9.9")
    implementation("org.ow2.asm:asm-tree:9.9")
}
