# Implementation strategy — code sharing, distribution, and monorepo integration

How the native SDKs get built, packaged, and released — and why they are two
hand-written codebases rather than one shared core.

[`01-platform-changes.md`](./01-platform-changes.md) covers what has to change in
`apps/wallet`, `apps/listener`, and `services/backend`.
[`02-native-sdk-overview.md`](./02-native-sdk-overview.md) covers what the SDKs do.
This document covers **how we build and ship them**, and corrects three claims in
those documents that industry research contradicts (§2 and §3). Two smaller factual
corrections — the uppercase-UUID failure mode and the `withCache.ts` path — were
applied directly in `02` rather than recorded here.

---

## 1. Decision: two hand-written native codebases

`02-native-sdk-overview.md` assumes hand-written Kotlin + Swift kept symmetric by
process. It never argues for it. The assumption is correct, but the reasons matter —
without them this gets relitigated every time someone reads a Kotlin Multiplatform
case study.

**Decision: separate Kotlin and Swift implementations, no shared core, for v0.1 and
the foreseeable roadmap.**

### 1.1 The usual argument is not the reason

The canonical case against shared cores is Dropbox's 2019 reversal of its
Djinni/C++ layer, independently confirmed by Slack's LibSlack post-mortem. Dropbox's
decisive cost was **hiring**: over a year failing to hire senior C++ mobile engineers,
and existing mobile engineers leaving rather than learn a skill they considered a
career dead end.

That argument mostly dissolves for Kotlin Multiplatform. KMP shared code is still
Kotlin, Android engineers already write it, and iOS engineers only need to *read* it.
JetBrains and Google both back the toolchain, so there is no bespoke infrastructure to
build. Citing Dropbox against KMP in 2026 is citing the wrong half of the argument.

The reasons below are specific to **shipping a library to third parties**, which is a
different problem from an app team sharing code across its own two apps. Nearly every
published KMP case study is the latter.

### 1.2 Reason 1 — no SDK vendor ships core logic this way

Three major vendors ship KMP SDKs. All three are **thin wrappers over two
independently maintained native SDKs**, not shared implementations.

RevenueCat's KotlinConf 2025 talk states it directly: *"We have existing native SDKs
for both Android and iOS, and did not want to rewrite all core logic… Created a new KMP
library, made it depend on the existing single-platform SDKs, provide a unified API."*
PostHog's docs describe theirs as *"a thin wrapper that delegates to the official
PostHog SDKs on each target — so you get native batching, queueing, and session replay
behind a single common API."* Sentry's KMP SDK builds on top of its existing native
SDKs. Amplitude has no official KMP SDK at all; the community's fallback plan in the
tracking issue is explicitly "a wrapper of native sdks, like React Native or Flutter
ones do."

Note what PostHog keeps native: **batching and queueing**. That is our durable offline
event queue (`02-native-sdk-overview.md` §7.1) — the single most logic-heavy component
in the MVP.

Touchlab's 2026 promotional case-study list (Bitkey, Blackstone, Duolingo, Forbes,
Google Workspace, Philips) is entirely app authors sharing between their own iOS and
Android teams. Zero library-to-external-consumer cases, in a document written to make
the strongest possible case for KMP.

**The pattern that exists buys API consistency, not implementation sharing — and it
still requires maintaining both native implementations.** That is the duplication a
shared core was supposed to remove.

### 1.3 Reason 2 — the generated Swift is not shippable to third parties

Kotlin/Native exports to iOS through an Objective-C bridge. What a merchant's iOS
developer would see:

| Kotlin | Exported Swift | Consequence |
|---|---|---|
| `Int?` | `KotlinInt?` (an `NSNumber` subclass) | caller writes `.int32Value` before arithmetic |
| sealed class | open ObjC class hierarchy | `switch` requires `default:` — exhaustiveness gone |
| enum | non-frozen | same loss of exhaustive matching |
| `suspend fun` | completion handler | no native cancellation |
| module structure | one flat umbrella namespace | internals leak into the public surface |

Our `FrakError` and `EstimatedReward` are sealed types (`02-native-sdk-overview.md` §9).
Their entire value is exhaustive matching at the call site. The ObjC bridge destroys
exactly that.

Two mitigations exist, neither free. **SKIE** (Touchlab's compiler plugin) restores
exhaustive sealed-class switching and real Swift `async`, but it is a third fast-moving
toolchain sitting downstream of both the Kotlin/Native compiler and the Swift ABI.
**Swift Export** is **Alpha** as of Kotlin 2.4 — JetBrains' own docs say "still
incomplete, so breaking changes are expected" — and it currently regresses sealed
classes relative to SKIE while improving nullability and namespacing.

The third option is hand-writing a Swift facade over the generated API, which
reintroduces the per-platform code the shared core was meant to eliminate.

### 1.4 Reason 3 — binary size, paid by every merchant

Each Kotlin/Native framework embeds its own copy of the runtime, GC, stdlib, and any
Kotlin dependencies including `kotlinx-coroutines`. JetBrains documents this as
"self-contained closures" and explicitly warns against shipping multiple such
frameworks in one app.

Reported sizes: ~6 MB for a hello-world framework; ~15 MB for "a pretty small SDK with
a couple of standard dependencies like ktor" — from an SDK author noting *customers
complain*; ~40 MB in one production migration.

`02-native-sdk-overview.md` §1.2 sets the budget at **< 150 KB per platform**. This is
not a near-miss.

RevenueCat's issue tracker shows what happens past that line: *"SDK Binary size impact
is ~5.2 MB via SPM — Request for optimization / Lightweight Core"*, *"The app size has
increased significantly"*, *"RevenueCatUi.framework is 4 MB in my executable… and I do
not even use it."* Our §1.2 exists specifically to avoid being that dependency.

### 1.5 Reason 4 — runtime collision, and we cannot see the merchant's build

This risk exists only for SDK vendors. An app author picking KMP controls the whole
dependency graph and sees a collision immediately in their own CI.

Two Kotlin/Native frameworks in one app produce:

```
objc[…]: Class KotlinBase is implemented in both …dylib and …dylib.
One of the two will be used. Which one is undefined.
```

JetBrains documents this. Touchlab documents the escalation: crashes "sometimes on the
very first call into shared code, other times deep inside Kotlin/Native's garbage
collector." As KMP adoption grows in mainstream Android shops, the odds that a merchant
app already ships a Kotlin/Native framework rise over time rather than falling.

**Rust + UniFFI carries the same class of risk.** `mozilla/uniffi-rs#2802`: two UniFFI
libraries in one binary produce duplicate-symbol link errors because each generates
identical C types such as `RustBuffer`; the maintainers' own assessment is that
prefixing generated C types is "the most robust (and possibly only) solution."
WalletConnect hit the real-world version — `duplicate symbol '_rust_eh_personality'` —
with two unrelated Rust static libraries in one iOS app.

Both are mitigable through symbol prefixing or internalization. Both mitigations are
**manual and non-default**, and both failure modes surface in a merchant's build where
they look like the merchant's bug, not ours.

A pure Swift and pure Kotlin SDK embeds no secondary runtime and cannot collide.

### 1.6 What we do instead: golden fixtures

Three concerns genuinely need byte-identical behavior across platforms, and all are pure
computation with no platform API dependency:

- **FrakContext v2 codec** — big-endian `uint32`, unpadded base64url, lowercase-only
  UUIDs, length-based version disambiguation (`02-native-sdk-overview.md` §8.1)
- **Reward selection and currency formatting** (§8.2)
- **The signed byte layout for `merge`/`ensure`/`install`** — `uint16be` length-prefixed
  fields, `uint64be` Unix seconds, lowercase 36-character UUID strings as UTF-8 rather
  than raw bytes, and a deliberately zero-length `binding` field so the field *count*
  never varies by op ([`../identity-proof-of-possession/README.md`](../identity-proof-of-possession/README.md) §2.3)

The third arrived from the identity work rather than from native, and its Phase 0 makes
the same call this section does — freeze the format, commit fixtures, and note that **no
golden fixtures exist anywhere in this repo today**. Both efforts need the same
mechanism; see §7 for how they sequence together.

The formatting risk is real, not theoretical: iOS and Android produce *different output
for identical locale and currency input* (`"CHF 10.00"` vs `"CHF10.00"` for the same
`en-US`/CHF pair), and ICU version skew produces divergence even within one platform
family. "Just use each platform's native formatter" is not a safe option — custom logic
is required on both platforms regardless of the sharing decision.

**We use golden fixtures, not a shared implementation.** Generate vectors from
`sdk/core/src/context/frakContextV2Codec.test.ts` and the reward-formatting tests,
commit them as a language-agnostic JSON file, and assert against them from the Kotlin,
Swift, and TypeScript suites.

This is Slack's post-LibSlack conformance-suite pattern, and `twitter-text` is the
canonical prior art — a YAML corpus consumed by independently maintained Java, Kotlin,
Swift, and JS implementations, whose stated philosophy is that *"anyone can feel free to
implement this logic however they choose."* Vectors are the contract; the
implementation is not.

`02-native-sdk-overview.md` §8.1 already mandates this. This document promotes it from
a testing note to **the named alternative to a shared core**, with the reasoning
attached.

**One fixture corpus, not three.** The codec, the signing layout, and reward formatting
should land in a single committed fixture set with one generator and one loader per
platform. Three separately-invented corpora would give three chances to disagree about
encoding, file layout, and which suite owns what — the exact divergence the mechanism
exists to prevent.

### 1.7 When to revisit — and why Rust, not KMP

Revisit **only** if the shared surface grows to include the event queue, retry/backoff,
and crypto — not for the codec alone.

At that point the tool is **Rust + UniFFI**, not KMP, for one reason specific to this
team: `apps/wallet/src-tauri/plugins/` already contains ~4,835 lines of first-party
Rust. The delta is packaging only (cross-compiling to `aarch64-apple-ios`,
`aarch64-apple-ios-sim`, `x86_64-apple-ios`, `lipo`, XCFramework assembly, `.so`/AAR
for Android) rather than a new language.

Unlike KMP, Rust+UniFFI has real external-vendor adoption at exactly this scope:
Stadia Maps' Ferrostar navigation SDK, bitdrift's mobile observability SDK, Wire's
CoreCrypto, and Mozilla's application-services. The closest structural analog is
**ReallyMe Crypto** — a Rust core doing byte-exact codecs and P-256 signing, published
to Rust, Swift, Kotlin, and TypeScript, with a `crates/conformance` package asserting
platform implementations against shared vectors. Their own policy prefers *native*
platform crypto where provable-equivalent and reserves the shared core for cases where
determinism cannot otherwise be guaranteed — which maps onto our split exactly: P-256
signing stays in Keystore/Secure Enclave, only the deterministic layer would move.

Binary size is controllable but is itself an engineering investment. A naive
`cargo build --release` of a trivial AES demo produced a 25 MB static library; bitdrift
holds a production Rust mobile SDK core to **~1 MB** through documented, measured
techniques (fat LTO plus dead-code stripping was −90% alone) and enforces it with
binary-size regression CI on every PR.

**Trigger for the revisit:** the shared deterministic surface exceeds roughly 1,000
lines *and* a drift bug reaches production despite the fixtures.

---

## 2. Correction: the team is not greenfield on native

`02-native-sdk-overview.md` §12 open question 6 states these SDKs "would be the org's
first production Kotlin/Swift codebase." The repository contradicts this.

First-party plugin sources under `apps/wallet/src-tauri/plugins/`, excluding vendored
`.tauri/`, `.build/`, and `gen/` directories:

| Platform | Lines | Notable |
|---|---|---|
| Kotlin | **1,391** | Firebase messaging (429), in-app updater (306), recovery hint (222), **native share sheet (174)**, **WebAuthn/passkeys (138)**, **Play Install Referrer (56)** |
| Swift | **1,920** | Firebase (545) + AppDelegate swizzler (160), **WebAuthn (443)**, **share sheet (275)**, recovery hint (246), updater (135) |

Swift excludes `Package.swift` manifests (2,144 lines with them).

Three of these are primitives the native SDK needs directly: the OS share sheet on both
platforms, Play Install Referrer on Android, and AppDelegate swizzling on iOS (relevant
to the `DeepLinkHandling.Automatic` strategy in §6.1).

**The real gap is library distribution, not native development**: publishing to Maven
Central and SPM, XCFramework assembly, consumer ProGuard rules, and semver discipline on
a binary that cannot be patched once a merchant ships it. That is a narrower and more
learnable gap than "first production Kotlin/Swift," and it should be scoped as such.

---

## 3. Correction: distribution has moved

Two claims in `02-native-sdk-overview.md` §2 are out of date.

### 3.1 CocoaPods — ship SPM only

§2 lists distribution as "SPM + CocoaPods."

CocoaPods has been in self-declared **maintenance mode since 2024**, and its trunk — the
publish server — goes **fully read-only on 2 December 2026**. After that date no new
pods or new versions can be published. Already-published pods keep resolving
indefinitely via the GitHub Specs repo and jsDelivr, so existing `Podfile`s keep
working, but the ecosystem is frozen.

Flutter is the bellwether: as of 3.44, **SPM replaced CocoaPods as the default iOS and
macOS dependency manager**, with the CLI auto-migrating Xcode projects.

**Ship SPM only.** Adding CocoaPods support now means building a publishing path into a
registry that closes within months of our own launch.

Distribute the iOS SDK as a **binary XCFramework** referenced from `Package.swift` via
`.binaryTarget` with a remote zip and checksum — the pattern AppsFlyer uses. Note one
known failure mode: AppsFlyer's `PrivacyInfo.xcprivacy` failed to bundle correctly in
the *static* SPM variant (their issue #281), so validate manifest propagation against a
real consumer app, not just a local build.

### 3.2 Maven Central — Central Publisher Portal, not OSSRH

§2 lists "Maven Central" without qualification.

**OSSRH was decommissioned on 30 June 2025**, alongside the EOL of Nexus Repository
Manager v2. `oss.sonatype.org` and `s01.oss.sonatype.org` no longer work. Publishing
now targets the **Central Publisher Portal**; existing namespaces were migrated
automatically with the same credentials.

Sonatype ships a "Portal OSSRH Staging API" compatibility shim so legacy Gradle plugins
built against the old endpoints keep working, but it is explicitly a migration aid.
Target the native Portal API.

**Budget this as real setup work.** Namespace verification, GPG signing, and the Portal
publishing flow are the specific "we have never shipped a distributed library" gap
identified in §2 above.

### 3.3 What is confirmed

For balance, the rest of §2's distribution and compliance analysis holds up:

- **`minSdk 24` / iOS 15** is conservative and safe. Branch, Adjust, and AppsFlyer all
  sit at Android 21 and iOS 12–15.
- **The core/UI artifact split is more disciplined than the incumbents.** None of
  Branch, AppsFlyer, Adjust, Singular, or Kochava ships a core/UI split — they have no
  UI surface. Our split is correct precisely because the UI artifact carries a WebView.
- **The privacy-manifest analysis is accurate**, including that Frak is absent from
  Apple's ~90-entry commonly-used-SDK list. That list is dominated by repackaged
  open-source libraries (Alamofire, RxSwift, Firebase components, Lottie); no
  closed-source attribution vendor appears on it. Signing the XCFramework anyway remains
  the right call.
- **`PrivacyInfo.xcprivacy` is a hard gate.** ITMS-91053 has been enforced since
  1 May 2024, and `UserDefaults` is one of the five required-reason categories.

One tailwind worth recording: **Firebase Dynamic Links shut down completely on
25 August 2025**, and Google shipped no first-party replacement for deferred deep
linking — their guidance is Universal Links plus App Links, which explicitly do not
cover the deferred case. Google exited the category.

---

## 4. React Native: additive, and only after both native SDKs are stable

Merchant apps built on React Native cannot consume a Kotlin or Swift SDK directly. The
question is when to close that gap, not whether.

**Decision: build the RN wrapper after both native SDKs reach v0.1 stability. Never in
parallel.**

### 4.1 The pattern is a thin wrapper, and it is cheap to build

Branch, AppsFlyer, and Adjust all ship RN packages, and all three are **thin wrappers
over their native SDKs**, not reimplementations — their changelogs are literally native
SDK version bumps ("Update Android SDK to 6.17.5", "Update iOS SDK to 6.17.8").

Sizing, from a real open-source attribution wrapper with a near-identical feature set
(configure, install tracking, deep links, ATT, SKAdNetwork, three event emitters):

| Piece | Lines |
|---|---|
| TypeScript codegen spec | ~60 |
| Swift implementation | ~215 |
| Kotlin implementation | ~215 |
| ObjC++ TurboModule shim | ~110 |

**Roughly 600–700 lines total.** Building it is not the cost.

### 4.2 The cost is recurring, and it is a third release train

- **React Native ships roughly every two months** with a support tail of about two
  releases — 0.82.x was already unsupported by the time 0.85 shipped.
- **Expo ships three SDK releases a year**, each pinned to exactly one RN version.
- Plus our own native SDK releases.

That is three version trains to reconcile continuously. Both vendors who do this best —
AppsFlyer and Adjust — still carry visible unresolved Expo compatibility bugs despite
dedicated resources.

### 4.3 An Expo config plugin is mandatory, not optional

Expo's managed workflow uses Continuous Native Generation: `android/` and `ios/` are
regenerated on every `expo prebuild`. Hand-edited native config does not survive.

Our SDK requires `<queries>` in `AndroidManifest.xml` for Frak app detection and
`LSApplicationQueriesSchemes` in `Info.plist` (`02-native-sdk-overview.md` §3). Without
a config plugin those are **silently wiped on every prebuild** — and the failure is
invisible: `isFrakAppInstalled()` returns false, the install shortcut never fires, and
nothing errors.

Two known hazards:

- Android `<queries>` has long-standing ergonomic issues in `@expo/config-plugins`
  (open issue #123). Test against a real prebuild, not just the plugin API.
- **Config plugins break on Expo's own template churn.** AppsFlyer's plugin only patched
  the Objective-C `AppDelegate`; when Expo 52+ defaulted to `AppDelegate.swift` it broke
  with `withAppsFlyerAppDelegate: Swift AppDelegate file is not supported yet`. Still
  unresolved; workaround is manual native setup.

**Ship the config plugin first-party**, matching AppsFlyer and Adjust. Branch's approach
is the anti-pattern — their docs state *"we do not maintain the [react-native-branch]
plugin for Expo… we cannot fix any issues that arise related to this plugin."*

### 4.4 Architecture and a note on Expo Go

**New Architecture only.** RN 0.80 froze the legacy architecture (June 2025); **RN 0.82
made New Architecture the only runtime — "always enabled and cannot be disabled"**; 0.85
began deleting legacy internals such as `CatalystInstanceImpl`. A wrapper started now
has no reason to carry a bridge fallback.

Use **TurboModules via `create-react-native-library`**, matching what merchant
integrators already expect from the incumbents. Nitro Modules would eliminate the ~110
line ObjC++ shim and is winning high-profile libraries (MMKV, VisionCamera), but it is
community-maintained rather than Meta-official, and our call pattern — configure once,
a handful of callbacks per session — gains nothing from its JSI performance advantages.

**Document explicitly that the SDK cannot work in Expo Go**, regardless of plugin
quality. Install Referrer, ATT, and OS deep-link integration all require a development
build. This is true of every attribution SDK; saying so upfront prevents a bad first
integration experience.

### 4.5 RN-first is not a real option

No established attribution vendor ships RN before native. The one RN-only attribution
SDK found in research achieves it by abandoning ATT, SKAdNetwork, Install Referrer, and
OS deep-link integration entirely — which is to say, by abandoning the capabilities that
make the category useful.

One market signal worth recording: **Shopify uses React Native for its merchant and
point-of-sale apps** — precisely our target segment. That argues the wrapper matters,
not that it should come first.

**Flutter is not deprioritized by the incumbents** — Branch, AppsFlyer, and Adjust all
ship Flutter plugins too. Treat Flutter as a later peer to RN, not a lower tier.
Published RN-vs-Flutter market-share figures conflict badly across sources and should
not drive the sequencing decision; if it becomes load-bearing, it needs its own
research pass.

---

## 5. Monorepo integration

Not covered in `01` or `02`. All findings below are verified against the current repo.

### 5.1 There is no Turborepo

Orchestration is plain Bun scripts plus Changesets. There is no `turbo.json` and no
`turbo` dependency. `bun run build:sdk` shells out sequentially with `--filter`, and the
`rpc → core → legacy → react → components` order is a hard requirement because
downstream packages typecheck against upstream build outputs.

**Native builds do not plug into a pipeline abstraction because there isn't one.** They
become new scripts and new CI jobs.

### 5.2 Placement: `sdk/android/` and `sdk/ios/`

Root `package.json` declares workspaces as `["apps/*", "packages/*", "sdk/*",
"example/*", "services/*"]`. A Gradle or Xcode project is not an npm package and cannot
be a workspace member.

The precedent already exists: `apps/wallet/src-tauri/gen/android/` and
`.../gen/apple/` are real Gradle and Xcode projects living inside a workspace folder,
invoked directly by the `tauri` CLI, never touched by `bun install`.

Place the SDKs at `sdk/android/` and `sdk/ios/`. Bun ignores subfolders without a
`package.json`, so no workspace change is needed. Two exclusions are required:

| File | Change | Precedent |
|---|---|---|
| `biome.json` | add `"!sdk/android"`, `"!sdk/ios"` to `files.includes` | `"!**/src-tauri/gen"` already present |
| `knip.ts` | do not add to `workspaces` | `ignoreWorkspaces: ["sdk/legacy"]` |

Leave `bun run build:sdk` untouched — it must keep meaning "build the JS SDKs."

### 5.3 Versioning: outside the Changesets linked group

`.changeset/config.json` declares a `linked` group tying `@frak-labs/frame-connector`,
`@frak-labs/core-sdk`, and `@frak-labs/react-sdk` to bump together.

**Native artifacts must not join that group.** Different registries, different release
cadence, and — decisively — a merchant's binary is frozen the moment they ship to the
App Store or Play Store. A JS patch release reaches consumers on their next `bun
install`; a native patch reaches them only when every merchant re-integrates and ships a
new store-reviewed build.

Version `id.frak:frak-sdk` and `FrakSDK` independently from day one.

Adopt an explicit deprecation policy before v1.0. Sentry's is the reference: a **90-day
minimum window** with old and new names both alive through the transition, plus separate
`latest` and pre-release channels. Braze publishes a similar SemVer commitment. The
underlying reason is the same one that drives `01-platform-changes.md` §1.5's version
pinning and kill switch: **keep correctness-sensitive logic server-side wherever the
choice exists**, because the server can be fixed and the shipped binary cannot.

### 5.4 CI: the hard parts already exist

`.github/workflows/tauri-mobile-release.yml` already carries the full native machinery:

| Capability | Where | Reusable? |
|---|---|---|
| macOS runner (`macos-26`) | `ios` job | yes — the only macOS usage in the repo |
| Xcode DerivedData + SwiftPM caching | `ios` job | yes, including the pre-warm that dodges a `swift-rs`/Firebase parallel-build race |
| App Store Connect API key | `APPSTORE_API_PRIVATE_KEY`, `APPSTORE_ISSUER_ID`, `APPSTORE_API_KEY_ID` | yes |
| Android signing | `ANDROID_KEYSTORE_BASE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD` | yes |
| Java 17 + Android SDK + Gradle cache | `android` job | yes |
| AWS OIDC for `sst shell` | workflow-level `id-token: write` | yes |

**Nothing here builds a library artifact** — only the full wallet app binary. New jobs
are needed for: `.aar` plus Maven Central Portal publish, XCFramework assembly plus SPM
release tagging, and consumer ProGuard/R8 rule verification.

**Cost note:** GitHub Actions bills macOS runners at a **10× minute multiplier** versus
Linux. A 200-minute macOS job exhausts an entire free-tier monthly allotment. We already
run a self-hosted Hetzner runner (`frak-hetzner-wallet`) for SST deploys, so the pattern
exists if cost becomes a constraint. The Guardian published a useful account of moving
iOS CI off hosted macOS runners for exactly this reason.

Structure tests in three tiers, matching standard native SDK practice: logic tests on
cheap Linux runners (JVM for Kotlin), integration tests against small fixture apps
driven through the public API, and device-farm smoke tests nightly rather than
merge-gating.

### 5.5 Promote OpenAPI export out of "enhancements"

`01-platform-changes.md` §3.6 lists OpenAPI export as an enhancement. **It should be
sequenced first, before either native SDK starts.**

The backend has no machine-readable spec today. `services/backend/src/index.ts` exports
Eden Treaty types (`export type App = typeof app`), which are TypeScript-only structural
inference over the Elysia route tree — unusable from Kotlin or Swift. But every route
already uses Elysia `t.*` (TypeBox) schemas, and TypeBox is JSON-Schema-compatible.
Adding `@elysiajs/swagger` yields a spec that generates Kotlin *and* Swift models from
one source.

Wire-format duplication is the largest drift category between two hand-written SDKs.
This removes it structurally rather than by discipline.

The division of labor is the industry pattern: **codegen owns the mechanical boundary,
humans own the developer-facing API.** Signal does this deliberately in `libsignal` —
their coding guidelines state the generated bridge layer is explicitly *not* meant to
produce a good API; each platform team hand-writes the idiomatic wrapper on top. Our
generated models feed the hand-written `FrakClient` facade; they are not the facade.

### 5.6 Docs convention

Existing plans under `docs/plans/` use: title as `# Fix plan — <scope>`, a blockquote
intro naming what the plan supersedes with "Decisions recorded" callouts, then
`## Phase 1 — Blockers`, `## Phase 2 — Agreed fixes`, `## Phase 3 — Tests`, closing
with `## Open product decisions` and `## Backlog`. Numbered items carry exact
`file/path.ts:line-range` pointers.

The `native-sdk/` folder deviates (numbered files, README index). That is appropriate
for a multi-document plan of this size — but any single-file follow-up plans should
return to the established skeleton.

---

## 6. v0.1 is a POC, and it needs example apps to exist at all

`02-native-sdk-overview.md` §11 lists an MVP scope that is closer to a shippable
product than a first proof. Before that scope is built, **v0.1 should be a deliberately
thin POC whose only job is proving the loop works end to end.**

This is not a scope cut for its own sake. The integration seams carry more risk than the
features do, and every one of them is unproven: an SDK-owned install step, a native shell
hosting a web page it must interpret the exit of, a return channel over a custom scheme,
and a `?confirmed=1` reload the funnel silently dies without. None of that is validated
by writing a better offline queue.

> **Decided: the POC is internal only — no merchant integrates it, including Moulinex.**
> Moulinex (`01` §3.5) integrates the hardened MVP, not this. Everything in §6.1 depends
> on that: an offline queue and config caching are deferrable precisely because no real
> user is behind them. If that changes, revisit the cuts before writing code, not after.

### 6.1 What the POC proves

One path, both platforms, end to end:

```
anonymous id → resolve config → read reward → present sharing sheet
  → user shares → track interaction → ?confirmed=1 → install handoff
```

Both platforms from the start. Building one first would halve the work but defer the two
things most likely to be wrong: whether the API surface is genuinely symmetric (§9 of
`02`), and whether the fixture corpus (§1.6) actually catches divergence — neither of
which a single platform can demonstrate.

**Deliberately cut from v0.1**, each recoverable later without redesign:

| Cut | Why it can wait |
|---|---|
| Durable offline event queue (§7.1 of `02`) | fire-and-forget with no retry is wrong for production, fine for proving the call lands |
| Dual SWR config cache | fetch every time; caching is an optimisation over a working call |
| 4-tier copy precedence (§8.2b) | hardcode tier 4, the i18n default |
| Local reward-formatting fallback | server-preferred only; the fallback matters when offline, which is also cut |
| `trackPurchase` | a second endpoint of the same shape as `track/interaction` — proves nothing new |
| Warm WebView, seeded state, perf budget (§7) | optimisations against a baseline that does not exist yet |

**Not cut, because cutting them invalidates the result:** key derivation and signing
(§4 of `02` — a released binary cannot be retrofitted), the self-referral guard (§6.1 —
its absence corrupts the referral graph during testing), enqueue-time idempotency keys,
and version pinning plus the kill switch (`01` §1.5).

Being internal does not soften those four. Signing and version pinning are kept for the
same reason either way — they are the things a later binary cannot add retroactively, and
the POC binary is the first one that exists.

### 6.1b What internal-only does and does not relax

The security items split, because they were never all gating the same thing. `01` §3.2
now delegates identity security wholesale to
[`../identity-proof-of-possession/`](../identity-proof-of-possession/README.md), so the
item numbers below are that plan's §3, not `01`'s.

| Item | Internal POC | Why |
|---|---|---|
| identity `3.9` — make `track/*` resolve-only | **still blocking** | the one-request variant of the headline attack. Backend-only, no SDK dependency, and the widest hole open today |
| identity `3.1` — authenticate `merge/execute` | **still blocking** | no session macro at all today. `01` §3.2 already defers the `?fmt=` merge path until enforcement lands, so the POC cannot exercise merge regardless |
| identity `3.7` — raw-hex-address bypass | **still blocking** | any address string is accepted as proof of wallet identity, reachable from `/track/*`, which the POC does exercise |
| identity `3.2`/`3.3`/`3.4` — install-code ticket, attempt limiting, `order-client` | can follow | all are `anonymousId` harvesting oracles. Internal testers holding their own ids is not an exposure |
| `01` §3.3 — rate limiting SDK endpoints | can follow | protects against abuse at volume; a handful of internal devices generate none |

The three that stay blocking are blocking because they are **already exploitable in
production**, not because of anything the POC does. Internal scope cannot relax them.
Note `3.7` in particular: it is reachable from `/track/interaction`, which is squarely
inside the §6.1 loop, so the POC would be exercising a live bypass rather than merely
coexisting with one.

What internal-only genuinely buys: no merchant app-store review cycle, no merchant
release coordination, no support burden from a half-built SDK, and freedom to make
breaking API changes between POC and MVP without a deprecation window (§5.3) — which is
worth more than the two deferred security items.

### 6.2 Example apps are the harness, not a demo

A native SDK cannot be exercised without an app to host it. There is no equivalent of
opening a page against `sdk/core` — until a merchant app calls it, the SDK does not run.
The example apps are therefore **the only way to test the POC at all**, which is a
different role from `example/wallet-ethcc` demonstrating the JS SDK to a reader.

Place them at `example/native-android/` and `example/native-ios/`, following the existing
convention: `example/*` packages are `private: true` and listed in `.changeset/config.json`
`ignore`. Apply the same Biome and knip exclusions as `sdk/android` and `sdk/ios` (§5.2).

Each app should be the smallest thing that drives the loop in §6.1: a product screen with
a share button, an order-confirmation screen, and a deep-link entry point for inbound
`fCtx` — consuming the SDK through its **public API only**, exactly as a merchant would.
An example app reaching past the public surface stops being a test of the thing being
shipped.

They pay for themselves past the POC as the integration tier of §5.4's three-tier test
strategy, and as the reference integration the docs point at.

### 6.3 What the POC has to answer

The POC is finished when these are settled — all are currently assumptions:

1. **Does the `?confirmed=1` → `PostShareConfirmation` → install handoff chain survive a
   real device round-trip?** `01` §1.2b calls this out as silently fatal. It has never run.
2. **Does the custom-scheme return channel behave under interruption** — backgrounding
   mid-share, process death while the OS share sheet is up (`02` §6.2)?
3. **Is the hosted `/sharing` page fast enough behind a native sheet** on a low-end
   Android device? `02` §7 sets p75 < 400 ms but flags that the targets were set assuming
   Custom Tabs pre-rendering and must be re-measured on the `WebView` path. That
   measurement is the trigger for going native on the sharing screen — so it gates a real
   architectural decision, not just a perf number.
4. **Does cross-surface attribution actually resolve** — share from native, open in a
   mobile browser (`02` §8.5)? This is the common case and is currently unvalidated.
5. **Does the fixture corpus catch a real divergence?** Introduce a deliberate
   one-byte error in one platform's codec and confirm the suite fails. A fixture set that
   has never failed has not been shown to work.

Question 3 and question 5 are the two worth pausing for. Everything else is a bug to fix;
those two change the plan.

---

## 7. Sequencing

Ordered by what unblocks what. Every item here is strategy or packaging; feature phasing
stays in `02-native-sdk-overview.md` §11.

### Before either SDK starts

| # | Item | Why first |
|---|---|---|
| 1 | Identity plan §3.9, §3.1, §3.7 | live production vulnerabilities, independent of native. The rest of the identity §3 list follows before public release — see §6.1b |
| 2 | OpenAPI export (`01` §3.6) | generates models for both SDKs; cheap; blocks nothing else |
| 3 | Golden fixture corpus — codec, signing layout, reward formatting | the shared contract that replaces a shared core (§1.6); **shared with identity Phase 0**, see below |
| 4 | Maven Central Portal namespace + GPG signing | lead time on namespace verification; the real "never done this" gap (§3.2) |

Item 3 is the same work as **Phase 0 of
[`../identity-proof-of-possession/`](../identity-proof-of-possession/README.md)**, which
freezes the signed byte layout and commits fixtures for it. Whoever starts first should
own the corpus, its generator, and the per-platform loader for all three concerns rather
than building a second one — a native-only fixture set and an identity-only fixture set
would need reconciling later, and a released binary cannot be retrofitted (§5.3).

### The POC (§6)

| # | Item |
|---|---|
| 5 | `sdk/android/` + `sdk/ios/` placement, `biome.json` and `knip.ts` exclusions (§5.2) |
| 6 | `example/native-android/` + `example/native-ios/` — the only way to run the SDK (§6.2) |
| 7 | The §6.1 loop on both platforms, with §6.1's cuts applied |
| 8 | Fixture assertions wired into both native suites, proven by a deliberate injected failure (§6.3 q5) |
| 9 | Answer §6.3 — particularly the low-end Android perf measurement, which gates the hosted-vs-native sharing decision |

### Hardening to MVP

Only after §6.3 is answered. Restores what §6.1 cut and completes `02` §11's MVP scope.
This is the first stage a merchant sees, so it is where "before public release" bites.

| # | Item |
|---|---|
| 10 | Security items deferred from the POC — identity §3.2/§3.3/§3.4 and `01` §3.3 (§6.1b) |
| 11 | Independent versioning outside the Changesets linked group (§5.3) |
| 12 | Library-artifact CI jobs, reusing existing runners and secrets (§5.4) |

The API is free to break between POC and MVP — no external consumer exists yet, so §5.3's
deprecation discipline starts at MVP, not before. That freedom expires the moment
Moulinex integrates.

### After both SDKs reach v0.1 stability

| # | Item |
|---|---|
| 13 | RN TurboModule wrapper + first-party Expo config plugin (§4) |
| 14 | Flutter plugin, if merchant demand justifies it (§4.5) |

---

## 8. Open questions

1. **App Clips — two docs disagree.** `docs/ios-app-clips.md` ranks an App Clip for the
   install flow as **P0** ("eliminates 6-digit code, deterministic attribution, ~20-30%
   conversion lift"), while `02-native-sdk-overview.md` §11 excludes App Clips
   explicitly, superseded by the pasteboard plus `SKStoreProductViewController` flow.

   These may not actually conflict: `ios-app-clips.md` targets the **web → wallet** flow,
   where a Safari Smart App Banner can host the App Clip Card; the native SDK targets
   **merchant app → wallet**, where there is no browser to host that banner and app-to-app
   App Clip invocation is not a well-trodden path. That doc also notes Tauri 2.x has no
   first-class App Clip support, requiring a pinned Xcode project and a hand-maintained
   target.

   **Needs a decision from whoever owns both**: is the exclusion deliberate and
   flow-scoped, or was `ios-app-clips.md` overlooked? If deliberate, say so in both
   documents so the next reader does not re-open it.

2. **RN wrapper ownership.** §4.2 establishes this as a sustained recurring cost across
   three release trains, not a one-time build. Who owns it, and does that person also own
   the native SDKs? Both vendors who do this well have dedicated resources and still
   carry unresolved Expo bugs.

3. **Self-hosted macOS runner.** §5.4 — is the 10× GitHub billing multiplier worth
   pre-empting given the existing Hetzner runner pattern, or do we start hosted and move
   only if cost bites?

---

## 9. Sources

Industry research supporting §1–§4, gathered July 2026.

**Shared core:** RevenueCat KMP wrapper-pattern engineering post and KotlinConf 2025
talk (Joop Korteweg) · PostHog KMP SDK docs · Sentry KMP SDK docs ·
`amplitude/Amplitude-Kotlin#114` · Kotlin/Native ObjC interop docs · Touchlab, "The
Future of KMP's iOS Interop" · SKIE docs (Touchlab) · Kotlin 2.4 Swift Export docs
(Alpha) · JetBrains "Choosing a configuration for your KMP project" ·
`JetBrains/kotlin-native#2183` · RevenueCat `purchases-ios#6176`, `#5891` ·
`dropbox.tech` "The (not so) hidden cost of sharing code between iOS and Android" ·
`slack.engineering` "Client consistency at Slack: beyond LibSlack" ·
`twitter/twitter-text` conformance suite · `mozilla/uniffi-rs#2802` ·
`WalletConnect/walletconnect-monorepo#7185` · bitdrift, "Optimizing bitdrift's Rust
mobile SDK for binary size" · Stadia Maps / Ferrostar XCFramework packaging writeup ·
ReallyMe Crypto `PROVIDER_POLICY.md`

**Distribution:** CocoaPods maintenance-mode announcement and trunk read-only date ·
Flutter 3.44 SPM default · `central.sonatype.org` OSSRH EOL notice · Apple
`developer.apple.com/support/third-party-SDK-requirements/` · Apple privacy-manifest and
ITMS-91053 documentation · Firebase Dynamic Links deprecation FAQ · Branch, AppsFlyer,
Adjust public changelogs · `AppsFlyerSDK/appsflyer-react-native-plugin#281`

**React Native:** React Native release blog posts 0.80, 0.81, 0.82, 0.84, 0.85, 0.86 ·
`reactwg/react-native-new-architecture#68` · Expo config-plugin and CNG docs ·
`expo/config-plugins#123` · `AppsFlyerSDK/appsflyer-react-native-plugin#638` · Branch
Expo plugin support disclaimer · Expo SDK 54–57 release notes

**Versioning:** Sentry SDK breaking-changes playbook and API architecture docs · Braze
SDK version management docs

**CI:** GitHub Actions runner pricing docs · The Guardian, "Faster, cheaper, messier:
lessons from our switch to self-hosted GitHub Actions"
