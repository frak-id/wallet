pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "native-android-example"
include(":app")

// Composite build against the real SDK checkout rather than a Maven coordinate: this repo
// builds the SDK from source alongside the example, so a merchant-facing change to
// sdk/android is exercised here without a publish step. A real merchant would instead just
// add `implementation("id.frak:frak-sdk:<version>")` once the artifact is on Maven Central —
// no includeBuild, no substitution block, none of what follows.
//
// GOTCHA: Gradle's automatic composite substitution matches included builds by `project.group`,
// which for sdk/android defaults to its root project name ("frak-android-sdk"), not "id.frak" —
// the "id.frak" groupId only exists inside frak-publish's MavenPublication block. Automatic
// substitution therefore silently fails to match `id.frak:frak-sdk` and Gradle would instead try
// (and fail) to resolve it from Maven Central. The substitution must be declared explicitly.
includeBuild("../../sdk/android") {
    dependencySubstitution {
        substitute(module("id.frak:frak-sdk")).using(project(":frak-sdk"))
        substitute(module("id.frak:frak-sdk-ui")).using(project(":frak-sdk-ui"))
    }
}
