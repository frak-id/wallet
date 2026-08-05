# Native SDK — building, shipping, and the ABI freeze

Two hand-written codebases, how they're distributed, how they fit the monorepo, and the decisions that must be taken before the first publish because they cannot be taken after.

## 1. Decision: two hand-written native codebases

No shared core — separate Kotlin and Swift, for v0.1 and the foreseeable roadmap.

- No SDK vendor ships shared core logic to third-party consumers: RevenueCat, PostHog and Sentry all wrap two independently maintained native SDKs; Amplitude has no KMP SDK at all.
- Kotlin/Native's generated Swift is not shippable to third parties — the Obj-C bridge loses exhaustive matching, cancellation and module structure that `FrakError`/`EstimatedReward` depend on.
- Binary size: each Kotlin/Native framework embeds its own runtime (~6–40 MB) against a 256 KB budget merchants pay for.
- Two Kotlin/Native (or Rust+UniFFI) runtimes in one app can collide at link time; pure Swift and pure Kotlin cannot.

Instead: golden fixtures as the cross-platform contract — see [`04-golden-fixtures.md`](./04-golden-fixtures.md). Revisit only if the shared deterministic surface exceeds ~1,000 lines *and* a drift bug reaches production despite the fixtures — then Rust+UniFFI, not KMP (`apps/wallet/src-tauri/plugins/` already has ~4,835 lines of first-party Rust, so the delta is packaging only).

Not greenfield on native: `apps/wallet/src-tauri/plugins/` already has 1,391 lines of Kotlin and 1,920 of Swift, including the OS share sheet, Play Install Referrer, WebAuthn and AppDelegate swizzling. The real gap is library distribution — Maven Central, SPM, XCFramework assembly, consumer ProGuard rules, semver on a binary a merchant has shipped.

## 2. Licence: Apache-2.0, for the native SDKs only

`sdk/{android,ios}/LICENSE`, diverging from the monorepo's GPL-3.0. GPL is a much harder ask for an artifact statically linked into a proprietary store binary. Apache-2.0 over MIT for the explicit patent grant (covers the identity proof-of-possession scheme) and trademark.

## 3. Distribution

**iOS — SPM only.** CocoaPods' trunk goes read-only 2 December 2026; SPM has no registry — resolution is a git URL plus a tag, publishing is `git tag`. Distribute as a binary XCFramework via `.binaryTarget`, remote zip and checksum. Three one-way doors, decided before v1:

- **Signing identity.** Xcode locks to the identity recorded on a merchant's first integration; sign with one stable team identity, **Apple Distribution**.
- **Binary URLs are immutable** — never re-upload or retag a tagged release; compute the checksum from the exact uploaded bytes, in CI.
- Validate `PrivacyInfo.xcprivacy` bundles in a real consumer app — AppsFlyer's manifest failed to bundle in their *static* SPM variant.

Our signature is verified at integration time only; it doesn't survive into the merchant's shipped app (re-signed at build, then by App Store Connect).

**Android — Central Publisher Portal.** OSSRH is decommissioned; target the native Portal API. Verified: `id.frak` is unclaimed, `frak.id` is on Route 53, so the apex TXT record can be written today. Budget half a day.

| Requirement | Detail |
|---|---|
| Namespace proof | apex TXT on `frak.id` with the Portal-issued key — not `_sonatype`, not a subdomain |
| GPG | public key on a keyserver, signed with a **primary** key |
| POM | name/description/url/licence/developer/scm |
| Javadoc jar | required by presence only — empty placeholder sanctioned |
| Checksums | `md5` + `sha1` mandatory |

Trap: clicking Verify before the TXT propagates caches `NXDOMAIN` for the TTL — `dig` first. Claim the namespace only once there's an artifact worth publishing.

**React Native, later and additive.** Build after both native SDKs reach v0.1 stability, never in parallel — it's a third release train (RN ships ~bimonthly, Expo three times a year). An Expo config plugin is mandatory day one: managed workflows silently wipe `<queries>`/`LSApplicationQueriesSchemes` on prebuild otherwise. Target New Architecture only (TurboModules). RN-first is not viable — the one RN-only attribution SDK in the field achieves it by dropping ATT, SKAdNetwork, Install Referrer and OS deep links.

## 4. Monorepo integration

No Turborepo — plain Bun scripts plus Changesets; native builds are new scripts and CI jobs, not pipeline entries.

`sdk/android/` and `sdk/ios/` are Gradle/SwiftPM projects with a `private: true` `package.json` that only dispatches to `scripts/run.sh` — keep them; they're excluded by name from `knip.ts`, `.changeset/config.json`, and `biome.json` instead. Example apps at `example/native-{android,ios}` follow the same rules.

The example apps consume the SDK the way a merchant does: Android via a Gradle composite build, iOS via a SwiftPM path dependency. Two traps found the hard way:

- Composite substitution matches on `project.group`; `frak-publish.gradle.kts` set `groupId` only inside the `MavenPublication` block, so substitution silently fell back to a Maven Central lookup. Fixed (`group = "id.frak"`) — the example's separate `dependencySubstitution` block still carries a comment asserting the old, now-false, state.
- SwiftPM path dependencies derive package identity from the last path component, not `Package.swift`'s `name:` — the correct spelling is `package: "ios"`, not `"FrakSDK"`.

Versioning is independent, outside the Changesets `linked` group — different registries, different cadence, and a merchant's binary freezes at store submission. Adopt an explicit deprecation policy before v1.0 (Sentry's 90-day dual-name window is the reference).

CI: `.github/workflows/tauri-mobile-release.yml` already has the macOS runner, signing secrets and OIDC — nothing there builds a library artifact yet. Needed: `.aar` + Portal publish, XCFramework assembly + SPM tagging, consumer ProGuard/R8 verification. Structure tests in three tiers (JVM logic on Linux, integration through the example apps, device-farm smoke nightly). GitHub bills macOS runners at 10×; the self-hosted Hetzner runner is the escape hatch.

Codegen owns the mechanical boundary — OpenAPI generates Kotlin/Swift *models*, not `FrakClient` itself.

## 5. ABI decisions before the first publish

These share one deadline — **the first publish of `id.frak:frak-sdk`**. After it, changing any of them is a breaking release for a binary already in the Play Store, not an edit.

**State of play: no binary-compatibility gate, no committed dump.** BCV was wired, dumps were committed, then both were removed deliberately — committing a dump *ratifies* the public shape. The gate returns once Q1–Q3 are answered. `explicitApi()` only forces you to *write* `public`; it detects nothing. The last dump was 509 lines for `frak-sdk`.

**Q1 — accept the `$default` constructor freeze, or move to builders?** Converting the promoted types from `data class` to plain classes removed `copy()`/`componentN()` but not the synthetic default-argument bridge, which encodes parameter count and a bitmask. Fifteen public types carry one; adding a field to any of them changes the signature, and a merchant binary compiled against today's SDK hits `NoSuchMethodError` against tomorrow's — unfixable by the merchant recompiling, since it's their shipped app that breaks.

| Option | Cost now | Cost later |
|---|---|---|
| A. Accept | zero | these 15 types can never gain a field |
| B. Builders | rewrite 10 types + tests | additive forever |
| C. Internal constructors + factories | smaller diff than B | additive, new overload per field |
| D. Keep the tree `internal` | reverts the promotion | UI module can't read its own config |

Recommendation: B for the config tree (most likely to grow); A is defensible for `FrakConfig`/`FrakMetadata` (merchant-authored, stable). Re-adding the dump without choosing silently picks A for everything.

**Q2 — was promoting ~51 properties ahead of a reader right?** Made public because `frak-sdk-ui`/`FrakSDKUI` is a separate module and can only see `public` API. Sound for what the sheet renders; not obviously true for all 51 (`PercentEncoding`, `environment`, `installPageUrl`). Alternative not taken: a `@RequiresOptIn` `@InternalFrakApi` marker excluded from the dump — weakens Q1 but is Kotlin-only, invisible to Java. Decide alongside Q1.

**Q3 — iOS: `init(from:)` is public API.** `FrakResolvedConfig.swift:105,153` are `public init(from decoder:)`, a side effect of the promotion. The `Decodable` conformance can never be removed once public, and Swift has no ABI dump to catch it. Fix: move the conformance to an internal wire type before publication. One of the two inits is the hand-written forgiving one that fixed the `translations` regression — that one must stay, `internal`-or-better but not necessarily `public`.

**Q4 — `FrakLogSink` divergence.** Shipped knowingly divergent: `fun interface` vs `protocol: Sendable`; a throwing sink is swallowed on Android and brings down the host process on iOS. Not a blocker, but the same integration is crash-safe on one platform and not the other. If unintended, iOS is the side to change.

**Q5–Q7 — member contracts, surfaced by the example apps.**

- Q5: no written error-model rule across 15 members (throw vs return-result vs null). Not recommended: unify all onto `FrakResult` (bigger break, smaller gain).
- Q6: `buildLink` returns `String?` for four different failure reasons that need opposite caller responses. Either `FrakResult<String>` (shape change, before the freeze) or a distinct warning log per path (non-breaking, can land later). `installUrl`/`installPageUrl` share the flaw at lower stakes.
- Q7: no per-product reward lookup — `rewards.best` is per-context only. Additive fix (`bestByProduct(products:)`) needs a backend shape change; sealing `FrakClient` made adding it safe after the freeze, but the decision belongs now.

| Q | State |
|---|---|
| `FrakClient` growth hazard | resolved — sealed concrete class, five namespaces |
| Q1 `$default` freeze | open |
| Q2 `@InternalFrakApi` vs promote | open |
| Q3 public `init(from:)` on iOS | open |
| Q4 `FrakLogSink` divergence | open |
| Q5 error-model rule | open |
| Q6 `buildLink` null-vs-result | open, shape change |
| Q7 per-product rewards | open, additive but needs a backend shape |

## 6. Sequencing and status

**Done.** OpenAPI export hardened, golden fixtures generated and loaded on both platforms, the SDK surface built, both example apps wired to the real SDK (composite build / path dependency) against a real merchant id, and a first end-to-end run on a physical Android device (initialize, wallet-installed probe, `config.resolve`, `rewards.best`).

Checkable rather than assumed — the example links the real artifact, not a shim:

```bash
unzip -p app-debug.apk classes3.dex | strings | grep -o "Lid/frak/sdk/[A-Za-z]*Api;"
# Lid/frak/sdk/{AppLink,Config,Rewards,Sharing,Tracking}Api;
```

**Next, in order:**

1. Answer Q1–Q7, then re-wire BCV and commit the dumps — everything ABI-shaped is blocked on this.
2. Swift 6 mode in `Package.swift`, run Android Lint (never executed once), an iOS device/simulator pass to match Android's.
3. CI jobs and publish paths (§3, §4) — gated on both SDKs having run on a device. Android has, iOS has not.
4. The correctness waves in `06-open-findings.md`, both platforms per PR.
5. Drive the remaining validation questions below through the harnesses.
6. RN TurboModule wrapper + Expo config plugin; Flutter if merchant demand justifies it.

What's built so far is internal only — no merchant integrates it, Moulinex included. That freedom to break the API ends the moment Moulinex integrates.

**Still unanswered** — only the example apps can exercise these, through the SDK's public API only:

1. Does `?confirmed=1` → `PostShareConfirmation` → install handoff survive a real round trip? Never run.
2. Does the custom-scheme return channel behave under interruption (backgrounding mid-share, process death while the OS chooser is up)?
3. Is the hosted `/sharing` page fast enough behind a native sheet on a low-end Android device? Gates an architectural decision (`03-sharing-and-install.md` §3), not a number.
4. Does cross-surface attribution resolve — share from native, open in a mobile browser?
5. Does the fixture corpus catch a real divergence? Introduce a deliberate one-byte error in one platform's codec and confirm the suite goes red — until that's run, the corpus is an assumption.

Questions 3 and 5 are worth pausing for; the rest are bugs to fix.

**Open ownership questions:** who owns the RN wrapper's recurring cost across three release trains; whether to pre-empt the 10× macOS billing multiplier with the Hetzner runner; and whether `docs/ios-app-clips.md` (App Clip P0 for *web → wallet*) conflicts with this plan's exclusion (scoped to *merchant app → wallet*, no Safari banner to host a Card) — probably not, but whoever owns both should say so in both documents.
