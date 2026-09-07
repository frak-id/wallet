# Consumer R8 / ProGuard rules for `id.frak.sdk:core`.
#
# These rules ship inside the AAR (wired via `consumerProguardFiles` in build.gradle.kts). R8
# reads them out of the artifact and merges them into the merchant app's configuration
# automatically, so a merchant pastes nothing into their own `proguard-rules.pro`.
#
# The rule of thumb for what belongs here: anything R8 cannot see is reachable.
# Reflection, serialization, JNI, and types named only from a string.
#
# Empty on purpose: nothing here is reached by reflection or JNI, and no type is named only
# from a string, so R8 can trace every entry point from the public API. The one serialization
# surface, FrakError's `readResolve` on its `object` arms, is not exercised by anything in the
# SDK. Rules land alongside the code that needs them. Expected future entries:
#
#   - the public API surface, so merchant code compiled against it keeps
#     resolving after minification
#   - JSON model classes whose field names are the wire format (verify before
#     assuming — the SDK hand-rolls JSON per the zero-dependency rule)
#   - anything held by the durable offline tracking queue across a process death
#
# Do not pre-emptively add a blanket `-keep class id.frak.sdk.** { *; }`: that disables
# shrinking of the entire SDK in every merchant build and hands us a permanent size regression
# to explain.
