# Consumer R8 / ProGuard rules for `id.frak:frak-sdk`.
#
# These rules ship INSIDE the AAR (wired via `consumerProguardFiles` in
# build.gradle.kts). R8 reads them out of the artifact and merges them into the
# merchant app's configuration automatically, so a merchant pastes NOTHING into
# their own `proguard-rules.pro` — see 03-implementation-strategy.md §5.4, which
# lists "consumer ProGuard/R8 rule verification" as its own CI job precisely
# because a missing rule here surfaces only in a minified release build, in
# someone else's app, after they shipped.
#
# The rule of thumb for what belongs here: anything R8 cannot see is reachable.
# Reflection, serialization, JNI, and types named only from a string.
#
# Empty on purpose: nothing here is reached by reflection or JNI, and no type is named
# only from a string, so R8 can trace every entry point from the public API. The one
# serialization surface is FrakError's `readResolve` on its `object` arms, and nothing in
# the SDK serializes one. Rules land alongside
# the code that needs them. Expected future entries:
#
#   - the public API surface, so merchant code compiled against it keeps
#     resolving after minification
#   - JSON model classes whose field names are the wire format (the SDK hand-rolls
#     JSON per the zero-dependency rule, so this may end up unnecessary — verify
#     rather than assume)
#   - anything held by the durable offline tracking queue across a process death
#
# Do NOT pre-emptively add a blanket `-keep class id.frak.sdk.** { *; }`. That
# disables shrinking of the entire SDK in every merchant build and hands us a
# permanent size regression to explain.
