# Native SDK — ABI decisions to settle before the first publish

Four questions the remediation pass in `28614308e` surfaced and deliberately did not
answer. They are grouped here because they share one deadline: **the first publish of
`id.frak:frak-sdk` to Maven Central.** After that, changing any of this is a breaking
release for a binary already in the Play Store, not an edit.

Unlike the audit in `05-audit-findings.md`, the evidence below was produced by actually
running the toolchain (`apiDump` under JDK 24 / AGP 8.11.0 / Gradle 8.14.3), not by static
reading.

## State of play

**There is no binary-compatibility gate right now, and no committed dump.** BCV was wired,
then the dumps were committed to give `apiCheck` a baseline, and then both were removed
again.

That removal was deliberate. Committing a dump *ratifies* the public shape: `apiCheck`
enforces it from then on, and the questions below stop being design choices and start
being breaking changes. Freezing the surface before deciding its shape is backwards, so the
gate comes back — with the dumps, and with whatever Q1/Q2 conclude — before the first
publish.

What the last generated dump showed, which is the evidence the rest of this document
rests on:

| File | Size |
| --- | --- |
| `frak-sdk/api/frak-sdk.api` | 509 lines, covering config, identity, sharing, tracking and the app-link results |
| `frak-sdk-ui/api/frak-sdk-ui.api` | non-empty (it was 0 bytes before the sharing sheet landed) |

One incidental finding worth keeping: BCV writes an **empty file** rather than nothing for
a module with no public API, and `apiCheck` fails if that file is absent. That answers a
question `sdk/android/scripts/run.sh` used to carry as a TODO.

> **The surface kept growing while these stayed open.** Q1's original list of 15
> `$default`-frozen types is out of date: `SharingRequest`, `SharingProduct`,
> `AttributionParams`, `FrakContext.V2` and `Interaction.*` all carry the same bridge.
> `FrakConfig` also gained `deepLink` as a **mid-list** parameter insertion, which is the
> more damaging variant of the same trap. Nothing mechanical is stopping the next one.
>
> `FrakConfig` has since gained a second parameter, `preloadSharing` (02 §7 lever 2's
> opt-in gate for the warm `WebView`) — this one **appended last**, not inserted, so it
> changes the `$default` bridge's signature the same way any addition to an open
> constructor does, but does not additionally break every caller that named a parameter
> after the insertion point the way `deepLink` did. It is still evidence for, not against,
> Q1: the tree keeps growing while the freeze question stays open, and appending correctly
> only avoids the *worse* variant of the trap, not the trap itself.

### A distinct hazard the same change surfaced: growing `FrakClient`

`preloadSharing` was first added as a member on the `FrakClient` **interface**, next to
`environment`, because `:frak-sdk-ui` can only see `public` API. That was reverted before
landing, and the flag now lives on the `Frak` object instead.

The reason is worth recording, because it is a *different* failure mode from Q1 and the
review that caught it had to prove it from the diff:

- `FrakClient`'s own KDoc says it is an interface rather than the implementation class
  "so merchant tests can substitute a fake without a mocking framework". Adding an abstract
  member therefore breaks the exact use case the type exists for.
- The break is **unconditional and compile-time for every implementer**, with no
  recompile-and-move-on path short of implementing the new member — strictly worse than
  Q1's `$default` bridge, which only breaks callers relying on the old default-argument
  overload.
- The proof was in the changeset itself: this repo's own hand-written `FakeFrakClient` in
  `PublicSurfaceTest.kt` had to gain `override val preloadSharing` just to keep compiling.
  Any merchant who took the documented invitation to write a fake would have hit the same
  wall on upgrade.
- `Frak` is an `object`. Nobody can implement it, so adding to it is purely additive.

**A third instance, resolved differently: `installPageURL()` / `installPageUrl()`.**
The install flow (`08-install-flow.md`) needs the sharing sheet to reach a freshly minted
`frak-install-v1` proof, and the sheet lives in the second module, so it can only see
`public` API. The same shape as `preloadSharing` — except this one genuinely needs the
*client instance*, so moving it to the `Frak` object would cost the sheet its injectable
fake and with it every test it has.

It landed **with a default body** (`= null` in Kotlin, a protocol-extension `nil` on iOS),
which removes the specific objection that got `preloadSharing` reverted: the break is no
longer unconditional and compile-time for every implementer, because there is nothing an
implementer must write. Both hand-written `FakeFrakClient`s deliberately do **not**
override it, so they are the regression test for the default staying in place.

What this does not fix is Q2: it is public purely because a second module needs it, its
only two call sites are `SharingSheetModel.swift` and `SharingSheetState.kt`, and it is now
the third symbol in that category alongside `PercentEncoding` and `environment` (the first is
a type rather than a member, but the question is the same). Fold it into whatever Q2
concludes. It also brings `FrakClient` to 15 members in Kotlin and 16 in Swift, which `07`'s
count of "four new members" no longer reflects.

**`environment` is still on `FrakClient`.** It is the same hazard, already shipped, and it
is what made the interface look like the natural home for `preloadSharing` in the first
place. Moving it to `Frak` is cheap right now — BCV is unwired and nothing is published —
and expensive later. Fold that into whatever Q2 concludes about which symbols exist only
for `:frak-sdk-ui`; `PercentEncoding` and `environment` are the same question wearing
different clothes.
---

## Q1 — Accept the `$default` constructor freeze, or move to builders?

### The finding, confirmed against the real dump

Converting the promoted types from `data class` to plain classes did remove `copy()` and
`componentN()` — the dump has zero matches for either. It did **not** remove the synthetic
default-argument constructor bridge. Fifteen public types carry one:

```text
public synthetic fun <init> (…;ILkotlin/jvm/internal/DefaultConstructorMarker;)V
```

| Group | Types |
| --- | --- |
| Promoted config tree (10) | `AttributionDefaults`, `BannerConfig`, `ButtonShareConfig`, `ButtonWalletConfig`, `FrakResolvedConfig`, `OpenInAppConfig`, `PostPurchaseConfig`, `ResolvedComponents`, `ResolvedPlacement`, `ResolvedSdkConfig` |
| Already public (5) | `FrakConfig`, `FrakMetadata`, `FrakError`, `FrakError$Decoding`, `FrakError$Server` |

The bridge encodes the parameter count in its signature and an `Int` bitmask of which
arguments were defaulted. **Adding one field changes the signature**, so a merchant binary
compiled against today's SDK hits `NoSuchMethodError` at runtime against tomorrow's — the
class of failure that cannot be fixed by the merchant recompiling, because it is their
shipped app in the store that breaks.

This is the same defect as audit finding **A3** (`FrakConfig` already had it), now
multiplied across the config tree by the promotion.

### Options

| Option | Cost now | Cost later |
| --- | --- | --- |
| **A. Accept the freeze** | Zero | These 15 types can never gain a field. Any new config key needs a new type or a new parallel accessor. Given the config tree mirrors a backend-driven dashboard that *will* grow, this is the expensive one |
| **B. Builders** | Rewrite 10 types + their tests; verbose from Kotlin, though idiomatic from Java (which A7 wants anyway) | Additive forever |
| **C. Internal constructors + additive factory functions** | Smaller diff than B; constructors become `internal`, public `operator fun invoke` / named factories take their place | Additive, but every future field needs a new overload — a slow accretion |
| **D. Defer: keep the tree `internal`, ship only what `:frak-sdk-ui` needs** | Reverts most of the promotion | Buys time, but D1 (the UI artifact cannot read its own config) comes back |

### Recommendation

**B for the config tree, and decide it before the dump lands.** The config tree is the
part most likely to grow — it is a projection of a dashboard. `FrakConfig`/`FrakMetadata`
are merchant-authored and much more stable, so A is defensible for those if B is judged
too large; that split is itself a legitimate outcome.

What is *not* defensible is re-adding the dump without choosing, because that silently
picks A for everything.

---

## Q2 — Was promoting ~51 properties ahead of a reader right?

The promotion made **51 public getters** across the config tree public, justified by
`:frak-sdk-ui` / `FrakSDKUI` being a separate module/target that can only see `public`.

That justification is sound for the properties the sharing sheet actually renders. It does
not obviously extend to all 51 — no reader exists yet for most of them.

The same question now has a second, smaller instance: `id.frak.sdk.net.PercentEncoding` is
`public` for exactly one reason — `:frak-sdk-ui` builds the hosted `/sharing` URL in a
separate Gradle module and can only see this artifact's `public` API. It is a 15-line
RFC 3986 encoder, not merchant-facing API, and it is currently indistinguishable from real
API in autocomplete. It was made public to collapse three hand-rolled copies of the same
byte-level loop into one, which is the right trade — but it is precisely the symbol a Q2
marker exists for.

### The alternative not taken

A `@RequiresOptIn` marker:

```kotlin
@RequiresOptIn("Frak SDK internals. Not covered by semantic versioning.")
public annotation class InternalFrakApi
```

wired into BCV:

```kotlin
configure<kotlinx.validation.ApiValidationExtension> {
    nonPublicMarkers += "id.frak.sdk.InternalFrakApi"
}
```

Types marked with it are `public` to the compiler — so `:frak-sdk-ui` links — but are
**excluded from the dump**, so they are not frozen and carry an explicit opt-in warning at
every merchant call site.

This directly weakens Q1: an unfrozen type can gain a field freely, which would make Q1's
answer "A, for now" a safe default rather than a permanent commitment.

### Trade-off

Against it: `@RequiresOptIn` is Kotlin-only. A Java consumer sees no warning at all, and
A7 already flags the public surface as Java-hostile. It is also a second, weaker tier of
"public" that merchants will use anyway once it appears in autocomplete.

**Decide alongside Q1** — the two answers interact, and picking Q2's marker changes what
Q1 has to cover.

---

## Q3 — iOS: `init(from:)` is now public API

`Sources/FrakSDK/Config/FrakResolvedConfig.swift:105` and `:153` are `public init(from decoder: any Decoder) throws`.

This was a **side effect of the promotion, not a request**. Consequences:

- The wire decoder is merchant-callable. Anyone can decode arbitrary JSON into a
  `FrakResolvedConfig` and hand it back to the SDK.
- The `Decodable` conformance can never be removed, so the wire format and the public model
  are now permanently coupled — exactly what a hand-written decoder layer usually exists to
  avoid.
- Swift has no dump to freeze it, so nothing will *tell* us when this breaks. There is no
  BCV equivalent on the Swift side (audit **A1** is only half-closed).

Note one of these two is the hand-written forgiving `init(from:)` added to fix the
`ResolvedPlacement.translations` regression — that one is load-bearing and must stay
`internal`-or-better, not necessarily `public`.

**Cheapest fix, if taken before publication:** move `Decodable` conformance to a separate
internal wire type, or drop the conformance to an `internal extension`. Both are breaking
changes after v0.1 ships.

---

## Q4 (recorded, lower stakes) — `FrakLogSink`'s deliberate cross-platform divergence

Shipped knowingly divergent:

| | Android | iOS |
| --- | --- | --- |
| Shape | `fun interface` | `protocol: Sendable` |
| A throwing/trapping sink | Caught and swallowed | **Brings down the host process** — no Swift equivalent |
| Thread-safety | Doc-only | Enforced by `Sendable` |

Not a blocker, but it means the same merchant integration is crash-safe on one platform and
not the other. If that is not intended, iOS is the side to change, and the protocol
signature is the thing that would have to change — so it is cheaper before publication.

---

## Decision log

| Q | Decision | Who / when |
| --- | --- | --- |
| Q1 — `$default` freeze | *open* — now also covers the sharing and tracking types | |
| Q2 — `@InternalFrakApi` vs promote | *open* | now three members in scope: `PercentEncoding`, `environment`, `installPageUrl` |
| Q3 — public `init(from:)` on iOS | *open* | |
| Q4 — `FrakLogSink` divergence | *open* | |

**Blocking:** re-adding BCV and committing `sdk/android/*/api/*.api`, and after that the
first publish to Maven Central. Until BCV is back, nothing mechanical detects an
accidental ABI change — `explicitApi()` only forces you to *write* `public`.
