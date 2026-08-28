# Native SDK — what is still open

Only open and partial items. Closed findings are not listed; git history has them. Ids are kept from
the original audits (`A*`/`S*`/`T*`/`D*` round 1, `2.x`–`8.x` round 2, `9.x` round 3, `§n` from the
2026-08-13 alpha audit) so older commit messages still resolve.

**State as of 2026-08-14.** Any count or severity below without a date and a verification method is
suspect — that was the failure mode of the register this replaces.

Verification vocabulary, used in the tables: **read** (inspection only), **executed** (a test or
command proves it), **device** (driven on real hardware).

## 0. Where this work is tracked

Linear tracks **product-facing** native work: a merchant-visible feature, or a defect with a reported
symptom. This file and [`next.md`](./next.md) own **engineering** items — ABI decisions, parity gaps,
test structure, and the unpinned surfaces in §9. Neither list is a subset of the other, and most of
this file is in neither a sprint queue nor anyone's inbox.

The split is recorded because it was previously undeclared, and that cost a duplicate: FRA-307 is
§8's `overallDeadlineSpansRetryBackoff` row, filed from a CI failure by someone who had no reason to
read this file. Search here before filing a native issue; when one is filed anyway, put its id on the
row so the duplicate is visible from both directions.

Open Linear issues at 2026-08-28 (`linear_list_issues`, all non-closed FRA), and where each lands:

| Issue | Row |
|---|---|
| FRA-307 — flaky iOS deadline test | §8, `overallDeadlineSpansRetryBackoff` — **duplicate** |
| FRA-295 — better sharing preview | §5, the bare-URL share payload. The `apps/business` editor half is product work and has no row |
| FRA-291 — resolve identity + balance | none — a new surface, not a gap in what ships |
| FRA-292 — prebuilt native components | [`next.md`](./next.md) §8. Its stated gate ("first usage") is looser than the real one — §6 here, a WebView sharing-performance measurement nobody has taken |

Nothing else here has a Linear issue. That is deliberate rather than backlog: an item gated on a
device tier or an owner decision is not actionable in a sprint queue. The ones that *are* actionable
are ordered in [`next.md`](./next.md) — §1 most of all, whose cost rises the moment a merchant
integrates `1.0.0-beta.1`.

## 1. ABI — the window has changed

`1.0.0-beta.1` is published on Maven Central and the SwiftPM mirror. These items were tracked as
"free before the first artifact exists"; that is no longer true. Each is now a break against a
published coordinate, and the budget for taking one is the remaining `beta` line. **Decide these
before `1.0.0` final.**

Nothing has consumed a published artifact yet, so the practical cost today is still near zero — but
it stops being near zero the moment a merchant integrates.

| Id | Item | Platform | Why it still matters |
|---|---|---|---|
| §4.6 | **`FrakContext` and `SharingResult` have no unknown arm.** The highest-value item here. A `Kind` discriminator does not fix it and cannot: `SharingResult` gained a 6th arm (`WalletOpened`) five days after being "narrowed" by `Kind`. A Kotlin `when` without `else` throws `NoWhenBranchMatchedException` at runtime on an already-installed binary; a Swift non-frozen public enum is a hard source break | both | unowned |
| §4.5 | **`tracking.purchase(String, String, String)`** — three unlabelled strings on the money path, trivially mis-ordered and permanently so | Android | unowned |
| §4.4 | **`FrakError` has no retryable/fatal axis**, and iOS's `LocalizedError` conformance exposes raw diagnostics as user-facing strings merchants will show to users | both | unowned |
| §4.9 / 9.9 | **Equality split across 8 types.** Android input types are 3-have / 4-haven't; `FrakConfig`/`FrakMetadata` are reference-identity on Android and hand-written `Hashable` on iOS. Adding equality later is a behaviour change with an unchanged descriptor — invisible to the ABI gate | both | unowned |
| §4.10 | **The on-disk queue row format carries no reliability tier.** If purchases ever need their own failure budget or drain tier, the format must carry it before merchants have rows on disk. A queue file cannot be migrated | both | unowned |
| A2 | **`FrakEnvironment` and `RewardTier` still fully open.** `RewardTier` gained an `Unknown` arm in `a9637386b`; `FrakEnvironment` is untouched, and is the weaker case — it is a merchant input nobody writes a `when` over | both | partially closed |
| A3 / D7 | iOS input types still use memberwise `init` where Android uses Builders. Source-compatible only while iOS ships source — this changes the day `do_xcframework()` produces a precompiled binary | iOS | tied to XCFramework |
| 9.15 | Call-site shape diverges beyond `rewards.best` (now unified): the ten resolved-config constructors are `internal` on Android and `public init` on iOS, so a merchant can build one for a test on iOS and cannot on Android; and six input types are Builder-vs-memberwise-init | both | undecided |

## 2. Deliberate deferrals

Open, tracked, knowingly not being worked.

| Id | Item | Gate |
|---|---|---|
| T3 | No automated device or simulator coverage. CI compiles iOS tests at the simulator triple and runs them on the macOS host, so every UIKit-gated suite executes nowhere. No Android `androidTest` source set | needs a device tier |
| 8.2 | ~2,000 lines of iOS sharing-sheet code with zero executed coverage, for the same structural reason. Android's `SharingHost` — lifecycle attach/detach, `ViewModelStore` retention, buffered-result replay — has no test constructing one either; no JVM harness supplies a real `ComponentActivity` + `ViewModelStore` + `ComponentDialog` | same |
| 4.2 | iOS `EventQueue` actor does synchronous file I/O on the cooperative pool. Making it `async` reopens an interleaving window that was closed deliberately; `SerialExecutor` needs a deprecated iOS-15-floor API. Bounded and short (≤1100 rows) | accepted with rationale |
| 9.5 | Android pauses the warm `SharingWebViewHandle` because it composites while warm; iOS has no analogue (the pooled `WKWebView` is never in a hierarchy until presented). Argued moot, unconfirmed | needs a simulator pass |
| — | `do_xcframework()` still `die`s "not implemented". Source distribution covers beta | needs a decision on binary distribution |

## 3. Security and privacy

| Id | Item | Platform | Verified |
|---|---|---|---|
| §3.7 | **Clock skew, half-fixed.** A device 61 s fast fails every proof, non-retryably. Android got `ServerClock` (stamps from the backend `Date` header) and the backend widened the merge window 2→10 min on the past side; `MAX_FUTURE_SKEW_SECONDS=60` is untouched. **iOS still stamps from the device clock — `ServerClock` was never ported.** `ServerClock` itself is unbounded: a proxy sending `Date: 2100` skews every proof, and it is not persisted, so a cold start runs on the device clock until the first response | iOS open | read |
| S4 | iOS keeps the resolve cache in Preferences, not Caches, with no backup exclusion. A per-read xattr mitigation was tried and reverted — `cfprefsd` reallocates the inode on every flush. Now a decision, not a design problem: the config cache is the SDK's own copy of someone else's data, so leaving it backed up is defensible. **Decide and record, or move it** | iOS | read |
| S5 / 3.7 | Unbounded peak memory reading a response body. Android streams in 8 KiB chunks and aborts past 1 MiB; iOS stays on a pre-check plus post-buffer cap, so a chunked or lying response is unbounded during the read. A streaming rewrite was tried and reverted (`session.bytes(for:)` is ~100k suspensions per response) | iOS | read |
| S11 | The sharing WebView URL puts `clientId` in a query string, and nothing in `frak-sdk-ui`/`FrakSDKUI` reads `TrackingConsent` — zero references in either module. It fails closed only incidentally, because `anonymousId()` returns null once consent is withdrawn and `build()` treats a null `clientId` as `MerchantResolutionFailed`. One point of failure, no second guard | both | read |
| §2.2 | Inbound `?fmt=` merge auto-executes with no origin check. **Reclassified from P0 to medium**: the fix cannot be built for the actual flow (target id B does not exist at mint time), and `WALLET_CONFLICT` bounds the damage to wallet-less victims, making it attribution theft rather than identity takeover. Non-urgent backend follow-ups: make the token single-use, cut the 60 min TTL to 2–5 min | backend | read |
| §3.3 | `initiateMerge`'s pre-existing auto-create arm for `sourceAnonymousId` has no proof guard — a second door, always open. Out of scope when found; still needs its own decision | backend | read |
| — | Design changes confirmed real and deliberately deferred: move `clientId` out of the query string; clear web-view data on consent withdrawal; defer the eager resolve; StrongBox plus key-invalidation recovery | both | read |
| — | `frak-sdk-ui` logs outside the merchant's configured `FrakLogger`. Closing it needs a new `@InternalFrakApi` accessor, so it is an ABI change | Android | read |
| — | iOS still needs the Universal Link move: a custom scheme cannot be bundle-id targeted, so the Android `setPackage` fix has no iOS twin | iOS | read |

## 4. Correctness

| Id | Item | Platform | Verified |
|---|---|---|---|
| §2.4 | **A wallet page that returns 200 OK but whose JS never boots leaves the sheet blank forever** — no timeout, no error, no host notification, and it bypasses the native-share fallback. A fix was attempted (settle-on-paint via `pageVisible`/`postVisualStateCallback`) and reverted: it broke the regression test asserting an activated page is not abandoned to tier 3. **Needs a device to answer whether `postVisualStateCallback` reliably fires for a fragment-activated warm document** | both | read, fix reverted |
| §2.3 | `DeepLinkHandling.Automatic` and warm starts. Fixed for the documented `Application.onCreate` path via `OnNewIntentProvider`. **Still open:** the listener subscribes only from `onActivityCreated`, so initialising from an Activity reproduces the original bug silently; and `Frak.shutdown()` leaves stale listeners, so re-initialising double-tracks | Android | partial |
| §3.2c | **Android never re-drives the outbox** — no timer, no foreground hook, no connectivity callback, where iOS has `willEnterForegroundNotification`. A purchase tracked in a tunnel sits until process restart or the 14-day drop. Needs `ProcessLifecycleOwner`, a new dependency on `:frak-sdk` (currently coroutines-only), so it is a decision rather than code | Android | executed (absent from tree) |
| §3.6 | The Compose build site has an empty `onDispose`. Navigating away with Compose Navigation orphans a live sheet on the new destination and fires `onResult` into a dead composition. Confirmed by reading and deliberately not fixed — the naive fix reintroduces the opposite bug (a torn-down sheet that never reports). **Needs a two-destination `NavHost` in the harness first**; the harness is single-screen and cannot reproduce it | Android | read |
| N4 / 5.7 | Three timeout mechanisms still exist on iOS, though they no longer compete for a budget (`Deadline.run` at 20 s with a 60 s backstop). Android is fixed (3 s/5 s inside a 20 s deadline) | iOS | read |
| 3.2 | A V1 `fCtx` carries no `merchantId`, so a V1 link from any merchant tracks as this merchant's arrival. Structural, unfixable the same way on either platform — the drain-time check cannot help | both | read |
| — | `NativeShare.share()` can hang if a presentation is accepted and then torn down. The refused-presentation half is fixed | both | read |
| — | Android's `NativeShare.share` reports whether the chooser *launched*, not whether the share completed — see [`decisions.md`](./decisions.md) §4.8 | Android | read |

## 5. Public API / DX

| Id | Item | Platform |
|---|---|---|
| 9.7 | iOS `shutdown()` is materially weaker than Android's. It cancels the startup task, the tracker and two flush subscriptions, but background config revalidation, `RewardRepository`, the `resetAnonymousId` purge and the eager identity mint are unstructured `Task`s that can still hit the network after it returns | iOS |
| D5 | A typo in `targetInteraction` fails silently — free `String`, no constants, no validation. Android moved it onto `RewardRequest`; iOS is unchanged | iOS |
| D3 / D4 | Transport-injection points are `internal` by design, so a merchant cannot substitute a fake transport. `FrakEnvironment.Custom` against a stub server is the only seam. Listed so it is not rediscovered as a bug | both |
| — | `FrakError.AlreadyPresenting` is unreachable on iOS (the `Binding` makes it structurally impossible) and real on Android | iOS |
| — | `FrakSdkVersion.kt`'s KDoc points at a `version` in `build.gradle.kts` that does not exist | Android |
| — | Merchant-facing gaps deferred with a README note: no test seam, no theming story, no install-handoff documentation | both |
| — | Dark mode: does the sheet follow the system setting? A product decision, not a defect | both |
| — | iOS's native share payload is a bare URL with no text or image. Closing it needs cross-surface `SharingView` changes | both |

## 6. Performance

| Id | Item | Platform |
|---|---|---|
| 4.6 | Both the reward and backoff caches evict opportunistically only, on insert and read. No periodic sweep, no size cap — a process that stops calling in, or a key that fails once and is never retried, keeps its entries for the process lifetime. Identical on both platforms | both |
| — | The sharing performance targets (p75 < 400 ms, p95 < 1 s, fallback > 1.5 s) were set for Chrome Custom Tabs and never re-measured for the WebView path. They gate whether the sharing screen goes native. The fallback threshold is known stale — it fired over still-loading pages and was raised to 5 s | both |

## 7. Simplification — mostly deletion

| Id | Item |
|---|---|
| 5.1 | `ConfigStore` is a per-key state machine — memory, hydration flag, revalidating flag, backoff map, single-flight, sequence pair — with exactly one key, on both platforms |
| 5.2 | iOS `SingleFlight` is a 135-line actor carrying a `CompletionFlag` class and a `Waiter` class where structs would do. Android's is 72 lines |
| 5.3 | Android still threads a non-reentrant `Mutex` through `Backoff.runOrRecordFailure` from two call sites. iOS dropped it |
| 5.4 | `ConfigStore` and `RewardRepository` are the same 40 lines twice, per platform — freshness check, backoff check, single-flight, sweep-then-insert. No `CachedEndpoint<T>` |

## 8. Tests

| Id | Item | Platform |
|---|---|---|
| 9.13 | **Three places the harness is structurally blind.** (a) Robolectric ships no WebView provider implementing `DOCUMENT_START_SCRIPT`, so `SharingHostStyle.install()` has no executed coverage. (b) `SharingSheetStateTest` injects `EmptyCoroutineContext` for `workContext`, collapsing `Dispatchers.Default` and `Main.immediate` onto one virtual scheduler — one scheduler cannot exhibit a two-dispatcher race, so the thread-confinement design has no regression test and cannot get one. (c) **No test in the repo reads emitted CSS**, which is why a tablet-cascade bug survived a test named for exactly the behaviour it broke: a class-presence assertion passes whether the rule wins or loses the cascade. (a) and (b) need the device tier; **(c) is tractable now** — Vanilla Extract emits static CSS at build time and `@vanilla-extract/vite-plugin` is already a dependency | both |
| T2 / 8.8 | Android's `Frak` facade is untested and structurally untestable: a Kotlin `object` with `@Volatile` state and no reset seam, so a second test in the same process observes the first's leftovers. iOS has `resetForTesting()`. Two-step fix — add the seam, then the tests | Android |
| T7 | iOS `Backoff` accepts an injectable clock and neither production call site passes one, so iOS's config/backoff tests need real sleeps where Android's use a virtual clock. This is the root cause of half of T6 | iOS |
| T6 / 8.4 | 20 real `Task.sleep` calls sequence the iOS concurrency tests; `HttpClientTest.kt:165` parks an IO thread for 10 s, measured at 10.03 s of a 15.4 s two-module Android suite | both |
| T5 | iOS asserts "some `FrakError`" at 16 sites where Android asserts the case. Swift Testing supports case-pattern assertion — test quality, not a language limit | iOS |
| 8.5 | `AndroidKeystoreDeviceKeyStore` has zero test references and is untestable on the JVM. iOS has `PersistedDeviceKeyStoreTests` | Android |
| 8.7 | iOS uses `Hex`/`Base64URL` as an oracle inside other suites with no tests of their own. Android closed this with RFC 4648 vectors | iOS |
| 9.3t | Android's `ResolvedConfigDecoderTest` never supplies a good and a bad placement together — the test that would catch the bug this row exists for is unwritten. iOS closed it | Android |
| 8.3, 8.6, 8.9 | A guard that cannot fail (`FrakContextCodecTest.kt:38-42` compares a count against the same filtered list that produced it); no iOS redirect/cache/`Accept-Encoding` assertions where Android has both; no concurrent-queue-writer test on either platform | both |
| — | `SharingSheetStateTest` initialises the real SDK against the production backend and makes a live HTTPS GET every CI run, with no shutdown or reset. **Accepted by decision** — "the backend absorbs the load" | Android |
| FRA-307 | `overallDeadlineSpansRetryBackoff` flaked once in six runs when written; CI then failed it on `dev @ a530c5f` with `attempts.value == 0`, so the cause is now known — 50 ms expires before `StubURLProtocol` is entered. Fix in the issue | iOS |
| — | Harness gaps with zero call sites in `example/` source (`.kt`/`.swift`, verified 2026-08-28): `setTrackingEnabled`, `resetAnonymousId`, `Frak.shutdown`, `heightFraction`, and the `@Composable build()` overload. `example/native-android` also has no `NavHost`, which is why §4's Compose `onDispose` row cannot be reproduced | both |

## 9. The unpinned surfaces

Not bugs — the highest-leverage structural gaps. Each is a place where three implementations must
agree and nothing makes them.

### 9.1 No golden corpus for URL query editing and attribution merge

325 lines of code (507 raw, measured 2026-08-13) hand-ported three ways:
`queryParams.ts`/`UrlQuery.kt`/`URLQuery.swift` and
`mergeAttribution.ts`/`AttributionParams.kt`/`SharingLinkBuilder.swift`. Between them they encode a
case-insensitive `fCtx` lookup, tolerant percent-decoding, "never re-encode the merchant's URL",
empty-value skipping, and a seven-field precedence rule.

`golden-sharing-links.json` would close it the way `golden-context.json` closed the codec. **Not
built.**

Three concrete drifts this gap has already produced:

- **9.11 — the TypeScript reference does not implement "never re-encode the merchant's URL."**
  `frakContext.ts`'s `update()` round-trips through `URLSearchParams`/`URL.toString()`, so
  `?note=hello%20world` becomes `?note=hello+world`. Both native ports deliberately avoid this and
  each has a test asserting an exact untouched query string. `frakContext.test.ts` only reads back
  decoded values, so it passes either way. **A link built web-side and one built natively can
  byte-differ on identical input and nothing would notice.**
- `mergeAttribution.ts`'s doc claims hardcoded fallbacks for `utm_medium`, `utm_campaign`, `ref` and
  `via`; only `utm_source=frak` exists in any of the three implementations. All three agree on the
  simpler real behaviour — the risk is that the next port is written from the comment.
- The resolve-response decoder is the second candidate. There is no TypeScript runtime decoder to
  conform to (`sdkConfigStore.ts:146` is a bare cast), so the forgiveness policy was invented
  independently on each platform and has produced three real divergences.

Related and still open: base64url strictness is asymmetric between web and native (native is
stricter, which is the right direction — closing it means loosening web); and there is no
uppercase-UUID vector, which belongs with the golden-proof work.

### 9.2 The native↔web style contract

`--frak-host-top-radius` and `--frak-host-surface` are hand-mirrored string literals in Kotlin and
TypeScript, each side asserting the other's spelling in its own test, with no compiler link. A
rename passes both builds and fails only at runtime.

This is the **smallest** of these gaps and the cheapest to close — two literals against a full
corpus. iOS's correctness additionally depends on those CSS fallbacks continuing to mean "square and
opaque", and nothing pins that, because iOS injects nothing by design.

`androidx-webkit` is an `implementation` dependency of `:frak-sdk-ui` that no dependency table
lists, and the dex budget that would have measured it was retired.

## 10. Doc hygiene

The register this file replaces carried claims that were wrong when written — reverted mechanisms
described in the present tense, per-file line counts stale by up to 128 lines, and "closed" rows for
work that had been reverted. The correction passes introduced their own errors.

**The rule going forward:** a claim in this file states its verification method and the date it was
measured, or it does not go in. "Directionally true, literally false" is how the previous register
lost its usefulness.
