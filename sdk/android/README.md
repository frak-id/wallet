# Frak Native SDK — Android

Gradle multi-module **library** project for the Frak native Android SDK. Not an
app: there is nothing to install and nothing to launch, so no command here ever
needs a device or an emulator.

> ⚠️ **Partial. Config, rewards, identity and share links work; nothing else exists yet.**
>
> What is implemented and tested (151 JVM unit tests — `grep -rhoP '^\s*@Test\b' frak-sdk/src/test --include=*.kt | wc -l`):
>
> | Package | What is there |
> | --- | --- |
> | `core` | `FrakConfig`, `FrakEnvironment`, `FrakMetadata`, `FrakError`, `FrakLogSink`, `FrakLogger`, `DefaultFrakClient` |
> | `net` | `HttpClient` over `HttpURLConnection`, `JsonReader` |
> | `config` | `ConfigStore` (SWR), `MerchantQuery`, `KeyValueStore`, `SingleFlight`, `Backoff` |
> | `rewards` | models, decoder and `RewardRepository` for `estimated-rewards` |
> | `identity` | `AnonymousIdStore`, the P-256 keystore keypair, and `ProofCodec` (id derivation + the proof envelope) |
> | `sharing` | `FrakContextCodec` (the `fCtx` v2 binary layout), `SharingLinkBuilder`, attribution merging |
>
> Public surface: `Frak.initialize` / `Frak.client`, `FrakClient.resolveConfig`,
> `configUpdates`, `campaigns`, `bestReward`, `anonymousId`, `resetAnonymousId`,
> `buildSharingLink` and `Frak.parseReferralLink`, plus `FrakContext`,
> `SharingRequest`, `SharingProduct` and `AttributionParams`,
> `FrakLogSink`, and the ten public
> config model types: `FrakResolvedConfig`, `ResolvedSdkConfig`, `ResolvedPlacement`,
> `ResolvedComponents`, `ButtonShareConfig`, `ButtonWalletConfig`, `OpenInAppConfig`,
> `PostPurchaseConfig`, `BannerConfig` and `AttributionDefaults`.
>
> A merchant can route SDK diagnostics into their own logging by setting `FrakConfig.logSink`
> (a `fun interface`, so a lambda works) — see "Logging" below.
>
> **Not implemented**: sending `x-frak-client-id` on the wire (nothing calls an
> id-keyed endpoint yet), interaction and purchase tracking, the durable offline
> queue, inbound `fCtx` handling and the self-referral
> guard, the sharing sheet, the install flow, and the 4-tier copy precedence.
> `tracking/` and `applink/` are still empty packages.
>
> The full resolve response *is* decoded — placements, component copy,
> translations, attribution — and the whole tree is `public`, not just the
> fields this increment acts on directly. Its reader, the sharing sheet, lives
> in `frak-sdk-ui`, a separate Gradle module that only sees `public` API, so
> keeping the tree `internal` here would make it structurally impossible for
> that module to consume — "promote later" was never actually available.
> None of these types are `data class`es: a published `copy()`/`componentN()`
> would enter the ABI and could never be removed, so every one is a plain class
> with hand-written `equals`/`hashCode`/`toString` and constructor defaults
> instead (`docs/plans/native-sdk/03-implementation-strategy.md` §5.3). That
> alone does **not** make these types able to gain a field later: every
> constructor is public with default arguments, which Kotlin compiles to a
> full-arity `<init>` plus a synthetic `<init>(..., int mask, DefaultConstructorMarker)`
> — adding a parameter changes both descriptors, so an already-compiled
> merchant binary still gets `NoSuchMethodError`. Making them additively
> evolvable (a `Builder`, or an internal constructor plus additive factory
> functions) is an open decision, not yet implemented.
>
> `example/native-android` still talks to a type-only stub. Wiring it to these
> artifacts through `mavenLocal()` is the next step.

## Artifacts

Two, so a merchant taking only tracking never pulls in a web view
(`docs/plans/native-sdk/02-native-sdk-overview.md` §2):

| Module | Coordinate | Namespace | Contents |
| --- | --- | --- | --- |
| `frak-sdk` | `id.frak:frak-sdk` | `id.frak.sdk` | Core. UI-free and headlessly testable. |
| `frak-sdk-ui` | `id.frak:frak-sdk-ui` | `id.frak.sdk.ui` | The sharing sheet. Depends on core. |

`minSdk 24`, Java/JVM target 17, and the Kotlin language and API levels are pinned
to **1.9** so merchants still on Kotlin 1.9 can consume the artifacts (02 §2).

Both modules run with `kotlin { explicitApi() }`: every public symbol needs an
explicit visibility modifier and an explicit return type. Adding a helper without
thinking cannot silently widen an API surface we are then stuck supporting inside
someone else's frozen binary.

## Publishing

Distribution is **Maven Central via the Central Publisher Portal**, not the
decommissioned OSSRH endpoints — see
`docs/plans/native-sdk/03-implementation-strategy.md` §3.2.

The POM is Central-valid today. `buildSrc/src/main/kotlin/frak-publish.gradle.kts`
is a convention plugin applied by both modules, so they cannot drift apart on
licence, developers or SCM — every field Central requires is there, plus the
sources and javadoc jars it checks for. Verify with:

```bash
bun run --cwd sdk/android publishLocal
cat ~/.m2/repository/id/frak/frak-sdk/0.0.1/frak-sdk-0.0.1.pom
```

**Signing is opt-in by key presence.** Set `ORG_GRADLE_PROJECT_signingInMemoryKey`
(the armoured private key) and, if the key is protected,
`ORG_GRADLE_PROJECT_signingInMemoryKeyPassword`. With no key set, signing is
skipped and the build still succeeds — so nobody needs a private key to build,
and there is no flag that could accidentally publish unsigned to Central.

Two things are still outstanding, both needing a human rather than code: claiming
the `id.frak` namespace (a TXT record on the `frak.id` apex — we own the Route 53
zone) and generating the real GPG key. Neither has a queue: Portal verification is
automated and same-day.

> **Open question — the licence.** The POM declares GPL-3.0, matching the
> monorepo `LICENSE` and the published JS SDKs. That is a defensible choice for a
> CDN bundle a merchant loads at runtime; it is a much bigger ask for a native
> artifact a merchant **statically links into their proprietary app**, where the
> copyleft reading is aggressive and most merchant legal teams will simply refuse.
> Every comparable SDK (Branch, AppsFlyer, Adjust) ships permissive — MIT or
> Apache-2.0. This needs a deliberate decision before the first publish, because
> relicensing after merchants have integrated is far harder than choosing now.

## Binary Compatibility Validator

Both modules run [kotlinx-binary-compatibility-validator](https://github.com/Kotlin/binary-compatibility-validator)
(BCV), wired once in `buildSrc/src/main/kotlin/frak-publish.gradle.kts` so
`:frak-sdk` and `:frak-sdk-ui` cannot drift on this any more than they can on
POM metadata. `explicitApi()` (above) only forces you to *write* `public`; it
says nothing about whether a change just *changed* something public. BCV is
what catches that: it dumps every public symbol's JVM descriptor into
`frak-sdk/api/frak-sdk.api` and `frak-sdk-ui/api/frak-sdk-ui.api`, committed to
git, and `apiCheck` — part of `check`, wired next to `checkSdkVersionMatchesArtifact`
and `checkDexSizeBudget` — fails the build if the live public surface disagrees
with the committed dump.

`check` is more than those three gates: for an AGP library module it also runs
`ktlintCheck`, the `test` task (JVM unit tests) and Android Lint. Android Lint
has never been executed in this project — there is no JDK in this environment
and no CI job runs it either — so its first run may surface pre-existing
findings unrelated to whatever change triggered it; that is not a BCV problem.
Also, `check` here is scoped to this Gradle build: ktlint is applied to
`subprojects {}` only, so the root project has no `check` task and
`./gradlew check` never lints the root `build.gradle.kts`/`settings.gradle.kts`
— only the repo-root `bun run lint` does. `check` is therefore not a superset
of `lint`.

No `ignoredPackages` and no `nonPublicMarkers`: `id.frak.sdk.**` public API
*is* the contract this SDK is built around, and this codebase has no
internal-marker annotation to configure BCV against.

**When a public API change is intentional:**

```bash
bun run --cwd sdk/android apiDump   # or: ANDROID_HOME=... ./gradlew apiDump (needs the SDK, see below)
git status sdk/android/frak-sdk/api sdk/android/frak-sdk-ui/api
git add sdk/android/frak-sdk/api sdk/android/frak-sdk-ui/api
```

`frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/` currently has no Kotlin sources
(just a `.gitkeep`), so it has no public API yet. Whether `apiDump` writes an
empty `frak-sdk-ui/api/frak-sdk-ui.api` or writes nothing at all for a module
with no public symbols has not been verified in this environment (no
JDK/Gradle available) — check what `git status`/`git add` actually report
rather than assuming either outcome. If no file was produced, that is
expected; do not hand-write one.

Review the diff like a changelog — every line is a promise to a merchant's
frozen binary — then commit it alongside the code change.

**An `apiCheck` failure you cannot explain from your own change is an
accidental ABI break, not a tooling problem.** Find what widened or narrowed
the public surface and either revert it or make it deliberate with an
`apiDump`.

> ⚠️ **The dump has not been generated yet.** `frak-sdk/api/frak-sdk.api` does
> not exist in this checkout, and it is unverified whether `frak-sdk-ui`'s
> dump ever will (see above) — this environment has no JDK/Gradle to produce
> either. Before this can merge, someone with a JDK must run:
>
> ```bash
> bun run --cwd sdk/android apiDump
> git status sdk/android/frak-sdk/api sdk/android/frak-sdk-ui/api
> git add sdk/android/frak-sdk/api sdk/android/frak-sdk-ui/api
> git commit -m "Add BCV API dumps"
> ```
>
> `git add` may report "pathspec did not match any files" for
> `frak-sdk-ui/api` if no dump was written — that is fine given `frak-sdk-ui`
> has no public API yet, not a failure to fix. Review the generated file(s) by
> hand once, since this is the *first* dump — there is no prior version to
> diff against.

## What each directory is for

`frak-sdk/src/main/kotlin/id/frak/sdk/` mirrors 02 §2's module layout table, one
package per row:

| Package | Lands there |
| --- | --- |
| `core/` | `FrakConfig`, the `FrakClient` facade, `FrakError` |
| `net/` | `HttpURLConnection` transport, JSON only, injects `x-frak-client-id` |
| `identity/` | `AnonymousIdStore`, `ProofCodec` — P-256 keypair in Keystore, lowercase derived id |
| `config/` | Dual SWR cache (config + bare merchantId), `PlacementResolver` 4-tier copy |
| `rewards/` | `RewardRepository`, `RewardSelector`, `RewardFormatter` |
| `tracking/` | `InteractionTracker`, `PurchaseTracker`, durable offline queue |
| `sharing/` | `FrakContextCodec` (V2 binary), `AttributionMerger`, `LinkBuilder` — the `Presenter` lives in `frak-sdk-ui` |
| `applink/` | `DeepLinkBuilder`, `InstallRedirector`, `AppInstalledProbe` |

The layout is deliberately symmetric with `sdk/ios/`. A merchant shipping both
apps must not have to learn two mental models.

Elsewhere:

- `frak-sdk/src/test/kotlin/id/frak/sdk/` — JVM unit tests, mirroring the main
  packages. Tier 1 of the three-tier test plan in 03 §5.4: logic tests on cheap
  runners, no device.
- `frak-sdk/src/test/kotlin/id/frak/sdk/fixtures/` — the golden-fixture loader.
  One shared cross-platform corpus (FrakContext v2 codec, the signed byte layout,
  reward formatting) that Kotlin, Swift and TypeScript all assert against. This is
  the named alternative to a shared native core — 03 §1.6.
- `frak-sdk/src/main/res/xml/frak_data_extraction_rules.xml` — excludes the SDK's
  `id.frak.sdk.xml` SharedPreferences from **both** `<cloud-backup>` and
  `<device-transfer>` (02 §4). Both blocks matter: cloud-backup alone still lets a
  device-to-device transfer clone whatever is in there. It is a thinner file than
  02 §4 assumes — see "Anonymous identity" below — but the exclusion stays,
  because the merchant marker it holds is what triggers regeneration.
- `frak-sdk/consumer-rules.pro`, `frak-sdk-ui/consumer-rules.pro` — R8 rules that
  ship *inside* the AAR, so merchants paste nothing into their own config
  (03 §5.4). Empty today; rules land alongside the code that needs them.
- `frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/` — the Compose sharing sheet and
  its View/Activity fallback.

Two absences in `frak-sdk/src/main/AndroidManifest.xml` are load-bearing:

- **No exported activity and no intent filter.** 02 §6.1 forbids a
  redirect-catcher activity — inbound `fCtx` handling is meant to go through
  the SDK's own deep-link entry point rather than a manifest-declared filter,
  so the merchant's own activity keeps owning the intent. That entry point is
  not yet implemented: there is no `FrakConfig.deepLink` (or equivalent) in
  `core/FrakConfig.kt` today, only the lower-level `applink/` package
  (`DeepLinkBuilder`, `InstallRedirector`, `AppInstalledProbe`).
- **No permission beyond `INTERNET`.** A library manifest merges into the host
  app; anything added here is a permission the merchant never asked for and has
  to justify on their store listing. The `<queries>` entries cover both
  `id.frak.wallet` and `id.frak.wallet.dev` and are never `QUERY_ALL_PACKAGES`.

`frak-sdk-ui` deliberately has **no `androidx.browser` dependency**. Chrome Custom
Tabs cannot implement this design (02 §3): a Custom Tab is a separate browser
Activity, so it cannot sit in a bottom sheet, cannot carry native buttons, and
cannot lose the browser toolbar. The transport is an embedded `WebView`, which is
a platform class and needs no dependency.

## Anonymous identity

One P-256 keypair per app installation, and an id derived from it:

```text
clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])   // RFC-4122 bits set
```

`ProofCodec` is the Kotlin half of a frozen wire format whose other halves are
`sdk/core/src/identity/canonical.ts` and the backend verifier. All three are
pinned to `sdk/core/src/identity/fixtures/golden-proofs.json`, which is what
makes "we ported it correctly" a test result rather than a claim.

**The keypair lives in `AndroidKeyStore`, not in SharedPreferences** — a
deliberate departure from the storage row in 02 §4, which predates the choice of
key home. Both properties that row wants are stronger there: the private key is
non-exportable, so only this device can mint a proof for this id, and keystore
entries are destroyed with the app, so the id dies with the install. Nothing
about it can be backed up or device-transferred, so no `data_extraction_rules`
entry could cover it even in principle.

**The id is never persisted.** It is re-derived from the key on every cold start
and memoised. 02 §4 requires key and id to be generated atomically, because a
surviving key with a lost id silently fails derivation — deriving on demand
means there is no second write to lose. `id.frak.sdk.xml` therefore holds one
value: which merchant the key was minted under, so a `merchantId` that changes
under an existing install regenerates the identity instead of carrying the old
one across.

**There is no unprovable fallback.** Keystore generation genuinely fails on some
devices; when it does, `anonymousId` is null and the SDK behaves as though
tracking were off. Minting a random id instead would recreate exactly the
unprovable tier that
[`docs/plans/identity-proof-of-possession/`](../../docs/plans/identity-proof-of-possession/)
exists to remove, and would hand an attacker a downgrade target.

`AndroidKeystoreDeviceKeyStore` is the one class the JVM suite cannot reach —
there is no `AndroidKeyStore` provider off-device — which is why it contains no
logic at all. Everything it would otherwise do lives in `JcaDeviceKey` and
`ProofCodec`, both driven in tests by real JDK-generated P-256 keys against the
same `java.security` interfaces the platform provider implements.

## Logging

Silent by default (`FrakConfig.logLevel = FrakLogLevel.NONE`). Raising `logLevel` sends
diagnostics to logcat under the `Frak` tag.

A merchant can also route those diagnostics into their own logging — Timber, a crash
reporter's breadcrumb trail — by setting `FrakConfig.logSink`. It is a `fun interface`,
so a lambda is enough:

```kotlin
Frak.initialize(
    context,
    FrakConfig(
        merchantId = BuildConfig.FRAK_MERCHANT_ID,
        logLevel = FrakLogLevel.INFO,
        logSink = { level, message, throwable ->
            val priority = when (level) {
                // Unreachable: FrakLogSink is never called with NONE (see below).
                FrakLogLevel.NONE -> Log.ASSERT
                FrakLogLevel.ERROR -> Log.ERROR
                FrakLogLevel.WARN -> Log.WARN
                FrakLogLevel.INFO -> Log.INFO
                FrakLogLevel.DEBUG -> Log.DEBUG
            }
            Timber.tag("Frak").log(priority, throwable, message)
        },
    ),
)
```

Two rules govern it:

- **`logLevel` gates the sink too, and gates it first.** A message is filtered against
  `logLevel` before the sink is ever consulted, so `NONE` reaches the sink exactly as it
  reaches logcat — not at all — and lowering `logLevel` reduces the sink's volume exactly
  as it reduces logcat's.
- **A sink replaces logcat, it does not add to it.** Once `logSink` is set, gated messages
  go to the sink *instead of* logcat. This is deliberate: logcat is harvested by crash
  reporters, so a sink is the only way for a merchant to stop Frak's own lines reaching it.

`FrakLogger`, the internal wrapper both routes go through, stays `internal` — `FrakLogSink`
is the seam merchants get, not that class. A throwing sink is swallowed rather than
propagated: this SDK must never crash its host over a merchant callback.

## Building, testing, linting

From the repo root:

```bash
bun run --cwd sdk/android build         # assembleRelease — this IS the typecheck
bun run --cwd sdk/android test          # JVM unit tests
bun run --cwd sdk/android lint          # ktlint check
bun run --cwd sdk/android format        # ktlint auto-format in place
bun run --cwd sdk/android size          # release dex size vs the budget
bun run --cwd sdk/android check         # full check: ktlint, tests, Android Lint, version drift, dex budget, apiCheck
bun run --cwd sdk/android apiDump       # regenerate the BCV API dump
bun run --cwd sdk/android publishLocal  # publishToMavenLocal (~/.m2)
```

Or `cd sdk/android` and run `bun run build`, `bun run lint`, and so on. The
commands are owned by this folder's `package.json` rather than aliased at the
repo root, matching how every other package in the monorepo declares its own
`build` / `lint` / `format`. Note that `bun run build:sdk` at the root still means
"build the JS SDKs" and does not touch this folder (03 §5.2).

Everything funnels through `scripts/run.sh`, which resolves the Android SDK and
exports `ANDROID_HOME` before invoking Gradle — without that export Gradle fails
with a bare "SDK location not found" even when the SDK sits at the default path.
Override with `ANDROID_HOME` or `ANDROID_SDK_ROOT` if yours lives elsewhere.

Gradle directly also works: `ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew
assembleRelease`. Android Studio works too — **Open** the `sdk/android` folder.

**`assembleRelease` IS the typecheck.** There is no separate typecheck task to
add and none will be added: assembling the release AARs compiles every source set
with `explicitApi()` enforced. If it assembles, it typechecks.

`publishLocal` puts `id.frak:frak-sdk` and `id.frak:frak-sdk-ui` into `~/.m2`,
which is how a merchant app — or `example/native-android` — consumes an
unreleased build through `mavenLocal()`.

## Formatting and linting — ktlint owns this folder

**biome does not touch `sdk/android`.** It cannot parse Kotlin, and this folder is
excluded from it in `biome.json` (`"!sdk/android"`). **ktlint is the equivalent of
`bun run format` and `bun run lint` here**, and it is the only formatter with any
authority over these files.

ktlint is applied through the Gradle plugin rather than a `brew install`, so it
resolves on a clean checkout like any other dependency. The engine version is
pinned from the version catalog independently of the plugin that runs it.

Rules live in `.editorconfig`, scoped to this folder with `root = true` so it can
never collide with biome. Two settings are deliberate:

- `ktlint_function_naming_ignore_when_annotated_with = Composable` — `@Composable`
  functions are PascalCase by Compose convention, which ktlint's function-naming
  rule does not know about. This earns its keep only in `frak-sdk-ui`; `frak-sdk`
  is UI-free by design and must never gain a `@Composable`. It stays at the root
  anyway rather than being duplicated into a per-module file, because it is a
  no-op on a source set with no annotated declarations.
- The default `ktlint_official` code style is kept, matching the example app.

## Version pinning

`FrakSdkVersion` is not cosmetic. `CURRENT` feeds the `x-frak-sdk-version`
header on every API call and the `?sdkv=` param on every `/sharing` URL — the two
halves of the pin between a frozen binary and the continuously-deployed hosted
page (01 §1.5). Both are marked BLOCKING for v0.1 precisely because neither can
be retrofitted into a build already on users' phones. Keep `CURRENT` in step with
the `version` in each `build.gradle.kts`.

It is an `object` with three members rather than a bare top-level const so that
it mirrors Swift's `FrakSdkVersion` exactly. 02 §9 makes cross-platform symmetry
a hard requirement, and the golden-fixture corpus cannot catch a symbol that
exists on one platform only.

## Toolchain

Versions live in `gradle/libs.versions.toml`. Notable: AGP 8.11.0, Kotlin 2.0.21
(compiling *to* language level 1.9), ktlint plugin 12.1.1 with engine 1.2.1,
Compose BOM 2024.02.01.

The Gradle wrapper is **8.14.3**, not the 8.7 that `example/native-android` uses.
This folder is built on a Java 24 host and Gradle only gained Java 24 support in
the 8.14 line; on 8.7 the daemon aborts before any build logic runs.

`gradle.properties` turns off the AGP build features this project has no use for
(`buildConfig`, `aidl`, `renderscript`, `resValues`, `shaders`). Each one left on
costs a task per module per variant and can only make the AAR bigger. The SDK
version is a reviewed constant in Kotlin rather than a generated `BuildConfig`
field.

There is no `.gitignore` here — the root one already covers `sdk/android/.gradle/`
and `sdk/android/**/build/`.
