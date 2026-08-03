# ProGuard/R8 rules for the Frak merchant example app.
#
# Referenced by `app/build.gradle.kts` in the release build type. The file must
# exist even while `isMinifyEnabled = false`, otherwise enabling minification
# later fails the build on a missing file rather than on a real rule problem.
#
# The example app itself needs no keep rules — Compose and Kotlin ship their own
# consumer rules. When the real Frak SDK lands it should ship *its* consumer
# rules in the artifact (`05-build-and-release.md` §4 lists consumer
# ProGuard/R8 rule verification as a CI job), not require merchants to paste
# rules in here.
