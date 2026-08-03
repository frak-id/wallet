# Native SDK — the shape of the public API

`06-abi-decisions.md` recorded a hazard it did not resolve: **`FrakClient` is an
interface, and every member added to it is an unconditional compile-time break for every
implementer.** That document caught the problem in a diff (`preloadSharing`, reverted) and
noted that one instance had already shipped (`environment`). It did not settle what to do
about the type itself.

This does. It shares `06`'s deadline — **the first publish of `id.frak:frak-sdk` to Maven
Central** — and it should land before the BCV dump is committed, because committing that
dump ratifies whatever shape exists at that moment.

## 1. The two decisions

1. **`FrakClient` stops being an interface** and becomes a sealed concrete class
   (`public class FrakClient internal constructor` / `public final class FrakClient`).
   Adding a method to it becomes additive-safe on both platforms.
2. **Its members split into five domain namespaces** — `.config`, `.rewards`, `.sharing`,
   `.tracking`, `.appLink` — with `environment`, `anonymousId` and `resetAnonymousId`
   staying on the root.

Neither is a behaviour change. Every wire call, every proof, every codec is untouched.

## 2. Why the interface has to go

### 2.1 The break is worse than the one Q1 is about

`06` states it, and the reasoning holds:

> Adding an abstract member therefore breaks the exact use case the type exists for… The
> break is **unconditional and compile-time for every implementer**, with no
> recompile-and-move-on path short of implementing the new member — strictly worse than
> Q1's `$default` bridge.

On the JVM this is not only a source break. A Kotlin interface member with a default body
compiles to a Java 8 default method *plus* a `DefaultImpls` class, and consumer code
compiled against the older interface can hit `AbstractMethodError` at runtime across a
separately-compiled module boundary. Adding a non-abstract method to a **class** has no
such failure mode: old bytecode simply never calls it.

Swift does not feel this yet, because the SDK ships as source through SPM. It will the
moment `03-implementation-strategy.md` §3.1's XCFramework `.binaryTarget` plan lands —
protocol witness tables are laid out when the *conformance* is compiled, so a new
requirement invalidates every conformance built before it.

### 2.2 The mitigation in use does not scale

`installPageUrl` was landed with a default body specifically so it would not break
implementers, with both hand-written fakes deliberately not overriding it as the
regression test:

```kotlin
// FrakClient.kt:81
 * Defaulted, so adding it does not break a merchant's hand-written fake — the reason
 * `preloadSharing` was pulled back off this interface (`06-abi-decisions.md`).
```

That works exactly once per member, and only when a silent default is *semantically*
defensible. `installPageUrl` returns `null` and the sheet falls back to the store handoff
— harmless. Applied as a policy across the ~6–9 members the wallet-session cluster will
add, it means every new capability ships with a plausible-looking no-op, and a merchant's
substitute silently does nothing. That is a worse outcome than a compile error.

### 2.3 The justification for the interface was never delivered

`FrakClient`'s KDoc says it is an interface "so merchant tests can substitute a fake
without a mocking framework". `05-audit-findings.md` D4:

> there is no way to *give* the fake to `Frak`. A merchant whose ViewModel calls
> `Frak.client.bestReward()` cannot make that deterministic in a unit test. Every
> merchant's first deliverable will be a `FrakWrapper` class.

So the full ABI cost is being paid for a capability no merchant can use. `PublicSurfaceTest`
proving a fake *compiles* proves something unreachable in practice.

The replacement is already public and already works: **`FrakEnvironment.Custom(wallet:backend:)`**.
A merchant points it at a stub server and exercises the real client — real codec, real
proof signing, real decoder. That is the RevenueCat "Test Store" shape, and it is a
stronger guarantee than a fake, which can silently disagree with our wire format. The
KDoc's promise is withdrawn and replaced with this one.

### 2.4 The surface is not going to stay at 15 members

`02-native-sdk-overview.md` §11 defers "Embedded wallet, `displayModal` multi-step, SSO,
pairing — all depend on a wallet session", plus v0.2's silent linking and the
`frakAction=share` primitive. That is roughly **+2–5 at v0.2 and +6–9 once a session
exists**: ~28 members over seven domains.

Under an interface, each one is a break. Under a sealed class with namespaces, the entire
wallet-session cluster lands as a new `.wallet` namespace without touching anything that
exists.

## 3. What the interface is actually load-bearing for

Sealing `FrakClient` naively would have broken the SDK's own second module, which is not a
merchant concern and was not visible from `06`'s framing:

| Site | Role |
|---|---|
| `frak-sdk-ui/.../SharingSheetState.kt:56` | `private val client: () -> FrakClient = { Frak.client }` |
| `frak-sdk-ui/src/test/.../FakeFrakClient.kt` | 121-line hand-written fake |
| `frak-sdk-ui/src/test/.../SharingSheetStateTest.kt` | 38 tests built on it |
| `FrakSDKUI/SharingSheetModel.swift:57` | `init(client: @escaping () -> (any FrakClient)? = { try? Frak.client })` |
| `FrakSDKTests/PublicSurfaceTests.swift` | second fake, deliberately non-`@testable` |

`frak-sdk-ui` is a separate Gradle module and `FrakSDKUI` a separate SPM target, so both
can only see `public` API — an `internal` interface cannot serve them.

**The sheet touches 8 of the 15 members.** The fix is to inject those, not an abstraction
over all fifteen:

```kotlin
internal class SharingSheetState(
    private val buildSharingLink: suspend (SharingRequest) -> String?,
    private val resolveConfig: suspend () -> FrakResolvedConfig,
    private val bestReward: suspend (String?, List<ProductDetails>?) -> BestReward?,
    private val track: suspend (Interaction) -> FrakResult<Unit>,
    private val installPageUrl: suspend (String, String) -> String?,
    private val openFrakApp: suspend () -> OpenAppResult,
    private val anonymousId: () -> String?,
    private val environment: () -> FrakEnvironment,
)
```

This deletes both fakes (~121 + ~110 LoC), keeps all 38 Android tests and the iOS mirror
alive and *narrower*, and needs no public protocol at all. It is already the idiom in this
codebase — `InteractionTracker(..., currentClientId = { identity.anonymousId() })` and
iOS's `DefaultFrakClient(session:backendURL:)` are the same pattern.

**The rejected alternative** was a narrow `SharingCapable` protocol for the UI module. In
Kotlin it must be `public` to cross the module boundary, so BCV freezes it and merchants
see it in autocomplete — precisely the `PercentEncoding` complaint in `06` Q2. It
relocates the hazard rather than removing it, and it drags `@InternalFrakApi` and `@_spi`
into the tree to serve one internal caller.

**Also rejected:** rewriting the sheet tests against a stub HTTP transport. They test a
sequencing-sensitive state machine; routing them through the network would make them test
the sheet *and* the whole client stack. `FrakEnvironment.Custom` is the seam for merchant
tests; function injection is the seam for ours. Different callers, different answers.

## 4. Target shape

```
root       environment · anonymousId · resetAnonymousId
.config    resolve · updates · current (iOS)
.rewards   campaigns · best
.sharing   buildLink
.tracking  track · purchase
.appLink   handleReferral · isFrakAppInstalled · openFrakApp · installUrl · installPageUrl
```

```kotlin
Frak.client.rewards.best(targetInteraction = "purchase", products = items)
Frak.client.sharing.buildLink(request)
Frak.client.tracking.purchase(customerId, orderId, token)
Frak.client.appLink.handleReferral(url)
Frak.client.config.updates            // StateFlow — coroutines confined to one namespace
```

```swift
try await Frak.client.rewards.best(targetInteraction: "purchase", products: items)
await Frak.client.sharing.buildLink(request)
await Frak.client.appLink.handleReferral(url)
```

`handleReferral` sits on `.appLink` because it is inbound-link handling; that it tracks an
arrival internally is an implementation detail, not a placement argument. There is **no
`.identity` namespace** — three members do not earn one.

### Swift keeps the actor behind a nonisolated root

```swift
public final class FrakClient: Sendable {
    let core: DefaultFrakClient                   // stays an internal actor
    public let config: ConfigAPI
    public let rewards: RewardsAPI
    // …
    public nonisolated var environment: FrakEnvironment { core.environment }
}

public struct ConfigAPI: Sendable {
    let core: DefaultFrakClient
    public func resolve(forceRefresh: Bool = false) async throws -> FrakResolvedConfig {
        try await core.resolveConfig(forceRefresh: forceRefresh)
    }
}
```

(`core` is `internal`, not `private`: each namespace struct lives in its own file and
needs to read it. Naming mirrors Kotlin's `ConfigApi`/`RewardsApi`/… with Swift's
acronym-casing convention, not a separate "Namespace" suffix.)

Namespaces are nonisolated structs forwarding into the actor, so there is **no extra
suspension hop** — callers already await it today. `DefaultFrakClient` stays internal
behind the public class rather than merging into it: the root must be nonisolated to keep
`Frak.client` throwing-*synchronous*, which is the deliberate reason `Frak.swift` uses a
hand-rolled `NSLock` instead of being an actor. The lock is untouched.

## 5. What this deliberately does not do

- **No laziness.** An earlier draft had each namespace and collaborator built `by lazy`.
  Dropped: `ConfigStore`/`RewardRepository`/`InteractionTracker` are a few fields over a
  shared `http`/`logger`/`scope`, and the eager *work* is the `init{}` Task, not the
  allocations. That Task is **required** — "nothing else triggers a drain, since the SDK
  holds no connectivity callback" — so queued events from a previous session would be
  stranded without it. Lazy holders would add `Sendable`/`lazy var` thread-safety surface
  on Swift for an unmeasurable win.
  - Consequence: `02-native-sdk-overview.md` §1.2's "no background threads at rest, no
    work on `Application.onCreate`" **overclaims** and is corrected in this pass. Init
    launches a one-shot drain. The sentence moves to match the code, not the reverse.
- **It does not settle Q1.** Sealing makes *methods* additive-safe. The `$default`
  constructor bridge across 15 types is untouched, and `FrakConfig` gaining a parameter is
  still the break `06` Q1 describes. Q1–Q4 remain open.
- **It does not fix Java-hostility (A7).** `Frak.client.tracking.track(...)` from Java is
  still `suspend`. The split makes a targeted per-namespace fix *possible* later; it does
  not deliver one.
- **`installPageUrl`'s default body loses its rationale.** Once nothing can implement the
  type, "defaulted so it does not break a fake" is dead weight. The default and its comment
  are removed in this pass.

## 6. Order of work

Each step leaves the tree compiling.

1. Rename `DefaultFrakClient`'s `private val config: FrakConfig` → `settings`; the
   `.config` namespace would otherwise shadow it.
2. Invert the UI seam to injected functions on both platforms. Delete both `FakeFrakClient`s.
   *`FrakClient` is still an interface here.*
3. Seal `FrakClient`. Drop the fake-substitution tests, and `installPageUrl`'s default.
4. Add the namespaces; root methods delegate to them, both spellings live.
5. Migrate call sites, then delete the flat root methods.
6. Docs: §9 API surface, the naming map, §1.2's wording, and `06`'s decision log.
7. Re-wire BCV and commit the dump. The shape is settled only here.

## 7. Cost

| | |
|---|---|
| Public types | 1 → 6 per platform |
| Core LoC | roughly flat — namespace plumbing offsets the deleted interface files |
| Test LoC | **−230** (both fakes) |
| Symmetry surface | 5 namespaces × 2 platforms to keep aligned; golden fixtures do not cover API shape |

**The honest argument for the split is timing, not present-day ergonomics.** At 15 flat
members it is marginal. It is free before the Maven publish and a major-version migration
after — OneSignal shipped exactly this split as a breaking v5, and Braze ships `IBraze` +
`BrazeUser` for the same reason. If the wallet session were cancelled, the recommendation
would be to seal and skip the split.

## 8. Still open

- **The example apps do not call this API, and this work did not rewire them.** An earlier
  draft of this section said that rewiring belonged in this work; it didn't happen —
  `05-audit-findings.md` D2's finding stands unchanged. Both harnesses are still hand-written
  stubs whose shape does not match the shipped SDK (`presentSharing` with a completion
  handler, `PurchaseDetails`). There is still no evidence that two-level namespacing reads
  well in a merchant's code. Tracked as follow-up, not silently dropped.
- **`bestReward` is seeded into the iOS sheet and not the Android one**, and Android tracks
  `Interaction.Sharing()` where iOS does not. Surfaced while cataloguing the UI's use of the
  client. Pre-existing, out of scope here, needs its own fix.
