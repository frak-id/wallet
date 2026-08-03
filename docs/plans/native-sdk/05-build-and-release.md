# Native SDK — building, shipping, and the ABI freeze

Why two hand-written codebases, how they are distributed, how they fit the monorepo, and
the decisions that must be taken **before the first publish** because they cannot be taken
after.

## 1. Decision: two hand-written native codebases

**No shared core — separate Kotlin and Swift, for v0.1 and the foreseeable roadmap.**

The usual argument against shared cores (Dropbox's Djinni/C++ reversal) is the wrong one to
cite: its decisive cost was *hiring* C++ mobile engineers, which mostly dissolves for Kotlin
Multiplatform. The reasons here are specific to **shipping a library to third parties**,
which nearly every published KMP case study is not.

1. **No SDK vendor ships core logic this way.** RevenueCat, PostHog and Sentry all ship KMP
   as a *thin wrapper over two independently maintained native SDKs* — RevenueCat says so
   outright, and PostHog's wrapper deliberately keeps **batching and queueing** native,
   which is our single most logic-heavy component. Amplitude has no official KMP SDK at all.
   Touchlab's own promotional case-study list is entirely app authors sharing between their
   own teams: zero library-to-external-consumer cases. The pattern that exists buys API
   consistency, not implementation sharing, and still requires both native implementations.
2. **The generated Swift is not shippable to third parties.** Kotlin/Native exports through
   an Objective-C bridge: `Int?` becomes `KotlinInt?`, sealed classes become open ObjC
   hierarchies so `switch` needs a `default:`, enums become non-frozen, `suspend fun`
   becomes a completion handler with no cancellation, and the module flattens into one
   umbrella namespace. Our `FrakError` and `EstimatedReward` exist *for* exhaustive
   matching. SKIE restores some of it but is a third fast-moving toolchain downstream of
   both the Kotlin/Native compiler and the Swift ABI; Swift Export is Alpha as of Kotlin
   2.4 and regresses sealed classes relative to SKIE.
3. **Binary size, paid by every merchant.** Each Kotlin/Native framework embeds its own
   runtime, GC and stdlib — ~6 MB for hello-world, ~15 MB with a couple of dependencies,
   ~40 MB in one reported migration, against a 256 KB budget. RevenueCat's issue tracker is
   what being on the wrong side of that line looks like.
4. **Runtime collision we cannot see.** Two Kotlin/Native frameworks in one app produce
   `Class KotlinBase is implemented in both … Which one is undefined`, escalating to crashes
   inside the GC. **Rust + UniFFI has the same class of problem** (duplicate `RustBuffer`
   symbols; WalletConnect hit `duplicate symbol '_rust_eh_personality'`). Both are mitigable
   by symbol prefixing, both mitigations are manual and non-default, and both failures
   surface in a *merchant's* build looking like the merchant's bug. Pure Swift and pure
   Kotlin embed no secondary runtime and cannot collide.

**What we do instead: golden fixtures** — see [`04-golden-fixtures.md`](./04-golden-fixtures.md).
Vectors are the contract; the implementation is not. This is Slack's post-LibSlack
conformance-suite pattern, with `twitter-text` as canonical prior art.

**When to revisit, and with what.** Only if the shared deterministic surface exceeds roughly
1,000 lines *and* a drift bug reaches production despite the fixtures. The tool would then
be **Rust + UniFFI, not KMP**: `apps/wallet/src-tauri/plugins/` already holds ~4,835 lines
of first-party Rust, so the delta is packaging only, and Rust+UniFFI has real
external-vendor adoption at this scope (Ferrostar, bitdrift, Wire CoreCrypto, Mozilla
application-services). The closest analog, ReallyMe Crypto, keeps platform crypto native and
shares only the deterministic layer — which maps onto our split exactly.

**The team is not greenfield on native.** `apps/wallet/src-tauri/plugins/` already contains
1,391 lines of first-party Kotlin and 1,920 of Swift, including the OS share sheet on both
platforms, Play Install Referrer, WebAuthn and AppDelegate swizzling. The real gap is
**library distribution** — Maven Central, SPM, XCFramework assembly, consumer ProGuard
rules, semver discipline on a binary that cannot be patched once a merchant ships it — which
is narrower and more learnable, and should be scoped as such.

## 2. Licence: Apache-2.0, for the native SDKs only

`sdk/{android,ios}/LICENSE`, deliberately diverging from the monorepo's GPL-3.0. GPL is
defensible for a CDN bundle loaded at runtime; it is a much bigger ask for an artifact a
merchant **statically links into a proprietary store binary**, and merchant legal teams will
decline rather than litigate the nuance. Apache-2.0 over MIT for the explicit patent grant —
which covers the identity proof-of-possession scheme — and the trademark clause. Branch,
AppsFlyer and Adjust are all permissive.

## 3. Distribution

### iOS — SPM only

CocoaPods has been in maintenance mode since 2024 and its trunk goes **read-only on 2
December 2026**; Flutter 3.44 already made SPM the default. Adding CocoaPods now means
building into a registry that closes around our launch.

**SPM has no registry**: SE-0292/SE-0391 shipped the client and protocol, no public registry
was ever launched, and resolution is a git URL plus a tag. Publishing is `git tag`. The Swift
Package Index is worth listing on and is never in the resolution path.

Distribute as a **binary XCFramework** referenced by `.binaryTarget` with a remote zip and
checksum. Three one-way doors, decided before v1 rather than discovered:

- **Signing identity.** Xcode records the identity on a merchant's *first* integration and
  hard-errors if it later changes or vanishes. Shipping unsigned is equally sticky —
  "unsigned" becomes the expected state, so adding a signature later is a break every
  consumer must accept. Not mandatory for an SDK absent from Apple's list, but the choice
  must be made once, with one stable team identity, using **Apple Distribution**.
- **Binary URLs are immutable.** SwiftPM pins `(url, checksum)` per tag. Never re-upload to
  a live URL, never retag. Zip output is non-deterministic, so compute the checksum from the
  exact uploaded bytes, in CI. The `.xcframework` sits at the zip root and the target name
  must match the module name; non-`https` URLs are rejected.
- Validate `PrivacyInfo.xcprivacy` propagation against a real consumer app — AppsFlyer's
  manifest failed to bundle in their *static* SPM variant.

Our signature does not survive into the merchant's shipped app (frameworks are re-signed at
build, then again by App Store Connect); it is verified at *integration* time, which is where
supply-chain tampering would matter.

### Android — Central Publisher Portal

OSSRH was decommissioned on 30 June 2025; `oss.sonatype.org` is gone. Target the native
Portal API, not the OSSRH compatibility shim.

**The lead time this plan originally assumed no longer exists.** Namespace verification is
automated — a DNS TXT record and "a few minutes" — and signup is self-service. Budget half a
day, where the long pole is our own Gradle and GPG config. Verified: **`id.frak` is
unclaimed** with no OSSRH-legacy conflict, and **`frak.id` is on Route 53**, so the apex TXT
record is one we can write today.

| Requirement | Detail |
|---|---|
| Namespace proof | a second **apex** TXT on `frak.id` with the Portal-issued key. Not `_sonatype`, not a subdomain |
| GPG | public key on `keyserver.ubuntu.com`, `keys.openpgp.org`, `pgp.mit.edu`. Sign with a **primary** key — a sub-key cannot be verified |
| POM | `name`, `description`, `url`, ≥1 `licenses`, ≥1 `developers`, `scm` — the SCM URL need not resolve |
| Javadoc jar | required **by presence only**; an empty placeholder is explicitly sanctioned |
| Checksums | `md5` + `sha1` mandatory |

One trap: clicking **Verify** before the TXT propagates caches the `NXDOMAIN` and you wait
out the TTL. `dig` first, click second.

Claim the namespace when there is an artifact worth publishing — nothing here is a reason to
start early.

### React Native, later and additive

**Build the RN wrapper after both native SDKs reach v0.1 stability. Never in parallel.**
Branch, AppsFlyer and Adjust all ship RN as thin wrappers whose changelogs are literally
native version bumps; a comparable open-source wrapper is ~600–700 lines total. Building it
is not the cost. The cost is **a third release train**: RN ships roughly every two months
with a ~two-release support tail, Expo ships three SDK releases a year each pinned to one RN
version, plus our own. Both vendors who do this best still carry unresolved Expo bugs.

An **Expo config plugin is mandatory**: managed workflows regenerate `android/` and `ios/` on
every prebuild, so our `<queries>` and `LSApplicationQueriesSchemes` are silently wiped and
`isFrakAppInstalled()` just returns false with no error. Ship it first-party — Branch's
"we do not maintain the Expo plugin" is the anti-pattern. Target **New Architecture only**
(RN 0.82 made it non-optional) via TurboModules from `create-react-native-library`, and
document that the SDK cannot work in Expo Go regardless of plugin quality.

RN-first is not a real option: the one RN-only attribution SDK in the field achieves it by
abandoning ATT, SKAdNetwork, Install Referrer and OS deep-link integration. Flutter is a
later peer to RN, not a lower tier — the incumbents ship both.

## 4. Monorepo integration

**There is no Turborepo.** Orchestration is plain Bun scripts plus Changesets;
`bun run build:sdk` shells out sequentially because downstream packages typecheck against
upstream build outputs. Native builds become new scripts and new CI jobs, not pipeline
entries.

`sdk/android/` and `sdk/ios/` are Gradle and SwiftPM projects, not npm packages. Each still
carries a `private: true` `package.json` whose **only** job is to dispatch to
`scripts/run.sh`, so `bun run --cwd sdk/android check` works like every other command in the
repo — do not delete them. Because that makes them real workspace members, they are excluded
by name rather than by absence: `knip.ts` `ignoreWorkspaces`, `.changeset/config.json`
`ignore`, `biome.json` `files.includes` (biome cannot parse Kotlin or Swift), and
`.gitignore` for build outputs. Example apps at `example/native-{android,ios}` follow the
same rules.

**The example apps consume the SDK the way a merchant does**, which is the point of them:
Android through a Gradle **composite build** (`includeBuild("../../sdk/android")` plus the
ordinary Maven coordinates, so only the resolution source differs), iOS through a SwiftPM
**path dependency**. Two traps, both found the hard way:

- Composite substitution matches on `project.group`, and `frak-publish.gradle.kts` set
  `groupId` **only inside the `MavenPublication` block**, so `project.group` defaulted to the
  root project name. Substitution silently failed and Gradle went looking for
  `id.frak:frak-sdk` on Maven Central, where it does not exist — the error blames the network
  rather than the mismatch. `group = "id.frak"` is now set; published coordinates are
  unchanged. ⚠️ The example *also* declares an explicit `dependencySubstitution` block, whose
  comment still asserts that `project.group` is not `id.frak`. One of the two is redundant and
  the comment is now false — worth resolving before it teaches someone the wrong thing.
- For a **path** dependency SwiftPM derives package identity from the last path component,
  not from `Package.swift`'s `name:` (which only applies to `url:` dependencies). The
  obvious `.product(name: "FrakSDK", package: "FrakSDK")` fails; the correct spelling is
  `package: "ios"`.

**Versioning is independent, outside the Changesets `linked` group.** Different registries,
different cadence, and decisively: a merchant's binary is frozen the moment they ship to a
store. A JS patch reaches consumers on their next install; a native patch reaches them only
when every merchant re-integrates and ships a store-reviewed build. Adopt an explicit
deprecation policy before v1.0 — Sentry's 90-day minimum window with both names alive is the
reference. The same asymmetry is why `01-platform-changes.md` §3 keeps
correctness-sensitive logic server-side: the server can be fixed, the shipped binary cannot.

**CI: the hard parts already exist.** `.github/workflows/tauri-mobile-release.yml` already
carries a macOS runner, Xcode/SwiftPM caching, App Store Connect API keys, Android signing
secrets, Java 17 + Android SDK + Gradle cache, and AWS OIDC. **Nothing there builds a library
artifact.** New jobs needed: `.aar` + Portal publish, XCFramework assembly + SPM tagging,
consumer ProGuard/R8 verification. Structure tests in three tiers — JVM logic tests on cheap
Linux runners, integration tests through the example apps' public API, device-farm smoke
tests nightly rather than merge-gating. Note GitHub bills macOS runners at a **10×**
multiplier; the existing self-hosted Hetzner runner is the escape hatch if cost bites.

**Codegen owns the mechanical boundary, humans own the developer-facing API.** The OpenAPI
spec (`01` §3) generates Kotlin and Swift *models*; it does not generate `FrakClient`.
Signal's `libsignal` guidelines say the same thing explicitly.

## 5. ABI decisions before the first publish

These share one deadline — **the first publish of `id.frak:frak-sdk`**. After it, changing
any of them is a breaking release for a binary already in the Play Store, not an edit. The
evidence below came from actually running `apiDump` (JDK 24 / AGP 8.11.0 / Gradle 8.14.3).

**State of play: there is no binary-compatibility gate and no committed dump.** BCV was
wired, the dumps were committed to give `apiCheck` a baseline, and then both were removed —
deliberately, because committing a dump *ratifies* the public shape and turns the questions
below from design choices into breaking changes. The gate comes back, with the dumps, once
Q1–Q3 are answered. Until then nothing mechanical detects an accidental ABI change;
`explicitApi()` only forces you to *write* `public`. (Incidental finding worth keeping: BCV
writes an **empty file** rather than nothing for a module with no public API, and `apiCheck`
fails if that file is absent.)

The last dump was 509 lines for `frak-sdk`, covering config, identity, sharing, tracking and
the app-link results.

### Q1 — accept the `$default` constructor freeze, or move to builders?

Converting the promoted types from `data class` to plain classes removed `copy()` and
`componentN()`, but **not** the synthetic default-argument bridge:

```text
public synthetic fun <init> (…;ILkotlin/jvm/internal/DefaultConstructorMarker;)V
```

Fifteen public types carry one — ten from the promoted config tree, plus `FrakConfig`,
`FrakMetadata`, `FrakError` and two of its arms — and `SharingRequest`, `SharingProduct`,
`AttributionParams`, `FrakContext.V2` and `Interaction.*` have joined them since. The bridge
encodes the parameter count and a bitmask, so **adding one field changes the signature** and
a merchant binary compiled against today's SDK hits `NoSuchMethodError` against tomorrow's —
unfixable by the merchant recompiling, because it is their shipped app that breaks.

The tree keeps growing while the question stays open: `FrakConfig` gained `deepLink` as a
**mid-list insertion** (the worse variant, which also breaks every caller that named a
parameter after it), then `preloadSharing` appended last.

| Option | Cost now | Cost later |
|---|---|---|
| **A. Accept** | zero | these 15 types can never gain a field; the config tree mirrors a dashboard that *will* grow |
| **B. Builders** | rewrite 10 types + tests; verbose from Kotlin, idiomatic from Java (which A7 wants) | additive forever |
| **C. Internal constructors + factory functions** | smaller diff than B | additive, but every field needs a new overload |
| **D. Keep the tree `internal`** | reverts the promotion | brings back the UI module being unable to read its own config |

**Recommendation: B for the config tree**, which is the part most likely to grow;
`FrakConfig`/`FrakMetadata` are merchant-authored and stable enough that A is defensible for
them. What is *not* defensible is re-adding the dump without choosing, because that silently
picks A for everything.

### Q2 — was promoting ~51 properties ahead of a reader right?

51 public getters across the config tree became public because `frak-sdk-ui` / `FrakSDKUI` is
a separate module and can only see `public` API. Sound for the properties the sheet renders;
not obviously true for all 51. Same question, smaller: `PercentEncoding` (a 15-line RFC 3986
encoder, public only to collapse three copies of the same loop), `environment`, and
`installPageUrl`.

The alternative not taken is a `@RequiresOptIn` `@InternalFrakApi` marker wired into BCV's
`nonPublicMarkers`: visible to the compiler so the UI module links, excluded from the dump so
it is never frozen, with an opt-in warning at every merchant call site. That directly weakens
Q1 — an unfrozen type can gain a field freely, making "A, for now" safe rather than
permanent. Against it: `@RequiresOptIn` is Kotlin-only, so a Java consumer sees nothing, and
it is a second weaker tier of public that merchants will use anyway once it appears in
autocomplete. **Decide alongside Q1; the answers interact.**

### Q3 — iOS: `init(from:)` is public API

`FrakResolvedConfig.swift:105` and `:153` are `public init(from decoder:)`, a side effect of
the promotion rather than a request. The wire decoder is merchant-callable, the `Decodable`
conformance can never be removed, so the wire format and the public model are now permanently
coupled — and Swift has no dump, so nothing will tell us when it breaks. Cheapest fix before
publication: move the conformance to an internal wire type. Note one of the two is the
hand-written *forgiving* `init(from:)` that fixed the `translations` regression; that one is
load-bearing and must stay — `internal`-or-better, **not necessarily `public`**.

### Q4 — `FrakLogSink` divergence

Shipped knowingly divergent: `fun interface` vs `protocol: Sendable`; a throwing sink is
swallowed on Android and **brings down the host process** on iOS; thread-safety is doc-only
on Android and enforced by `Sendable` on iOS. Not a blocker, but the same merchant
integration is crash-safe on one platform and not the other. If unintended, iOS is the side
to change and the protocol signature is what changes — cheaper before publication.

### Q5–Q7 — member contracts, surfaced by rewiring the example apps

Putting a real integrator in front of the surface produced three decisions the API review
did not. All three are cheaper before the freeze than after.

**Q5 — write the error-model rule down.** Four styles across fifteen members, listed in
`02` §6.2. Part is defensible (telemetry must not take down a checkout), part is an accident
of authorship. The `@Throws` annotations made the throwing tier *discoverable*, which was the
urgent half; what is missing is the stated rule — *telemetry returns a result, data-fetch
throws, local best-effort builders return null* — so the +6–9 wallet-session members have an
obvious home instead of fragmenting the surface further. Unifying all fifteen onto
`FrakResult` is **not** recommended: bigger break, smaller gain.

**Q6 — `buildLink` returns `String?` for four different reasons**: no identity yet; config
resolution failed and was swallowed; no merchant resolvable; no link anywhere. "Retry in a
moment" and "you misconfigured `homepageLink`" need opposite responses and are the same
`null`. Either return `FrakResult<String>` (a shape change, so **before** the freeze) or keep
`String?` and log a distinct warning per path (non-breaking, can land later).
`installUrl`/`installPageUrl` have the same flaw at lower stakes.

**Q7 — there is no per-product reward lookup.** Documenting `rewards.best` as per-context
steers merchants *out* of the listing use case without serving it. The additive fix is a
sibling returning a per-product mapping in one request — `bestByProduct(products:)`. Sealing
`FrakClient` made adding it safe after the freeze, but it needs a backend shape that returns
per-product results, so the **decision** belongs now even if the code does not.

| Q | State |
|---|---|
| `FrakClient` growth hazard | **resolved** — sealed concrete class, five namespaces (`02` §6) |
| Q1 `$default` freeze | open — now also covers the sharing and tracking types |
| Q2 `@InternalFrakApi` vs promote | open — `PercentEncoding`, `environment`, `installPageUrl` |
| Q3 public `init(from:)` on iOS | open |
| Q4 `FrakLogSink` divergence | open |
| Q5 error-model rule | open — no shape change, but it governs every future member |
| Q6 `buildLink` null-vs-result | open — shape change, so before the freeze |
| Q7 per-product rewards | open — additive in the SDK, needs a backend shape |

## 6. Sequencing and status

**Done.** OpenAPI export hardened for the MVP surface (four real defects, `b8142a96e` /
`3578e5c92`); golden fixture corpus generated and loaded on both platforms; `sdk/android` +
`sdk/ios` scaffolding and monorepo wiring; the SDK surface itself, both platforms; **both
example apps rewired off their stubs onto the real SDK** (composite build / path dependency),
pointed at the development environment with a real merchant id; and the
**first end-to-end run on a physical device** — initialize, wallet-installed probe,
`config.resolve` returning a real merchant, `rewards.best` returning a real reward.

That the example links the real artifact rather than a shim is checkable rather than assumed:

```bash
unzip -p app-debug.apk classes3.dex | strings | grep -o "Lid/frak/sdk/[A-Za-z]*Api;"
# Lid/frak/sdk/{AppLink,Config,Rewards,Sharing,Tracking}Api;
```

**Next, in order:**

1. Answer Q1–Q7, then re-wire BCV and commit the dumps. Everything else ABI-shaped is
   blocked on this, and it gets harder weekly. Q6 and Q7 are shape changes; Q5 is a written
   rule.
2. Make the work verifiable: Swift 6 mode in `Package.swift`, *run* Android Lint (it has
   never executed once — `abortOnError` is already the default, the gap is execution), and
   an **iOS** device/simulator pass to match Android's. Each will immediately find things two
   static audits could not.
3. CI jobs and the publish paths (§3, §4) — the deliberate deferral in `06` §2, which is
   gated on *both* SDKs having run on a device. Android has; iOS has not.
4. The correctness waves in `06-open-findings.md`, both platforms per PR.
5. Drive the remaining validation questions below through the harnesses.
6. RN TurboModule wrapper + Expo config plugin; Flutter if merchant demand justifies it.

**What is built so far is internal only, and that is a decision, not an accident. No
merchant integrates it, Moulinex included — they get the hardened MVP.** That is what makes
breaking the API between now and MVP free: the deprecation discipline above starts at MVP,
and that freedom expires the moment Moulinex integrates.

**Still unanswered.** One device run resolved a merchant and a reward; none of the following
has been exercised. The example apps are the *only* way to run a native SDK at all, which is
why they are the prerequisite for every question here (and they must consume the SDK through
its **public API only** — an example reaching past the public surface stops being a test of
the thing being shipped):

1. Does the `?confirmed=1` → `PostShareConfirmation` → install handoff chain survive a real
   round trip? It is silently fatal and has never run.
2. Does the custom-scheme return channel behave under interruption — backgrounding
   mid-share, process death while the OS chooser is up?
3. Is the hosted `/sharing` page fast enough behind a native sheet on a **low-end Android**
   device? This one gates an architectural decision, not a number (`03` §3).
4. Does cross-surface attribution resolve — share from native, open in a mobile browser?
5. **Does the fixture corpus catch a real divergence?** Introduce a deliberate one-byte error
   in one platform's codec and confirm the suite goes red. Until that has happened the
   corpus is an assumption.

Questions 3 and 5 are the two worth pausing for. The rest are bugs to fix; those two change
the plan.

**Open ownership questions:** who owns the RN wrapper's recurring cost across three release
trains; whether to pre-empt the 10× macOS billing multiplier with the existing Hetzner
runner; and whether `docs/ios-app-clips.md` (which ranks an App Clip P0 for the *web →
wallet* flow) actually conflicts with this plan's exclusion (which is scoped to *merchant app
→ wallet*, where there is no Safari banner to host an App Clip Card). They probably do not
conflict — but whoever owns both should say so in both documents.
