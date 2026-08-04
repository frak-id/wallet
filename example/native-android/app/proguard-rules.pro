# ProGuard/R8 rules for the Frak merchant example app.
#
# Referenced by `app/build.gradle.kts` even though `isMinifyEnabled = false`, so the file
# must exist before minification is ever turned on.
#
# No keep rules needed here — Compose and Kotlin ship their own consumer rules. The real
# Frak SDK should ship its own consumer rules in the artifact, not require merchants to
# paste rules in here.
