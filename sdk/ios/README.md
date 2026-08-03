# Frak Native SDK — iOS

SwiftPM **library** package for the Frak iOS SDK. Two products, `FrakSDK` and
`FrakSDKUI`, targeting iOS 15+. **Licensed Apache-2.0** (`sdk/ios/LICENSE`), not the
monorepo's GPL-3.0: merchants statically link this into closed-source App Store
binaries, and the patent grant covers the identity proof-of-possession scheme.

> ⚠️ **Swift 6 strict concurrency is verified in one configuration no merchant
> compiles.** `Package.swift` is `swift-tools-version: 5.9` and declares no
> `swiftSettings`, so Swift 6 language mode exists only as `-swift-version 6` inside
> `scripts/run.sh`. A merchant consuming this package gets Swift 5 mode with minimal
> concurrency checking, and the sources already use Swift 6.0-only syntax
> (`isolated (any Actor)? = #isolation`, `nonisolated(unsafe)`). Moving the flag into
> `Package.swift` at tools-version 6.0 is tracked in the audit docs.

> ⚠️ **The MVP surface is implemented. None of it has run on a device.**
>
> What is implemented and tested (257 Swift Testing tests, counted from `@Test` under
> `sdk/ios/Tests`):
>
> | Folder | What is there |
> | --- | --- |
> | `Core` | `FrakConfig`, `FrakLogSink`, `FrakEnvironment`, `FrakMetadata`, `FrakError`, `FrakLogger`, `Base64URL`, `Hex` |
> | `Net` | `HTTPClient` over `URLSession` (GET + POST), `JSONDecoding`, `URLQuery`, `PercentEncoding` |
> | `Config` | `ConfigStore` (SWR, actor-isolated), `MerchantQuery`, `KeyValueStore`, `SingleFlight`, `Backoff` |
> | `Rewards` | models, decoder and `RewardRepository` for `estimated-rewards` |
> | `Identity` | `DeviceKey` (Secure Enclave P-256), `ProofCodec`, `AnonymousIdStore` |
> | `Sharing` | `FrakContext`, `FrakContextCodec` (v2 binary), attribution merge, `SharingLinkBuilder` |
> | `Tracking` | `Interaction`, `EventQueue` (durable JSONL), `InteractionTracker` |
> | `AppLink` | `AppLauncher`, `InstallLinks`, `ReferralArrival` |
> | `FrakSDKUI` | `.frakSharingSheet` — `WKWebView` in a SwiftUI sheet, native share/copy, three-tier fallback |
> | (root) | `Frak`, `FrakClient`, `DefaultFrakClient` |
>
> Both wire formats are asserted against `sdk/core/src/{identity,context}/fixtures/`,
> not against themselves.
>
> **Not implemented**: the 4-tier copy precedence (`copy(placement:component:)`), the
> install-code + pasteboard + `SKStoreProductViewController` handoff (see below), and
> the XCFramework distribution path (`scripts/run.sh xcframework` exits 1 with the
> intended outline).
>
> **No CI builds this.** Every claim above rests on the suites, and the suites are only
> *executed* on the host toolchain — see "Two stages" in `scripts/run.sh`.

### Where iOS deliberately diverges from the Kotlin twin

Three, each forced by the platform rather than chosen. They are the parts of a port
worth reading before the code.

**1. The identity lives in `UserDefaults`, not the Keychain** (`02` §4). Keychain items
survive uninstall, which would resurrect a "fresh" user's anonymous id across a
delete–reinstall cycle — a persistent cross-install identifier, inconsistent with both
Android (where the SDK's preferences are wiped) and the web (where clearing site data
resets the id). What is stored is a key *reference*: on a device with a Secure Enclave,
the blob is the enclave's own wrapped representation, useless to anything but that chip.
`PersistedDeviceKeyStore` falls back to a software `P256.Signing.PrivateKey` where there
is no enclave, which in practice means the simulator.

That suite is included in device backups, so a restore carries the blob to a phone whose
enclave cannot unwrap it. Stored material this device cannot use is therefore replaced
rather than treated as fatal — the id it derived is already unrecoverable at that point,
and refusing to remint would leave the install with no id at all. Nothing is cleared
before a replacement exists: the enclave also refuses before a device's first unlock, and
a read that fails for a passing reason must not cost the user a healthy key.

**2. `DeepLinkHandling` has no `.automatic`.** Android's SDK registers
`ActivityLifecycleCallbacks` and reads inbound intents itself. iOS has no equivalent:
inbound URLs land on the host's own `App`, `Scene` or `AppDelegate`, none of which a
library can observe without being wired in. So `.manual` is the default and the only
working mode — call `appLink.handleReferral(_:)` from `onOpenURL`, or from your router:

```swift
.onOpenURL { url in
    Task { await (try? Frak.client)?.appLink.handleReferral(url) }   // then navigate to it anyway
}
```

The return value says whether the link carried an `fCtx`. It is **not** a "stop routing"
signal: a share link is the merchant's own product URL with a parameter appended.

**3. The install fallback carries nothing.** Android hands the Play Store an install
referrer with `merchantId`, `anonymousId` and a signed proof, so the link survives the
round trip. iOS has no counterpart, so `openFrakApp()` links the identity only on the
deep-link path — when the wallet is already installed. A user who installs from the store
arrives unlinked until the install-code + pasteboard + `SKStoreProductViewController` flow
of `02` §6 exists. `ProofCodec` and `AnonymousIdStore.signProof` are compiled into the
binary regardless and pinned to the golden corpus: a released binary cannot be
retrofitted, so the signing half has to be in the store build before the backend half
is enforced.

> Be precise about what that means today: **`signProof` has no production caller on
> iOS.** It is referenced only by tests. `InstallLinks.deepLink` emits
> `<scheme>://install?m=&a=` — an unauthenticated assertion of an anonymous id — where
> Android mints and attaches a proof. The store-fallback gap is forced by the platform;
> the *deep-link* gap is not, and could carry a proof today. Until it does, the Secure
> Enclave is buying 16 bytes of UUID entropy that `SecRandomCopyBytes` would also give.

### Two smaller notes

The full resolve response *is* decoded, and the whole `sdkConfig` tree —
`ResolvedSdkConfig` and its nested placement, component and attribution types — is
`public`: the sharing sheet that reads it lives in `FrakSDKUI`, a separate SwiftPM
target that only sees `public`, so "internal until there is a reader" cannot work
here. Still absent from the public surface: `css` (no native use), `productId`
(legacy) and `allowedDomains` (browser-only origin check) — see
`FrakResolvedConfig`'s doc comment.

Known divergence from Kotlin: `ResolvedSdkConfig.init(from:)` forgives at the
`components` block, not at each nested leaf, so one wrong-typed leaf drops the whole
block. Now user-visible since `sdkConfig` is public, but fixing it is a decoding
behaviour change out of scope here and tracked separately — see the disabled test in
`ResolvedConfigDecoderTests`.

`example/native-ios` still talks to a type-only stub. Wiring it to this package
is the next step.

Design docs: [`docs/plans/native-sdk/`](../../docs/plans/native-sdk/) —
`01-platform-changes.md`, `02-native-sdk-overview.md`,
`03-implementation-strategy.md`. Section references throughout this file point there.

## What exists

```
Package.swift                            iOS-only, two library products, four targets
Sources/FrakSDK/
  FrakSDKVersion.swift                   version string, header/query param names
  PrivacyInfo.xcprivacy                  real and correct — a hard shipping gate
  Core/                                  FrakConfig, FrakLogSink, FrakEnvironment, FrakError, FrakLogger, FrakCall, Base64URL, Hex
  Net/                                   HTTPClient, Deadline, JSONDecoding, URLQuery, PercentEncoding
  Config/                                ConfigStore, MerchantQuery, KeyValueStore, FrakResolvedConfig, Backoff, SingleFlight
  Rewards/                               reward models, decoder, RewardRepository
  Identity/                              DeviceKey, ProofCodec, AnonymousIdStore
  Sharing/                               FrakContext, FrakContextCodec, SharingRequest, SharingLinkBuilder
  Tracking/                              Interaction, EventQueue, InteractionTracker
  AppLink/                               AppLauncher, InstallLinks, ReferralArrival
  Frak.swift, FrakClient.swift, DefaultFrakClient.swift
Sources/FrakSDKUI/
  FrakSharingSheet.swift                 the .frakSharingSheet modifier and its sheet
  SharingSheetModel.swift                the sequencing: deadline, tiers, outcomes
  SharingSheetLogic.swift                SharingSession + the tier predicate, outside the UIKit #if
  SharingWebView.swift                   hardened WKWebView + navigation-interception policy
  SharingPageURL.swift                   the hosted /sharing URL and the return scheme
  NativeShare.swift                      UIActivityViewController and the pasteboard
  WarmSharingWebView.swift               opt-in offscreen warm-up
  SharingResult.swift                    the outcome type and its significance ranking
  Resources/{en,fr}.lproj                the sheet's native chrome, four keys
Tests/FrakSDKTests/                      roughly one suite per source file + Fixtures/
Tests/FrakSDKUITests/                    SharingPageURL, the outcome ranking, the tier predicate.
                                         SharingSheetModel and SharingWebView have no executed
                                         coverage: neither compiles on the macOS test host.
scripts/run.sh                           build / test / lint / format / xcframework
```

Everything in `FrakSDKUI` that touches UIKit sits behind `#if canImport(UIKit)`, so the
target still compiles for the macOS host that `swift test`'s second stage runs on. On that
host it reduces to `SharingPageURL` and `SharingResult`; the rest is type-checked by stage
one against the iOS-simulator triple and executed by neither.

## `FrakSDK` vs `FrakSDKUI`

Two artifacts, so **a merchant taking only tracking never pulls in a web view**
(`02` §2). `FrakSDKUI` carries the sharing sheet and `WebKit`; `FrakSDK` is UI-free
and headlessly testable. `FrakSDKUI` depends on `FrakSDK`; the dependency never runs
the other way.

`03` §3.3 notes this split is more disciplined than the incumbents — none of Branch,
AppsFlyer, Adjust, Singular or Kochava ships one, because none of them has a UI
surface. Ours is correct precisely because the UI artifact carries a WebView.

### Zero third-party dependencies

A hard rule (`02` §1.2, §5): `URLSession`, `Codable`, native `async`/`await`,
`Foundation.UUID`, `NumberFormatter`, `WebKit`, `UserDefaults` — all platform. No
Alamofire, no Combine wrappers, no DI framework, no analytics SDK. `Package.swift`
declares no `dependencies` at all, and nothing may be added there without revisiting
that rule. Merchant apps are dependency-sensitive, and version conflicts are the
number-one native SDK integration complaint.

## `Core/`, `Net/`, `Identity/`… are folders, not modules

**SwiftPM has no submodule concept.** A Swift module is a target, and these are
directories inside the single `FrakSDK` target. They mirror `02` §2's module layout
table so the Swift and Kotlin trees stay symmetric on sight, but they carry **no**
access-control or import boundary: everything in `FrakSDK` sees everything else in
`FrakSDK`, regardless of which folder it sits in. `internal` is per-target, not per
folder.

Splitting them into real targets would give enforced boundaries at the cost of
`public` on every cross-folder call and a larger `.xcframework` matrix. Not worth it
for an SDK this size — but it is the reason a folder cannot be relied on to hide
anything.

These are the plan's names for what belongs in each folder, not the Swift type names —
several were folded together or renamed on the way in. The tree above is the inventory.

| Folder | What lands there (`02` §2) |
| --- | --- |
| `Core/` | `FrakConfig`, `FrakLogSink`, the `FrakClient` facade, `FrakError` |
| `Net/` | `URLSession` transport, JSON only, injects `x-frak-client-id` |
| `Identity/` | `AnonymousIdStore` — device-held P-256 keypair, lowercase canonical form |
| `Config/` | dual SWR cache (config + bare `merchantId`), `PlacementResolver` (4-tier copy, `02` §8.2b) |
| `Rewards/` | `RewardRepository`, `RewardSelector`, `RewardFormatter` |
| `Tracking/` | `InteractionTracker`, `PurchaseTracker`, durable offline JSONL queue |
| `Sharing/` | `FrakContextCodec` (V2 binary), `AttributionMerger`, `LinkBuilder` — the `Presenter` lives in `FrakSDKUI` |
| `AppLink/` | `DeepLinkBuilder`, `InstallRedirector`, `AppInstalledProbe` |

## Logging

Silent by default (`FrakConfig.logLevel = .none`). Raising `logLevel` sends diagnostics to
`os.Logger` under the `id.frak.sdk` subsystem, `Frak` category.

A merchant can also route those diagnostics into their own logging — an `os.Logger`
subsystem of their own, CocoaLumberjack, a crash reporter's breadcrumb trail — by setting
`FrakConfig.logSink`. It is a protocol, so a conforming type is enough:

```swift
struct TimberSink: FrakLogSink {
    func log(level: FrakLogLevel, message: String, error: (any Error)?) {
        // route into your own logging
    }
}

Frak.initialize(
    FrakConfig(
        merchantId: "...",
        logLevel: .info,
        logSink: TimberSink()
    )
)
```

Two rules govern it, same as Kotlin:

- **`logLevel` gates the sink too, and gates it first.** A message is filtered against
  `logLevel` before the sink is ever consulted, so `.none` reaches the sink exactly as it
  reaches `os.Logger` — not at all — and lowering `logLevel` reduces the sink's volume
  exactly as it reduces `os.Logger`'s.
- **A sink replaces `os.Logger`, it does not add to it.** Once `logSink` is set, gated
  messages go to the sink *instead of* `os.Logger`. This is deliberate: `os.Logger` output
  is harvested by crash reporters, so a sink is the only way for a merchant to stop Frak's
  own lines reaching it.

iOS-specific hazards that Kotlin's `synchronized`/reentrant lock and single-threaded logcat
writer do not have:

- **The sink is called synchronously, on whatever thread or actor produced the line** —
  including from inside the `ConfigStore` and `RewardRepository` actors. A slow sink
  serialises SDK work on that actor; do not do blocking I/O in `log(level:message:error:)`.
- **It may be called concurrently**, from more than one thread or actor at once — this is
  exactly why `FrakLogSink` requires `Sendable`. A conformer must be safe to call from
  multiple threads simultaneously.
- **Calling back into `Frak`** (`Frak.client`, `Frak.isInitialized`, or a second
  `Frak.initialize`) from a sink is no longer a deadlock: `Frak.initialize` only holds its
  lock to decide what happened, and emits every log line afterwards, once the lock is
  released, so no logger call happens while the lock is held on any path. It is still a bad
  idea, though — if the reentrant call itself logs, it recurses into the sink again with
  nothing to bound the recursion.
- **A trap inside it cannot be contained.** Unlike a throwing Kotlin lambda, which this SDK
  catches, a Swift `fatalError`, forced unwrap, or forced try inside a sink brings down the
  host process; there is no equivalent of "swallow and continue" for a trap.

`FrakLogger`, the internal wrapper both routes go through, stays non-public — `FrakLogSink`
is the seam merchants get, not that type.

## Calling `Frak.client`

`Frak.client` is throwing-synchronous (`get throws`, not `async`) — it only has to check
whether `initialize(_:)` has run — while every namespace member on `FrakClient`
(`rewards.best`, `config.resolve`, `sharing.buildLink`, …) is `async`. Swift has no syntax
for "throw synchronously, then await" in one expression, so `try await Frak.client.rewards
.best(...)` does not compile: `client` has to be resolved first.

The recommended idiom, local to whatever type needs it:

```swift
private func client() -> FrakClient? { try? Frak.client }
```

then `await client()?.rewards.best(...)`, `try await client()?.config.resolve()`, etc. This
is deliberately **not** a second public accessor on `Frak` or `FrakClient` — two public
spellings of the same thing would be frozen forever by the same source-compat guarantees
as the sealed `FrakClient` namespace, and an `async` `Frak.client` would break symmetry
with the synchronous Kotlin equivalent. Write the three lines above per call site instead.

## Building, testing, linting

From the repo root, or `cd sdk/ios` and drop the `--cwd`:

```bash
bun run --cwd sdk/ios build    # compile against the iOS simulator SDK
bun run --cwd sdk/ios test     # compile for iOS, then run the suites
bun run --cwd sdk/ios lint     # swift-format lint (strict)
bun run --cwd sdk/ios format   # swift-format rewrite in place
```

These wrap `scripts/run.sh`, which is where the real invocations live. Commands are
owned by this package's `package.json` rather than aliased at the repo root, matching
how every other package in the monorepo declares its own `build` / `lint` / `format`.

### `swift build` under Swift 6 IS the typecheck

There is no separate `tsc`-equivalent step. Swift 6 strict concurrency is a hard
requirement (`02` §2: "Swift 6 strict-concurrency clean"), so a green build is the
typecheck, the concurrency check, and the data-race check at once:

```bash
swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator \
  -Xswiftc -swift-version -Xswiftc 6
```

The explicit triple is not optional ceremony. **A bare `swift build` targets the host
and compiles this as macOS** — passing without ever exercising iOS. `scripts/run.sh`
always supplies it for `build` and the first stage of `test`.

`Package.swift` also declares `platforms: [.iOS(.v15), .macOS(.v12)]`. The macOS entry
is not a second supported platform to ship — it exists only because `swift test`'s
second stage (below) runs the compiled tests directly on the host toolchain, and
without a macOS floor that run falls back to a very old implicit deployment target
where APIs the SDK uses (`Logger`, `URLSession.data(for:delegate:)`) do not exist.

`-swift-version 6` is passed on the command line rather than declared in the manifest.
`.swiftLanguageMode(.v6)` is a PackageDescription 6.0 API, unavailable at
tools-version 5.9; the 5.9 alternatives are `.unsafeFlags`, which SwiftPM refuses in a
resolved dependency and would make this package unconsumable, or
`.enableUpcomingFeature`, which flips individual proposals rather than the language
mode. Tools-version 5.9 is the floor from `02` §2, so the flag stays in `run.sh` until
the floor moves.

### `swift test` runs on the host, on purpose

`test` is two stages, because neither alone is the test:

1. `swift build --build-tests` at the iOS triple — proves the suites compile against
   the iOS SDK under Swift 6 strict concurrency.
2. `swift test` on the host — actually asserts behaviour.

Stage 1 cannot run the suites: SwiftPM's test runner is a macOS process and refuses to
`dlopen` an iOS-simulator bundle. Executing on a real simulator needs
`xcodebuild test -destination 'platform=iOS Simulator,…'`, which needs a generated
Xcode project — the gap the example harness fills with XcodeGen. That is deferred
alongside the XCFramework work.

That day has arrived, so stage 2 is no longer sufficient on its own. `FrakSDK` has one
platform-conditional seam — `SystemAppLauncher`, which is a `false`-returning stub where
there is no `UIKit`, and which nothing tests directly. `FrakSDKUI` has five (six across
the package): everything touching UIKit sits behind `#if canImport(UIKit)`, so on the host that target reduces to
`SharingPageURL` and `SharingResult`. The sheet, the web view, the state machine and the
native share are type-checked by stage 1 and **executed by neither** — the
xcodebuild-on-simulator path above is what finally runs them.

The suites use **Swift Testing, not XCTest** — XCTest's Swift overlay is a zippered
macOS/Catalyst dylib and cannot be linked for `arm64-apple-ios15.0-simulator` from
SwiftPM at all, so an XCTest suite could not clear stage 1.

`Tests/FrakSDKTests/Fixtures/` is where the golden-fixture loader lands (`03` §1.6):
one committed language-agnostic corpus generated from the TypeScript suites. One
corpus, not three.

**Two of its three parts are asserted from Swift**: the FrakContext v2 codec
(`golden-context.json`) and the signed byte layout for `merge`/`ensure`/`install`
(`golden-proofs.json`), both identically from Swift, Kotlin and TS.
`golden-rewards.json` is **declared by `GoldenFixtures.rewards` and loaded by no
test — on either native platform.** Most of its 67 vectors cover reward selection and
currency formatting that neither native SDK implements (the backend returns
pre-formatted values via `formatted=1`), but its 16 `format-amount` vectors are a real
decode-fidelity contract, and they are currently hand-copied into
`RewardsDecoderTests.swift` as literals instead. Wire them or drop the constant.

### `swift format` owns this folder, not biome

`biome` cannot parse Swift, so `sdk/ios` is excluded from it in `biome.json`.
**swift-format** is the equivalent of `bun run format` and `bun run lint` here.

Nothing to install: `swift format` ships inside the Xcode toolchain, so the version is
pinned to whatever Xcode the machine already builds with. Rules live in
`.swift-format`, copied verbatim from `example/native-ios/.swift-format` — the SDK is
held to at least the harness's bar. 4-space indent to match the repo's biome settings
rather than swift-format's 2-space default, `--strict` so style findings fail rather
than warn, and `NeverForceUnwrap` / `NeverUseForceTry` /
`NeverUseImplicitlyUnwrappedOptionals` on top of the defaults — the Swift analogue of
the repo's ban on `as any` / `!` in TypeScript.

## `PrivacyInfo.xcprivacy` is a hard gate

`Sources/FrakSDK/PrivacyInfo.xcprivacy` is real and kept current with what the code
actually does. Since 1 May 2024, an SDK using a *required-reason API* must declare it in
a privacy manifest or App Store Connect rejects the upload with **ITMS-91053**.

**That rejection lands on the merchant's upload, not ours.** Getting this wrong breaks
every integrator's release — the worst possible first impression, and the reason the
file is already here.

It declares:

- `NSPrivacyTracking` false, with no tracking domains. Nothing the SDK sends is joined
  with data from another company's app or site, and none of it reaches a data broker.
  The ATT decision itself is `02` §12 question 1 and is still open; if it changes, this
  key and the per-type `Tracking` flags change with it.
- `NSPrivacyCollectedDataTypeDeviceID`, linked and not for tracking — the anonymous id,
  which the install handoff deliberately links to the user's Frak identity.
- `NSPrivacyCollectedDataTypePurchaseHistory`, linked — `trackPurchase` transmits the
  merchant's customer and order identifiers plus a checkout token.
- `NSPrivacyCollectedDataTypeProductInteraction`, linked — `track(_:)` posts `arrival`,
  `sharing` and `custom` interactions. This is the SDK's headline feature and was the
  most conspicuous omission when the file declared only the two types above.
- `NSPrivacyCollectedDataTypeUserID`, linked — `trackPurchase(customerId:)` takes the
  merchant's own customer identifier. Distinct from the Device ID: declaring it only as
  Purchase History under-declares the identifier itself, and under-declaring is the
  rejection.
- `NSPrivacyAccessedAPICategoryUserDefaults` with reason `CA92.1`, for the merchant
  config cache and the anonymous id (`02` §4). Nothing else the SDK touches is a
  required-reason API — no file timestamps, disk space, boot time or active keyboards,
  and neither WebKit nor `UIPasteboard` is in a category. **`CA92.1` is settled**: it
  covers an SDK reading/writing UserDefaults in the app's own container on the app's
  behalf. `C56D.1`, floated in `02` §5.1, is for an SDK exposing a UserDefaults
  *wrapper API for the app to call* — this SDK exposes none, so it would be wrong.

**`Interaction.custom(_:data:)` is the merchant's own declaration responsibility.** It
carries an arbitrary `[String: String]` that the SDK durably persists and transmits; a
merchant who puts an email or a user id in there makes this manifest incomplete for
*their* binary, and ITMS-91053 lands on their upload. Say so in integration docs.

**`FrakSDKUI` ships its own manifest** (`Sources/FrakSDKUI/PrivacyInfo.xcprivacy`,
wired as a `.copy` resource). It is a separately consumable `.library` product, so an
absent file there is not "inherits `FrakSDK`'s" — Apple aggregates per binary, and it
would be a hole in the merchant's privacy report. It declares the subset the module is
itself responsible for: `DeviceID` and `ProductInteraction` (`SharingPageURL.build`
puts `clientId` and `merchantId` in the page URL; the sheet reports the share outcome),
plus an **explicit empty** `NSPrivacyAccessedAPITypes` — an empty array is a
declaration, an absent file is not. `UIPasteboard` in `NativeShare` is not a
required-reason category.

One known failure mode to validate before shipping (`03` §3.1): AppsFlyer's manifest
failed to bundle correctly in the *static* SPM variant (their issue #281). Propagation
must be checked against a real consumer app, not a local build.

## Distribution: SPM only, CocoaPods deliberately not supported

**CocoaPods is not supported and will not be** (`03` §3.1). It has been in
self-declared maintenance mode since 2024 and its trunk — the publish server — goes
**fully read-only on 2 December 2026**. After that date no new pods or new versions can
be published. Adding CocoaPods support now means building a publishing path into a
registry that closes within months of our own launch. Flutter is the bellwether: as of
3.44, SPM replaced CocoaPods as its default iOS dependency manager.

The shipped artifact will be a **signed binary XCFramework**, referenced from a
consumer's `Package.swift` via `.binaryTarget` with a remote zip and checksum — the
pattern AppsFlyer uses. Signing is not currently mandatory (Frak is absent from
Apple's commonly-used third-party SDK list) but `02` §5.1 and `03` §3.3 both call it
the right move: it is cheap, it is a supply-chain signal, and joining that list later
would make it required.

**None of that is built yet.** `bun run --cwd sdk/ios xcframework` exits 1 with a
pointed message; the intended `xcodebuild archive` / `-create-xcframework` outline is
in the comments above `do_xcframework()` in `scripts/run.sh`.

## Monorepo placement

`sdk/ios` sits in the root `package.json` workspaces glob (`sdk/*`), so this
`package.json` exists to make the folder a workspace member with the standard script
names — it publishes nothing to npm (`private: true`) and Bun installs nothing for it.
Versioning stays **outside** the Changesets linked group that ties
`@frak-labs/frame-connector`, `@frak-labs/core-sdk` and `@frak-labs/react-sdk`
together (`03` §5.3): the iOS SDK's version is the one in
`Sources/FrakSDK/FrakSDKVersion.swift`, which feeds the `x-frak-sdk-version` header and
the `?sdkv=` query parameter (`01` §1.5), and it must not move because a web package
bumped.
