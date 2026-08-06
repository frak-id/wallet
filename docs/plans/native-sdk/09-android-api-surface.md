# Android SDK — API surface decisions

Status: locked. Applies to `sdk/android`. iOS unaffected except where noted.

This is the resolution of A3, A7, A2/9.8 and the `PercentEncoding`/BCV half of A1 from
[`06-open-findings.md`](./06-open-findings.md), and it supersedes the Q1/Q2 half of
[`05-build-and-release.md`](./05-build-and-release.md) §5. Q3–Q7 there are untouched and still open. Written as one document because the five
decisions are not independent: removing default arguments is what makes `nonPublicMarkers` behave,
and the `*Async` twins are what make Java a real target rather than a claim.

## 0. The compiler facts everything below rests on

Verified against kotlinlang.org and BCV's own issue tracker rather than assumed, because three of
the five decisions turn on them.

| Fact | Consequence |
|---|---|
| A default argument compiles to the full-arity member plus a synthetic `$default`/`DefaultConstructorMarker` bridge encoding parameter count and a bitmask. Adding a parameter changes both descriptors | Every merchant binary already compiled against the old arity gets `NoSuchMethodError`. This is A3 |
| Opt-in propagates through signatures: *"if the signature of an API element includes a type that requires opt-in, the signature itself must also require opt-in"*, and applying `@OptIn` at the declaration **does not** stop it — *"the opt-in requirement still propagates"* | An `@InternalFrakApi` on a type that any merchant-facing member returns makes that member uncallable. See §3 |
| No same-module exemption exists. Module-wide `-opt-in=<marker>` is the sanctioned escape, per file `@OptIn` the narrow one | The SDK must opt in to its own marker, and *where* it does so is a real choice — a module-wide flag also silences the marker in the tests written to prove what a merchant can reach |
| A marker on a constructor-`val` resolves `param → property → field` and, on either of the first two, never reaches the class file as a Java annotation — it lives in `@Metadata` plus a synthetic `getX$annotations()` holder, which BCV filters out | A property-level marker gates the Kotlin compiler and leaves the getter frozen in the dump: the worst of both. Hence `@Target(CLASS)` only |
| A `sealed` class's constructor may be `protected` (the default) or `private`, and nothing else — `public` and `internal` are compile errors | `FrakError`'s base constructor cannot be hidden. Dropping its `cause` default is the whole of what is available, and it is enough: the default was the bridge |
| BCV omits an `internal` constructor from the dump, but *keeps* the `DefaultConstructorMarker` bridge a defaulted internal constructor still emits. Evidence: [BCV issue 171](https://github.com/Kotlin/binary-compatibility-validator/issues/171), which shows the before/after dumps for exactly this — marking the constructor `internal` removes one `<init>` line and leaves `public synthetic fun <init> (…DefaultConstructorMarker;)V` | "Internal constructor" and "no default arguments" are one decision, not two. Re-verify against the first real `apiDump`: if BCV filters `ACC_SYNTHETIC` in the version we pin, the no-defaults half is unmotivated |
| `@RequiresOptIn` has no javac enforcement. `internal` is emitted `public` in bytecode; Kotlin name-mangles `internal` *functions* but cannot mangle a constructor, so an `internal` constructor stays javac-reachable | **Neither mechanism blocks Java.** What both buy is a Kotlin compile error plus absence from the `.api` dump — and the dump *is* the compatibility contract, so a Java caller who reaches past it is outside it by definition. Stated once here because three earlier drafts of this document claimed a javac block that does not exist |

## 1. Construction — Builder, with Kotlin sugar over it

The rule: **no public API carries a Kotlin default argument.** That is the target state, not a
description of the tree today — §1a lists everything that still violates it and which step closes
each one. One implementation, two entry points:

```kotlin
// Java — the canonical form, the Builder is the implementation
FrakConfig.Builder("merchant-id")
    .trackingEnabled(false)
    .logLevel(FrakLogLevel.DEBUG)
    .build();

// Kotlin — sugar, delegates to the same Builder
val config = FrakConfig("merchant-id") {
    trackingEnabled = false
    logLevel = FrakLogLevel.DEBUG
}
```

The sugar is a top-level function taking `Builder.() -> Unit` — the "fake constructor" idiom Compose
uses for `AnnotatedString`. Both entry points are ABI-additive: a new option is one new setter plus one
new `var`, never a changed constructor signature.

**One deviation from the plan as written, and it removes surface rather than adding it.** The plan said
"a scope class with `var`s that writes through to the Builder". There is no separate scope class: the
Builder's own `var`s *are* the scope. A distinct scope class would mean a second public type per
input type, a second home for every default (and therefore a way for the two to drift), and the same
call syntax either way. Collapsing them keeps the plan's stated invariant literally — one new setter
plus one new `var` — with one type instead of two.

One thing the example above got ahead of itself on, settled in step 2: `merchantId` is **not**
required. `FrakConfig.merchantId` is `String?` and resolution falls back to `packageId` when it is
null, so a `Builder(merchantId)` with a required positional argument would have deleted that path.
Answer: two constructors, `Builder(merchantId: String)` and `Builder()`. The empty one has to be the
*primary* — a shared `private constructor(String?)` would erase to the same JVM descriptor as
`constructor(String)`, since nullability is an annotation rather than part of a signature, and the two
would collide. `merchantId` also keeps an ordinary setter, like every other option; the two
constructors are ergonomics for the two shapes a call site takes, not an attempt to make the field
unreachable any other way.

A second rule fell out of the same question, and it is worth stating because it decides every future
type: **the sugar mirrors the Builder's constructor overloads, and there is never a no-argument one.**
`SharingProduct.Builder(title, link)` and `FrakConfig.Builder(merchantId)` exist, so
`SharingProduct(title, link)` and `FrakConfig("merchant-id")` exist beside their lambda forms — in
`FrakConfig`'s case not because `merchantId` is required (it is not; §1 above is explicit) but because
it is the recommended way to name a merchant and the shortest working config. What deliberately does
*not* exist is `SharingRequest()`/`FrakMetadata()`/`ProductDetails()`/`AttributionParams()`: for a type
with nothing required, an empty call is indistinguishable from the all-defaults constructor this whole
exercise removed, so the lambda is mandatory even when it is `{ }`.

Never `@JvmOverloads`. It fixes Java and leaves Kotlin callers resolving through `$default` anyway.

Order of application:

| Type | State |
|---|---|
| `FrakSharing` | done (`refactor/android-sharing-sheet-api`) |
| `SharingRequest`, `SharingProduct`, `ProductDetails` | done — step 2 |
| `FrakConfig`, `FrakMetadata`, `AttributionParams` | done — step 2 |
| `FrakEnvironment.Custom`, `FrakError.Server`/`.Decoding` | done — step 2, explicit overloads rather than Builders (§1a) |
| `FrakContext.V1`/`.V2` | done — step 2, but as a read model: `internal` constructors, no Builder |
| Resolved-config tree | not builders — §3 |

`ProductDetails` is an addition to the original list, and belongs there on the same evidence: six
fully-defaulted parameters, merchant-constructed, reached from both `SharingProduct.details` and — since
step 4 — `RewardRequest.products`. It is the same finding as `SharingRequest`, one level down.

### 1a. Where defaults still survive

The rule covers all public API, not just the constructors. Auditing `:frak-sdk`'s whole main source
set turns up twelve more declarations across the nine rows below that the original plan did not list,
and one row is load-bearing for step 4. (`:frak-sdk-ui` is already clean: `FrakSharing.Builder`'s knobs
are `private var`s and `FrakSharingDefaults.HEIGHT_FRACTION` is a `@JvmStatic val`.)

After step 4 the table is closed: no public declaration in either module carries a Kotlin default
argument. Only step 5 remains.

| Declaration | Defaults | Step |
|---|---|---|
| `ConfigApi.resolve(forceRefresh = false)` | 1 | 4 — **done**: `resolve()` / `resolve(Boolean)`, each with a `resolveAsync` twin |
| `RewardsApi.campaigns(forceRefresh = false)` | 1 | 4 — **done**: same shape |
| `RewardsApi.best(targetInteraction, audience, forceRefresh, products)` | 4 | 4 — **done**: `best(RewardRequest)` / `best(RewardRequest, Boolean)`. `forceRefresh` stays a parameter, not a field of the request; see §2a |
| `FrakEnvironment.Custom` secondary constructor | 2 | 2 — **done**: two explicit overloads, `(wallet, backend)` and `(wallet, backend, walletPackageId, walletScheme)` |
| `FrakError.Server(status, code, retryAfterSeconds)`, `FrakError.Decoding(message, cause)` | 3 | 2 — **done**: one explicit overload each (`Server(status)`, `Decoding(message)`), and the `FrakError` base constructor lost its `cause` default. It could *not* also be hidden — see the sealed-constructor row in §0 — so it stays `protected` and in the dump, minus the bridge |
| `BestReward(…, isProductScoped, matchedProducts)` (`rewards/Rewards.kt`) | 2 | 2 — **done**: defaults dropped. Not in the original audit and it should have been: a *read* model with a public constructor and a `DefaultConstructorMarker` bridge is the same hazard as an input type. `RewardsDecoder` always passed all seven arguments, so the defaults only ever served the decoder's own forward-compatibility, which is where that concern belongs. Whether the reward read models should follow the config tree to `internal` constructors is still open, below |
| `FrakContext.V2(merchantId, timestamp, clientId, wallet)` | 2 | 2 — **done**, and not with a Builder. It is returned by `Frak.parseReferralLink` and never supplied by a merchant, so it took the read-model treatment: `internal` constructors on both `V1` and `V2` |
| `Interaction.Arrival` (4), `Interaction.Sharing` (2), `Interaction.Custom` (2) | 8 | 3 — **done**: the collapse in §4 removed all three publicly-constructible classes, and the defaults with them |
| `mergeAttribution(...)` | 1 | none — `internal`, not on the surface |

Step 4 has to answer one thing the plan left open: when `best` gains `bestAsync`, does the `suspend`
original keep its `$default` bridge? It must not. Both twins take the same explicit arity, which is
exactly why §2's example shows `best(request: RewardRequest)` — the parameter object is what makes a
four-optional call site expressible without defaults on either twin.

## 2. Async — Kotlin `suspend`, Java `*Async` → `CompletableFuture`

```kotlin
public suspend fun best(request: RewardRequest): BestReward?
public fun bestAsync(request: RewardRequest): CompletableFuture<BestReward?>
```

Free: `kotlinx-coroutines-jdk8` merged into `-core` in 1.7.0, the SDK is on 1.11.0 with
`api(kotlinx.coroutines.core)`. minSdk 24 clears `CompletableFuture`'s floor. `future.cancel(true)`
cancels the job.

Three invariants:

1. `scope.future(Dispatchers.Main) { … }` — otherwise `thenAccept` runs off-main and the obvious
   Java call site crashes. (`Dispatchers.Main` turned out not to exist on this classpath; the
   invariant survives, the mechanism does not — see §2a.)
2. Launch on the same `SupervisorJob` `shutdown()` cancels. Not a fresh scope.
3. `*Async` suffix, not `@JvmSynthetic` — hiding the twin also drops it from the BCV dump.

### 2a. What landed, and four places the sketch above was wrong

**`Dispatchers.Main` does not exist on this classpath, and adding it would be worse.** It lives in
`kotlinx-coroutines-android`, which nothing here depends on; touching it throws
`IllegalStateException: Module with the Main dispatcher had failed to initialize` in the merchant's
process. `:frak-sdk-ui` already met this and answered it with a hand-rolled `MainThreadDispatcher`
over `Handler(Looper.getMainLooper())`. `:frak-sdk` gets its own copy, for three reasons: adding the
artifact is a second runtime dependency in a library that advertises one; it would retroactively
falsify `SharingHost.kt`'s KDoc, which says the dispatcher is on no classpath *in this build*; and it
would not even buy testability, since its `Dispatchers.Main` also resolves through
`Looper.getMainLooper()`, which throws on the stubbed `android.jar` `:frak-sdk` tests run against. The
seam that works is constructor injection, which `DefaultFrakClient` already uses for `ioDispatcher`.
The copy's handler is `by lazy` where `:frak-sdk-ui`'s is not — `:frak-sdk-ui` runs under Robolectric
and `:frak-sdk` does not, so class-init must not touch the framework. Duplicated rather than shared
because sharing means `@InternalFrakApi public`, and that marker has not fired against a real
`apiDump` yet (§3a).

**Invariant 1 as written would have put the whole body on the main thread.** `scope.future(context)`
merges `context` into the scope's, *overriding* the scope's `ioDispatcher`. It survives today only by
accident — every blocking leaf hops itself, but `resolveConfig`/`campaigns`/`bestReward` deliberately do
not — and the first leaf that forgets is an ANR in a release build. So every twin funnels through one
internal helper, `DefaultFrakClient.asFuture`, which is `scope.future(mainDispatcher) { withContext(ioDispatcher) { … } }`:
body on IO, completion signalled on main, one place that names either. `scope` stays private; nothing
new reaches the public surface.

The honest limit, recorded once: what this guarantees is that *completion is signalled* on the main
thread. `CompletableFuture` runs a non-`Async` stage on the completing thread **or** the registering
thread, whichever is later, so a `thenAccept` attached after the future already completed runs inline
on whoever attached it. For the call site this exists for — register immediately, from main — the two
are the same thing.

**Invariant 2 cannot apply to `Frak.shutdownAsync`.** Routing teardown through the scope teardown
cancels means the future is cancelled by the work it is awaiting: `isCancelled` true, and a Java
caller's `thenRun(::finishTeardown)` never fires. It gets its own never-cancelled scope, and says why.

**"Result type is `FrakResult<T>`" is a ban on `kotlin.Result`, not a wrapping mandate.** The twins
mirror whatever the suspending member returns — `resolveAsync` completes exceptionally with the same
`FrakError` that `resolve` throws; `trackAsync` returns `CompletableFuture<FrakResult<Unit>>` because
`track` returns `FrakResult<Unit>`. Re-wrapping all eighteen would give one surface two error models,
make `exceptionally`/`whenComplete` dead code, and redefine `FrakResult`'s documented meaning
("outcome of a fire-and-forget call") one commit before it freezes. Two deliberate exceptions: `setTrackingEnabledAsync` and `shutdownAsync` return
`CompletableFuture<Void?>`, because `kotlin.Unit` on a Java signature is noise. Stated precisely, since
otherwise the exception looks arbitrary: **twins mirror, except where the mirrored type is `Unit` and not
nested.** `trackAsync` stays `CompletableFuture<FrakResult<Unit>>` — unwrapping a nested `Unit` would
mean inventing a different result type for the Java surface, which is what this paragraph refuses.

**And the last three default arguments did not need a source break.** §1a framed
`resolve`/`campaigns`/`best` as a signature change; dropping a default is a *binary* break, which the
pre-freeze window is for, and it does not have to be a source break. `resolve()` and
`resolve(forceRefresh: Boolean)` are explicit overloads — the mechanism steps 2 and 3 already blessed
for `FrakEnvironment.Custom` and `FrakError.Server` — so `resolve()` still compiles for Kotlin *and*
becomes callable from Java for the first time. `best`'s four optionals are the combinatorial problem a
parameter object solves, and get `RewardRequest`; `forceRefresh`'s two-way problem is what an overload
solves. `forceRefresh` deliberately stays *out* of `RewardRequest`: it is cache control, not a
description of the reward wanted, the type is conceptually the cache key, and a merchant who built one
request in a ViewModel and reused it would carry `forceRefresh = true` forever with no diagnostic.

Coverage: `FrakSdkJavaCallSiteFixture.java` (new, `:frak-sdk`'s own) proves every twin is *nameable*
from Java, which is the only thing a Java caller could not do before and the only thing no runtime test
can see. `AsyncTwinTest` proves the two threading halves and the post-`shutdown()` behaviour, because
otherwise the main-thread invariant would be asserted nowhere at all — `example/native-android` is
Kotlin-only and never calls a twin.

**The twin count is eighteen, not fifteen.** Fourteen suspending members live on `FrakClient` and the
five `*Api` namespaces; the fifteenth is `Frak.shutdown`. The extra three are `resolveAsync()`,
`campaignsAsync()` and `bestAsync(request)` — no-argument twins that exist because the *suspending* pair
does. Keeping them applies "twins mirror the members they shadow" literally: a Java caller reading the
Kotlin docs finds the same shape, and the alternative is a surface where Kotlin has a short form and Java
does not.

Two mechanical corrections while counting: the twins delegate to their suspending member rather than
re-spelling the call into `DefaultFrakClient`, so `RewardRequest` → core has one mapping site and a field
added to it cannot be silently dropped from the Java surface. And `asFuture` starts `UNDISPATCHED`: with
`CoroutineStart.DEFAULT` the coroutine's *start* is posted to the main dispatcher too, so a `bestAsync`
issued during a janky scroll would not begin its network work until the main queue drained.

**The caveat that costs an ANR, recorded because it cannot be engineered away:** never `get()` or
`join()` a twin on the main thread. Completion needs a main-looper turn and a blocked main thread never
gives one, so the future never completes — deterministic, not a race. It is stated on `asFuture`, on
`ConfigApi.resolveAsync`, on `Frak.shutdownAsync`, in `sdk/android/README.md`'s Java section, and in the
Java fixture. Related, lower stakes: an internally-raised `CancellationException` reaches Java as
`isCancelled == true`, so Java is told it cancelled something it did not.

Also fixed while here, in both copies of the dispatcher: `Handler.post` returns `false` when the looper
is exiting, and dropping the block on that path would leave a future suspended forever. It now cancels
and re-dispatches so the coroutine resumes and finishes, which is what `kotlinx-coroutines-android`'s own
`HandlerContext` does.

Still owed: `checkDexSizeBudget` has not been run against this. Eighteen twins plus their suspend-lambda
classes, `MainThreadDispatcher`, and `RewardRequest`'s three classes is roughly twenty-two new classes
against a 256 KB budget. If it goes red that is a signal about the twin count, not a reason to raise the
budget.

Result type is `FrakResult<T>`. Never `kotlin.Result` — a value class, erases to `Object` from Java.

Session outcomes keep callbacks (`fun interface ResultCallback`, `@MainThread`). Two idioms on
purpose: events get callbacks, requests get futures.

## 3. Visibility — `@InternalFrakApi` + BCV `nonPublicMarkers`

```kotlin
@RequiresOptIn(level = RequiresOptIn.Level.ERROR, message = "Internal to the Frak SDK; not covered by compatibility guarantees.")
@Retention(AnnotationRetention.BINARY)
@Target(AnnotationTarget.CLASS)
public annotation class InternalFrakApi
```

```kotlin
apiValidation { nonPublicMarkers.add("id.frak.sdk.InternalFrakApi") }
```

One mechanically checkable rule, rather than a per-type judgement call:

> `@InternalFrakApi` may only be applied at `AnnotationTarget.CLASS`, and only to a class that
> appears in the signature of no merchant-facing public member.

The `CLASS`-only half is a starting point chosen for dump visibility, not a principle: the targets
can be widened additively if a non-class declaration genuinely has to cross the boundary, provided
the new placement is checked against a real `apiDump` first. The second half is the principle.

### 3a. What is marked

`PercentEncoding`, and so far only `PercentEncoding`. It is the genuine article: `public` purely
because `:frak-sdk-ui` builds the sharing and install URLs, reachable from no public signature, of no
conceivable merchant value. It is also the end-to-end spike for the mechanism — if
`nonPublicMarkers` does not fire on a `BINARY`-retention class marker in whichever BCV version step 5
pins, one type reveals it, not fifty-one properties.

### 3b. What is *not* marked, revising the original plan

The original plan had the whole resolved-config tree marked: ten classes, fifty-one constructor
properties (fifty-three public properties now, since step 1 added `displayName`/`displayLogoUrl`),
"public only to cross the `frak-sdk-ui` module boundary". **That premise is false**, in two
independent ways, and marking the tree would have been a functional API removal:

- `FrakResolvedConfig` is the return type of `ConfigApi.resolve()` and `ConfigApi.updates`. Per the
  propagation rule in §0, marking it forces the marker onto both — and `nonPublicMarkers` would then
  drop *them* from the dump too. The committed `frak-sdk.api` would show a `ConfigApi` with no
  `resolve` and no `updates`: the one API path ever exercised on a physical device, absent from the
  file whose whole job is to be the honest record. `example/native-android` would need an `@OptIn`
  to keep calling it, which breaks the invariant that the harness drives the SDK through public API
  only.
- The deep tree is not a boundary type either. What actually crossed the module boundary was four
  properties over eight read sites in two files: `FrakResolvedConfig.merchantId` (3),
  `FrakResolvedConfig.name` and `ResolvedSdkConfig.name` folded together (2), and
  `ResolvedSdkConfig.logoUrl` (3).
  `AttributionDefaults` has a production reader inside `:frak-sdk` (`DefaultFrakClient` →
  `SharingLinkBuilder` → `mergeAttribution`, all six fields). The remaining seven classes have no
  in-repo reader outside tests at all: they are merchant-facing copy-precedence API
  (`sdk/android/README.md`, and iOS says the same in `FrakResolvedConfig.swift`), not module
  plumbing, and marking them would remove a documented feature rather than tidy a boundary.

So the tree stays public and unmarked, and gets the *other* half of the plan instead, which is the
half that was load-bearing all along.

### 3c. Internal constructors, and no default arguments

All ten constructors are `internal`. None takes a default argument. Both halves, for the reasons in
§0: `internal` keeps the constructor out of the dump and out of a Kotlin merchant's reach (not out of
javac's — see the third row of §0), and dropping the defaults keeps the `DefaultConstructorMarker`
bridge from landing in the dump anyway.
`ResolvedConfigDecoder`, the only production caller, already passed every argument, so nothing was
lost. The defaults moved to `ConfigTreeFixtures.kt` in the test source set, where a new field is one
new parameter on one helper and every test that does not care keeps compiling.

The result reads exactly true in a dump: a class with getters, `equals`/`hashCode`/`toString`, and no
constructor — *"the SDK hands you this; you do not build it."* A new backend field is a new getter.
Additive forever, with no Builder to write and no wire-shaped defaults to restate.

### 3d. The cross-module test seam

Making the constructors `internal` breaks one thing: `FakeSharingClient` in `:frak-sdk-ui`'s test
source set built a `FrakResolvedConfig`, and KGP wires friend access from a module's `test`
compilation to its own `main`, not to a sibling module's. (`-Xfriend-paths` exists and is how KGP
does that wiring; it is an `-X` flag and declined here, not absent.) Three options were on the table
— ship a marked factory in the production artifact, enable AGP `testFixtures`, or stop passing the
tree across the boundary at all. The third was taken:

- `FrakResolvedConfig` gains two derived properties, `displayName` (`sdkConfig?.name ?: name`) and
  `displayLogoUrl`. The precedence rule now lives once, in `:frak-sdk`, where `FrakResolvedConfigTest`
  pins it against a decoded response; it previously lived as an inline fold in `:frak-sdk-ui` with no
  coverage at all. `display`-prefixed rather than `name`/`logoUrl` so a derived getter never squats
  on a name a future top-level wire field would want — repointing a getter is a behaviour change with
  an unchanged JVM descriptor, which no `.api` dump can catch. Mirrored on iOS in the same commit
  (`displayName`/`displayLogoURL`) so the fold does not immediately become a parity finding.
- `SharingDependencies.resolveConfig()` returns an internal `SharingMerchant(merchantId,
  displayName, logoUrl)` instead of the whole tree. `:frak-sdk-ui` now names `FrakResolvedConfig` in
  exactly one place, the projection itself.

Two honest costs, recorded rather than implied:

- `toSharingMerchant()`, `FrakClientDependencies.resolveConfig()` and `resolveWarmUrl()` are executed
  by no test.
  `:frak-sdk-ui`'s fake returns a pre-built `SharingMerchant`, and it cannot do otherwise for exactly
  the reason above. The fold is covered in `:frak-sdk`; the wiring that reaches it is not.
- `testFixtures` was rejected on a premise worth correcting for anyone revisiting it: it would *not*
  land in the merchant's AAR (`frak-publish.gradle.kts` declares `singleVariant("release")`, so a
  fixtures variant would be a separate opt-in coordinate). It was rejected for cost, and because
  whether an AGP `testFixtures` compilation gets friend access to `main` needs verifying first. The
  "not in a merchant's AAR" objection applies to a *production* factory, which is a different
  option.

### 3e. Where the opt-in lives

Per file `@OptIn(InternalFrakApi::class)`, in the four files that touch `PercentEncoding`
(`HttpClient.kt`, `UrlQuery.kt`, `InstallLinks.kt`, `SharingPageUrl.kt`). **Not** a module-wide
`-opt-in` flag in the `frak-publish` convention plugin: that plugin applies to both modules and all
compilations including `test`, so it would silently void `PublicSurfaceTest`, whose entire guarantee
is that it references nothing internal.

### 3f. The Java hole, stated once

`@RequiresOptIn` is invisible to javac, so a Java merchant gets no diagnostic from
`@InternalFrakApi`. That is a weaker guarantee than it looks now that Java is supported, and it is
why the config tree relies on `internal` rather than on the marker. What the marker buys is the
honest dump plus a *Kotlin* compile error. Neither blocks javac: `internal` is emitted `public`, and
Kotlin mangles `internal` functions but cannot mangle a constructor. What that costs is bounded — the
dump is the compatibility contract, so a Java caller reaching past it is outside the contract by
construction. `PublicSurfaceTest`'s own KDoc now says
what it can and cannot prove, because friend access already voided the half about
merchant-constructibility.

## 4. Interaction — collapse to opaque struct + factories

Matches the shape iOS already has:

```kotlin
public class Interaction private constructor(internal val kind: Kind) {
    internal sealed interface Kind { /* arrival / sharing / custom */ }

    public companion object {
        @JvmStatic public fun custom(customType: String): Interaction
        @JvmStatic public fun custom(customType: String, data: Map<String, String>): Interaction
        // explicit overloads, not default args
    }
}
```

Fixes four things at once: A2 exhaustiveness (no `when` for a consumer to break),
forward-compatible forever, one fewer sealed hierarchy in the dump, and no `when` for Java to fake.

Two details: `@JvmStatic` on the factories or Java sees `Interaction.Companion.custom(…)`. And apply
the no-defaults rule with overloads where a factory has optionals — `arrival` is SDK-built
(`handleReferral` constructs it), so the merchant-facing pressure is really on `custom`.

Cost: an `Interaction` becomes non-introspectable. Fine — it is write-only, you hand it to `track()`.

**Landed as step 3, with three adjustments to the sketch above:**

- `Kind` is a nested `internal sealed interface` of three classes rather than an enum: Kotlin has no
  enum with per-case payloads, and a sealed interface keeps `InteractionTracker`'s `when` exhaustive.
  Being `internal`, it stays out of the dump, and the exhaustiveness burden lands on the *SDK* — a
  fourth shape is a compile error in `InteractionTracker` and additive for every consumer, which is
  the whole asymmetry the collapse buys (A2).
- Seven factories, no defaults: `arrival` takes one full-arity form (four nullables, spelled out at
  the single call site that builds one), `sharing` takes `()`, `(purchaseId)` and
  `(sharingTimestamp, purchaseId)`, `custom` takes `(customType)`, `(…, data)` and
  `(…, data, idempotencyKey)`. Eight default arguments become zero. The `(purchaseId)`-only overload
  is the plausible merchant call — "they shared, after this order", with no better answer for *when*
  than now — and adding it later would have been awkward, since `sharing(null)` would then have had two
  readings.
- **`equals`/`hashCode`/`toString` are structural**, delegating to `Kind` (whose three classes are
  `data class`es — they are `internal`, so the generated `copy()`/`componentN()` can never reach the
  dump, and the objection that bans `data class` on the rest of this surface does not apply). This was
  nearly missed. The *value* is write-only, but the code that *builds* one is ordinary merchant code
  that wants a test, and without equality the only available assertion is reference identity. iOS's
  twin is `Hashable` and pins exactly that in its own `PublicSurfaceTests`; shipping Android without it
  would have been a fresh instance of finding 9.9 one commit before the dump froze it.
- The constructor is `internal`, not `private`. A `private` constructor called from the companion makes
  Kotlin emit a synthetic accessor of the form `<init>(Kind, DefaultConstructorMarker)` — and per the
  §0 fact table BCV *keeps* synthetic `<init>`s with a `DefaultConstructorMarker`, which would have put
  the `internal` `Kind` type into the ratified dump. `internal` is called directly, so no accessor is
  generated. Unverifiable until step 5, and step 5 is the wrong place to find out.
- `custom` copies its `data` map. The event goes onto a durable queue and is read back by a drain that
  can run long after the call returned, so a caller who kept the map could otherwise mutate an event
  already enqueued — the same fix `SharingRequest.Builder` applies to its product list.

Coverage, in three layers because no one of them is sufficient. `InteractionFactoryTest` reaches
through the `internal` `Kind` and checks every argument of every factory, because an opaque type makes
a dropped argument invisible from outside — the same guard `BuilderWiringTest` gives the Builders, and
with the same friend-access caveat, so it proves nothing about what a merchant can reach.
`PublicSurfaceTest` therefore covers the factories through public API only, which it can do *because*
equality is structural. And `JavaCallSiteFixture.java` calls all seven from Java, which is the only
check that `@JvmStatic` is actually there: without it every call site would read
`Interaction.Companion.custom(…)`.

Two decisions worth stating rather than leaving to the KDoc:

- **`arrival` stays public**, even though `handleReferral` builds one and the KDoc says calling it
  yourself double-counts an event that carries no idempotency key. The case for `internal` is real — the
  only reachable effect of a merchant calling it is a duplicated referral payout. It stays public
  because `Frak.parseReferralLink` is public and `FrakContext`'s *fields* are public, so a merchant who
  routes deep links entirely themselves can legitimately build and track an arrival; and because iOS
  exposes it. If that flow is ever withdrawn, this should go `internal` with it.
- **`Interaction` gets a weaker "additive" guarantee than the Builder types, deliberately.** A new
  field on `custom` is a new overload, which means the parameter order is frozen, only prefix subsets
  are expressible, and the overload count grows per field — exactly the objection §1 raises against
  overloads and answers with Builders. `Interaction` is exempt because it is opaque and write-only: a
  Builder's value is that a caller can name any subset of options, and there is no subset to name when
  three shapes have two or three fields each and the type cannot be read back. That boundary — Builders
  for readable input types, factories for opaque ones — is the rule, so that step 4's `RewardRequest`
  taking a Builder reads as the rule rather than as drift.

## 5. Constants

`public const val` banned — it inlines into merchant bytecode and freezes at their compile time. Use
`@JvmStatic val`. Already fixed for `FrakSharingDefaults.HEIGHT_FRACTION`.

## 6. Verification

`JavaCallSiteFixture.java` — no assertions, no JUnit; the assertion is that `javac` accepts it.
Verified compiled into `:frak-sdk-ui:test`. Extended to `frak-sdk` alongside the `*Async` work; it is
what catches a `Continuation` on the public surface or a `$default` bridge Java cannot name.

## Sequencing

Five commits, in this order, each reviewed before the next starts.

1. `@InternalFrakApi` + internal constructors on the config tree — biggest surface reduction,
   unblocks the rest
2. Builders + Kotlin sugar: `SharingRequest`/`SharingProduct`/`ProductDetails` first, then
   `FrakConfig`/`FrakMetadata`/`AttributionParams`/`FrakContext.V2`. Also the two §1a rows that are
   *not* builder candidates and would otherwise be missed: explicit overloads for
   `FrakEnvironment.Custom` and for `FrakError.Server`/`FrakError.Decoding`
3. `Interaction` collapse — which is also what removes its eight default arguments. **Done**, with
   structural equality and an `internal` rather than `private` constructor; see §4
4. `*Async` twins + the `frak-sdk` Java fixture. **Done** — and not a source break after all: the
   three defaulted `*Api` functions became explicit overloads rather than losing their short form.
   `best` did change shape, to take a `RewardRequest`. Details and four corrections in §2a
5. Re-add BCV and commit the dump

Step 5 last because committing a dump ratifies the shape. Expect it larger than the deleted one
(`05` §5 records that at 509 lines for `frak-sdk`; nothing in git history can confirm it, since no
`.api` file exists in any ref) — builders and `*Async` twins both add declarations. That is the
correct outcome; the metric is frozen surface, not line count.

One convenient interaction: BCV's `nonPublicMarkers` historically mishandled functions with default
parameters. Removing defaults (§1) makes that moot.

## Open, and to be answered before the dump is committed

Added by the step-2 review, in the order they become unfixable:

- **The Kotlin file-facade names are about to be frozen and there is no `@file:JvmName` anywhere.**
  `SharingRequest { }` compiles to `SharingRequestKt.SharingRequest(Function1)`, `FrakMetadata { }` to
  `FrakConfigKt.FrakMetadata(Function1)` — the facade is named after the *file*, not the type, and two
  of the five files declare more than one. The ten sugar functions land like this:
  `FrakConfigKt` gets `FrakMetadata(Function1)` plus all three `FrakConfig` overloads; `SharingRequestKt`
  gets both `SharingProduct` overloads plus `SharingRequest(Function1)`; `ProductDetailsKt` and
  `AttributionParamsKt` and `RewardRequestKt` get one each. Once the dump records those names, renaming
  or splitting **any of the five files** — `core/FrakConfig.kt`, `core/ProductDetails.kt`,
  `sharing/SharingRequest.kt`, `sharing/AttributionParams.kt`, `rewards/RewardRequest.kt` — is a binary
  break. The decision taken for now is deliberate and
  minimal: **keep the default facade names and do not rename or split those four files after step 5.**
  A `@file:JvmName` would decouple the two, but picking a name badly is also permanent. Note that two of
  the nine — `FrakConfig(String)` and `SharingProduct(String, String)` — take no `Function1` and are
  ordinary Java-callable statics, so the facade name is not purely internal noise.
- **`FrakMetadata.currency` is non-null with an EUR default, and there is no "unset".**
  `RewardRepository` reads currency only from `FrakMetadata`, so a US merchant who never calls
  `.currency(...)` prices every reward in EUR with no diagnostic — and the SDK cannot tell "unset" from
  "explicitly EUR", so the backend has no route to correct it. Its sibling `lang` is nullable and
  documented "null means let the backend decide". Pre-existing behaviour, not introduced here, but
  making it `FrakCurrency?` after the freeze is a Kotlin source break. Either match `lang`, or keep
  EUR and warn at `initialize` when it was never set (a `private var` on the Builder, no new surface).
- **Equality is inconsistent across the input types, and step 4 made the split wider before it gets
  narrower.** `ProductDetails`, `AttributionParams` and now `RewardRequest` have `equals`/`hashCode`;
  `FrakConfig`, `FrakMetadata`, `SharingProduct` and `SharingRequest` do not — 3-have / 4-haven't, with
  the new arrival on the *have* side while `SharingRequest`, the same shape on a hotter path, is not.
  `RewardRequest` has it because a new type has no excuse; the older four are the decision still owed. That asymmetry is inherited, and it has a visible cost: the Builder-versus-sugar comparison
  in `PublicSurfaceTest` can only be an `assertEquals` for the two types that have equality, and has to
  be written out field by field for the rest — which is a test that silently weakens every time a field
  is added, since nothing forces the new one into the comparison. Adding `equals` after the dump is a
  behaviour change with an unchanged descriptor, which no `.api` file catches. Decide before step 5.
- **`FrakContext` joined the list of types a merchant cannot obtain for their own tests.** Both
  constructors are `internal` and `FrakContextCodec` is `internal`, so a merchant testing their own
  handling of a parsed referral link has to hardcode an opaque base64 `fCtx` captured from a running
  SDK, and no sample appears in the README or the KDoc. Same class of gap as `FrakResolvedConfig`
  below; cheapest fix is a documented known-good link rather than new API.
- **`:frak-sdk-ui`'s `FrakSharing.Builder` is now the odd one out.** It uses `private var`s, a fluent
  setter with `require()` validation, and has no Kotlin sugar; the seven `:frak-sdk` Builders use public
  `var`s, no validation, and a sugar function each. Both are about to be frozen side by side. Either
  align them or write the rule down — the honest version is probably "`:frak-sdk-ui`'s builder has no
  sugar because its `build()` is `@Composable`, which a top-level function cannot wrap".
- **`ConfigApi.updates` has no Java story.** It is a `StateFlow`, which a Java caller cannot collect, so
  "Java is a supported target" is overstated by exactly one member. Additive to fix (a listener
  registration, or a `Publisher` via `kotlinx-coroutines-reactive`, which would be a new dependency), so
  not a freeze blocker — but the namespace table lists `updates` without a caveat and should not.
- **`Frak.shutdownAsync` has no injectable dispatcher**, so it reaches `Looper.getMainLooper()` and is
  unreachable from `:frak-sdk`'s JVM suite. `AsyncTwinTest` covers `asFuture`, i.e. seventeen of the
  eighteen twins; this one is proven nameable by the Java fixture and proven to run by nothing. Same
  file records the two `shutdown()` concurrency caveats `shutdownAsync` makes reachable.

- **A merchant has no first-party way to obtain a `FrakResolvedConfig`.** All ten constructors are
  `internal`, `ResolvedConfigDecoder` is `internal`, and `ConfigApi`/`FrakClient` are final classes
  with `internal` constructors — so a merchant unit-testing their own `FrakResolvedConfig → UiState`
  mapper, or writing a Compose `@Preview`, has nothing but a mocking framework (which produces an
  instance with the hand-written `equals` bypassed) or `FrakEnvironment.Custom` against a stub server
  plus `Frak.initialize`, i.e. Robolectric for a pure function. This is a real regression in merchant
  testability and it is *not* blocked by the dump: a `@JvmStatic public fun
  fromResolveResponse(json: String): FrakResolvedConfig` on the companion is arity-stable forever,
  exercises the real decoder, is Java-callable, and can be added additively after step 5. The other
  candidates are a `testFixtures` variant or an `id.frak:frak-sdk-testing` artifact with its own ABI.
  Deferred, not dismissed.
- **`api(project(":frak-sdk"))` publishes a *required*, not strict, version.** `:frak-sdk-ui` emits
  21 `PercentEncoding.encode` call sites into its own class files, and once `nonPublicMarkers` drops
  that symbol from the dump, re-signaturing it becomes an invisible change that a merchant on mixed
  artifact versions meets as `NoSuchMethodError` at share time. `frak-publish.gradle.kts` says the two
  artifacts "ship in lockstep"; the POM does not. Land `version { strictly(...) }` (or a shared Gradle
  capability) in the same commit as `nonPublicMarkers`, or the marker removes a guard without
  replacing it.
- **BCV against an Android library module** has never run here. Whether `nonPublicMarkers` fires on a
  `BINARY`-retention class-level marker in the pinned version is unverified; `PercentEncoding` is the
  spike that answers it. Land BCV with the surface unchanged first and commit that baseline, then the
  marker, so a surprise in the first `apiDump` is separable from a surprise in the marker.

## Deliberately out of scope, and why

- **The reward read models** (`Campaign`, `BestReward`, `TokenAmount`, `EstimatedReward`,
  `RewardTier`) are the same shape of problem as the config tree — decoder-built, merchant-read —
  and `BestReward` already carries two defaulted parameters. They were not in the locked plan and
  are not folded in here, because `PublicSurfaceTest` documents a merchant building one for a preview
  screen and that use case deserves a decision of its own rather than a drive-by. Open.
- **iOS.** It ships source through SwiftPM, so a merchant recompiles every build and a defaulted
  parameter on a public `init` stays source-compatible. That changes the day `do_xcframework()` ships
  a precompiled binary; filed as Q3 in `05` §5.
- **`androidx.annotation.RestrictTo`** as a belt-and-braces Lint-enforced marker for Java consumers
  was considered and dropped: `:frak-sdk` has zero *third-party* runtime dependencies by rule (coroutines is first-party to Kotlin and the only exception), and Android Lint has
  never executed once in this build (1.2b), so it would enforce nothing today.
