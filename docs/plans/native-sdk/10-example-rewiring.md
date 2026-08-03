# 10 — Rewiring the example apps, and what it found

`09-api-shape.md` §8 left one bullet open:

> There is still no evidence that two-level namespacing reads well in a merchant's code.

This document closes it. Both example apps now compile against the real SDK instead of a
hand-written stub, and the exercise did what an example app is supposed to do: it found
things no amount of reading the surface had found.

**Headline verdict: the namespace split is vindicated.** `Frak.client.rewards.best(...)`,
`Frak.client.appLink.handleReferral(url)` and `Frak.client.tracking.purchase(...)` are
unambiguous at every call site in both harnesses. Nobody had to be told which namespace
anything lived in.

**What it actually found is a different problem.** The namespaces are fine; the *members
inside them* have inconsistent contracts. Error reporting has four styles, one call's
return type doesn't fit the most obvious merchant screen, and two doc links pointed at
members that no longer exist.

---

## 1. What was there before

Both apps called a stub committed inside the example itself —
`example/native-android/.../sdk/FrakSDK.kt` and `example/native-ios/.../SDK/FrakSDK.swift`.
Each opened with the same banner:

> ⚠️ SCAFFOLDING — this is not the Frak Android SDK.
> The real SDK does not exist yet. […] Delete this file once the real artifact ships.

That instruction had been outstanding since the real SDK shipped. The stub's shape was not
merely older than the real API, it was a *different design* — `presentSharing(request) { }`
with a completion handler, `PurchaseDetails(orderId, amountInCents)` — so `05-audit-findings.md`
D2's complaint ("the example apps prove nothing") was correct and unfixable by renaming.

## 2. How they are wired now

**Android** uses a Gradle composite build. `example/native-android/settings.gradle.kts`
does `includeBuild("../../sdk/android")` and the app depends on the ordinary Maven
coordinates, so the example is written exactly the way a merchant writes it — the only
difference is where the artifact resolves from.

That did not work at first, and the reason is worth recording because it is a defect in
`sdk/android`, not in the example. `frak-publish.gradle.kts` set `groupId = "id.frak"`
*inside the `MavenPublication` block only*, never as `project.group`. Gradle's automatic
composite substitution matches on `project.group`, so it silently failed to substitute and
went looking for `id.frak:frak-sdk:0.0.1` on Maven Central, where it does not exist. The
error blames the network, not the mismatch. **Fixed by setting `group = "id.frak"`**;
published coordinates are unchanged.

**iOS** uses a SwiftPM path dependency, `.package(path: "../../sdk/ios")`. This carries a
papercut worth documenting for anyone vendoring the SDK: `sdk/ios/Package.swift` declares
`name: "FrakSDK"`, but for a **path** dependency SwiftPM derives package identity from the
last path component. The obvious-looking `.product(name: "FrakSDK", package: "FrakSDK")`
fails; the correct spelling is `package: "ios"`. The declared `name:` only becomes the
identity for `url:` dependencies. The error message is clear, so this costs minutes rather
than hours, but it is a trap.

## 3. Proof it is real

The concern with any example app is that it compiles against a shim. It does not:

```
$ unzip -p app-debug.apk classes3.dex | strings | grep -o "Lid/frak/sdk/[A-Za-z]*Api;"
Lid/frak/sdk/AppLinkApi;
Lid/frak/sdk/ConfigApi;
Lid/frak/sdk/RewardsApi;
Lid/frak/sdk/SharingApi;
Lid/frak/sdk/TrackingApi;
```

The five namespace classes are in the shipped dex. Both harnesses drive the real client
through initialize → `appLink.isFrakAppInstalled()` → `config.resolve()` →
`rewards.best(...)` → share sheet → `tracking.purchase(...)`.

The merchant id is fake, so every network call fails. That is deliberate: the harness
renders a labelled failure state rather than fabricating a number, which exercises the
error paths that a happy-path demo never would.

---

## 4. Findings

Two workers rewired one platform each without seeing the other's work, then an oracle
review checked both. Where they independently hit the same wall, that is called out —
it is the strongest signal this exercise produced.

### Fixed

**F1 — `handleReferral` could throw on Kotlin and structurally could not on Swift.**
Kotlin's `handleReferralLink` was wrapped in `frakCall {}`, whose catch-all converts any
unexpected `Throwable` into a *thrown* `FrakError`. Swift's twin is `async -> Bool` — it
discards the tracking `Result` and cannot throw at all. Swift is right: this method's
`Bool` means "was this a referral link", and arrival telemetry must never take down a
merchant's URL routing.

Worth recording honestly: the first framing of this bug was wrong. "Network down → Kotlin
throws" does *not* reproduce, because `trackingCall` already absorbs `FrakError` before
`frakCall` sees it. The real defect is structural — a landmine for any future unguarded
exception, which Swift is incapable of having. Kotlin now mirrors Swift explicitly
(rethrow `CancellationException`, log and swallow everything else). Regression test added.

**F2 — Kotlin's throwing contract was invisible.** Kotlin has no checked exceptions, so
`config.resolve`, `rewards.campaigns` and `rewards.best` are indistinguishable in
autocomplete from members that cannot fail. A merchant who forgets `try/catch` has written
a latent production crash. All three now carry `@Throws(FrakError::class)` — additive,
zero runtime cost, and it fixes Java interop as a side effect. Deliberately *not* applied
to members whose failure is encoded in the return type.

**F3 — Four KDoc links pointed at deleted members.** `FrakConfig.kt`, `ProductDetails.kt`,
`RewardRepository.kt` and `SharingResult.kt` still linked `[FrakClient.handleReferralLink]`,
`[FrakClient.bestReward]`, `[FrakClient.openFrakApp]`. Dokka cannot resolve these, so
published docs render dead text — on the surface merchants actually read. Four equivalents
fixed on Swift. **Three review passes missed these** because they swept `docs/` and the
READMEs, not doc comments inside `src/main`.

**F4 — `rewards.best` steers merchants into an N-request pattern.** Both workers
independently built a product catalog and called `best` **once per row**, because a single
`BestReward?` cannot be attributed back to individual rows. The reward cache is keyed on
the encoded product list, so N rows = N cache keys = N requests against a
`limitedParallelism(4)` budget. Two of two integrators made the same mistake, which makes
it an API problem rather than a user problem. Docs on both platforms now state that `best`
answers "the best reward in *this* context", that a listing calls it once for the whole
visible set, and that per-row calls are an anti-pattern. Both harnesses were rewritten to
match — an example shipping the anti-pattern its own SDK documents against is worse than
no example.

**F5 — the harnesses claimed a parity they did not have.** Both files promised "same ids,
titles and links, so a divergence is visible in review". Three had shipped: iOS passed
`targetInteraction: "purchase"` and Android passed nothing (*not* cosmetic — it narrows
campaign selection, rides the wire, and is part of the cache key, so the two apps asked the
backend different questions); iOS sent `placement`, Android omitted it; iOS set `metadata`
and `logLevel` and Android set neither, leaving the Android harness with no SDK logging at
all. Now identical, with the one unavoidable difference (`DeepLinkHandling.Automatic`)
commented on both sides.

### Open — these need a decision

**O1 — the error model has four styles across fifteen members.**

| Style | Members |
|---|---|
| Typed result | `tracking.track`, `tracking.purchase` |
| Throws | `config.resolve`, `rewards.campaigns`, `rewards.best` |
| Nullable, error swallowed | `sharing.buildLink`, `appLink.installUrl`, `appLink.installPageUrl` |
| Bool/enum, error swallowed | `appLink.handleReferral`, `appLink.openFrakApp` |

Part of this is defensible: `tracking.*` returns a result because telemetry must not take
down a checkout path. Part is not — `config.resolve` throwing while `sharing.buildLink`
returns a silent `null` is an accident of authorship, not a design. F2 made the throwing
tier discoverable, which was the urgent half. **What is still missing is a stated rule** —
*telemetry returns a result, data-fetch throws, local best-effort builders return null* —
so that the +6–9 wallet-session members have an obvious home instead of fragmenting the
surface further. Unifying all fifteen onto `FrakResult` is **not** recommended: bigger
break, smaller gain.

**O2 — `buildLink` returns `String?` for four different reasons.** No identity yet; config
resolution failed and was swallowed; no merchant resolvable; no link anywhere. "Retry in a
moment" and "you misconfigured `homepageLink`" need opposite responses and are the same
`null`. Options: return `FrakResult<String>` (a shape change, so before the freeze), or
keep `String?` and log a distinct warning on each path (non-breaking, can land later).
`installUrl`/`installPageUrl` have the same flaw with lower stakes.

**O3 — a per-product reward lookup does not exist.** F4 documents the current call out of
the listing use case, but does not serve it. The additive fix is a sibling returning a
per-product mapping in one request — `bestByProduct(products:) -> Map<String, BestReward>`.
Sealing `FrakClient` made adding it safe *after* the freeze, but it needs a backend shape
that returns per-product results, so the **decision** belongs now even if the code doesn't.

### Considered and rejected

**`Frak.client` throwing-synchronous next to async namespace members.** You cannot write
`try await Frak.client.rewards.best(...)` as one expression, so the iOS harness has a
three-line `client() -> FrakClient?` helper. Adding a non-throwing public twin would mean
two permanent public spellings of the same thing to save two lines, and would break
symmetry with Kotlin. `Frak.client`'s synchronousness is load-bearing (`09` §4). Documented
as the recommended idiom in `sdk/ios/README.md` instead.

**Merging `SharingProduct` and `ProductDetails`.** Both workers complained about building
the same logical product twice. But the split is deliberate and documented: `ProductDetails`
mirrors the backend's `PRODUCT_SCOPE_FIELDS` allowlist, and adding `title`/`link` would put
fields on the wire that can never match; merging the other way would force a checkout screen
with only line items to invent display copy. A `toProductDetails()` conversion helper would
remove the friction additively.

**Dropping the iOS `.macOS(.v12)` floor.** SwiftPM propagates platform floors, so the
example was forced to declare macOS for an iOS-only app. The floor was initially diagnosed
as a test-only artifact leaking into the published contract, and the recommendation was to
lower it to `.v11` (`Logger`'s true requirement). Verification refuted both: `HTTPClient`
calls `URLSession.data(for:delegate:)`, which needs macOS 12, from shipping code. **The
number was right; only the comment explaining it was wrong**, and it has been corrected.
Removing the floor would mean maintaining parallel `os_log` and completion-handler
`URLSession` implementations for a platform the SDK ships no product on.

**`DeepLinkHandling`'s Android-only `Automatic` case.** Android has
`ActivityLifecycleCallbacks`; iOS has no hook that lets a library install itself in front of
the app's own URL routing. No API shape fixes that. This is one of the rare places where a
platform-shaped API is the honest answer; both sides now document the divergence and why.

---

## 5. What this cost

| | Before | After |
|---|---|---|
| Example → real SDK | no dependency at all | composite build (Android), path dependency (iOS) |
| Stub LoC | 270 across two files | deleted |
| SDK defects found | — | 5 fixed, 3 open |
| Android tests | 248 | 249 |
| iOS tests | 291 | 291 |

Both examples build clean; both SDK suites stay green.

## 6. Still open

- **O1, O2 and O3 above** need decisions before the ABI freeze. O2 and O3 are shape
  changes; O1 is a written rule plus, optionally, aligning the nullable tier.
- **The apps have never been run.** `assembleDebug` and `swift build` typecheck; neither
  harness has been launched on a device or simulator, so nothing here proves the sharing
  sheet renders or that the deep-link intent filter fires. That is the next thing worth
  doing, and it needs an emulator and Xcode rather than CI.
- **`bestReward` is still seeded into the iOS sheet and not the Android one**, and Android
  still tracks `Interaction.Sharing()` where iOS does not — carried over from `09` §8,
  untouched here.
