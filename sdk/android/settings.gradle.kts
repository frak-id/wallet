pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    // Modules may not declare their own repositories: every coordinate this
    // build resolves is decided here, so a stray `repositories {}` in a module
    // fails the build instead of silently widening the supply chain.
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "frak-android-sdk"

// Two artifacts, so a merchant taking only tracking never pulls in a web view
// (02-native-sdk-overview.md §2).
include(":frak-sdk")
include(":frak-sdk-ui")
