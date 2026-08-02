import org.jetbrains.kotlin.gradle.dsl.JvmDefaultMode
import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import org.jetbrains.kotlin.gradle.dsl.KotlinVersion

plugins {
    id("com.android.library")
    // Shared POM, PGP signing, and the android {} config both artifacts must agree on.
    id("frak-publish")
}

android {
    namespace = "id.frak.sdk"
}

kotlin {
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

dependencies {
    // Zero third-party runtime deps except coroutines (first-party to Kotlin).
    // `api` not `implementation`: suspend/StateFlow appear in the public surface.
    api(libs.kotlinx.coroutines.core)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)

    // Test-only (stays out of the published POM). Real org.json needed because the unit
    // test classpath's stubbed android.jar throws on every android.* call.
    testImplementation(libs.json)
}
