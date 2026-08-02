# Frak Native SDK — Android

Gradle multi-module **library** project for the Frak native Android SDK. Not an
app: there is nothing to install and nothing to launch, so no command here ever
needs a device or an emulator.

> ⚠️ **The MVP surface is implemented. Nothing has run on a device.**
>
> What is implemented and tested (209 JVM unit tests — `grep -rc '@Test' frak-sdk*/src/test -r --include=*.kt | awk -F: '{s+=$2} END {print s}'`):
>
> | Package | What is there |
> | --- | --- |
> | `core` | `FrakConfig`, `FrakEnvironment`, `FrakMetadata`, `FrakError`, `FrakLogSink`, `FrakLogger`, `DefaultFrakClient` |
> | `net` | `HttpClient` over `HttpURLConnection`, `JsonReader` |
> | `config` | `ConfigStore` (SWR), `MerchantQuery`, `KeyValueStore`, `SingleFlight`, `Backoff` |
> | `rewards` | models, decoder and `RewardRepository` for `estimated-rewards` |
> | `identity` | `AnonymousIdStore`, the P-256 keystore keypair, and `ProofCodec` (id derivation + the proof envelope) |
> | `sharing` | `FrakContextCodec` (the `fCtx` v2 binary layout), `SharingLinkBuilder`, attribution merging |
> | `tracking` | `InteractionTracker`, `EventQueue` (durable JSONL, FIFO, bounded) |
> | `applink` | inbound `fCtx` handling with the self-referral guard, the wallet deep link and the Play install referrer |
> | `ui` (`frak-sdk-ui`) | the Compose sharing sheet, its hardened web view, and the native share/copy footer |
>
> Public surface: `Frak.initialize` / `Frak.client`, `FrakClient.resolveConfig`,
> `configUpdates`, `campaigns`, `bestReward`, `anonymousId`, `resetAnonymousId`,
> `buildSharingLink`, `track`, `trackPurchase`, `handleReferralLink`,
> `isFrakAppInstalled`, `openFrakApp`, `installUrl` and `Frak.parseReferralLink`,
> plus `FrakContext`, `SharingRequest`, `SharingProduct`, `AttributionParams`,
> `Interaction`, `FrakResult`, `OpenAppResult` and `DeepLinkHandling`,
> `FrakLogSink`, and the ten public
> config model types: `FrakResolvedConfig`, `ResolvedSdkConfig`, `ResolvedPlacement`,
> `ResolvedComponents`, `ButtonShareConfig`, `ButtonWalletConfig`, `OpenInAppConfig`,
> `PostPurchaseConfig`, `BannerConfig` and `AttributionDefaults`.
>
> A merchant can route SDK diagnostics into their own logging by setting `FrakConfig.logSink`
> (a `fun interface`, so a lambda works) — see "Logging" below.
>
> **Not implemented**: the 4-tier copy precedence (`FrakClient.copy`),
> `referralStatus`, and the analytics event stream.
>
> **Untested on a device.** Every claim here rests on JVM unit tests and a
> release build. The sheet has never actually been presented: the Compose surface
> and the `?confirmed=1` reload are still covered only by the parts of them that
> are pure logic.
>
> The sheet's *sequencing* is no longer in that category. `SharingSheetStateTest`
> and `SharingWebViewClientTest` run under Robolectric — a real Android runtime on
> the JVM — so tier 3's fallback, the 1.5s latency budget, tier 2's cache-only
> retry and the web view's origin pinning are exercised against real `Context`,
> `Intent` and `WebView` behaviour rather than asserted in prose. Each of the five
> bugs fixed in that area has a test that was confirmed to fail without the fix.
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
to **2.2** (02 §2). This was 1.9 until the Kotlin 2.4 upgrade: 2.4 dropped
`-language-version=1.9` together with the K1 compiler, so the old "merchants on
Kotlin 1.9 can consume this" guarantee is no longer expressible. 2.2 rather than
the lowest 2.4 still accepts (2.0) because 2.0 and 2.1 are themselves already
deprecated and will go the same way.

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

## Binary compatibility

There is **no binary-compatibility gate right now.** kotlinx-binary-compatibility-validator
(BCV) was wired into `buildSrc/src/main/kotlin/frak-publish.gradle.kts` and then
removed, along with the `api/*.api` dumps it generated.

The reason is ordering, not doubt about the tool. Committing a dump *ratifies*
the public shape: from then on `apiCheck` enforces it, and changing it is a
breaking release rather than an edit. That shape is still undecided — see
[`docs/plans/native-sdk/06-abi-decisions.md`](../../docs/plans/native-sdk/06-abi-decisions.md),
specifically:

- **Q1** — Kotlin default arguments generate a synthetic `$default` constructor
  bridge whose signature encodes the parameter count, so every public type built
  that way is frozen on arrival: it cannot gain a field without `NoSuchMethodError`
  in a merchant binary that is already in the store. Builders or internal
  constructors plus additive factories are the only additively-evolvable shape.
- **Q2** — whether to keep promoting types straight to fully-public, or gate the
  ones that exist only for `:frak-sdk-ui` behind a `@RequiresOptIn`
  `@InternalFrakApi` wired into BCV's `nonPublicMarkers`, so they link across the
  module boundary without being frozen. `id.frak.sdk.net.PercentEncoding` is the
  current example of a symbol that is public purely because a second Gradle module
  needs it.

Freezing the surface first and deciding its shape afterwards is backwards, so the
gate comes back — with the dumps, and with whatever Q1/Q2 conclude — before the
first publish. Until then `explicitApi()` is the only enforcement: it makes you
*write* `public`, but says nothing about whether a change altered something already
public.

`check` still runs `ktlintCheck`, the `test` task (JVM unit tests), Android Lint,
`checkSdkVersionMatchesArtifact` and `checkDexSizeBudget`. Note it is scoped to
this Gradle build: ktlint is applied to `subprojects {}` only, so the root project
has no `check` task and `./gradlew check` never lints the root
`build.gradle.kts`/`settings.gradle.kts` — only the repo-root `bun run lint` does.
`check` is therefore not a superset of `lint`.

## What each directory is for

`frak-sdk/src/main/kotlin/id/frak/sdk/` mirrors 02 §2's module layout table, one
package per row:

| Package | Lands there |
| --- | --- |
| `core/` | `FrakConfig`, the `FrakClient` facade, `FrakError` |
| `net/` | `HttpURLConnection` transport, JSON only, plus query-string editing |
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
- `frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/` — the sheet's tests, under
  Robolectric. Separate from the core module's on purpose: `:frak-sdk` is
  deliberately free of framework types and must stay provable without an Android
  runtime, so Robolectric is scoped to this module alone. These tests are pinned
  to JDK 17 (see the module's build script) because Robolectric's bundled ASM
  cannot instrument newer bytecode.
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
  so the merchant's own activity keeps owning the intent. `FrakConfig.deepLink`
  is that entry point: `Automatic` registers `ActivityLifecycleCallbacks`
  covering cold *and* warm start, `Manual` leaves it to
  `FrakClient.handleReferralLink`.
- **No permission beyond `INTERNET`.** A library manifest merges into the host
  app; anything added here is a permission the merchant never asked for and has
  to justify on their store listing. The `<queries>` entries cover both
  `id.frak.wallet` and `id.frak.wallet.dev` and are never `QUERY_ALL_PACKAGES`.

`frak-sdk-ui` deliberately has **no `androidx.browser` dependency**. Chrome Custom
Tabs cannot implement this design (02 §3): a Custom Tab is a separate browser
Activity, so it cannot sit in a bottom sheet, cannot carry native buttons, and
cannot lose the browser toolbar. The transport is an embedded `WebView`, which is
a platform class and needs no dependency.

## The sharing sheet

Native chrome around the hosted `/sharing` page, in `frak-sdk-ui`. The split
follows 02 §1.3: what the user can feel is native — the sheet animates in
immediately and the footer opens the real OS share sheet, with their own apps
and contacts — while the reward card, product cards and FAQ come from the page
that already serves three other consumers. Forking that natively would gate
every copy change on a merchant's app-store release cycle.

```kotlin
val sharing = rememberFrakSharingLauncher { result ->
    // InstallStarted is informational — the SDK already handled it end to end.
}
Button(onClick = { sharing.launch(SharingRequest(products = listOf(product))) }) { Text(cta) }
```

Three things in there are load-bearing and easy to lose:

- **`&confirmed=1`.** Under `native=1` the page's own share controls are hidden,
  so after a share the page has no way to know it happened. Without the reload
  the user shares and the page just sits there — no confirmation, no install
  call to action, no wallet. The funnel dies silently.
- **The interaction is queued before the OS share sheet opens.** Android will
  kill a host app while that sheet is foregrounded, so anything recorded on the
  way back is lost in the field.
- **No JavaScript bridge.** State goes in as query parameters and comes out as
  an intercepted navigation to `frak-<packageId>://result`. That is what lets
  this module skip the origin checks the `apps/listener` postMessage layer
  needed — adding a bridge later means re-deriving all of them. The web view is
  also origin-pinned by scheme, host and port (a prefix match would accept
  `wallet.frak.id.attacker.example`), file access is off, mixed content is
  blocked, and links out open in the system browser where the user can see whose
  URL they are on.

The return scheme is derived from the host's package id and must match the
wallet's `^frak-[a-z0-9._-]{1,60}$`; a scheme it rejects means every callback is
dropped with no error anywhere, so it is sanitised and tested against that exact
pattern.

There is no image loader, so the sheet header is text. Loading the merchant's
logo natively would mean a third-party dependency, and the budget in 02 §5 does
not have room for one — the page renders the logo instead, from `logoUrl`.

### Offline behaviour (01 §4's three tiers)

- **Tier 1 (online)** is the page as designed.
- **Tier 2 (warm cache)** is the platform HTTP cache: `WebSettings.cacheMode`
  is `LOAD_DEFAULT`, so an in-date cached response paints without a round trip
  and a stale one revalidates in the background — the same behaviour any
  browser tab gets. On top of that, a failed main-frame load gets **one**
  cache-only retry (`LOAD_CACHE_ONLY`) before falling through to tier 3, so a
  previously-visited sheet can still paint with no network at all.
  **What this does NOT cover:** 02 §7 lever 4 also names a service worker
  caching the `/sharing` shell, so a sheet the device has *never* visited
  before still has something to show offline. That needs a `fetch` handler
  registered wallet-side, and `apps/wallet/app/service-worker.ts` has none —
  it exists only for push notifications (`install`/`activate`/`push`/
  `notificationclick`). Nothing on the SDK side can substitute for a
  wallet-side gap; it is not attempted here, and the first-ever-offline-visit
  case is a real, currently-open gap rather than a solved one.
- **Tier 3 (page unreachable)** fires the native OS share sheet directly with
  the locally-built link, tracked exactly as a normal share. It triggers on a
  main-frame transport error, a main-frame HTTP error, or 02 §7's latency
  budget (1.5s, timed from the moment the sheet starts preparing, not from
  when a page candidate exists — the budget has to cover
  `buildSharingLink`/`resolveConfig` too, both network-bound). Critically,
  tier 3 does not need [`resolveConfig`](../../sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/config/ConfigStore.kt)
  to succeed: `buildSharingLink` is 100% local computation, and `ConfigStore`
  serves any *persisted* config however stale, so `resolveConfig` only ever
  throws with nothing cached at all for this install — a first launch
  offline. Even then, the share still fires; only the reward pitch (which
  needs the resolved config for currency and copy) is lost, and the chooser
  falls back to no title rather than the merchant's name.

Known gaps:

- The web view is recreated on a configuration change. 02 §6.2 asks for it to
  survive rotation, which needs a retained holder Compose cannot express for a
  `View`.
- **Warm web view (02 §7 lever 2) is implemented, opt-in, default off.**
  `FrakConfig.preloadSharing` gates an offscreen `WebView` created and
  `loadUrl()`ed against the wallet origin's `/sharing` route as soon as
  `rememberFrakSharingLauncher` enters composition (the share surface
  appearing), and destroyed when it leaves. It cannot preload the exact page
  URL — `merchantId`/`clientId`/`sessionId` are not known until the sheet
  actually presents — so what it saves is the connection (DNS/TCP/TLS) and
  the on-device `WebView` engine being warm, plus a cache hit on the JS bundle
  where the platform HTTP cache allows it; not reused by the sheet itself
  (see `WarmSharingWebView`'s doc for why). Untested on a device, same as the
  rest of the sheet — and unlike the sheet's sequencing, the warm path has no
  Robolectric coverage either: what it saves is wall-clock connection setup,
  which a JVM test cannot observe.
- Service-worker shell caching (02 §7 lever 4's other half) is unavailable —
  see "Offline behaviour" above.
- **Not the non-persistent data store 02 §7 asks for.** Android has no
  per-`WebView` data store — only a process-wide directory chosen once, before
  any `WebView` exists, which a library cannot take from its host. Third-party
  cookies are off, but first-party wallet cookies and DOM storage outlive the
  sheet in the app's shared directory, and clearing them is an app-global API
  that would delete the merchant's own.
- The install proof does not ride the wallet deep link. `/install` reads it from
  a URL fragment, and the wallet's own deep-link router rebuilds the route from
  search params only, so a fragment would be dropped. Only the Play Store arm
  carries a proof today.
- An inbound link handled automatically is marked consumed with an intent extra,
  which does not survive process death. A cold start from a restored intent
  re-tracks the same arrival.

## The event queue

Tracked events are durable before they are sent, not after. An event recorded
only on a successful response is lost to every tunnel and every process kill —
and Android will kill a host app while the OS share sheet is foregrounded, which
is exactly when a `sharing` event is in flight. So `track` and `trackPurchase`
return once the event is on disk; delivery happens behind them, oldest first.

The store is an append-only JSONL file, compacted on flush (02 §7.1). It lives
in `noBackupFilesDir`, so the platform keeps it out of cloud backup and device
transfer without depending on a rules file a merchant can override — queued
events must never be replayed from someone else's device.

What is pinned, because JSONL is weakest exactly here:

| Concern | Behaviour |
| --- | --- |
| Idempotency | stamped once at enqueue, written into the body on the shapes whose schema carries one — `sharing` and `custom`. Never re-stamped per attempt. `arrival` and `purchase` have no such field and no header is read, so those rely on the backend's own reconciliation. |
| Timestamps | capture time, not flush time, so an event sent hours later still lands in the right attribution window. |
| Ordering | strict FIFO. A failure stops the drain rather than skipping past it. |
| Torn tail | a kill mid-write leaves a partial last line; unreadable rows are discarded, the rest survive. |
| Compaction | temp file plus rename, never in place. |
| Bounds | 1000 events / 14 days, oldest dropped first. |
| Poison | evicted after 3 permanent 4xx, so one rejected event cannot block the queue forever. |
| Backoff | the shared `Backoff` — exponential, jittered, `Retry-After`-aware. 429 and 5xx back off without dropping. |
| `resetAnonymousId` | purges the queue, and the drain independently drops any event whose captured id is no longer the current one — the purge can race a flush, so the guarantee cannot rest on it alone. |

Three gaps to know about:

- **Single writer, not enforced.** A merchant initialising the SDK from a second
  process (`:remote`) would corrupt both this file and the SharedPreferences.
  02 §7.1 asks for a debug-build assertion; there is none yet.
- **No flush on reconnect.** The queue drains on `initialize` and after each
  `track`. A connectivity callback needs `ACCESS_NETWORK_STATE`, which a library
  must not force onto its host, so a device that comes back online mid-session
  drains on the next tracked event rather than immediately.
- **Enqueue needs a merchant id.** The body carries one, so `track` resolves the
  merchant first. With `FrakConfig.merchantId` set — the documented integration
  — that is local. With only a package id and a cache that has never been
  filled, an offline `track` fails instead of queueing.

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
bun run --cwd sdk/android check         # full check: ktlint, tests, Android Lint, version drift, dex budget
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

Versions live in `gradle/libs.versions.toml`. Notable: AGP 9.1.1, Kotlin 2.4.10
(compiling *to* language level 2.2), ktlint plugin 14.2.0 with engine 1.8.0,
Compose BOM 2026.06.01.

Kotlin is compiled by **AGP's built-in Kotlin support**, not the
`org.jetbrains.kotlin.android` plugin, which AGP 9.0 made redundant and which now
fails outright if applied alongside it. Compiler settings therefore live in
`kotlin { compilerOptions {} }` rather than the removed `android { kotlinOptions {} }`.
The Compose compiler plugin is separate and is still applied explicitly.

The Gradle wrapper is **9.5.0**, not the newest 9.6.x. That is the ceiling of the
range Kotlin Gradle plugin 2.4.10 declares fully supported (7.6.3–9.5.0); AGP 9.1
requires at least 9.3.1, so 9.5.0 satisfies both without leaving either matrix.
The launching JDK no longer constrains this — Gradle 9.x runs on any JVM from 17
to 26.

`gradle.properties` turns off the AGP build features this project has no use for
(`buildConfig`, `aidl`, `renderscript`, `resValues`, `shaders`). Each one left on
costs a task per module per variant and can only make the AAR bigger. The SDK
version is a reviewed constant in Kotlin rather than a generated `BuildConfig`
field.

There is no `.gitignore` here — the root one already covers `sdk/android/.gradle/`
and `sdk/android/**/build/`.
