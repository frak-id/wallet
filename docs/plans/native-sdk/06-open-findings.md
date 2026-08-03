# Native SDK — open findings

Merged register of the two full audits of `sdk/android` and `sdk/ios` (round 1 over the
first tree, round 2 at `51d923ded`), re-verified against the current code. **Only what is
still open or partial is listed.** Closed findings are summarised in §4 and not itemised —
git history has them.

Both audits were static: no toolchain ran. So was the re-verification. Ids are kept from
the original documents (`B*/S*/C*/N*/A*/D*/T*` from round 1, `2.x/3.x/4.x/5.x/8.x` from
round 2) so older commit messages and review notes still resolve.

**Scorecard:** 119 findings tracked, 22 fixed, 13 partial, 84 open.

## 0. The two structural lessons

Worth more than any individual row.

1. **The same bug is almost always on both platforms.** The port is faithful; the holes
   are in the *shared design* and got copied twice — backoff bypassed on a cold cache,
   `configUpdates` never firing from revalidation, the queue growing exactly while it
   cannot drain, identity minted on the main thread. Per-platform review does not find
   these. A shared spec plus shared fixtures does. Fix them **both platforms, one PR**.
2. **Docs drift ahead of the code faster than anyone expects.** Round 2's third headline
   was a list of doc claims that had silently become false. Correct prose when the code
   moves, not in a batch.

A third, learned while remediating: a passing suite can prove nothing. Android's tracker
tests run the detached drain inline under `UnconfinedTestDispatcher`, so they pass
identically against the *unfixed* code.

## 1. Blocking the first publish

ABI-irreversible or verification-blocking. Everything else can ship late.

| Id | Finding | Evidence |
|---|---|---|
| A1 / 1.6 | **No binary-compatibility gate, no committed `.api` dump.** BCV was wired then removed on purpose while the shape is unfrozen (`buildSrc/…/frak-publish.gradle.kts:10`). `FrakConfig` and `FrakClient` have gained members since, each a silent ABI change. Blocked on the Q1–Q7 decisions in `05-build-and-release.md` §5 | `find sdk/android -name '*.api' -not -path '*/build/*'` → nothing |
| A3 / D7 | **`FrakConfig` is a 9-parameter constructor with defaults and no builder.** The synthetic `$default` bridge encodes the parameter count, so adding a field is a `NoSuchMethodError` for an already-shipped merchant binary. Three parameters have been added since the finding | `core/FrakConfig.kt:74-89` |
| A4 / A5 | **Error taxonomy.** Every internal bug surfaces as `FrakError.Decoding`; there is no `Internal` arm, `FrakError` is not `Equatable`/`equals`, and a backoff refusal arrives as `Network(ISE("backing off"))` | `DefaultFrakClient.kt:327`, `Core/FrakError.swift:4` |
| S6 / C7 | **No consent handle and no shutdown.** `trackingEnabled` is an immutable constructor `val`; there is no `setTrackingEnabled`, no `shutdown()`, no scope cancellation. Consent withdrawal and GDPR erasure are unimplementable, and tests cannot clean up | `FrakConfig.kt`, no `shutdown` on either platform |
| 4.5 | **`anonymousId` is a synchronous property that mints identity on the main thread.** Making it `suspend`/`async` is a breaking change afterwards | `FrakClient.kt:26`, `DefaultFrakClient.swift:60` |
| B4 / B5 / 1.5 | **iOS declares `swift-tools-version: 5.9` but uses Swift 6-only syntax** (`isolated (any Actor)? = #isolation`), and no target sets `swiftSettings`. Consumers compile in Swift 5 mode, which hides real errors — e.g. `HTTPClient: Sendable` holding a non-`Sendable` `NoRedirectDelegate`. Swift 6 is verified only by `scripts/run.sh` | `Package.swift:1`, `Core/FrakCall.swift:6`, `Net/HTTPClient.swift:17` |

## 2. Deliberate deferrals

Open, tracked, and knowingly not being worked.

| Id | Finding | Why deferred |
|---|---|---|
| B3 / 1.1 | No publish path on either platform — `publishToMavenLocal` only; `do_xcframework()` prints "NOT IMPLEMENTED" | Publishing lands once the SDKs have run on a device (`05-build-and-release.md` §6) |
| B3 / 1.2 | No CI job builds, tests or lints either SDK. Android Lint has never executed once | Same gate. Consequence: **every green claim in this folder is a human running a command once** |
| T3 | No automated device/simulator coverage; no `androidTest` source set. One manual Android device run (config + rewards) is the only on-device evidence that exists, and iOS has none | Same gate |

## 3. Open by area

### 3.1 Security & privacy — nothing here is closed

| Id | Finding | Evidence |
|---|---|---|
| S1 / 3.5 | iOS logs every value at `privacy: .public`, including the anonymous id (a declared Linked `DeviceID`) — widening the *merchant's* privacy envelope | `Core/FrakLogger.swift:59-65` |
| S2 | Raw backend response bodies logged at ERROR on both platforms | `config/ConfigStore.kt:142`, `Config/ConfigStore.swift:128` |
| S3 / 3.6 | Android's backup exclusion is **inert** — `frak_data_extraction_rules.xml` is referenced by nothing in the manifest — and there is no `full-backup-content` for API 24–30. iOS has no exclusion at all, and the event-queue file sets no protection class | `AndroidManifest.xml`, `EventQueue.swift:145,165` |
| S4 | iOS keeps the resolve cache in Preferences rather than Caches and sets no `NSURLIsExcludedFromBackupKey` | `Config/KeyValueStore.swift` |
| S5 / 3.7 | Unbounded response-body read on both platforms — no size cap, no `Content-Length` check. On Android the body is then persisted verbatim into `SharedPreferences` | `net/HttpClient.kt:122`, `Net/HTTPClient.swift:138` |
| S7 | `FrakEnvironment.Custom` performs no scheme validation — cleartext and `file:` are reachable | `core/FrakEnvironment.kt:32-38` |
| 3.2 | Android does not check an inbound `fCtx`'s `merchantId` against the SDK's own before tracking an arrival; the V1 self-referral bypass is unchanged | `DefaultFrakClient.kt:185-202` |
| 3.3 | iOS software-key fallback writes the **raw P-256 private scalar** into a backed-up plist, behind a class comment claiming it "stores a key reference, not the key itself". No simulator-only guard | `Identity/DeviceKey.swift:88` |

### 3.2 Correctness

| Id | Finding | Evidence |
|---|---|---|
| C3 / 2.4a | **`configUpdates` never fires from background revalidation** — the SWR mechanism is invisible to its only consumer. Both platforms. Decide the API shape before fixing | `config/ConfigStore.kt:147-166` |
| C4 | Lost update on `configUpdates` across the `await`; no monotonic sequence guard | `DefaultFrakClient.kt:103`, `.swift:97` |
| 2.6 | The event queue is bounded on **read only**, so it grows without limit exactly while backoff is armed and it cannot drain. Both platforms | `EventQueue.kt:79-82,129`, `EventQueue.swift:63,115-131` |
| 2.7 | *Partial.* The read/compact lock window is closed; reconciliation still keys on `idempotencyKey` rather than an SDK-owned row id | `InteractionTracker.kt:139`, `.swift:177` |
| 2.10 | Empty strings survive decode on iOS and become null on Android | `net/JsonReader.kt:25`, `Config/FrakResolvedConfig.swift:109-119` |
| 2.11 | *Partial.* `trackingCall` still does not route through `frakCall`'s error boundary | `DefaultFrakClient.kt:274-281` |
| N1 | Money is `Double` on both platforms, with no finiteness check | `rewards/Rewards.kt:8`, `Rewards/Rewards.swift:7` |
| N2 | Two different percent-encoders on the wire — Android a strict RFC 3986 allowlist, iOS `URLComponents` plus a manual `+` patch | `net/HttpClient.kt`, `Net/HTTPClient.swift:155-162` |
| N3 | *Partial.* iOS now tolerates a malformed array element; Android's `objectArray` still lets a failing element kill the whole response | `net/JsonReader.kt:71-82` |
| N4 / 5.7 | Timeouts contradict each other: connect 10 s + read 15 s = 25 s against a 20 s overall deadline (Android); three overlapping mechanisms on iOS | `net/HttpClient.kt:158-162`, `HTTPClient.swift:41-44` |
| N5 | A 204/205/304 is misread as a transport failure and retried (Android) | `net/HttpClient.kt:121` |
| N6 | Retries are too broad and immediate — any `IOException`/`URLError`, no delay, no jitter | both HTTP clients |
| N7 | Clock skew can pin the config cache as fresh forever; no `fetchedAt > now` clamp | `ConfigStore.kt:61`, `.swift:63` |
| N8 | iOS session accepts and replays cookies for the process lifetime | `Net/HTTPClient.swift:40-45` |
| — | **The load deadline is not cancelled on a manual share/copy.** Tap Copy while the page is still loading and the 1.5 s tier-3 deadline later raises a second OS chooser; on iOS it also closes the sheet. Both platforms | found post-audit, unfixed |
| — | **Android `resetAnonymousId()` can silently fail to erase.** `AnonymousIdStore.reset()` wraps `keyStore.delete()` in `runCatching`, so a throwing `deleteEntry` leaves the identity alive while the queue is purged on the assumption it rotated | found post-audit, unfixed |

### 3.3 Public API / DX

| Id | Finding | Evidence |
|---|---|---|
| A2 | Sealed/enum hierarchies make an exhaustive `when`/`switch` a consumer break | `FrakError`, `FrakEnvironment`, `RewardTier`, … |
| A6 | Android `Frak.client` throws from a property getter; neither platform has `clientOrNull` | `Frak.kt:101` |
| A7 | The Android surface is Java-hostile — everything `suspend`, no `@JvmOverloads`, no callback bridge. The namespace split made a targeted fix *possible*, not delivered | `FrakClient.kt` |
| A8 | `NotInitialized` / `TrackingDisabled` / `AlreadyPresenting` are `object`s whose single stack trace is captured at class init | `core/FrakError.kt:12,46,53` |
| A9 | Public reward models have identity equality and no `toString` (Android) | `rewards/Rewards.kt` |
| D2b | *Was D2, now residue.* Both harnesses compile against the real SDK and one has run on a device, but **neither has exercised the sharing sheet, the install handoff or an inbound deep link** — so nothing proves the sheet renders or that the intent filter fires | `example/native-{android,ios}` |
| D3 | *Partial.* `FrakLogSink` is public, but **no request is logged at any level** — no URL, status or duration — and there is no transport-injection seam | both HTTP clients |
| D4 | No merchant test seam beyond `FrakEnvironment.Custom`; all injection points are `internal` | both platforms |
| D5 | A typo in `targetInteraction` fails silently — free `String`, no constants, no validation | `RewardsApi.kt:35` |
| D6 | `forceRefresh` does not force a config refresh; `fetchRewards` hardcodes `forceRefresh = false` | `DefaultFrakClient.kt:289`, `.swift:301` |
| A7b | **Parity: `bestReward` is seeded into the iOS sheet and not the Android one, and Android tracks `Interaction.Sharing()` where iOS does not.** Pre-existing, surfaced while cataloguing the UI's use of the client | `frak-sdk-ui` vs `FrakSDKUI` |
| Q4 | `FrakLogSink` diverges deliberately: a throwing sink is swallowed on Android and **brings down the host process** on iOS. Cheaper to change before publication | decision recorded in `05-build-and-release.md` §5 Q4 |

### 3.4 Performance

| Id | Finding | Evidence |
|---|---|---|
| 4.2 | iOS `EventQueue` is a plain `actor` doing blocking file I/O on the cooperative pool | `Tracking/EventQueue.swift:59` |
| 4.4 | O(N) disk + JSON per tracked event, i.e. O(N²) per session — the whole file is read on every flush, twice | `EventQueue.kt:68`, `InteractionTracker.kt` |
| 4.6 | Rewards cache and `Backoff.state` never evict | `RewardRepository.kt:19,113`, `.swift:22,103` |

### 3.5 Simplification — mostly deletion

| Id | Finding |
|---|---|
| 5.1 | `ConfigStore` is a per-key state machine (4 maps + a sub-flight) with exactly one key |
| 5.2 | iOS `SingleFlight` is still a ~120-line actor with a `Waiter` class where a struct on the owning actor would do |
| 5.3 | *Partial.* iOS dropped `runOrRecordFailure`; Android still passes a non-reentrant `Mutex` as a parameter (**C6**) |
| 5.4 | `ConfigStore` and `RewardRepository` are the same 40 lines twice, per platform — no `CachedEndpoint<T>` |
| 5.5 | *Partial.* The convention plugin owns `android {}`; the `kotlin {}` block is still duplicated per module |
| 5.6 | Duplicated primitives inside each platform — UUID regex, `UUID_BYTES`, hex helpers in both `ProofCodec` and `FrakContextCodec` |
| 5.8 | *Partial.* Most dead code deleted; `resetForTesting()` still on iOS |

Smaller open items from the round-2 best-practice pass that are worth doing in the same passes: `resourcePrefix`
unset on `frak-sdk-ui`; `FrakEnvironment.Custom` inheriting **dev** wallet package id and
scheme defaults; iOS `SharingSheetModel.release()` not cancelling the prepare task (a naive
fix here is wrong — `.onDisappear` also fires when `UIActivityViewController` covers the
sheet, so it reports a successful share as `.dismissed`; the real fix needs a device); a
fixed 480 pt iOS sheet with no `presentationDetents`; `NativeShare.share()` can still hang
if a presentation is accepted then torn down.

### 3.6 Tests

| Id | Finding |
|---|---|
| T4 / 8.1 | **`golden-rewards.json` is loaded by nobody.** `GoldenFixtures.REWARDS` / `.rewards` are declared and never used; reward decoding is asserted against hand-written literals on both platforms. This is the largest corpus in the repo asserting nothing |
| T2 / 8.8 | Android's `Frak` facade is entirely untested (iOS has `FrakTests.swift`) |
| T5 | iOS asserts "some `FrakError`" where Android asserts the case |
| T6 / 8.4 | Real sleeps: 17 `Task.sleep` calls sequence the iOS concurrency tests; `HttpClientTest.kt:99` parks an IO thread for 10 s |
| T7 | Parity divergences: iOS backoff clock ignores the injected `now()`; persisted `fetchedAt` is millis on Android and a `Date` on iOS |
| 8.2 | *Partial.* `SharingSheetLogic` is extracted and tested; the 287-line `SharingSheetModel` and all of `SharingWebView` have zero executed coverage |
| 8.5 | *Partial.* iOS has `PersistedDeviceKeyStoreTests`; the real Android keystore is untestable on the JVM and untested |
| 8.3, 8.6, 8.7, 8.9, 8.10 | A guard that cannot fail (`FrakContextCodecTest.kt:42-46`); no iOS redirect/cache/`Accept-Encoding` assertions; `Base64URL`/`Hex` used as an oracle with no tests of their own; no concurrent-queue-writer test on either platform; housekeeping |

### 3.7 The largest un-pinned surface

Not a bug — the highest-leverage structural gap. **There is no golden corpus for URL query
editing, gap-fill and attribution merge**: ~230 lines hand-ported three ways
(`queryParams.ts` / `UrlQuery.kt` / `URLQuery.swift`, plus `mergeAttribution` /
`AttributionParams.kt` / `SharingLinkBuilder.swift`) encoding case-insensitive `fCtx`
lookup, tolerant percent-decoding, "never re-encode the merchant's URL", empty-value
skipping and a seven-field precedence rule. Drift there silently mis-attributes revenue and
no test on any platform would notice. `golden-sharing-links.json` would close it the way
`golden-context.json` closed the codec. The resolve-response decoder is the second
candidate — it has already produced two real divergences (2.10, and block-level
forgiveness).

## 4. Closed, for the record

Fixed and verified in the current tree: Android `SingleFlight` re-entrancy (**B1**) and
blocking I/O on the caller's thread (**B2**); the licence, now Apache-2.0 (**B6/1.3**); the
iOS privacy manifests on both targets (**1.4**); iOS `SingleFlight` cancellation and
join-after-completion (**C1/C2**); the `revalidating` cancellation leak (**C5/2.4b**); the
shared 2-slot dispatcher, now split 2 disk / 4 network (**C8/4.1**); the config tree being
invisible to the UI module (**D1**) and un-round-trippable through equality (**A10**);
both sharing sheets misreading a failed load as ready (**2.1/2.2**); backoff bypassed on a
cold cache (**2.3**); the startup drain ignoring `trackingEnabled` (**2.5**); an iCloud
restore bricking identity (**2.8**); iOS dropping a rewards response over an absent `tiers`
(**2.9**); the WebView starting arbitrary activities (**3.1**); `signProof` having no
production caller (**3.4**); `track()` awaiting the whole backlog (**4.3**); the doc-claim
corrections (**T8/7**); and the first concurrency tests for `SingleFlight` (**T1**). Closed by rewiring the example apps: **D2** (both harnesses were stubs of an API shape that never shipped), plus four defects only a real integrator found — Kotlin's `handleReferral` able to throw where Swift structurally cannot, the invisible throwing tier (`@Throws`), four KDoc links pointing at members the reseal deleted, and a `frak-publish` `groupId` set only inside the publication so composite substitution silently failed.

Two regressions that the remediation itself introduced are worth remembering, because both
looked local: making `ResolvedPlacement.translations` non-optional on a *synthesized*
`Decodable` type made the backend's routine omission drop **every** placement; and
detaching the tracking drain (4.3) widened 2.7's window and silently deleted iOS's drain
coalescing.

One lesson from the rewiring belongs with those: **three review passes missed the dead KDoc links because they swept `docs/` and the READMEs, not doc comments inside `src/main`** — the surface merchants actually read in autocomplete.
