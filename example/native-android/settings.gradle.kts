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

// Gradle's automatic composite substitution matches on `project.group`, which sdk/android
// does not set to "id.frak" — without this explicit declaration, `id.frak:*` would not resolve.
includeBuild("../../sdk/android") {
    dependencySubstitution {
        substitute(module("id.frak:frak-sdk")).using(project(":frak-sdk"))
        substitute(module("id.frak:frak-sdk-ui")).using(project(":frak-sdk-ui"))
    }
}
