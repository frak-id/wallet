# Frak Native SDK — Android

Gradle multi-module library project for the Frak native Android SDK. It is not an app: there is nothing to install and nothing to launch, so no command here needs a device or an emulator.

## Build, test, lint

From the repo root:

```bash
bun run --cwd sdk/android build         # assembleRelease — this IS the typecheck
bun run --cwd sdk/android test          # JVM unit tests
bun run --cwd sdk/android lint          # ktlint check
bun run --cwd sdk/android format        # ktlint auto-format in place
bun run --cwd sdk/android size          # release dex size vs the budget
bun run --cwd sdk/android check         # ktlint, unit tests, Android Lint, version drift, dex budget
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
| `frak-sdk` | `id.frak:frak-sdk` | Core. UI-free, headlessly testable. |
| `frak-sdk-ui` | `id.frak:frak-sdk-ui` | The sharing sheet. Entry point is `FrakSharing.Builder`, callable from XML/Java/Compose; the sheet itself is still Compose, hosted in a `ComponentDialog`. Depends on core. |

Split so a merchant taking only tracking never pulls in a web view. `minSdk 24`, Java/JVM target 17.

`frak-sdk/src/main/kotlin/id/frak/sdk/` packages:

| Package | Contains |
| --- | --- |
| `core/` | `FrakConfig`, `FrakEnvironment`, `DefaultFrakClient`, `FrakError`, `FrakResult`, `FrakLogger`, `Base64Url` |
| `net/` | `HttpClient` (`HttpURLConnection`), `JsonReader`, `UrlQuery`, `PercentEncoding` |
| `identity/` | `AnonymousIdStore`, `ProofCodec`, `DeviceKey`, `AndroidKeystoreDeviceKeyStore` |
| `config/` | `ConfigStore` (SWR cache), `FrakResolvedConfig`, `ResolvedConfigDecoder`, `MerchantQuery`, `SingleFlight`, `Backoff`, `KeyValueStore` |
| `rewards/` | `RewardRepository`, `Rewards`, `RewardsDecoder` |
| `tracking/` | `InteractionTracker`, `Interaction`, `EventQueue` |
| `sharing/` | `FrakContextCodec` (fCtx v2 binary), `FrakContext`, `SharingLinkBuilder`, `AttributionParams`, `SharingRequest` |
| `applink/` | `InstallLinks`, `ReferralArrival`, `AppLauncher`, `DeepLinkObserver` |

`frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/` — the sharing sheet. `FrakSharing`/`FrakSharing.Builder`, `SharingResult` and `FrakSharingDefaults` are the whole public surface; `SharingHost` owns the `ComponentDialog`, the warm `WebView` pool and the one-sheet-at-a-time guard, per hosting Activity.

Tests: `frak-sdk/src/test/kotlin/...` (JVM unit tests, mirrors main packages) and `frak-sdk-ui/src/test/kotlin/...` (Robolectric, pinned to JDK 17 — Robolectric's bundled ASM cannot instrument newer bytecode). Robolectric is scoped to `frak-sdk-ui` only; `frak-sdk` stays framework-free.

## Public API

Entry point: `Frak.initialize`, `Frak.client`, `Frak.shutdown`, `Frak.parseReferralLink`.

`FrakClient`: `environment`, `anonymousId`, `resetAnonymousId`, `setTrackingEnabled`, `isTrackingEnabled`, and five namespaces:

| Namespace | Members |
| --- | --- |
| `config` | `resolve`, `updates` |
| `rewards` | `campaigns`, `best` |
| `sharing` | `buildLink` |
| `tracking` | `track`, `purchase` |
| `appLink` | `handleReferral`, `isFrakAppInstalled`, `openFrakApp`, `installUrl`, `installPageUrl` |

Supporting public types: `FrakContext`, `SharingRequest`, `SharingProduct`, `ProductDetails`, `AttributionParams`, `Interaction`, `FrakResult`, `OpenAppResult`, `DeepLinkHandling`, `FrakLogSink`, `FrakConfig`, `FrakEnvironment`, `FrakMetadata`, `FrakError`, `FrakLogger`.

Resolved-config model, publicly *readable* in full (placements, component copy, translations, attribution): `FrakResolvedConfig`, `ResolvedSdkConfig`, `ResolvedPlacement`, `ResolvedComponents`, `ButtonShareConfig`, `ButtonWalletConfig`, `OpenInAppConfig`, `PostPurchaseConfig`, `BannerConfig`, `AttributionDefaults`. Every constructor in that tree is `internal`: it is a read model the SDK hands you from `config.resolve()`, and a public constructor would freeze an arity the backend keeps adding fields to — see "Binary compatibility" below. `FrakResolvedConfig.displayName`/`displayLogoUrl` are derived properties that resolve the `sdkConfig`-over-top-level precedence once, so a caller never writes that fold itself. `display`-prefixed deliberately: a derived getter must not squat on the name a future top-level wire field would want, since repointing one is a behaviour change with an unchanged JVM descriptor that no `.api` dump could catch.

`id.frak.sdk.net.PercentEncoding` is annotated `@InternalFrakApi` (`@RequiresOptIn`, ERROR): `public` only because `:frak-sdk-ui` builds URLs with it. Naming it from Kotlin is a compile error without an explicit opt-in; javac is not told, which is the annotation's known limit. It is also the marker BCV's `nonPublicMarkers` will exclude from the dump — that half is not in force yet, see "Binary compatibility" below.

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

No public API takes a Kotlin default argument — with one documented holdout, at the end of this section. Merchant-constructed types split two ways: a `Builder` where the value is readable, static factories where it is opaque (`Interaction`, below). Everything else takes explicit constructor overloads. Both halves are one decision, and the reason is `FrakConfig`: it went from 8 to 9 parameters after the last `.api` dump was taken. A Kotlin default compiles to the full-arity constructor *plus* a synthetic `<init>(..., int mask, DefaultConstructorMarker)`, and adding a field changes both descriptors — so that change would have been `NoSuchMethodError` on every already-shipped merchant binary, unfixable by the merchant, because it is their app in the store that breaks. `@JvmOverloads` is not the answer either: it fixes Java and leaves Kotlin callers resolving through `$default` anyway.

So: `FrakConfig`, `FrakMetadata`, `SharingRequest`, `SharingProduct`, `ProductDetails` and `AttributionParams` each have a nested `Builder` with chained setters, plus a Kotlin function of the same name taking `Builder.() -> Unit`. The Builder's `var`s *are* the Kotlin scope — there is no second scope type and therefore no second home for a default. A new option is one new setter plus one new `var`: additive forever.

Types that are public but not expected to grow took explicit constructor overloads instead of a Builder: `FrakEnvironment.Custom` (two origins, optionally a wallet package id and scheme) and `FrakError.Server`/`FrakError.Decoding`.

Read models — the things the SDK hands *back* — split two ways, and the split is a live question rather than a settled rule:

- The resolved-config tree and `FrakContext` have `internal` constructors and no Builder at all. A merchant reads them and never builds one.
- The reward models (`BestReward`, `Campaign`, `TokenAmount`, `RewardTier`, `EstimatedReward`) keep **public** constructors, because a merchant does build one — for a `@Preview`, or a fake over `rewards.best`, which `PublicSurfaceTest` pins. They carry no default arguments (`BestReward`'s two were dropped in step 2), so no `DefaultConstructorMarker` bridge reaches the dump, but their arity is frozen the moment it is committed. Whether they should follow the config tree instead is open — see `docs/plans/native-sdk/09-android-api-surface.md`.

`Interaction` is neither a Builder nor a set of overloaded constructors: it is an opaque type with `@JvmStatic` factories (`Interaction.custom("checkout")`, `Interaction.sharing()`), over an `internal` `Kind` carrying the three wire shapes. That is iOS's shape, adopted here in step 3. It buys three things a sealed hierarchy could not: a fourth wire shape is additive rather than a break for any consumer who wrote an exhaustive `when`; the hierarchy leaves the frozen surface entirely; and Java calls it the same way Kotlin does instead of writing an `instanceof` chain. The cost is that an `Interaction` cannot be read back — acceptable, because it is write-only: you build one and hand it to `tracking.track`.

One thing still carries default arguments: `ConfigApi.resolve`, `RewardsApi.campaigns` and `RewardsApi.best`, six between them. They change shape with the Java `*Async` twins (step 4 of `docs/plans/native-sdk/09-android-api-surface.md`), so they are fixed there rather than twice.

`Frak.shutdown()` cancels background work and unregisters the deep-link observer; call it to release the SDK deterministically (`initialize` can then run again). It is not a consent control — it records no decision.

`FrakConfig.logSink` (a `fun interface`) and `FrakClient.setTrackingEnabled` are the merchant-facing hooks for logging and consent; see the doc comments on `FrakConfig` and `FrakClient` for the exact contract.

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

The MVP surface above is implemented and covered by ~400 JVM unit tests (`grep -rc '@Test' frak-sdk*/src/test -r --include=*.kt | awk -F: '{s+=$2} END {print s}'`), plus Robolectric coverage in `frak-sdk-ui` for the sharing sheet's sequencing (tier 3 fallback, the 1.5s latency budget, tier 2's cache-only retry, web view origin pinning).

One Android device pass (SM-G998B, Android 15) has exercised `initialize`, the wallet-installed probe, `config.resolve` and `rewards.best`. The sharing sheet, the install handoff and inbound deep links have not run on a device, and neither has the `ComponentDialog` host that replaced `ModalBottomSheet` — no rotation pass, no leak check, no edge-to-edge pass against a `targetSdk 35`-or-later host. `.github/workflows/apps.yaml` lints, builds and unit-tests this SDK on every push and PR touching `sdk/android/**`, but it does **not** build `example/native-android`: nothing in CI compiles the harness, so a broken harness call site does not go red. There is no publish path or binary-compatibility gate.

`example/native-android` builds against the real artifacts via a Gradle composite build (`includeBuild("../../sdk/android")` with an explicit `dependencySubstitution`, since Gradle's automatic substitution matches on `project.group`, which defaults to `frak-android-sdk` here, not `id.frak`). It exercises `Frak.initialize`, `.appLink`, `.config.resolve`, `.tracking.purchase` and `.rewards.best` through the SDK's public API — a source checkout, not a published artifact.

## Build facts a contributor will trip on

- **Gradle wrapper is 9.5.0**, not the newest 9.6.x — the ceiling of the range Kotlin Gradle plugin 2.4.10 declares fully supported (7.6.3–9.5.0). AGP 9.1 requires at least 9.3.1, so 9.5.0 satisfies both.
- **AGP 9.1.1, Kotlin 2.4.10** compiling to Kotlin language/API level **2.2** (was 1.9 until the Kotlin 2.4 upgrade dropped `-language-version=1.9` and the K1 compiler). ktlint plugin 14.2.0, engine 1.8.0. Compose BOM 2026.06.01. Versions live in `gradle/libs.versions.toml`.
- Kotlin is compiled by AGP's built-in Kotlin support, not the `org.jetbrains.kotlin.android` plugin — AGP 9.0 made that redundant and it now fails outright if applied alongside AGP's own support. Compiler settings live in `kotlin { compilerOptions {} }`. The Compose compiler plugin is still applied explicitly.
- **`explicitApi()` is on for both modules.** Every public symbol needs an explicit visibility modifier and an explicit return type. It stops a helper from silently widening the API surface, but it does not by itself detect a breaking change to an already-public symbol — see "Binary compatibility" below.
- **The config model types (`FrakResolvedConfig` and friends) are plain classes, not data classes, with `internal` constructors and no default arguments.** A published `copy()`/`componentN()` would enter the ABI and could never be removed, hence hand-written `equals`/`hashCode`/`toString`. But that alone was not additive: a public constructor with default arguments compiles to a full-arity `<init>` plus a synthetic `<init>(..., int mask, DefaultConstructorMarker)`, and adding a parameter changes both descriptors — an already-compiled merchant binary would get `NoSuchMethodError`. The fix is both halves at once. `internal` keeps the constructor out of Kotlin merchants' reach and out of the `.api` dump — not out of *javac's* reach, since Kotlin mangles `internal` functions but cannot mangle a constructor, so it is emitted `public`; a Java caller who reaches it is simply outside the compatibility contract; dropping the defaults keeps the `DefaultConstructorMarker` bridge from landing in the dump anyway, which it does even for an `internal` constructor. A new backend field is now a new getter and nothing else. The old defaults live in `ConfigTreeFixtures.kt` in the test source set. Merchant-facing *input* types (`FrakConfig`, `FrakMetadata`, `SharingRequest`, `SharingProduct`, `ProductDetails`, `AttributionParams`) have a `Builder` instead, since a caller does have to construct those — see "Construction" below.
- `gradle.properties` turns off AGP build features this project has no use for (`buildConfig`, `aidl`, `renderscript`, `resValues`, `shaders`) — each costs a task per module per variant and can only grow the AAR. The SDK version is a reviewed Kotlin constant (`FrakSdkVersion`), not a generated `BuildConfig` field.
- No `.gitignore` here — the root one covers `sdk/android/.gradle/` and `sdk/android/**/build/`.
- **Versioning sits outside Changesets.** `id.frak:frak-sdk` and iOS's `FrakSDK` version independently of the JS packages and of each other — a merchant's binary freezes at store submission, so a JS-style patch cadence does not apply. `sdk/android/package.json` is `private` and listed in `.changeset/config.json`'s `ignore`; it exists only to dispatch to `scripts/run.sh`.
- `FrakSdkVersion.CURRENT` feeds the `x-frak-sdk-version` header and the `?sdkVersion=` param on `/sharing` URLs. Keep it in step with `version` in each `build.gradle.kts` — neither can be retrofitted into a build already on users' phones.

## Publishing

Distribution will be Maven Central via the Central Publisher Portal. It is not wired yet: `frak-publish.gradle.kts` declares publications and signing but no `repositories { maven { … } }` and no Portal plugin, so the only working publish path today is `publishToMavenLocal`.

```bash
bun run --cwd sdk/android publishLocal
cat ~/.m2/repository/id/frak/frak-sdk/0.0.1/frak-sdk-0.0.1.pom
```

The POM contents are Central-valid already — `buildSrc/src/main/kotlin/frak-publish.gradle.kts` is a convention plugin applied by both modules (licence, developers, SCM, sources/javadoc jars), only the transport is missing.

Signing is opt-in by key presence: set `ORG_GRADLE_PROJECT_signingInMemoryKey` (and `...signingInMemoryKeyPassword` if the key is protected). With no key set, signing is skipped and the build still succeeds.

Licence: Apache-2.0 (`sdk/android/LICENSE`), deliberately not the monorepo's GPL-3.0 — a native artifact is statically linked into a merchant's proprietary app, where a copyleft reading is a much bigger ask than for a CDN bundle.

## Binary compatibility

No gate right now. kotlinx-binary-compatibility-validator was wired into `frak-publish.gradle.kts` and then removed, along with the `api/*.api` dumps it generated, because committing a dump ratifies the public shape before that shape is decided.

The shape is now decided, and being applied in five reviewed steps — `docs/plans/native-sdk/09-android-api-surface.md` is the record. Both former open questions are answered there:

- **Q1, the `$default` freeze.** Read models (the config tree, `FrakContext`) get `internal` constructors; merchant-constructed types get a `Builder` with a Kotlin scope-function sugar over the same Builder; `Interaction` becomes an opaque type with static factories; everything else takes explicit overloads. `@JvmOverloads` is banned — it fixes Java and leaves Kotlin callers on `$default` anyway. One holdout remains, with a step assigned: `ConfigApi.resolve`/`RewardsApi.campaigns`/`RewardsApi.best`. See "Construction" above.
- **Q2, promoting types ahead of a reader.** Types that are `public` only to cross the `:frak-sdk`/`:frak-sdk-ui` boundary carry `@InternalFrakApi`, which will drop them out of the dump via `nonPublicMarkers` once BCV is back. Today it is a Kotlin compile error and nothing more. `PercentEncoding` is the first and, so far, only one: the marker propagates through signatures, so putting it on the config tree would have taken `ConfigApi.resolve()` out of the dump and out of every merchant's reach along with it.

BCV comes back — dumps included — as the last of the five steps, since committing a dump ratifies the shape. Until then `explicitApi()` is the only enforcement.

## Open decisions blocking first publish

- Binary-compatibility gate: BCV plus a committed dump, the last of the five steps in `docs/plans/native-sdk/09-android-api-surface.md`, along with the handful of decisions that document lists as "to be answered before the dump is committed".
- Claiming the `id.frak` namespace (TXT record on the `frak.id` apex), generating the real GPG key, wiring the Portal repository. None of these has started; Portal verification is automated and same-day once requested.
- A device pass covering the sharing sheet, the install handoff and inbound deep links — publishing an artifact nothing has run is how you burn a version number.
- A CI job that builds `example/native-android`. `.github/workflows/apps.yaml` already lints, builds and unit-tests the SDK itself (see "Testing" above); nothing compiles the harness, so a broken harness call site does not go red.
