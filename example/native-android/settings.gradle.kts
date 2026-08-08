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

// Gradle's automatic composite substitution derives an included build's coordinates from
// `project.group` + the Gradle module name. sdk/android publishes `id.frak.sdk:core` and
// `id.frak.sdk:ui` from modules still named `frak-sdk`/`frak-sdk-ui`, so the automatic mapping
// looks for `id.frak.sdk:frak-sdk` and misses. Without these explicit lines the coordinates below
// fall back to a Maven Central lookup and this example silently stops testing the local SDK.
includeBuild("../../sdk/android") {
    dependencySubstitution {
        substitute(module("id.frak.sdk:core")).using(project(":frak-sdk"))
        substitute(module("id.frak.sdk:ui")).using(project(":frak-sdk-ui"))
    }
}
