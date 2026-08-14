# Native SDK — decisions

Decisions that are expensive to revisit, with the reason and what each one locks in. Ordered by
blast radius, not date. If a decision is cheap to reverse, it is not here.

## 1. Architecture

### 1.1 Two hand-written codebases, no shared core

Separate Kotlin and Swift. No KMP, no Rust, no shared runtime.

No SDK vendor ships shared-core logic to third-party consumers — RevenueCat, PostHog and Sentry all
wrap two independently maintained native SDKs. Kotlin/Native's generated Swift is not shippable:
the Obj-C bridge loses the exhaustive matching, cancellation and module structure that `FrakError`
and `EstimatedReward` depend on. Each Kotlin/Native framework also embeds its own runtime (~6–40 MB)
against a 256 KB budget merchants pay for, and two such runtimes in one host app can collide at
link time.

**Locks in:** golden fixtures are the cross-platform contract instead of shared code
([`contract.md`](./contract.md) §4).
**Revisit only if** the shared deterministic surface exceeds ~1,000 lines *and* a drift bug reaches
production despite the fixtures — then Rust + UniFFI, not KMP.

### 1.2 No iframe, no postMessage RPC

A native app is already a trust boundary, so the `apps/listener` layer is not ported. Every RPC
method the MVP needs has a direct HTTPS twin keyed by `merchantId`, with no server-side origin
check. Only the sharing flow needs a web view.

### 1.3 Zero third-party runtime dependencies

Accepted exceptions: `kotlinx-coroutines-core` and Compose on Android, `androidx-webkit` on
`:frak-sdk-ui`. Rejected: Retrofit, Moshi, Gson, Alamofire, Room, RxJava, and every DI or analytics
framework.

### 1.4 Two artifacts per platform

`id.frak.sdk:core` / `FrakSDK` carry no UI. `id.frak.sdk:ui` / `FrakSDKUI` carry the web view and
the sharing sheet. A merchant taking only tracking never pulls in a web view.

Gradle modules stay named `frak-sdk` / `frak-sdk-ui` (the ABI dump path keys off `project.name`)
while the published coordinates are `core` / `ui` — Sonatype authorizes namespaces downward only,
so `id.frak:frak-sdk` would have been rejected at upload.

### 1.5 Native where the user can feel it, hosted where they cannot

Share sheet, buttons, haptics and store presentation are native. Reward card, FAQ and legal copy
come from `/sharing`. One reward amount is computed once and displayed identically on iOS, Android
and web.

The public API returns `SharingResult` and never leaks the web view, so going fully native later is
not a breaking change.

## 2. Public API and ABI

The Android surface is frozen by a committed `.api` dump. iOS has no ABI gate and cannot easily
have one — its freeze is source-level.

### 2.1 No Kotlin default arguments on any public declaration

A default argument compiles to the full-arity member plus a synthetic
`$default`/`DefaultConstructorMarker` bridge encoding parameter count and a bitmask. Adding a
parameter changes both descriptors, so every merchant binary compiled against the old arity gets
`NoSuchMethodError` — unfixable by the merchant.

Resolution, by type role:

| Role | Treatment | Types |
|---|---|---|
| Merchant-constructed input | `Builder` | `FrakConfig`, `FrakMetadata`, `SharingRequest`, `SharingProduct`, `ProductDetails`, `AttributionParams`, `RewardRequest` |
| Read model | `internal` constructor, no defaults | `FrakResolvedConfig` + 9 others, `FrakContext.V1`/`.V2` |
| Not expected to grow | explicit overloads | `FrakEnvironment.Custom`, `FrakError.Server`/`.Decoding` |
| Opaque write-only | `@JvmStatic` factories | `Interaction` |

Never `@JvmOverloads` — it fixes Java and leaves Kotlin resolving through `$default`. Kotlin sugar
is a top-level `Type(args) { }` function delegating to the same Builder, so a default has one home.
`FrakConfig.Builder()` must be the primary constructor: nullable and non-null overloads erase to the
same JVM descriptor.

This is what every merchant-facing SDK serving Java converges on — Stripe migrated *to* it from data
classes.

### 2.2 `*Async` twins for Java

Every `suspend fun` on `FrakClient` and the five `*Api` namespaces has a `CompletableFuture` twin
named `*Async`; 18 in total. `kotlinx-coroutines-jdk8` merged into `-core` in 1.7.0 and minSdk 24
clears the `CompletableFuture` floor, so this cost no new dependency.

All twins funnel through `DefaultFrakClient.asFuture` — body on the IO dispatcher, completion
signalled on main via a hand-rolled `MainThreadDispatcher` (`Dispatchers.Main` needs
`kotlinx-coroutines-android`, which is not a dependency). `Frak.shutdownAsync` gets its own
never-cancelled scope, since routing through the scope it cancels would self-cancel the future.

**Trap:** never `get()`/`join()` a twin on the main thread — deterministic deadlock.
**Why not `@JvmSynthetic`:** hiding the twin drops it from the ABI dump too.
**Why `FrakResult<T>` and not `kotlin.Result`:** the latter is a value class that erases to `Object`
from Java and cannot carry the typed `FrakError` arm across the boundary.

### 2.3 `@InternalFrakApi` and BCV `nonPublicMarkers`

`@RequiresOptIn(ERROR) @Retention(BINARY)`, wired into `apiValidation { nonPublicMarkers }`. A
marked class is absent from the `.api` dump, and absence from the dump *is* the compatibility
contract.

May only target a class that appears in no merchant-facing public member's signature — opt-in
propagates through signatures, so marking a return type makes every caller uncallable, and applying
`@OptIn` at the declaration does not stop it. This is why the resolved-config tree got `internal`
constructors instead: marking it would have poisoned `ConfigApi.resolve()`.

Opt-in is per-file `@OptIn`, never a module-wide `-opt-in` flag — the flag would silently void
`PublicSurfaceTest`, which exists to test that exact boundary.

Neither `@RequiresOptIn` nor `internal` blocks Java. Java reaching past them is outside the contract
by construction.

### 2.4 The ABI gate is hand-rolled, and had to be

BCV registers `apiDump`/`apiCheck` only when a `kotlin-android`/`kotlin`/`kotlin-multiplatform`
plugin is applied. AGP 9 compiles Kotlin itself and blocks `org.jetbrains.kotlin.android`, so BCV's
hook never fires — no tasks, no error ([BCV#312](https://github.com/Kotlin/binary-compatibility-validator/issues/312)).
KGP's `abiValidation {}` replacement lives on the standalone Kotlin plugin extension and is closed
by the same gap (KT-78025).

`frak-publish.gradle.kts` therefore drives BCV's own `KotlinApiBuildTask`/`KotlinApiCompareTask`
from the release compile tasks — the same approach OkHttp and elastic/apm-agent-android took. The
BCV version is pinned because these are internal task types, not public API. Tasks are named
`apiDump`/`apiCheck` deliberately: if upstream ever registers them the build fails loudly, which is
the signal to delete the hand-rolled block.

Regenerate with `bun run --cwd sdk/android apiDump` (JDK 17 + `ANDROID_HOME`) and review the diff.
Never run `apiDump` and `apiCheck` in one Gradle invocation.

### 2.5 Failure signalling — four tiers

For new Android API: Absence (`T?`), Outcome (sealed/enum), Predicate (`Boolean`), Failure
(`throws FrakError`). Exception: `tracking.track()`/`purchase()` return `FrakResult<Unit>` and never
throw — hot path, and `TrackingDisabled` is expected rather than exceptional.

**The ABI gate does not police tier changes.** Nullability, `@Throws` and `suspend` erasure are
invisible to the `.api` dump, so a tier change needs `!` in the commit subject and a release note.

### 2.6 `FrakClient` is a sealed concrete class, not an interface

```
root       environment · anonymousId · resetAnonymousId · setTrackingEnabled · isTrackingEnabled
.config    resolve · updates · current          (updates/current iOS-only, see below)
.rewards   campaigns · best
.sharing   buildLink
.tracking  track · purchase
.appLink   handleReferral · isFrakAppInstalled · openFrakApp · installUrl · installPageUrl
```

Adding an abstract member to an interface is an unconditional binary break for every implementer
(`AbstractMethodError` at runtime on the JVM). Sealing it made post-freeze additions safe. Test
fakes go through `FrakEnvironment.Custom` against a stub server, not through a substituted
transport.

`shutdown()` lives on the `Frak` facade, not on the client, so it cannot kill a client that
`Frak.client` handed out.

Two deliberate renames from the JS SDK: `getMerchantInformation()` → `rewards.campaigns()`,
`MerchantReward` → `Campaign`.

### 2.7 `ConfigApi.updates`/`current` diverge on purpose

Android has neither. Its `updates` was fed only from the network-fetch success path and lied on a
warm start — a stale-cache read never fired it. iOS's is multicast, replay-latest, deduped on
equality, and fed by background revalidation, with test coverage. **Do not "fix" this into parity.**

### 2.8 Merchant identity resolution order

Cached config's `merchantId` (cache-only, never network) → `settings.merchantId` → fetch under the
caller's policy. The backend is authoritative; the configured id is a fallback, not an override.

Three policies: `required` (propagate), `optional` (swallow to null), `cachedOnly` (never touch the
network — used for cold-start referral arrival).

## 3. Identity

### 3.1 Storage, per platform

Android keeps the P-256 key in `AndroidKeyStore`, non-exportable and never backed up. iOS keeps key
and merchant marker in a backup-excluded `Application Support/id.frak.sdk/` file, with the Secure
Enclave when available and a raw scalar otherwise.

**Keychain was rejected on iOS**: it survives uninstall/reinstall, which would resurrect a "fresh"
user id inconsistent with Android and web.

**The iOS split is by backup requirement, not by suite.** Key and marker must *not* survive a
restore; the consent decision *must*, or a withdrawal silently reverts to enabled on a new phone.
So consent stays in a backed-up `id.frak.sdk.consent` suite on iOS and in `id.frak.sdk.xml` on
Android. Anyone "fixing" this by excluding every iOS suite, or reinstating Android's backup rules,
breaks it.

The identity store shares `FrakStorage.directory()` with the event queue but **not** its `tmp`
fallback — `tmp` is purgeable, and an identity that churns reports every purge as a brand-new user,
so `Frak.initialize` refuses outright rather than degrading.

### 3.2 Derivation and proof format

`clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])`, RFC-4122 bits set, lowercase canonical.
Swift's `UUID.uuidString` is uppercase and must be normalised once at the boundary.

Proof is `v ‖ pk ‖ ts ‖ sig`, base64url. Validity ±2 min for `merge`, 30 days for `install`. Native
mints `merge` and `install` only — there is no native SSO surface.

No legacy or trust-on-first-use ids. Cryptographic only.

### 3.3 Inbound merge is proof-mandatory

`handleReferral` reads the merge token, signs `frak-merge-v1` binding `SHA-256(mergeToken)`, and
posts `/user/identity/merge/execute` with its own id as `targetAnonymousId`. Unlike web's keyless
legacy path, the proof is mandatory. The token is consumed once per process. There is no outbound
merge-initiate on native.

## 4. Sharing sheet

### 4.1 Warm pool, session-at-the-tap, fragment activation

Three mechanisms, all forced by measurement:

- **Warm pool** — `SharingWebViewPool` pre-warms the real merchant page before the tap, lent to the
  sheet at the tap and rebound on close. A skeleton is stacked over the view until
  `postVisualStateCallback` fires, not `onPageFinished` (which risks a blank frame on React apps).
- **Session-at-the-tap** — `SharingPresentation.start` runs on the click handler itself, before the
  sheet composes. Opening a sheet occupies Main for ~300 ms; anything sequenced inside composition
  loses 200–430 ms.
- **Fragment activation** — the per-tap navigation is delivered as a location fragment merged
  same-document, so there is no request, no remount and no React boot. Tap-to-first-paint went
  555–757 ms from 716–1119 ms.

Traps this locks in:

- The fragment must hang off `WebView.getUrl()`/`webView.url` — the committed, router-normalised URL
  — not the URL originally loaded. Getting this wrong causes a full cross-document navigation.
- Activation is only valid on a *finished* warm document. A fragment on an unfinished document
  strands forever.
- `SharingSession.warmBaseUrl` is compared against the actual view before activating, which is what
  prevents cross-merchant pool reuse.
- A same-document activation produces no `onPageFinished`/`didFinish`, so activation itself must
  settle the load deadline. The invariant: **any page action at all is the page's own JS reporting a
  user driving a rendered document.**
- `preload=1` fires `sharing_page_preloaded`, not `sharing_page_viewed`; activation clears the flag
  so the funnel denominator stays real.
- Only the keys the fragment actually carries are spread over the warm URL. Absent keys must not
  erase existing config values.

### 4.2 A `ComponentDialog`, not a second Activity

The public API takes Stripe's `PaymentSheet` *shape* — Builder, callback, three build sites — but
rejects Stripe's Activity vehicle, hosting in an `androidx.activity.ComponentDialog` like Shopify's
`checkout-sheet-kit-android`.

A WebView plus warm pool plus live coroutine state is not `Parcelable`-shaped, and the durability
guarantee an Activity would buy cannot be honoured anyway — the pool and session are gone after
process death regardless, which is the whole point of the warm pool. `SharingResult.Failed` also
carries an arbitrary `Throwable`.

`ComponentDialog` calls `initializeViewTreeOwners()` on every `setContentView`, giving
`AbstractComposeView` the lifecycle and saved-state owners it needs. It does not provide a
`ViewModelStoreOwner`, which is fine — the sheet never calls `viewModel()`.

**Accepted costs:** no process-death result redelivery, no back-stack participation, and no
independent `windowOptOutEdgeToEdgeEnforcement` on Android 15+.

### 4.3 `ModalBottomSheet` deleted outright

Hosting it inside a `ComponentDialog` would stack two platform Windows — two scrims, two back-press
dispatchers, two IME contracts, conflicting TalkBack semantics.

Almost none of it was in use: gestures disabled, no drag handle, transparent container, rectangle
shape, drag and dismiss already hand-rolled. Its three real jobs map 1:1 onto `ComponentDialog`
itself, `FLAG_DIM_BEHIND` plus a Compose-drawn scrim keyed to the sheet offset, and the existing
`Animatable`-driven `graphicsLayer`.

Deleting it also closed two rendering defects previously judged unfixable from a call site: M3
1.4.0's entry-overshoot scaling blurring the WebView draw functor, and `DraggableAnchorsNode.measure`
using `place()` rather than `placeWithLayer()`, which re-ran `WebView.layout()` every animation
frame.

**Trap:** `themeResId = 0` inherits the merchant's dialog theme, which sets `windowIsFloating` and
defeats `MATCH_PARENT`. The sheet pins `android.R.style.Theme_Translucent_NoTitleBar` and
`lightColorScheme()` because it no longer has a `MaterialTheme` ancestor.

### 4.4 Rotation survival lives in a `ViewModel`

Pool, presentation and sheet state move onto the `ViewModelStore` of the owner passed to `build()`.

The WebView is constructed over a `MutableContextWrapper` — application context while pooled,
swapped to the current Activity from the moment the host attaches, downgraded again in `onDestroy`.
The swap cannot be deferred to `acquire`: a WebView resolves theme, `LayoutInflater` and popup host
at construction time, and a retroactive base swap does not fix already-resolved popups.

Rotation must not report `Dismissed`. `onDestroy` with `isChangingConfigurations` detaches and
dismisses the dialog with no report; `ViewModel.onCleared()` is the real teardown that reports.

The guarantee is configuration-change survival, **not** process-death survival — there is no
`SavedStateHandle`. The dialog's composition and the drag `Animatable` do not survive; the sheet
resets to its resting position, which is correct.

### 4.5 No JavaScript bridge

Inbound is query params, or an activation fragment when already on the warm page. Outbound is an
intercepted navigation to `<returnScheme>://result?...`, cancelled by the SDK. No
`addJavascriptInterface` (no origin control); `addWebMessageListener`/`WKScriptMessageHandler` stay
deferred until more than an action and a session id need to cross, or a reply is needed.

`share` and `copy` are **asks, not reports** — a page cannot call `navigator.share` in an Android
WebView, and a share must be signed by the SDK keypair. They are exempt from the `sendHostResult`
dedupe and repeatable per page load.

Hardening: the sub-frame check runs above the `returnScheme` branch on both platforms; navigation is
pinned to the wallet origin; external http(s) opens in the system browser; file access and universal
file access are disabled; mixed content is blocked; there is no `WKUIDelegate`/`WebChromeClient`,
which blocks `window.open`.

### 4.6 Chrome is styled by origin, not by route

The sheet injects `--frak-host-top-radius` and `--frak-host-surface` at document start, scoped to
the wallet origin. A route-scoped query param was the earlier shape and was wrong: `/install` never
received it and popped square corners mid-flow, and every future route the one web view can reach
would have carried the same bug.

iOS injects nothing by design — a second arc inside a SwiftUI `.sheet` reads as a double corner —
so it inherits the CSS fallbacks.

### 4.7 The install handoff mints its proof at the tap

`returnToHost("install")` → host signs `.install` **now** → loads `<wallet>/install?m=&a=#p=<proof>`
in the same web view → the page hands the code back via `returnToHost("code", value, exp)`.
The sheet stays open throughout.

Minting at the tap rather than at sheet preparation matters three ways: most sheets never reach
install; a Secure Enclave signature can fail and must not block sharing; and the proof's `ts` is
what the backend's 30-day window measures from.

`returnToHost` exists because the page has no signing key. It reports intent; the host decides.

### 4.8 `&confirmed=1` fires only after a real share

Never after a copy. Only the SDK knows whether an OS chooser actually came up, and a copy has
already toasted — a reload would tear down mid-toast.

Tracking is recorded on the **result**, not the intent: `share()` and the tier-3 fallback gate
tracking on the chooser result. `copy()` gates before, because no completion signal exists for a
clipboard write.

**Known weakness:** Android's `NativeShare.share` returns whether the chooser *launched*, not
whether the share completed. True completion needs an `ActivityResultLauncher`, which is a public
API change. Currently optimistic.

## 5. Build, release and distribution

### 5.1 Apache-2.0, native only

`sdk/{android,ios}/LICENSE` diverges from the monorepo's GPL-3.0. GPL is a much harder ask for an
artifact statically linked into a proprietary store binary. Apache-2.0 over MIT for the explicit
patent grant — which covers the identity proof-of-possession scheme — and the trademark clause.

### 5.2 iOS ships through a mirror repo

SwiftPM reads only a root `Package.swift` and has no subpath support
([swift-package-manager#5768](https://github.com/swiftlang/swift-package-manager/issues/5768)), so
`sdk/ios/` is unreachable from the monorepo. `release-ios-sdk.yml` force-pushes one orphan commit
per release to `frak-id/frak-ios-sdk` using a repo-scoped deploy key.

Rejected: a root `Package.swift` in the monorepo (204 MiB clone, tag collisions with the JS train),
and moving `sdk/ios` out (breaks the golden-fixture contract, since the corpus lives in `sdk/core`).

Package identity is the last URL path component, case-folded and globally unique, so the repo is
`frak-ios-sdk` — `ios-sdk` would have collided.

`Tests/` are not mirrored, and the manifest ships unmodified with test targets pointing at absent
directories. `swift build` therefore fails inside the mirror. That is intentional and documented in
the mirror README — no drift is preferable to a divergent manifest.

CocoaPods is not supported; trunk goes read-only 2 Dec 2026.

### 5.3 Swift 6 language mode in the manifest

`Package.swift` is tools-version 6.0 with `.swiftLanguageMode(.v6)` on all four targets, so a
merchant's own build gets the same strict concurrency CI does. Passing `-swift-version 6` from
`run.sh` only reached CI.

**Cost:** a hard Xcode 16 floor for anyone resolving the package. `.unsafeFlags` is not an
alternative — SwiftPM forbids it on a package resolved as a dependency.
**Consequence:** tests use Swift Testing, not XCTest, because the XCTest overlay cannot link at an
iOS-simulator triple from SwiftPM.

### 5.4 A stub javadoc jar

Central requires the artifact to exist and never opens it, and `withSourcesJar()` already publishes
every source file, which is what an IDE reads.

AGP's bundled Dokka carries a relocated ASM predating the `PermittedSubclasses` class-file
attribute and throws on the first `sealed` type it reads as a binary — this SDK has seven public
sealed hierarchies. Pinning a modern Dokka is not reachable: AGP resolves the Dokka worker classpath
in a detached configuration, and Dokka 2's Gradle plugin hooks the same `kotlin-android` plugin AGP
9 blocks (§2.4).

Both modules get the stub, symmetrically — a real jar for one and a stub for its sibling would be
one coordinate family with a silently different contract.

### 5.5 Versioned outside Changesets

`id.frak.sdk:core` and `FrakSDK` version independently. Different registries, different cadence, and
a merchant's binary freezes at store submission, so a JS-style patch cadence is meaningless. Both
`package.json` files are `private` and in `.changeset/config.json` `ignore`; they exist only to
dispatch to `scripts/run.sh`.

Independent means independent: no gate compares the Android version to the iOS one, and neither
release workflow triggers the other. They have matched so far because they were cut together, not
because anything enforces it — and that is the point, since either platform must be able to take a
hotfix alone.

What Changesets does buy, and what replaces it. Changesets owns three things for the JS packages:
the version bump, the CHANGELOG, and the publish. Here the bump is by hand — one commit, all sites,
gated — and the publish is the tag workflow. The CHANGELOG is `sdk/{android,ios}/CHANGELOG.md` in
Keep a Changelog format, written by hand under `[Unreleased]` and promoted by the release commit.
It is not decoration: `scripts/native-version.ts` fails the release if the version being cut has no
section, and both workflows publish that section as the GitHub release body. The iOS one also ships
inside the mirror payload, where it is the only history a merchant can see — each mirror release is
a single force-pushed orphan commit.

The version sites are gated as one set, per platform, from `scripts/native-version.ts`: five files
on Android (`gradle.properties`, `FrakSdkVersion.kt`, `package.json`, the harness coordinates, and
the README twice — the merchant integration snippet and the `publishLocal` path) and three on iOS
(`FrakSDKVersion.swift`, `package.json`, the `exact:` pin in `README.mirror.md`). The list lives at
the monorepo root rather than in Gradle or `run.sh` because one Android site is outside that
package, and because a per-platform copy is the thing that drifts. Extraction failing is a failure
rather than a pass — a site that changed shape would otherwise compare empty to empty and gate
nothing.

### 5.6 No Turborepo, no codegen of `FrakClient`

Native builds are plain Bun scripts and CI jobs. OpenAPI generates Kotlin and Swift *models* only —
the mechanical boundary — never the client.

### 5.7 React Native comes later, or not at all

Additive, after both native SDKs are stable, on a separate release train, never in parallel. An
Expo config plugin would be mandatory from day one: managed workflows wipe `<queries>` and
`LSApplicationQueriesSchemes` on prebuild. New Architecture (TurboModules) only.

## 6. Deliberately not done

| | Why |
|---|---|
| Wallet session, passkey login, embedded wallet, `displayModal`, SSO, pairing | Depend on a wallet session the anonymous path does not need |
| Fully native sharing UI | Gated on a performance measurement that has not been taken |
| iOS App Clip | Superseded by the install-code flow |
| Service-worker cache for `/sharing` | The HTML shell is `no-store` by design, and an offline render dies on two per-merchant queries anyway. `?r=` seeding covers the real case |
| Enforcing share tracking inside the page | Stays an ownership assumption on the native SDK — see [`contract.md`](./contract.md) trap 3 |
| `SKOverlay` campaign tokens | They resolve to the wallet's own App Store Connect account, not the merchant's |
| Web's inbound-link fallback heuristics | Native has synchronous OS APIs |
| Transport injection for tests | `HttpClient` stays `internal`; `FrakEnvironment.Custom` against a stub server is the seam |
| Dex size budget | Retired in `32836c217` — it gated unminified d8 output, so it went red on work costing a merchant nothing and could not see a regression in what R8 keeps |
