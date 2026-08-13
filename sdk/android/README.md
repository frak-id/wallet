# Frak Native SDK — Android

Gradle multi-module library project for the Frak native Android SDK. It is not an app: there is nothing to install and nothing to launch, so no command here needs a device or an emulator.

This file is contributor-facing. The section below is the only merchant-facing part of it, and it is the whole integration.

## For merchants

**Before anything else: Frak must allow-list your application id against your merchant id.** Ask us to do it. Until it is done every call fails with `MerchantResolutionFailed` — and `tracking.purchase` still returns `Success`, because tracking is queued and best-effort, so the failure is invisible unless you turn logging up.

**Nothing is published yet.** There is no `mavenCentral()` coordinate to depend on today; talk to us. When there is, it is:

```kotlin
dependencies {
    implementation("id.frak.sdk:core:<version>")
    // Only if you show the sharing sheet. Brings Compose (ui, foundation, material3),
    // androidx.activity and androidx.webkit onto your runtime classpath.
    implementation("id.frak.sdk:ui:<version>")
}
```

Consumer floors: `minSdk 24`, JVM target 17, Kotlin metadata at language level 2.2 (so a Kotlin 2.2+ compiler), AGP 8.2+. `:frak-sdk-ui`'s `@Composable build()` overload needs you to declare Compose yourself — it is an `implementation` dependency here, not `api`.

```kotlin
// Application.onCreate
Frak.initialize(
    this,
    FrakConfig.Builder("your-merchant-id")
        // Defaults to NONE. Every diagnostic the SDK writes, including the two failures
        // above, is dropped on the floor until you raise this.
        .logLevel(FrakLogLevel.DEBUG)
        .build(),
)
```

Manifest checklist — the SDK's own manifest already merges in `INTERNET` and the `<queries>` entry for the wallet package, so there is nothing to add for those. What you must supply:

- An `<intent-filter>` for the `https` domain your share links point at (Android App Links, plus `assetlinks.json` on that domain), or an inbound referral never reaches your app at all.
- `Frak.initialize` in your **default process** only.
- With `DeepLinkHandling.Automatic` (the default) on a `singleTask`/`singleTop` activity, call `setIntent(intent)` in `onNewIntent` — Android does not update `getIntent()` for you, and without it every warm-start referral is silently lost.

## Build, test, lint

From the repo root:

```bash
bun run --cwd sdk/android build         # assembleRelease — this IS the typecheck
bun run --cwd sdk/android test          # JVM unit tests
bun run --cwd sdk/android lint          # ktlint check
bun run --cwd sdk/android format        # ktlint auto-format in place
bun run --cwd sdk/android check         # all of the above plus the ABI gate, Android Lint, version drift
bun run --cwd sdk/android apiCheck      # public ABI vs the committed api/*.api
bun run --cwd sdk/android apiDump       # write those dumps; the diff IS the ABI decision
bun run --cwd sdk/android publishLocal  # publishToMavenLocal (~/.m2)
```

Or `cd sdk/android` and run `bun run build`, `bun run lint`, etc. — the scripts live in this folder's `package.json`, not aliased at the repo root. `bun run build:sdk` at the root builds the JS SDKs and does not touch this folder.

Everything funnels through `scripts/run.sh`, which resolves the Android SDK and exports `ANDROID_HOME` before invoking Gradle — without that export Gradle fails with "SDK location not found" even when the SDK is at the default path. Override with `ANDROID_HOME` or `ANDROID_SDK_ROOT` if yours lives elsewhere.

Gradle directly also works: `ANDROID_HOME=$HOME/Library/Android/sdk ./gradlew assembleRelease`. Android Studio: open the `sdk/android` folder.

`assembleRelease` is the typecheck — it compiles every source set with `explicitApi()` enforced, and there is no separate typecheck task.

`check` is scoped to this Gradle build: ktlint runs on `subprojects {}` only, so `./gradlew check` never lints the root `build.gradle.kts` / `settings.gradle.kts` — only the repo-root `bun run lint` does. `check` is not a superset of `lint`.

biome does not touch `sdk/android` (excluded in `biome.json`, it cannot parse Kotlin). ktlint is the equivalent of `bun run format` / `bun run lint` here, applied through the Gradle plugin so it resolves on a clean checkout with no `brew install`. Rules live in `.editorconfig`, scoped to this folder (`root = true`).

## Module layout

| Module | Coordinate | Contents |
| --- | --- | --- |
| `frak-sdk` | `id.frak.sdk:core` | Core. UI-free, headlessly testable. |
| `frak-sdk-ui` | `id.frak.sdk:ui` | The sharing sheet. Entry point is `FrakSharing.Builder`, callable from XML/Java/Compose; the sheet itself is still Compose, hosted in a `ComponentDialog`. Depends on core. |

Split so a merchant taking only tracking never pulls in a web view. `minSdk 24`, Java/JVM target 17.

`frak-sdk/src/main/kotlin/id/frak/sdk/` packages:

| Package | Contains |
| --- | --- |
| `core/` | `FrakConfig`, `FrakEnvironment`, `DefaultFrakClient`, `FrakError`, `FrakResult`, `Base64Url` |
| `net/` | `HttpClient` (`HttpURLConnection`), `JsonReader`, `UrlQuery`, `PercentEncoding` |
| `identity/` | `AnonymousIdStore`, `ProofCodec`, `DeviceKey`, `AndroidKeystoreDeviceKeyStore` |
| `config/` | `ConfigStore` (SWR cache), `FrakResolvedConfig`, `ResolvedConfigDecoder`, `MerchantQuery`, `SingleFlight`, `Backoff`, `KeyValueStore` |
| `rewards/` | `RewardRepository`, `Rewards`, `RewardsDecoder` |
| `tracking/` | `EventOutbox` (drain + retry policy), `EventQueue` (the durable file it owns), `QueuedRow`, `RowSender` + `InteractionSender`/`PurchaseSender`/`MergeSender`, `SendContext`, `DeliveryOutcome`, `Interaction` |
| `sharing/` | `FrakContextCodec` (fCtx v2 binary), `FrakContext`, `SharingLinkBuilder`, `AttributionParams`, `SharingRequest` |
| `applink/` | `InstallLinks`, `ReferralArrival`, `AppLauncher`, `DeepLinkObserver` |

`frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/` — the sharing sheet. `FrakSharing`/`FrakSharing.Builder`, `SharingResult` and `FrakSharingDefaults` are the whole public surface; `SharingHost` owns the `ComponentDialog`, the warm `WebView` pool and the one-sheet-at-a-time guard, per hosting Activity.

Tests: `frak-sdk/src/test/kotlin/...` (JVM unit tests, mirrors main packages) and `frak-sdk-ui/src/test/kotlin/...` (Robolectric, pinned to JDK 17 — Robolectric's bundled ASM cannot instrument newer bytecode). Robolectric is scoped to `frak-sdk-ui` only; `frak-sdk` stays framework-free.

## Public API

Entry point: `Frak.initialize`, `Frak.client`, `Frak.clientOrNull`, `Frak.isInitialized`, `Frak.shutdown`/`Frak.shutdownAsync`, `Frak.parseReferralLink`.

`FrakClient`: `environment`, `anonymousId`, `resetAnonymousId`, `setTrackingEnabled`, `isTrackingEnabled` (each with an `*Async` twin — see "Java" below), and five namespaces:

| Namespace | Members |
| --- | --- |
| `config` | `resolve` (+ `resolveAsync`). Stale-while-revalidate with a 5-minute freshness window; pass `forceRefresh = true` to skip both the cache and the backoff |
| `rewards` | `campaigns`, `best` (+ `campaignsAsync`, `bestAsync`) |
| `sharing` | `buildLink` (+ `buildLinkAsync`) |
| `tracking` | `track`, `purchase` (+ `trackAsync`, `purchaseAsync`) |
| `appLink` | `handleReferral`, `isFrakAppInstalled`, `openFrakApp`, `installPageUrl` (+ an `*Async` for each except `isFrakAppInstalled`, which never suspended) |

Supporting public types: `FrakContext`, `SharingRequest`, `SharingProduct`, `ProductDetails`, `RewardRequest`, `AttributionParams`, `Interaction`, `FrakResult`, `OpenAppResult`, `DeepLinkHandling`, `FrakLogSink`, `FrakConfig`, `FrakEnvironment`, `FrakMetadata`, `FrakError`. (`FrakLogger` is **not** public — it is `internal` and absent
from the ratified `.api` dump; `FrakLogSink` above is the merchant-facing half.)

Resolved-config model, publicly *readable* in full (placements, component copy, translations, attribution): `FrakResolvedConfig`, `ResolvedSdkConfig`, `ResolvedPlacement`, `ResolvedComponents`, `ButtonShareConfig`, `ButtonWalletConfig`, `OpenInAppConfig`, `PostPurchaseConfig`, `BannerConfig`, `AttributionDefaults`. Every constructor in that tree is `internal`: it is a read model the SDK hands you from `config.resolve()`, and a public constructor would freeze an arity the backend keeps adding fields to — see "Binary compatibility" below. `FrakResolvedConfig.displayName`/`displayLogoUrl` are derived properties that resolve the `sdkConfig`-over-top-level precedence once, so a caller never writes that fold itself. `display`-prefixed deliberately: a derived getter must not squat on the name a future top-level wire field would want, since repointing one is a behaviour change with an unchanged JVM descriptor that no `.api` dump could catch.

`id.frak.sdk.net.PercentEncoding` is annotated `@InternalFrakApi` (`@RequiresOptIn`, ERROR): `public` only because `:frak-sdk-ui` builds URLs with it. Naming it from Kotlin is a compile error without an explicit opt-in; javac is not told, which is the annotation's known limit. It is also the marker wired into BCV's `nonPublicMarkers`, so it never enters the dump — see "Binary compatibility" below, including what about that is still unverified.

Not implemented: the 4-tier copy precedence (`FrakClient.copy`), `referralStatus`, the analytics event stream.

## Basic usage

```kotlin
Frak.initialize(
    context,
    FrakConfig(BuildConfig.FRAK_MERCHANT_ID) {
        logLevel = FrakLogLevel.INFO
    },
)

lifecycleScope.launch {
    Frak.client.tracking.purchase(/* ... */)
}
```

```java
// The same thing from Java. The Kotlin form above is sugar over this Builder, not a second
// implementation, so a default has exactly one home.
Frak.initialize(
        context,
        new FrakConfig.Builder(BuildConfig.FRAK_MERCHANT_ID)
                .logLevel(FrakLogLevel.INFO)
                .build());
```

### Construction

No public API takes a Kotlin default argument, anywhere. Merchant-constructed types split two ways: a `Builder` where the value is readable, static factories where it is opaque (`Interaction`, below). Everything else takes explicit constructor overloads. Both halves are one decision, and the reason is `FrakConfig`: it went from 8 to 9 parameters after the last `.api` dump was taken. A Kotlin default compiles to the full-arity constructor *plus* a synthetic `<init>(..., int mask, DefaultConstructorMarker)`, and adding a field changes both descriptors — so that change would have been `NoSuchMethodError` on every already-shipped merchant binary, unfixable by the merchant, because it is their app in the store that breaks. `@JvmOverloads` is not the answer either: it fixes Java and leaves Kotlin callers resolving through `$default` anyway.

So: `FrakConfig`, `FrakMetadata`, `SharingRequest`, `SharingProduct`, `ProductDetails`, `AttributionParams` and `RewardRequest` — seven types — each have a nested `Builder` with chained setters, plus a Kotlin function of the same name taking `Builder.() -> Unit`. The Builder's `var`s *are* the Kotlin scope — there is no second scope type and therefore no second home for a default. A new option is one new setter plus one new `var`: additive forever.

Types that are public but not expected to grow took explicit constructor overloads instead of a Builder: `FrakEnvironment.Custom` (two origins, optionally a wallet package id and scheme) and `FrakError.Server`/`FrakError.Decoding`.

Read models — the things the SDK hands *back* — split two ways, and the split is a live question rather than a settled rule:

- The resolved-config tree and `FrakContext` have `internal` constructors and no Builder at all. A merchant reads them and never builds one.
- The reward models (`BestReward`, `Campaign`, `TokenAmount`, `RewardTier`, `EstimatedReward`) keep constructors a merchant can call — for a `@Preview`, or a fake over `rewards.best`, which `PublicSurfaceTest` pins — but they are `@InternalFrakApi public constructor`, not plain `public`. Plain `internal` was not an option: `:frak-sdk-ui` is a separate Gradle project, so it would have locked the UI module and merchant previews out too. The marker keeps them callable behind an opt-in and **out of the dump**, so their arity is no longer frozen and a new backend field is not a merchant-breaking change. `RewardTier` also carries an `Unknown` arm, so an unrecognised tier degrades instead of failing the whole reward — the same escape `EstimatedReward.Unknown` has always had.

`Interaction` is neither a Builder nor a set of overloaded constructors: it is an opaque type with `@JvmStatic` factories (`Interaction.custom("checkout")`, `Interaction.sharing()`), over an `internal` `Kind` carrying the three wire shapes. That is iOS's shape, adopted here in step 3. It buys three things a sealed hierarchy could not: a fourth wire shape is additive rather than a break for any consumer who wrote an exhaustive `when`; the hierarchy leaves the frozen surface entirely; and Java calls it the same way Kotlin does instead of writing an `instanceof` chain. The cost is that an `Interaction` cannot be read back — acceptable, because it is write-only: you build one and hand it to `tracking.track`.

Nothing on the public surface carries a Kotlin default argument any more. `ConfigApi.resolve` and `RewardsApi.campaigns` took explicit `()`/`(Boolean)` overloads; `RewardsApi.best` took a `RewardRequest` parameter object, because four optionals is what a parameter object is for. `forceRefresh` stays a parameter rather than a field of the request — it is cache control, not a description of the reward wanted.

### Java

Every suspending member of `FrakClient` and its five namespaces has a `CompletableFuture` twin named `*Async`, plus `Frak.shutdownAsync()` — seventeen twins, one per member; `grep Async frak-sdk/api/frak-sdk.api` is the count. Kotlin callers use the `suspend` form; a Java caller cannot name a `Continuation`, so before the twins they could call none of them.

```java
Frak.getClient().getRewards()
        .bestAsync(new RewardRequest.Builder().targetInteraction("purchase").build())
        .thenAccept(reward -> banner.setText(reward == null ? "" : reward.getFormatted()));
```

The twins are the same work on the same `SupervisorJob` that `Frak.shutdown()` cancels, funnelled through one internal helper so the threading contract has one home: the body runs on the SDK's IO dispatcher and **completion is signalled on the main thread**, so the `thenAccept` above can touch a `View`. (`CompletableFuture` runs a non-`Async` stage on the completing *or* the registering thread, whichever is later — for the realistic call site those are the same.) `Dispatchers.Main` is deliberately not used: it lives in `kotlinx-coroutines-android`, which this SDK does not depend on, so there is a twelve-line `Handler`-backed dispatcher instead.

**Never `get()` or `join()` a twin on the main thread.** Completion needs a main-looper turn and a blocked main thread never gives one, so the future never completes — a deterministic ANR, not a race. Register a continuation (`thenAccept`, `whenComplete`), or block on a background thread.

Java callers reach teardown as `Frak.shutdownAsync()`; `Frak.shutdown()` is a suspending
member and so the one entry point that is not `@JvmStatic`. A twin called after
`Frak.shutdown()` returns an already-cancelled future rather than hanging. `Frak.shutdownAsync()` is the one twin on its own scope — it cannot use the one it is cancelling — and it returns immediately, so `shutdownAsync(); initialize(…)` back-to-back races the teardown; sequence the second call off the future.

Twins mirror their suspending member's return type: `resolveAsync` completes exceptionally with the same `FrakError` that `resolve` throws (wrapped in `CompletionException`, as any future would), and `trackAsync` returns `CompletableFuture<FrakResult<Unit>>` because `track` returns `FrakResult<Unit>`. There is no second result type layered over the future. Two exceptions return `CompletableFuture<Void>`: `setTrackingEnabledAsync` and `shutdownAsync`, because `kotlin.Unit` on a Java signature is noise.

Two async idioms coexist on purpose: a request/response call returns a future, and a *session outcome* — `FrakSharing`'s — stays a `@MainThread` callback, because a sheet reports once, later, from a lifecycle the caller does not own.

`Frak.shutdown()` cancels background work and unregisters the deep-link observer; call it to release the SDK deterministically (`initialize` can then run again). It is not a consent control — it records no decision.

`FrakConfig.logSink` (a `fun interface`) and `FrakClient.setTrackingEnabled` are the merchant-facing hooks for logging and consent; see the doc comments on `FrakConfig` and `FrakClient` for the exact contract, and [PRIVACY.md](PRIVACY.md) for what to declare in Play Data Safety. Two caveats before you build a consent flow on `setTrackingEnabled`: the decision is written with `SharedPreferences.apply()`, so a withdrawal lost to a process kill reverts to enabled on the next launch (finding S10); and the web SDK has no equivalent switch today, so a privacy notice written against this behaviour does not hold for a merchant's web integration.

The sharing sheet is a Stripe-shaped Builder with two build sites, so XML, Java and Compose callers see the same types:

```kotlin
private lateinit var sharing: FrakSharing

// Activity / XML / Java. In onCreate, after super.onCreate — not a property initialiser:
// an Activity has no ViewModelStore (which is what carries a live sheet across a rotation)
// until the framework attaches its Application, and build() throws if it cannot reach one.
sharing = FrakSharing.Builder(::onShareResult).build(this)
sharing.warm()                 // when a share affordance becomes visible
sharing.present(request)       // on the tap

// Compose — warms on composition-enter
val sharing = remember { FrakSharing.Builder(::onShareResult) }.build()
```

`frak-sdk-ui/src/test/java/.../JavaCallSiteFixture.java` is a compile-only assertion that the above stays callable from Java. There is no `build(Fragment)` yet — `build(requireActivity())` works, and Builder methods are additive with no ABI break, so it lands with the Fragment harness screen that would exercise it rather than ahead of it.

## Status

The MVP surface above is implemented and covered by 536 JVM unit tests as of 2026-08-13 (392 in `frak-sdk`, 144 in `frak-sdk-ui`; count them off `*/build/test-results/testDebugUnitTest/*.xml`, not by grepping `@Test`), including Robolectric coverage in `frak-sdk-ui` for the sharing sheet's sequencing (tier 3 fallback, the 1.5s latency budget, the retry ladder, web view origin pinning).

Android has been driven on a device (SM-G998B/Android 15 through development, RMX3511/Android 16 for the 2026-08-13 pass) — `initialize`, the wallet-installed probe, `config.resolve`, `rewards.best`, and since 2026-08-13 **the sharing sheet and the `ComponentDialog` host, in a minified R8 build** (`isMinifyEnabled = true` on the harness release variant): no `ClassNotFoundException`/`NoSuchMethodError`/`VerifyError` across 16 500 logcat lines, 254 SDK classes reaching R8 and 23 shaken out. Still not run on a device: the install handoff, inbound deep links (cold *or* warm), a rotation pass, a leak check, and anything only a multi-destination `NavHost` triggers. The run is also single-screen, so it cannot see anything the harness itself gets wrong. `.github/workflows/apps.yaml` lints, builds and unit-tests this SDK on every push and PR touching `sdk/android/**`, but it does **not** build `example/native-android`: nothing in CI compiles the harness, so a broken harness call site does not go red. There is no publish path exercised end to end. The binary-compatibility gate is wired and **ratified**: both `api/*.api` dumps are committed, `apiCheck` runs in CI, and `check` is green — see "Binary compatibility" below.

`example/native-android` builds against the real artifacts via a Gradle composite build (`includeBuild("../../sdk/android")` with an explicit `dependencySubstitution`, since Gradle's automatic substitution derives coordinates from `project.group` plus the Gradle module name and so looks for `id.frak.sdk:frak-sdk`, not the published `id.frak.sdk:core`). It exercises `Frak.initialize`, `.appLink`, `.config.resolve`, `.tracking.purchase` and `.rewards.best` through the SDK's public API — a source checkout, not a published artifact.

## Build facts a contributor will trip on

- **Gradle wrapper is 9.5.0**, not the newest 9.6.x — the ceiling of the range Kotlin Gradle plugin 2.4.10 declares fully supported (7.6.3–9.5.0). AGP 9.1 requires at least 9.3.1, so 9.5.0 satisfies both.
- **AGP 9.1.1, Kotlin 2.4.10** compiling to Kotlin language/API level **2.2** (was 1.9 until the Kotlin 2.4 upgrade dropped `-language-version=1.9` and the K1 compiler). ktlint plugin 14.2.0, engine 1.8.0. Compose BOM 2026.06.01. Versions live in `gradle/libs.versions.toml`.
- Kotlin is compiled by AGP's built-in Kotlin support, not the `org.jetbrains.kotlin.android` plugin — AGP 9.0 made that redundant and it now fails outright if applied alongside AGP's own support. Compiler settings live in `kotlin { compilerOptions {} }`. The Compose compiler plugin is still applied explicitly.
- **`explicitApi()` is on for both modules.** Every public symbol needs an explicit visibility modifier and an explicit return type. It stops a helper from silently widening the API surface, but it does not by itself detect a breaking change to an already-public symbol — see "Binary compatibility" below.
- **The config model types (`FrakResolvedConfig` and friends) are plain classes, not data classes, with `internal` constructors and no default arguments.** A published `copy()`/`componentN()` would enter the ABI and could never be removed, hence hand-written `equals`/`hashCode`/`toString`. But that alone was not additive: a public constructor with default arguments compiles to a full-arity `<init>` plus a synthetic `<init>(..., int mask, DefaultConstructorMarker)`, and adding a parameter changes both descriptors — an already-compiled merchant binary would get `NoSuchMethodError`. The fix is both halves at once. `internal` keeps the constructor out of Kotlin merchants' reach and out of the `.api` dump — not out of *javac's* reach, since Kotlin mangles `internal` functions but cannot mangle a constructor, so it is emitted `public`; a Java caller who reaches it is simply outside the compatibility contract; dropping the defaults keeps the `DefaultConstructorMarker` bridge from landing in the dump anyway, which it does even for an `internal` constructor. A new backend field is now a new getter and nothing else. The old defaults live in `ConfigTreeFixtures.kt` in the test source set. Merchant-facing *input* types (`FrakConfig`, `FrakMetadata`, `SharingRequest`, `SharingProduct`, `ProductDetails`, `AttributionParams`) have a `Builder` instead, since a caller does have to construct those — see "Construction" below.
- `gradle.properties` turns off AGP build features this project has no use for (`buildConfig`, `aidl`, `renderscript`, `resValues`, `shaders`) — each costs a task per module per variant and can only grow the AAR. The SDK version is a reviewed Kotlin constant (`FrakSdkVersion`), not a generated `BuildConfig` field.
- No `.gitignore` here — the root one covers `sdk/android/.gradle/` and `sdk/android/**/build/`.
- **Versioning sits outside Changesets.** `id.frak.sdk:core` and iOS's `FrakSDK` version independently of the JS packages and of each other — a merchant's binary freezes at store submission, so a JS-style patch cadence does not apply. `sdk/android/package.json` is `private` and listed in `.changeset/config.json`'s `ignore`; it exists only to dispatch to `scripts/run.sh`.
- `FrakSdkVersion.CURRENT` feeds the `x-frak-sdk-version` header and the `?sdkVersion=` param on `/sharing` URLs. Keep it in step with `version` in each `build.gradle.kts` — neither can be retrofitted into a build already on users' phones.

## Publishing

Distribution is Maven Central via the Central Publisher Portal, and the path is wired end to end. The Portal takes a zipped Maven-layout tree over REST rather than a Maven deploy — OSSRH, which would have given a repository URL, is decommissioned — so `frak-publish.gradle.kts` publishes both modules into a shared local `centralBundle` repository, the root build zips it, and `.github/workflows/release-android-sdk.yml` uploads it on an `android-v*` tag. Gradle never sees the Portal token.

```bash
bun run --cwd sdk/android bundle   # build + verify build/central-bundle.zip, no upload
```

`bundle` runs `checkCentralBundle`, not `centralBundle`, and the distinction matters: signing is opt-in, so a missing key yields an *unsigned* bundle rather than a failure. The check refuses a bundle where any artifact lacks its `.asc`, `.md5` or `.sha1`.

Both artifacts go up in **one** deployment. They ship in lockstep behind a `strictly` constraint, so two deployments could land `ui` on Central pointing at a `core` that failed validation.

Releases default to `USER_MANAGED`: the Portal validates, then a human releases or drops it at [central.sonatype.com/publishing/deployments](https://central.sonatype.com/publishing/deployments). `AUTOMATIC` exists as a workflow input and cannot be undone once it publishes.

The format was proven against the real Portal rather than assumed — a `USER_MANAGED` probe of `0.0.1` returned `VALIDATED` with no errors and no warnings, confirming the layout, the signatures, the POM and the javadoc stub, and was then dropped without publishing.

**The signing key exists.** RSA 4096, sign-only primary with no subkey (Maven and Nexus cannot sign with a subkey), expires 2028-08-07:

```
Frak Labs <hello@frak-labs.com>
A1BB F732 9154 CC10 824C  B10E C699 DDEA E382 89E1
```

Published to `keyserver.ubuntu.com` (serving, with the uid) and `keys.openpgp.org` (serving by fingerprint; it withholds the uid until the address is verified by clicking the mail it sends). The private half lives only in the `ORG_GRADLE_PROJECT_SIGNINGINMEMORYKEY` and `…KEYPASSWORD` secrets on `frak-id/wallet`, plus whatever out-of-band backup the holder filed.

**Trap when wiring the CI job.** GitHub uppercases secret *names*, but Gradle reads the env var case-sensitively as `ORG_GRADLE_PROJECT_signingInMemoryKey`. The job must map them explicitly:

```yaml
env:
  ORG_GRADLE_PROJECT_signingInMemoryKey: ${{ secrets.ORG_GRADLE_PROJECT_SIGNINGINMEMORYKEY }}
  ORG_GRADLE_PROJECT_signingInMemoryKeyPassword: ${{ secrets.ORG_GRADLE_PROJECT_SIGNINGINMEMORYKEYPASSWORD }}
```

Get the case wrong and nothing fails: `isRequired = signingKey != null` makes signing opt-in, so the build succeeds and publishes **unsigned**, and the first thing to notice is Central rejecting the deployment.

```bash
bun run --cwd sdk/android publishLocal
cat ~/.m2/repository/id/frak/sdk/core/1.0.0-beta.1/core-1.0.0-beta.1.pom
```

The POM contents are Central-valid already — `buildSrc/src/main/kotlin/frak-publish.gradle.kts` is a convention plugin applied by both modules (licence, developers, SCM, sources/javadoc jars), only the transport is missing.

Signing is opt-in by key presence: set `ORG_GRADLE_PROJECT_signingInMemoryKey` (and `...signingInMemoryKeyPassword` if the key is protected). With no key set, signing is skipped and the build still succeeds.

Licence: Apache-2.0 (`sdk/android/LICENSE`), deliberately not the monorepo's GPL-3.0 — a native artifact is statically linked into a merchant's proprietary app, where a copyleft reading is a much bigger ask than for a CDN bundle.

## Binary compatibility

The gate is `apiCheck`, wired into `check`. It extracts the release variant's public ABI and fails on any difference from `<module>/api/<module>.api`; `apiDump` rewrites those files. **That diff is the point** — every line added is a symbol this SDK can no longer change, and every line removed is one a shipped merchant binary may already be linking against, so an ABI change becomes a reviewable decision instead of an accident.

```bash
bun run --cwd sdk/android apiDump    # rewrite api/frak-sdk.api and api/frak-sdk-ui.api
bun run --cwd sdk/android apiCheck   # compare; also runs as part of `check`
```

**The dumps are not committed yet.** Until they are, `apiCheck` fails with BCV's own message telling you to run `apiDump` — which is the correct state for a build whose surface has just been reshaped and not yet ratified, and not something to work around. Note `apiDump` needs a JDK and the Android SDK; there is nothing to hand-write.

**The wiring is hand-rolled, and it has to be.** binary-compatibility-validator registers its `apiDump`/`apiCheck` only when `kotlin-android`, `kotlin` or `kotlin-multiplatform` is applied — and AGP 9 compiles Kotlin itself and *blocks* `org.jetbrains.kotlin.android`, so BCV's Android hook never fires and it silently does nothing ([BCV#312](https://github.com/Kotlin/binary-compatibility-validator/issues/312)). Its documented replacement, KGP's `kotlin { abiValidation { } }`, is closed for the same reason: that DSL is on the extension the standalone Kotlin plugin registers, not the one AGP provides ([KT-78025](https://youtrack.jetbrains.com/issue/KT-78025), open). So `frak-publish.gradle.kts` registers BCV's own `KotlinApiBuildTask`/`KotlinApiCompareTask` against `compileReleaseKotlin` + `compileReleaseJavaWithJavac`, which is what okhttp and elastic/apm-agent-android did for the same gap. Those task types are internal to BCV, so its version is pinned rather than floated. If a future BCV or KGP starts registering the tasks itself, this build fails with "a task with that name already exists" — the signal to delete the block.

Release variant only: it is the variant a merchant consumes and the only one published. Neither module has debug-only sources; adding one is what would make this worth revisiting.

`@InternalFrakApi` is wired into `nonPublicMarkers` in the root `build.gradle.kts`, so everything it marks drops out of the dump. `@Target(CLASS)` on that annotation is load-bearing: a marker on a property never reaches the class file as a Java annotation, so BCV cannot see one. That mechanism is now **verified**: the first `apiDump` ran and `PercentEncoding` is absent from both dumps. It is the only type carrying the marker, deliberately, so one type answered the question rather than fifty.

The shape being frozen was decided in five reviewed steps — `docs/plans/native-sdk/decisions.md` §2 is the record, and `open.md` §1 records what the now-committed dump made permanent. Both former open questions are answered there:

- **Q1, the `$default` freeze.** Read models (the config tree, `FrakContext`) get `internal` constructors; merchant-constructed types get a `Builder` with a Kotlin scope-function sugar over the same Builder; `Interaction` becomes an opaque type with static factories; everything else takes explicit overloads. `@JvmOverloads` is banned — it fixes Java and leaves Kotlin callers on `$default` anyway. No holdouts remain: no public declaration in either module carries a Kotlin default argument. See "Construction" above.
- **Q2, promoting types ahead of a reader.** Types that are `public` only to cross the `:frak-sdk`/`:frak-sdk-ui` boundary carry `@InternalFrakApi`, wired into `nonPublicMarkers` in the root `build.gradle.kts` so they never enter the dump. `PercentEncoding` is the first and, so far, only one: the marker propagates through signatures, so putting it on the config tree would have taken `ConfigApi.resolve()` out of the dump and out of every merchant's reach along with it.

`explicitApi()` remains the first line of defence — it stops a helper silently widening the surface — but it detects nothing about a change to an already-public symbol. That is what the dump is for.

## Open decisions

- ~~The committed `api/*.api` dumps.~~ **Done** — both are committed and `apiCheck` passes in CI. What `docs/plans/native-sdk/open.md` §1 still lists as open is now *frozen* rather than pending: fixes to those items have to be additive or they are a break.
- The `-javadoc` jar is a **stub**, on both artifacts. AGP's `withJavadocJar()` runs a bundled Dokka whose relocated ASM predates the `PermittedSubclasses` attribute, so it throws on the first `sealed` type it reads as a binary — which is every publish of `:frak-sdk-ui`, since that module sees `:frak-sdk` as a jar. Central requires the artifact to exist and never opens it, and the sources jar carries the KDoc an IDE actually reads. Detail and the reason a modern Dokka is not reachable from here: `docs/plans/native-sdk/decisions.md` §5.4.
- ~~Generating the real GPG key and wiring the Portal repository.~~ **Done** — the signing key is on a keyserver and lives in the `ORG_GRADLE_PROJECT_SIGNINGINMEMORYKEY` secrets, and `.github/workflows/release-android-sdk.yml` builds, signs, verifies and uploads the bundle. The `id.frak.sdk` namespace is claimed, which is why the coordinates are `id.frak.sdk:core`/`:ui` and not `id.frak:frak-sdk`: Sonatype grants authorization downwards only, so a verified `id.frak.sdk` covers `id.frak.sdk.*` and never the `id.frak` parent.
- A device pass covering the sharing sheet, the install handoff and inbound deep links — publishing an artifact nothing has run is how you burn a version number.
- A CI job that builds `example/native-android`. `.github/workflows/apps.yaml` already lints, builds and unit-tests the SDK itself (see "Testing" above); nothing compiles the harness, so a broken harness call site does not go red.
