# Native SDK — open findings

Merged register of the two full audits of `sdk/android` and `sdk/ios` (round 1 over the
first tree, round 2 at `51d923ded`), re-verified against the current code. **Only what is
still open or partial is listed.** Closed findings are summarised in §4 and not itemised —
git history has them.

Both audits were static: no toolchain ran. So was the re-verification. Ids are kept from
the original documents (`B*/S*/C*/N*/A*/D*/T*` from round 1, `2.x/3.x/4.x/5.x/8.x` from
round 2) so older commit messages and review notes still resolve.

**Scorecard:** 119 findings tracked historically across both audits. §1–§3 row counts (mechanically counted, current): **9 rows partial**, **30 rows fully open** (22 in §3, 5 blocking in §1, 3 deliberately-deferred in §2), across 39 rows total. §4 lists ids as closed in prose rather than a table, so an exact closed-count is not independently re-derivable from this document alone without re-parsing every bolded id in §4's prose against §1–§3's rows — a prior revision asserted **43** without showing that work, and at least one of those (**S5**) is a cross-reference to a row that is still *Partial* in §3.1, not a closure, while another (**B3/1.2**) is a cross-reference to an open §2 deferral. Treat 9 partial / 30 open as the current state; 119 is the historical denominator only; the closed count needs a re-audit before being restated as a single number.

This revision closes six more: **4.5** (`anonymousId` async + eager generation, which also
closes the unnamed `resetAnonymousId(): Boolean` row), **C3** (background revalidation reaches
`configUpdates`), **C4** (monotonic sequence guard), **2.7** (SDK-owned row id, upgraded from
partial — the read/compact lock window was already closed; reconciliation now also keys on it
instead of the caller-suppliable `idempotencyKey`), and **5.5** (the `kotlin {}` block is no
longer duplicated per module: `explicitApi`/`jvmTarget`/language version/`jvmDefault` are
configured once by the convention plugin, `buildSrc/src/main/kotlin/frak-publish.gradle.kts`,
with each module's build file reduced to a comment pointing there — Android-only build plumbing,
no iOS counterpart needed). **S5 stays partial** — an iOS streaming rewrite was attempted and
reverted this pass; see §4's note. **D3 moves from no-logging-at-all to partial** — request
logging (method/host/path/status/duration, never the query string or a header value) now runs on
both platforms; the transport-injection seam it also named is still missing.

## 0. The structural lessons

Worth more than any individual row.

1. **The same bug is almost always on both platforms.** The port is faithful; the holes
   are in the *shared design* and got copied twice — backoff bypassed on a cold cache,
   `configUpdates` never firing from revalidation, the queue growing exactly while it
   cannot drain, identity minted on the main thread. Per-platform review does not find
   these. A shared spec plus shared fixtures does. Fix them **both platforms, one PR** —
   and when the platform APIs genuinely differ (a Swift `enum` cannot carry a stack trace
   the way a Kotlin exception class can; `UserDefaults` and `SharedPreferences` fail
   differently), "fix both" becomes "fix one and **name the other platform's status in the
   same row**". A row that says *Fixed* without saying what happened on the other platform
   is the same failure mode as not fixing it there at all — the Tier 0/1 pass produced
   several (S3, S5, N1, A8), all corrected to say so explicitly.
2. **Docs drift away from the code faster than anyone expects, in both directions.**
   Round 2's third headline was a list of doc claims that had silently become true fixes
   left undocumented (N2, this pass) or become false the moment the fix landed (six stale
   evidence line-refs in this same document, introduced by the commits that fixed the
   underlying findings). Correct prose when the code moves, not in a batch — and re-read
   the evidence column, not just the verdict, every time a row is touched.

A third, learned while remediating: a passing suite can prove nothing. Android's tracker
tests run the detached drain inline under `UnconfinedTestDispatcher`, so they pass
identically against the *unfixed* code.

A fourth, from the 4.5/C3/C4/2.7 remediation pass: **a fix's own regression test can be the
bug.** Multiple review rounds over the same diff found compile blockers introduced by a fix's
test (an unimported extension, a hanging `AsyncStream` iterator attached after the value it
needed to see had already been replayed), and a *second*-order defect where the mitigation for
one corruption bug (a failed on-disk rewrite silently deleting the queue) introduced another
(the id-reservation counter used to make that mitigation safe was never rolled back on the
failure path it exists to handle, so a second failed rewrite could hand out a duplicate row id
and delete an undelivered event instead of a delivered one). Neither was caught by the round
that wrote the fix — both needed an independent pass reading the new code as if it might be
wrong, not confirming that it matched the design.

A fifth, from the same pass: **a guard can be right for a reason other than the one it was
filed for.** C4 was filed against a background revalidation racing a foreground `forceRefresh`
for the same key. That race is structurally *unreachable* — `SingleFlight` collapses both
callers onto one in-flight fetch before either reaches the publish site
(`config/ConfigStore.kt:33-38`). The sequence guard is still correct and still wanted, but for
a different case: two *different* query keys landing out of order into the single shared
`memory`/`updates`/disk slot — which no production path can currently produce, so the guard is
exercised only by tests that construct a second key by hand. Closing a finding is not the same
as confirming the mechanism it named. A fix whose rationale is never re-derived ships a comment
that lies about why the code exists, and the next reader deletes it as dead weight.

A sixth, about commits rather than code: **a remediation commit changes things its message does
not list.** `3c64c4c1f`, whose subject is "async identity, live config revalidation, durable
reconciliation", also moved iOS's session timeouts from 8 s to a 60 s backstop and inverted
which mechanism is authoritative (5.7) — a change to a shipped timeout budget, named in no
commit message and caught only by re-reading the file. `895c86d2d` had earlier moved the same
values 15/20 → 8/8, also unannounced. Diff the whole commit against this register, not just the
files its message names.

## 1. Blocking the first publish

ABI-irreversible or verification-blocking. Everything else can ship late.

| Id | Finding | Evidence |
|---|---|---|
| A1 / 1.6 | **No binary-compatibility gate, no committed `.api` dump.** BCV was wired then removed on purpose while the shape is unfrozen (`buildSrc/…/frak-publish.gradle.kts:14`). `FrakConfig` and `FrakClient` have gained members since, each a silent ABI change. Blocked on the Q1–Q7 decisions in `05-build-and-release.md` §5 | `find sdk/android -name '*.api' -not -path '*/build/*'` → nothing |
| A3 / D7 | **`FrakConfig` is a 9-parameter constructor with defaults and no builder.** The synthetic `$default` bridge encodes the parameter count, so adding a field is a `NoSuchMethodError` for an already-shipped merchant binary. Three parameters have been added since the finding | `core/FrakConfig.kt:74-89` |
| A4 / A5 | **Error taxonomy.** Every internal bug surfaces as `FrakError.Decoding`; there is no `Internal` arm, `FrakError` is not `Equatable`/`equals`, and a backoff refusal arrives as `Network(ISE("backing off"))` | `DefaultFrakClient.kt:404`, `Core/FrakError.swift:4` |
| S6 / C7 | **No consent handle and no shutdown.** `trackingEnabled` is an immutable constructor `val`; there is no `setTrackingEnabled`, no `shutdown()`, no scope cancellation. Consent withdrawal and GDPR erasure are unimplementable, and tests cannot clean up | `FrakConfig.kt`, no `shutdown` on either platform |
| B4 / B5 / 1.5 | **iOS declares `swift-tools-version: 5.9` but uses Swift 6-only syntax** (`isolated (any Actor)? = #isolation`), and no target sets `swiftSettings`. Consumers compile in Swift 5 mode, which hides real errors — e.g. `HTTPClient: Sendable` holding a non-`Sendable` `NoRedirectDelegate`. Swift 6 is verified only by `scripts/run.sh` | `Package.swift:1`, `Core/FrakCall.swift:6`, `Net/HTTPClient.swift:5,24,82` |

## 2. Deliberate deferrals

Open, tracked, and knowingly not being worked.

| Id | Finding | Why deferred |
|---|---|---|
| B3 / 1.1 | No publish path on either platform — `publishToMavenLocal` only; `do_xcframework()` prints "NOT IMPLEMENTED" | Publishing lands once the SDKs have run on a device (`05-build-and-release.md` §6) |
| B3 / 1.2 | No CI job builds, tests or lints either SDK. Android Lint has never executed once | Same gate. Consequence: **every green claim in this folder is a human running a command once** |
| T3 | No automated device/simulator coverage; no `androidTest` source set. One manual Android device run (config + rewards) is the only on-device evidence that exists, and iOS has none | Same gate |

## 3. Open by area

### 3.1 Security & privacy

Only S1/S2/S7 among the round-1 security ids closed outright; they are recorded in §4, not here.

| Id | Finding | Evidence |
|---|---|---|
| S3 / 3.6 | *Partial.* iOS: *fixed* — `EventQueue` now sets `.completeUntilFirstUserAuthentication` on the queue file at creation (`append`, when `isNewFile`) and after every compaction (`replace`); `applyProtection()` itself is a no-op on macOS, guarded by `#if canImport(UIKit)`, since the API is unavailable there. Android: **still inert** — a `frak_full_backup_content.xml` was added for API 24–30, but a library cannot wire either rules file into its own `<application>` (singular attribute, merger raises a **build error** on a differing merchant value, not a silent drop — `02-sdk-design.md` §3 corrected to say so). The required merchant integration step is now documented in `sdk/android/README.md` ("Backup and device-transfer exclusion"), but nothing changes for a merchant who hasn't taken it | `AndroidManifest.xml`, `Tracking/EventQueue.swift:266-267,275,346,425-429` |
| S4 | iOS keeps the resolve cache in Preferences rather than Caches and sets no `NSURLIsExcludedFromBackupKey`. **A per-read xattr-on-the-backing-plist mitigation was attempted and reverted**: `cfprefsd` persists a suite by atomic replace, which allocates a new inode on every flush, so the flag does not survive the first write after it is set — the retry-on-every-read design in the reverted diff was compensating for that and still left the just-flushed window uncovered. It also called `FileManager.urls(for: .libraryDirectory...)` on macOS, a platform this package's `Package.swift` declares as a real shipping target, which resolves to the *user's* real `~/Library`, not an app container. The durable fix is the same shape as the S3/iOS fix above — an SDK-owned, backup-excluded directory set once at creation — applied to `KeyValueStore` instead of ad hoc per-call exclusion; not attempted here, and `Caches` is the wrong destination for the identity suite specifically (eviction under disk pressure would silently rotate the anonymous id, reopening the closed **2.8**) | `Config/KeyValueStore.swift` |
| S5 / 3.7 | *Partial.* Unbounded response-body read on both platforms — no size cap, no `Content-Length` check. On Android the body is then persisted verbatim into `SharedPreferences`. **Android: fixed**, a genuine streaming abort — `readBytesUpTo` aborts incrementally once the running total exceeds 1 MiB, never buffering past the cap; the pooled connection is `disconnect()`-ed on both the pre-check and the mid-read abort so it isn't left poisoned. **iOS: partial, and a streaming rewrite was tried and reverted this pass** — `session.bytes(for:)` iterated the body one byte per `await` (~100,000 suspensions for a typical response), a real production regression judged too risky to land without a compiler to check it. iOS stays on `session.data(for:)` with a pre-check plus a post-buffer cap: an oversized body is never returned to a caller that would persist it, but peak memory during the read is not bounded the way Android's abort is. A real fix needs a `URLSessionDataDelegate`-based accumulate-and-cancel, not `session.bytes(for:)` | `net/HttpClient.kt:239-260` (Android's cap is enforced by `readBytesUpTo`, not the range alone), `Net/HTTPClient.swift:233-258` |
| 3.2 | *Partial.* Android did not check an inbound `fCtx`'s `merchantId` against the SDK's own before tracking an arrival. **V2 fixed on both platforms** (case-insensitive, whitespace-trimmed compare, primarily against the merchant's own `FrakConfig.merchantId`, falling back to the cached config's `merchantId` only when the merchant didn't set one; fails open — lets the arrival through untouched — only when neither is available yet, since fire-and-forget arrival handling must not block on a fresh network resolve). Because most integrations set `FrakConfig.merchantId`, the fail-open path rarely fires in practice. **The V1 half is unchanged and cannot be fixed the same way**: a V1 context carries no `merchantId` field at all, so a V1 link from any merchant is still tracked as this merchant's arrival | `applink/ReferralArrival.kt:28-43`, `AppLink/ReferralArrival.swift:23-39` |
| 3.3 | iOS software-key fallback writes the **raw P-256 private scalar** into a backed-up plist, behind a class comment claiming it "stores a key reference, not the key itself". No simulator-only guard | `Identity/DeviceKey.swift:88` |

### 3.2 Correctness

| Id | Finding | Evidence |
|---|---|---|
| 2.6 | The event queue is bounded on **read only**, so it grows without limit exactly while backoff is armed and it cannot drain. Both platforms | `EventQueue.kt:157-159,308-309`, `EventQueue.swift:120,122,231-232` |
| N4 / 5.7 | *Partial, closer to closed than previously recorded.* Timeouts contradicted each other: connect 10 s + read 15 s = 25 s against a 20 s overall deadline (Android); three overlapping mechanisms on iOS. **Android budget fixed**: connect/read are now 3 s/5 s (two attempts + jitter fit inside the 20 s deadline with slack). **iOS collapsed to one authoritative mechanism instead of budgeting three**: `Deadline.run` alone bounds a request at 20 s; `timeoutIntervalForRequest`/`timeoutIntervalForResource` were raised to a deliberate 60 s backstop that cannot fire first (`HTTPClient.swift:68,72-73`), not tightened to 8 s as an earlier revision of this row said. Three mechanisms still exist, but they no longer compete for a budget and the code documents which one is authoritative — the remaining gap is that the count is still three, not one | `net/HttpClient.kt:295-310`, `Net/HTTPClient.swift:47-73` |
| — | **The load deadline is not cancelled on a manual share/copy.** Tap Copy while the page is still loading and the 1.5 s tier-3 deadline later raises a second OS chooser; on iOS it also closes the sheet. Both platforms | found post-audit, unfixed |

### 3.3 Public API / DX

| Id | Finding | Evidence |
|---|---|---|
| A2 | Sealed/enum hierarchies make an exhaustive `when`/`switch` a consumer break | `FrakError`, `FrakEnvironment`, `RewardTier`, … |
| A7 | The Android surface is Java-hostile — everything `suspend`, no `@JvmOverloads`, no callback bridge. The namespace split made a targeted fix *possible*, not delivered | `FrakClient.kt` |
| D2b | *Was D2, now residue.* Both harnesses compile against the real SDK and one has run on a device, but **neither has exercised the sharing sheet, the install handoff or an inbound deep link** — so nothing proves the sheet renders or that the intent filter fires | `example/native-{android,ios}` |
| D3 | *Partial.* Request logging now lands on both platforms — method, host, path, status and duration at DEBUG, deliberately never the query string or a header value, wired to the real logger in production (`net/HttpClient.kt:154-163`, `Net/HTTPClient.swift:218-231`). What remains open is the seam: the only transport-injection points (Android's `open: (URL) -> HttpURLConnection`, iOS's `session:`) are `internal`, so a merchant still cannot substitute a fake transport — overlaps D4 | `net/HttpClient.kt:39,154-163`, `Net/HTTPClient.swift:91,218-231` |
| D4 | No merchant test seam beyond `FrakEnvironment.Custom`; all injection points are `internal` | both platforms |
| D5 | A typo in `targetInteraction` fails silently — free `String`, no constants, no validation | `RewardsApi.kt:35` |
| A7b | **Parity: `bestReward` is seeded into the iOS sheet and not the Android one, and Android tracks `Interaction.Sharing()` where iOS does not.** Pre-existing, surfaced while cataloguing the UI's use of the client | `frak-sdk-ui` vs `FrakSDKUI` |
| Q4 | `FrakLogSink` diverges deliberately: a throwing sink is swallowed on Android and **brings down the host process** on iOS. Cheaper to change before publication | decision recorded in `05-build-and-release.md` §5 Q4 |

### 3.4 Performance

| Id | Finding | Evidence |
|---|---|---|
| 4.2 | iOS `EventQueue` is a plain `actor` doing blocking file I/O on the cooperative pool | `Tracking/EventQueue.swift:118` |
| 4.4 | O(N) disk + JSON per tracked event, i.e. O(N²) per session — the whole file is read on every flush, twice | `EventQueue.kt:125,130,206`, `InteractionTracker.kt` |
| 4.6 | *Partial — the original "never evict" wording was wrong at filing.* Both caches evict opportunistically: the rewards map sweeps entries past their TTL on every insert, and `Backoff.state` drops a key on expiry-read and on success, so neither grows without bound. What remains is that eviction is **insert-triggered only** — a process that stops calling `bestReward`, or a key that fails once and is never dialled again, retains its last entries for the process lifetime. No periodic sweep, no size cap | `RewardRepository.kt:141`, `.swift:136-137`, `Backoff.kt:30,51`, `Backoff.swift:42,67` |

### 3.5 Simplification — mostly deletion

| Id | Finding |
|---|---|
| 5.1 | `ConfigStore` is a per-key state machine (4 maps + a sub-flight) with exactly one key |
| 5.2 | iOS `SingleFlight` is still a ~120-line actor with a `Waiter` class where a struct on the owning actor would do |
| 5.3 | *Partial.* iOS dropped `runOrRecordFailure`; Android still passes a non-reentrant `Mutex` as a parameter (**C6**) |
| 5.4 | `ConfigStore` and `RewardRepository` are the same 40 lines twice, per platform — no `CachedEndpoint<T>` |

**5.8 withdrawn.** Was flagged as leftover dead code; re-verified and found stale —
`resetForTesting()` is `internal`-only (never public API) and is genuinely exercised by four
tests in `FrakTests.swift`. Not a gap; removing it would delete working test infrastructure.

Smaller open items from the round-2 best-practice pass that are worth doing in the same passes:
`FrakEnvironment.Custom`/`.custom` inheriting **dev** wallet package id and scheme defaults —
*partial*: overriding was added (`walletPackageId`/`walletScheme` constructor params on Android,
a 3-arg `.custom(wallet:backend:walletScheme:)` case on iOS), but the no-argument defaults are
unchanged (`DEV_WALLET_PACKAGE_ID`/`DEV_WALLET_SCHEME` on Android, `"frakwallet-dev"` on iOS's
2-arg convenience `custom(wallet:backend:)`), so a merchant who doesn't override still probes for,
and deep-links into, Frak's internal dev app;
iOS `SharingSheetModel.release()` not cancelling the prepare task (a naive
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
| T6 / 8.4 | Real sleeps: **21** `Task.sleep` calls sequence the iOS concurrency tests (8 in `SingleFlightTests`, 4 in `FrakClientTests`, 3 each in `ConfigStoreTests`/`DeadlineTests`, 2 in `TestSupport`, 1 in `HTTPClientTests`); `HttpClientTest.kt:166` parks an IO thread for 10 s |
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

From the Tier 0/1 remediation pass, both platforms unless noted: iOS log-privacy widening, all
four `os.Logger` call sites moved from `privacy: .public` to `.private` (**S1**); raw backend
response bodies logged at ERROR, now only the body's length/byte count (**S2**,
`config/ConfigStore.kt:224-225`, `Config/ConfigStore.swift:227-228`); `FrakEnvironment.Custom`
accepting cleartext and `file:`, now an `https`-or-loopback-`http` allowlist with the rejection
logged at `Frak.initialize` (**S7** — Android parses with `java.net.URI` and iOS with
`URLComponents`, two parsers whose accept sets had to be reconciled twice: bracketed IPv6, and
underscore hosts, where `URI.getHost()` returns null for a registry-based authority and needs an
authority fallback. Both cases are now pinned by the same fixture list on each platform);
`URLComponents` onto the same RFC-3986 `PercentEncoding` Android already used, byte-for-byte
identical unreserved-character sets on both platforms now (**N2**); iOS's `URLSession` switched
to an ephemeral configuration, so cookies are no longer accepted or replayed for the process
lifetime (**N8**); unbounded response reads on Android, which is now a genuine streaming abort
(**S5**, Android half — iOS is a post-buffer check, see §3.1); a 204/205/304 misread as a
transport failure and retried (**N5**); retries that were too broad and immediate — narrowed to a
transient allowlist (`SocketException`/`EOFException`/`InterruptedIOException`/`UnknownHostException`
on Android, matching `URLError` cases on iOS) plus 100–300 ms jitter (**N6**); clock skew pinning
the config cache fresh forever, now clamped to a non-negative age (**N7**); empty optional strings
decoding inconsistently between platforms, now normalised to absent on both (**2.10**); a
non-finite (`NaN`/`Infinity`) money amount surviving decode — every numeric reward and
`ProductDetails` field now goes through a finiteness guard on Android (`TokenAmount`,
`RewardTier.minValue`/`maxValue`, `EstimatedReward.Percentage.percent`,
`BestReward.minPurchaseValue`/`lockupDurationDays`, all `ProductDetails` fields), where `org.json`
accepts those as bare literals — iOS's `JSONDecoder` already rejects them by default, so this arm
of the finding was always Android-only (**N1**); `objectArray`/`ForgivingArray` re-verified to
already behave identically on both platforms — **N3** as filed described a gap that no longer
exists, corrected rather than left stale; `forceRefresh` not reaching the config resolve inside
`fetchRewards` on either platform, so a forced rewards refresh could still read a stale merchant
id/currency (**D6**); `clientOrNull` added to both platforms (**A6**); `NotInitialized`/
`TrackingDisabled`/`AlreadyPresenting` converted from singleton `object`s to plain classes on
Android so each throw captures its own stack trace — iOS has no equivalent gap, since Swift enum
errors never carry one regardless of how they're declared (**A8**, Android-only); `equals`/
`hashCode`/`toString` added to every public Android reward model plus `ProductDetails`, which the
same gap also applied to (**A9**); `trackingCall` now routes through `frakCall`'s normalisation on
Android, so an unexpected `Throwable` from the tracker can no longer escape uncaught — iOS's
equivalent closure is structurally non-throwing, so it never had the gap (**2.11**); the UUID
regex, hex encode/decode and UUID-to-bytes round trip de-duplicated on Android via new
`core/Hex.kt`/`core/Uuid.kt` helpers shared between `ProofCodec` and `FrakContextCodec`, mirroring
the dependency shape of iOS's existing `Hex.swift` (**5.6**); and `resourcePrefix` set on
`frak-sdk-ui` (not on `frak-sdk`, which ships no prefixable resources today) so an unprefixed
resource *would* fail Android Lint — moot until **B3/1.2** gives lint somewhere to run, see §2.

From this pass: `anonymousId` is now `suspend`/`async` on both platforms (**4.5**), minted eagerly
by a `Deferred`/detached `Task` started as soon as the client exists rather than lazily on first
read, so a caller racing the warm-up awaits the SAME in-flight generation instead of blocking a
thread or getting a spurious `null`; a refusal (locked device, transient keystore/Secure Enclave
hiccup) is never cached, so one bad read cannot turn into a permanently inert install — pinned by
a dedicated recovery test on both platforms. `resetAnonymousId()` now returns `Bool`/`Boolean` (closing the last of the previously-partial
`resetAnonymousId` row: Android's internal `AnonymousIdStore.reset()` already reported success
faithfully, but the public `FrakClient.resetAnonymousId(): Unit` had nowhere to put that
information until this ABI change): Android's keystore delete can genuinely fail and the caller
needs to know whether the id actually rotated before purging queued events under the old one;
iOS's equivalent cannot fail by construction (deletion only ever drops the stored key *reference*,
never touches the Secure Enclave) and returns `true` unconditionally — a deliberate platform
asymmetry kept for the sake of one shared cross-platform erasure contract, not an oversight. `configUpdates`/`updates` now fires
from background revalidation, not just a caller's own direct fetch (**C3**): `ConfigStore`, not
`DefaultFrakClient`, owns the stream, since `fetch` is the one choke point every resolved config
passes through on either path. A monotonic sequence number minted at the START of each fetch (not
at completion) and compared under the same lock/actor isolation that publishes closes the lost-
update race across two different merchant/query keys racing to publish into the single cache slot
(**C4**) — the specific case the finding named, a background revalidation racing a foreground
`forceRefresh` for the SAME key, turns out to be structurally unreachable, since `SingleFlight`
already collapses both onto one in-flight fetch; the guard's proven value is the cross-key case,
named honestly in both platforms' source comments rather than left to imply it does something it
doesn't. Reconciliation now has an SDK-owned monotonic row id, not just a closed lock window
(**2.7** upgraded from partial to closed): `idempotencyKey` is caller-suppliable and not
guaranteed unique, so two colliding rows could reconcile the wrong one, or both. A migration
rewrite that fails to persist is now treated as non-durable — `read()` returns nothing rather than
handing out ids that only exist in memory, since a caller reconciling delivery against unpersisted
ids would match nothing and silently re-upload every already-delivered event (worst case the
un-keyed `arrival` event, which the backend cannot dedupe either); and a row appended before an
old-format file is ever read now reserves id-space for the rows still awaiting migration, so the
newest row keeps the highest id instead of the invariant silently inverting. Android's
read-then-replace reconcile moved inside `EventQueue` as one dispatcher hop, matching the iOS
actor twin, so a future caller reaching `EventQueue` outside the tracker's mutex can't reopen the
window the doc already warned about.

Android's build plumbing is no longer duplicated per module (**5.5**, upgraded from partial to
closed): `explicitApi`/`jvmTarget`/language version/`jvmDefault` are configured once by the
`frak-publish` convention plugin (`buildSrc/src/main/kotlin/frak-publish.gradle.kts:55-58`)
instead of in each module's own `kotlin {}` block, and both module build files now carry only a
comment pointing there. Android-only by construction — `Package.swift` has a single
`swiftSettings` site, so iOS never had the duplication.

S5's iOS half was attempted as a genuine streaming abort (`session.bytes(for:)`, batched into an
`AsyncBytes` iterator) during this pass and reverted: draining `AsyncBytes` is one `await` per
**byte**, replacing a single `data(for:)` call with roughly 100,000 suspension points for a
rewards-sized response — a real regression on the production path, not a theoretical one — and the
abort path's claim that letting the stream fall out of scope tears down the underlying task was
unverifiable without a compiler and is contradicted by `AsyncBytes` publicly exposing its
`URLSessionDataTask`. iOS stays on `data(for:)` with a pre-check plus a post-buffer cap; §3.1's row
is unchanged.

Two regressions that the remediation itself introduced are worth remembering, because both
looked local: making `ResolvedPlacement.translations` non-optional on a *synthesized*
`Decodable` type made the backend's routine omission drop **every** placement; and
detaching the tracking drain (4.3) widened 2.7's window and silently deleted iOS's drain
coalescing.

One lesson from the rewiring belongs with those: **three review passes missed the dead KDoc links because they swept `docs/` and the READMEs, not doc comments inside `src/main`** — the surface merchants actually read in autocomplete.
