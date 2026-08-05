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
| `frak-sdk-ui` | `id.frak:frak-sdk-ui` | The Compose sharing sheet. Depends on core. |

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

`frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/` — the Compose sharing sheet and its View/Activity fallback.

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

Supporting public types: `FrakContext`, `SharingRequest`, `SharingProduct`, `AttributionParams`, `Interaction`, `FrakResult`, `OpenAppResult`, `DeepLinkHandling`, `FrakLogSink`, `FrakConfig`, `FrakEnvironment`, `FrakMetadata`, `FrakError`, `FrakLogger`.

Resolved-config model, all public and decoded in full (placements, component copy, translations, attribution): `FrakResolvedConfig`, `ResolvedSdkConfig`, `ResolvedPlacement`, `ResolvedComponents`, `ButtonShareConfig`, `ButtonWalletConfig`, `OpenInAppConfig`, `PostPurchaseConfig`, `BannerConfig`, `AttributionDefaults`.

Not implemented: the 4-tier copy precedence (`FrakClient.copy`), `referralStatus`, the analytics event stream.

## Basic usage

```kotlin
Frak.initialize(
    context,
    FrakConfig(
        merchantId = BuildConfig.FRAK_MERCHANT_ID,
        logLevel = FrakLogLevel.INFO,
    ),
)

lifecycleScope.launch {
    Frak.client.tracking.purchase(/* ... */)
}
```

`Frak.shutdown()` cancels background work and unregisters the deep-link observer; call it to release the SDK deterministically (`initialize` can then run again). It is not a consent control — it records no decision.

`FrakConfig.logSink` (a `fun interface`) and `FrakClient.setTrackingEnabled` are the merchant-facing hooks for logging and consent; see the doc comments on `FrakConfig` and `FrakClient` for the exact contract.

## Status

The MVP surface above is implemented and covered by 220 JVM unit tests (`grep -rc '@Test' frak-sdk*/src/test -r --include=*.kt | awk -F: '{s+=$2} END {print s}'`), plus Robolectric coverage in `frak-sdk-ui` for the sharing sheet's sequencing (tier 3 fallback, the 1.5s latency budget, tier 2's cache-only retry, web view origin pinning).

One Android device pass (SM-G998B, Android 15) has exercised `initialize`, the wallet-installed probe, `config.resolve` and `rewards.best`. The sharing sheet, the install handoff and inbound deep links have not run on a device. No CI job builds this SDK, and there is no publish path or binary-compatibility gate.

`example/native-android` builds against the real artifacts via a Gradle composite build (`includeBuild("../../sdk/android")` with an explicit `dependencySubstitution`, since Gradle's automatic substitution matches on `project.group`, which defaults to `frak-android-sdk` here, not `id.frak`). It exercises `Frak.initialize`, `.appLink`, `.config.resolve`, `.tracking.purchase` and `.rewards.best` through the SDK's public API — a source checkout, not a published artifact.

## Build facts a contributor will trip on

- **Gradle wrapper is 9.5.0**, not the newest 9.6.x — the ceiling of the range Kotlin Gradle plugin 2.4.10 declares fully supported (7.6.3–9.5.0). AGP 9.1 requires at least 9.3.1, so 9.5.0 satisfies both.
- **AGP 9.1.1, Kotlin 2.4.10** compiling to Kotlin language/API level **2.2** (was 1.9 until the Kotlin 2.4 upgrade dropped `-language-version=1.9` and the K1 compiler). ktlint plugin 14.2.0, engine 1.8.0. Compose BOM 2026.06.01. Versions live in `gradle/libs.versions.toml`.
- Kotlin is compiled by AGP's built-in Kotlin support, not the `org.jetbrains.kotlin.android` plugin — AGP 9.0 made that redundant and it now fails outright if applied alongside AGP's own support. Compiler settings live in `kotlin { compilerOptions {} }`. The Compose compiler plugin is still applied explicitly.
- **`explicitApi()` is on for both modules.** Every public symbol needs an explicit visibility modifier and an explicit return type. It stops a helper from silently widening the API surface, but it does not by itself detect a breaking change to an already-public symbol — see "Binary compatibility" below.
- **The config model types (`FrakResolvedConfig` and friends) are plain classes, not data classes.** A published `copy()`/`componentN()` would enter the ABI and could never be removed. Each has a hand-written `equals`/`hashCode`/`toString` and constructor defaults instead. That alone does not make them additively evolvable: a public constructor with default arguments compiles to a full-arity `<init>` plus a synthetic `<init>(..., int mask, DefaultConstructorMarker)`, and adding a parameter changes both descriptors — an already-compiled merchant binary would get `NoSuchMethodError`. An additively-evolvable shape (a `Builder`, or an internal constructor plus additive factory functions) is not implemented.
- `gradle.properties` turns off AGP build features this project has no use for (`buildConfig`, `aidl`, `renderscript`, `resValues`, `shaders`) — each costs a task per module per variant and can only grow the AAR. The SDK version is a reviewed Kotlin constant (`FrakSdkVersion`), not a generated `BuildConfig` field.
- No `.gitignore` here — the root one covers `sdk/android/.gradle/` and `sdk/android/**/build/`.
- **Versioning sits outside Changesets.** `id.frak:frak-sdk` and iOS's `FrakSDK` version independently of the JS packages and of each other — a merchant's binary freezes at store submission, so a JS-style patch cadence does not apply. `sdk/android/package.json` is `private` and listed in `.changeset/config.json`'s `ignore`; it exists only to dispatch to `scripts/run.sh`.
- `FrakSdkVersion.CURRENT` feeds the `x-frak-sdk-version` header and the `?sdkv=` param on `/sharing` URLs. Keep it in step with `version` in each `build.gradle.kts` — neither can be retrofitted into a build already on users' phones.

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

No gate right now. kotlinx-binary-compatibility-validator was wired into `frak-publish.gradle.kts` and then removed, along with the `api/*.api` dumps it generated, because committing a dump ratifies the public shape before that shape is decided. Open questions:

- Whether the config model types move to a builder or an internal-constructor-plus-factory shape (see "plain classes, not data classes" above).
- Whether to keep promoting types straight to fully-public, or gate the ones that exist only for `frak-sdk-ui`'s consumption behind a `@RequiresOptIn` `@InternalFrakApi` wired into BCV's `nonPublicMarkers`. `id.frak.sdk.net.PercentEncoding` is the current example of a symbol public only because a second module needs it.

The gate — dumps included — comes back once these are settled and before the first publish. Until then `explicitApi()` is the only enforcement.

## Open decisions blocking first publish

- Binary-compatibility gate and the two questions above.
- Claiming the `id.frak` namespace (TXT record on the `frak.id` apex), generating the real GPG key, wiring the Portal repository. None of these has started; Portal verification is automated and same-day once requested.
- A device pass covering the sharing sheet, the install handoff and inbound deep links — publishing an artifact nothing has run is how you burn a version number.
- A CI job that builds and tests this SDK; none exists today.
