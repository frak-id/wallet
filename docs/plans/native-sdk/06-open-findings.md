# Native SDK — open findings

Register of open findings from two audits of `sdk/android`/`sdk/ios` (round 1 over the first tree, round 2 at `51d923ded`), re-verified against the current code. Only what is still open or partial is listed; closed findings are one line each in §4. Ids are kept from the original documents (`B*/S*/C*/N*/A*/D*/T*` from round 1, `2.x/3.x/4.x/5.x/8.x` from round 2) so commit messages and review notes still resolve. Both audits were static — no toolchain ran, and neither did the re-verification.

## 1. Blocking the first publish

ABI-irreversible or verification-blocking. Everything else can ship late.

| Id | Finding | Evidence |
|---|---|---|
| A1 / 1.6 | No binary-compatibility gate, no committed `.api` dump. `FrakConfig` and `FrakClient` have gained members since. Blocked on the Q1–Q7 decisions in `05-build-and-release.md` §5 | `buildSrc/…/frak-publish.gradle.kts:14` |
| A3 / D7 | `FrakConfig` is a 9-parameter constructor with defaults and no builder — the synthetic `$default` bridge makes adding a field a `NoSuchMethodError` for an already-shipped merchant binary. Three parameters added since filing | `core/FrakConfig.kt:74-89` |
| A4 / A5 | Error taxonomy: every internal bug surfaces as `FrakError.Decoding`; no `Internal` arm, not `Equatable`/`equals`, a backoff refusal arrives as `Network(ISE("backing off"))` | `DefaultFrakClient.kt:404`, `Core/FrakError.swift:4` |
| B4 / B5 / 1.5 | iOS declares `swift-tools-version: 5.9` but uses Swift 6-only syntax; no target sets `swiftSettings`. Consumers compile in Swift 5 mode, hiding real errors. Verified only via `scripts/run.sh` | `Package.swift:1`, `Core/FrakCall.swift:6` |

Closed this pass, both platforms: S6a (tracking-consent kill switch on `FrakClient`, backed by a persisted `TrackingConsent`) and S6b (`Frak.shutdown()` on the facade only). See §4.

## 2. Deliberate deferrals

Open, tracked, and knowingly not being worked.

| Id | Finding | Why deferred |
|---|---|---|
| B3 / 1.1 | No publish path on either platform — `publishToMavenLocal` only; `do_xcframework()` prints "NOT IMPLEMENTED" | Gated on a device run, `05-build-and-release.md` §6 |
| B3 / 1.2 | No CI job builds, tests or lints either SDK; Android Lint has never executed once | Same gate. Every green claim in this folder is a human running a command once |
| T3 | No automated device/simulator coverage, no `androidTest` source set. One manual Android device run is the only on-device evidence; iOS has none | Same gate |

## 3. Open by area

### 3.1 Security & privacy

| Id | Finding | Evidence |
|---|---|---|
| S3 / 3.6 | Partial. iOS fixed — `EventQueue` sets `.completeUntilFirstUserAuthentication` on creation and after every compaction. Android still inert — backup-exclusion XML files exist, but a library can't wire itself into a merchant's `<application>`; documented in `sdk/android/README.md`, does nothing until a merchant applies it | `AndroidManifest.xml`, `Tracking/EventQueue.swift:266-267` |
| S4 | iOS keeps the resolve cache in Preferences, not Caches, with no backup exclusion. A per-read xattr mitigation was tried and reverted — `cfprefsd` reallocates the inode on every flush, so the exclusion doesn't survive the next write. Needs an SDK-owned, backup-excluded directory set at creation, the same shape as S3's iOS fix | `Config/KeyValueStore.swift` |
| S5 / 3.7 | Partial. Unbounded response-body read, no size cap. Android fixed — `readBytesUpTo` aborts incrementally past 1 MiB. iOS: a streaming rewrite was tried and reverted (`session.bytes(for:)` is ~100k suspensions per response) — stays on a pre-check plus post-buffer cap, so peak memory during the read is unbounded | `net/HttpClient.kt:239-260`, `Net/HTTPClient.swift:233-258` |
| 3.2 | Partial. V2 `fCtx` merchantId check fixed on both platforms (case-insensitive, fails open only when no config is available yet). V1 contexts carry no `merchantId` field at all — unfixable the same way; a V1 link from any merchant still tracks as this merchant's arrival | `applink/ReferralArrival.kt:28-43` |
| 3.3 | iOS software-key fallback writes the raw P-256 private scalar into a backed-up plist, behind a class comment claiming it stores a key reference. No simulator-only guard | `Identity/DeviceKey.swift:88` |
| S10 | Consent-decision durability is undefined on Android: `SharedPreferences.apply()` is async, so a withdrawal lost to a process kill reverts to enabled on next launch. Its survival across a device transfer depends on the S3 integration step most merchants haven't taken. iOS has no such fork — no backup exclusion at all (S4), so a denial always survives a restore. No test pins either | `config/KeyValueStore.kt:34-43` |
| S11 | Sharing WebView URL puts `clientId` in a query string; nothing in `frak-sdk-ui`/`FrakSDKUI` reads `TrackingConsent`. Fails closed today only because `anonymousId()` returns null once consent is withdrawn — no second guard | `frak-sdk-ui`, `FrakSDKUI` |

Closed/decided: S1, S2, S7 (round-1 security — §4). S6c is recorded as a process decision, not a code gap: backend-held data erasure goes through the published `frak.id/account-deletion` route; no `clientId`-keyed DSR API is planned. S9 — `trackingEnabled` no longer gates config/rewards reads, which carry no identifier; tracking entry points stay gated.

### 3.2 Correctness

| Id | Finding | Evidence |
|---|---|---|
| N4 / 5.7 | Partial, closer to closed. Android budget fixed (connect/read 3s/5s inside a 20s deadline). iOS collapsed to one authoritative mechanism (`Deadline.run`, 20s), with `timeoutIntervalForRequest`/`Resource` raised to a 60s backstop that can't fire first. Three mechanisms still exist, but they no longer compete for a budget | `net/HttpClient.kt:295-310`, `Net/HTTPClient.swift:47-73` |
| — | Load deadline isn't cancelled on a manual share/copy — tapping Copy while the page is still loading later raises a second OS chooser (also closes the sheet on iOS). Both platforms, found post-audit, unfixed | — |
| — | `SharingPageAction.Install` has no in-flight guard, unlike `share`/`copy`, which both carry one for exactly this reason (the hosted page's footer stays enabled across the native round trip). Two rapid install taps run two `installPageUrl` fetches and race each other's navigation on the shared web view. Both platforms | `SharingSheetState.kt` / `SharingSheetModel.swift`, the `.install` case |
| — | iOS `SharingWebView`'s two `decidePolicyFor` overloads "nearly match" `WKNavigationDelegate` — the SDK now types the decision handlers `@escaping @MainActor @Sendable`, the code does not, so they are not static conformance witnesses and are reached by ObjC selector dispatch alone. Compiles with a warning today and works in every other project that hits it, but the whole outbound channel rides on it. `@preconcurrency import WebKit` does not silence it. Verify on the first simulator pass, then match the signature | `Sources/FrakSDKUI/SharingWebView.swift` |
| — | Android does not reset `SharingWebViewHandle.documentReady` in `onRenderProcessGone`, so an idle pooled view whose renderer was reclaimed still reports a finished document and the next sheet activates by fragment into a dead renderer, skipping its skeleton. Fixed on iOS (`webViewWebContentProcessDidTerminate`), open on Android | `SharingWebView.kt` |

2.6 and 4.4 closed (§4).

### 3.3 Public API / DX

| Id | Finding | Evidence |
|---|---|---|
| A2 | Sealed/enum hierarchies make an exhaustive `when`/`switch` a consumer break | `FrakError`, `FrakEnvironment`, `RewardTier` |
| A7 | Android surface is Java-hostile — everything `suspend`, no `@JvmOverloads`, no callback bridge. The namespace split made a targeted fix possible, not delivered | `FrakClient.kt` |
| D2b | Both harnesses compile against the real SDK and one has run on a device, but neither has exercised the sharing sheet, the install handoff or an inbound deep link | `example/native-{android,ios}` |
| D3 | Partial. Request logging lands on both platforms (method/host/path/status/duration, never the query string or a header value). Transport-injection points remain `internal`, so a merchant can't substitute a fake transport — overlaps D4 | `net/HttpClient.kt:39,154-163` |
| D4 | No merchant test seam beyond `FrakEnvironment.Custom`; all injection points `internal` | both platforms |
| D5 | Typo in `targetInteraction` fails silently — free `String`, no constants, no validation | `RewardsApi.kt:35` |
| Q4 | `FrakLogSink` diverges deliberately — a throwing sink is swallowed on Android and brings down the host process on iOS. Cheaper to change before publication | decision recorded in `05-build-and-release.md` §5 Q4 |

### 3.4 Performance

| Id | Finding | Evidence |
|---|---|---|
| 4.2 | Accepted with rationale, not fixed — iOS only. `EventQueue` actor does synchronous file I/O on the cooperative pool; making it `async` reopens the interleaving window 2.7 closed, and the alternative (`SerialExecutor`) needs a deprecated iOS-15-floor API. What's blocked is bounded and short (≤1100 lines). Android unaffected — off-thread I/O free from `withContext` | `Tracking/EventQueue.swift` |
| 4.6 | Partial. Both caches evict opportunistically (on insert/read), not on a schedule — a process that stops calling in, or a key that fails once and is never retried, keeps its last entries for the process lifetime. No periodic sweep, no size cap | `RewardRepository.kt:141`, `Backoff.kt:30,51` |

### 3.5 Simplification — mostly deletion

| Id | Finding |
|---|---|
| 5.1 | `ConfigStore` is a per-key state machine (4 maps + a sub-flight) with exactly one key |
| 5.2 | iOS `SingleFlight` is a ~120-line actor with a `Waiter` class where a struct would do |
| 5.3 | Partial. iOS dropped `runOrRecordFailure`; Android still passes a non-reentrant `Mutex` as a parameter (C6) |
| 5.4 | `ConfigStore` and `RewardRepository` are the same 40 lines twice, per platform — no `CachedEndpoint<T>` |

5.8 withdrawn — `resetForTesting()` is `internal`-only and genuinely exercised by four tests; not dead code.

Smaller open items: `FrakEnvironment.Custom`/`.custom` still default to Frak's internal dev wallet package id/scheme when a merchant doesn't override (overriding was added, the no-arg default wasn't changed); a fixed 480pt iOS sheet with no `presentationDetents`; `NativeShare.share()` can still hang if a presentation is accepted then torn down.

### 3.6 Tests

| Id | Finding |
|---|---|
| T8 | Neither test suite compiled on `3bf9bcf4d`. Android: a parameter reorder silently rebound 9 trailing lambdas onto the wrong parameter. iOS: a literal `\u2014` in a string broke the whole target's parse. Both introduced by the same commit, both fixed — direct evidence for B3/1.2, since "green" here has only ever meant a human running a command once |
| T9 | Two tests were passing vacuously; one still is. (a), (b) fixed — a fixture-decode mismatch and a stale-assertion ordering. (c) still vacuous: `"flush survives a failed migration rewrite"` can't fail — its read-only-parent-directory setup blocks the deletion it's checking for, so it passes by OS permission, not by the code under test. The invariant is genuinely pinned, but by `EventQueueTests`, not this one |
| T2 / 8.8 | Android's `Frak` facade is entirely untested (iOS has `FrakTests.swift`) |
| T5 | iOS asserts "some `FrakError`" where Android asserts the case |
| T6 / 8.4 | 21 real `Task.sleep` calls sequence the iOS concurrency tests; `HttpClientTest.kt:166` parks an IO thread for 10s |
| T7 | Parity: iOS backoff clock ignores the injected `now()`; persisted `fetchedAt` is millis on Android and a `Date` on iOS |
| 8.2 | Partial. `SharingSheetLogic` is extracted and tested; the 287-line `SharingSheetModel` and all of `SharingWebView` have zero executed coverage |
| 8.5 | Partial. iOS has `PersistedDeviceKeyStoreTests`; the real Android keystore is untestable on the JVM and untested |
| 8.3, 8.6, 8.7, 8.9, 8.10 | A guard that cannot fail (`FrakContextCodecTest.kt:42-46`); no iOS redirect/cache/`Accept-Encoding` assertions; `Base64URL`/`Hex` used as an oracle with no tests of their own; no concurrent-queue-writer test on either platform; housekeeping |

2.7 closed (§4).

### 3.7 The largest un-pinned surface

Not a bug — the highest-leverage structural gap. No golden corpus for URL query editing, gap-fill and attribution merge: ~230 lines hand-ported three ways (`queryParams.ts`/`UrlQuery.kt`/`URLQuery.swift`, `mergeAttribution`/`AttributionParams.kt`/`SharingLinkBuilder.swift`), encoding a case-insensitive `fCtx` lookup, tolerant percent-decoding, "never re-encode the merchant's URL", empty-value skipping and a seven-field precedence rule. Drift there silently mis-attributes revenue and no test on any platform would notice. `golden-sharing-links.json` would close it the way `golden-context.json` closed the codec. The resolve-response decoder is the second candidate — it has already produced two real divergences (2.10, and block-level forgiveness).

## 4. Closed, for the record

Fixed and verified in the current tree: Android `SingleFlight` re-entrancy (B1) and blocking I/O on the caller's thread (B2); the licence, now Apache-2.0 (B6/1.3); iOS privacy manifests on both targets (1.4); iOS `SingleFlight` cancellation and join-after-completion (C1/C2); the `revalidating` cancellation leak (C5/2.4b); the shared 2-slot dispatcher, now split 2 disk/4 network (C8/4.1); the config tree being invisible to the UI module (D1) and un-round-trippable through equality (A10); both sharing sheets misreading a failed load as ready (2.1/2.2); backoff bypassed on a cold cache (2.3); the startup drain ignoring `trackingEnabled` (2.5); an iCloud restore bricking identity (2.8); iOS dropping a rewards response over an absent `tiers` (2.9); the WebView starting arbitrary activities (3.1); `signProof` having no production caller (3.4); `track()` awaiting the whole backlog (4.3); the doc-claim corrections (T8/7); the first concurrency tests for `SingleFlight` (T1); and, closed by rewiring the example apps, D2 (both harnesses were stubs of an API shape that never shipped) plus four defects only a real integrator found (a throw where Swift structurally can't, the invisible `@Throws` tier, dead KDoc links, and `frak-publish`'s `groupId` set only inside the publication).

Tier 0/1 remediation pass, both platforms unless noted: log-privacy widening, all four `os.Logger` call sites moved to `.private` (S1); raw response bodies now logged only by length (S2); `FrakEnvironment.Custom` restricted to an https-or-loopback-http allowlist (S7); `PercentEncoding` unified to the same RFC-3986 set on both platforms (N2); iOS `URLSession` switched to an ephemeral configuration (N8); unbounded response reads on Android, now a genuine streaming abort — the Android half of S5, iOS stays partial (§3.1); a 204/205/304 no longer misread as a transport failure (N5); retries narrowed to a transient allowlist plus jitter (N6); clock skew clamped to a non-negative cache age (N7); empty optional strings normalised to absent on both platforms (2.10); non-finite (`NaN`/`Infinity`) money amounts rejected on Android — iOS's `JSONDecoder` already rejected them, so this arm was Android-only (N1); `objectArray`/`ForgivingArray` re-verified already identical on both platforms — N3 as filed described a gap that no longer exists; `forceRefresh` now reaching the config resolve inside `fetchRewards` on either platform (D6); `clientOrNull` added to both platforms (A6); Android's `NotInitialized`/`TrackingDisabled`/`AlreadyPresenting` converted from singleton `object`s to plain classes so each throw captures its own stack trace — iOS has no equivalent gap, Swift enum errors never carry one (A8, Android-only); `equals`/`hashCode`/`toString` added to every public Android reward model plus `ProductDetails` (A9); Android's tracker exceptions now routed through `frakCall`'s normalisation — iOS's equivalent is structurally non-throwing (2.11); UUID/hex helpers de-duplicated on Android via `core/Hex.kt`/`core/Uuid.kt`, mirroring iOS's existing `Hex.swift` (5.6); `resourcePrefix` set on `frak-sdk-ui` (5.5's Lint prerequisite, moot until B3/1.2 gives Lint somewhere to run).

This pass: `anonymousId` is now `suspend`/`async` on both platforms, minted eagerly by a detached task with a cached-refusal guard so one bad read can't permanently disable the SDK (4.5); `resetAnonymousId()` now returns `Bool`/`Boolean` so a caller knows whether rotation actually happened before purging queued events (closes the rest of that row); `configUpdates`/`updates` now fires from background revalidation, not just a caller's own direct fetch, since `ConfigStore` owns the stream (C3); a monotonic sequence number minted at fetch-start closes the cross-key lost-update race (C4) — the originally-named same-key race turns out structurally unreachable, since `SingleFlight` already collapses it; reconciliation now uses an SDK-owned monotonic row id instead of the caller-suppliable, non-unique `idempotencyKey` (2.7, upgraded from partial); the event queue is capped (~1100 rows) and now sweeps unparseable rows on every read, closing the old F5 (2.6); Android's build plumbing (`explicitApi`/`jvmTarget`/language version/`jvmDefault`) is configured once by the `frak-publish` convention plugin instead of per module (5.5, upgraded from partial — iOS never had the duplication, `Package.swift` has one `swiftSettings` site).

Closed by the iOS sharing-sheet port (warm pool, session-at-the-tap, fragment activation): A7b, which described a parity gap that no longer exists — both platforms seed `bestReward` and both track `Interaction.Sharing()`; and iOS `release()` not cancelling the prepare task, now cancelled by `SharingPresentation.dispose`, which also clears the model's outcome callbacks so a build still suspended for a dismissed sheet cannot poison the next session's reported result or dismiss a live sheet. Two more were found by review of that port and fixed in it: `SharingSession.navigation` could report a fragment activation for a session with no page at all, skipping the tier-3 fallback (both platforms); and iOS derived the pooled view's `loadedBaseURL` from `URL(string:).absoluteString` while comparing it against a raw `SharingPageURL.warm(...)` string, resting the entire activation path on a Foundation round-trip that is observed behaviour rather than contract.
Two regressions the remediation itself introduced, both fixed: making `ResolvedPlacement.translations` non-optional on a synthesized `Decodable` type dropped every placement on a routine backend omission; detaching the tracking drain (4.3) widened 2.7's window and silently deleted iOS's drain coalescing.
