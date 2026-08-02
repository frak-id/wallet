# Native SDK Audit — Android + iOS Core

13 parallel review passes over `sdk/android` and `sdk/ios` (API surface, concurrency,
networking, build/packaging, parity, security/privacy, tests, spec conformance,
architecture/DX). Findings below are deduplicated and re-verified against source by
hand; claims that did not survive verification are listed in §8.

No toolchain was available in the audit environment (`java`, `swift`, `gradle` all
absent), so nothing was compiled or executed. Everything is static analysis.

---

## Status — what the `feat/native-mobile-sdk` working tree has since addressed

This document was written **before** a remediation pass. The findings below are kept as
originally written; this section is the delta.

> **Toolchain note.** The remediation pass itself had no toolchain, so it shipped
> unverified. A later pass *did* have JDK 24 / Swift 6 / Xcode and compiled and ran both
> platforms. Entries below marked **[verified]** were executed; unmarked ones are still
> source-only claims.

**Fixed**

| ID | Where |
|---|---|
| **B1** — `SingleFlight` `computeIfAbsent` re-entrancy | `config/SingleFlight.kt` — `putIfAbsent` + `CompletableDeferred`, cleanup from `Job.invokeOnCompletion`, install wrapped in try/catch. Pinned by the new `config/SingleFlightTest.kt` (50 callers, real thread pool, FIFO registration barrier) |
| **B2** — blocking disk I/O on the caller's thread | `config/ConfigStore.kt` — `readPersisted`/`writePersisted` are `suspend` + `withContext(ioDispatcher)`; hydration hops to the SDK scope via `SingleFlight`; lock scope narrowed. The KDoc that asserted the opposite is corrected |
| **D1** — UI artifact cannot read the config tree | Both platforms: the whole `ResolvedSdkConfig` tree is now `public` |
| **A10** — merchant fakes cannot round-trip through equality | `sdkConfig` is a public constructor parameter on both platforms; Android `toString` prints all 7 fields |
| **T1 / T2** — no `SingleFlight` test, no `Frak` entry-point test | `SingleFlightTest.kt` (Android), `FrakTests.swift` (iOS). Each platform still lacks the other's |

**Partially fixed**

- **A1** — BCV is wired (`buildSrc/.../frak-publish.gradle.kts`, catalog, `check`/`apiDump` scripts, README).
  **[verified]** The wiring was also *broken*: BCV's Android path needs KGP on buildSrc's classpath and
  only AGP was added, so the whole Android build died with `NoClassDefFoundError:
  KotlinAndroidProjectExtension` before any task ran. Fixed by adding KGP to buildSrc and moving the
  root/module `alias(libs.plugins.kotlin.android)` to an unversioned `id(...)`, matching AGP's existing
  pattern. `apiDump` now runs: `frak-sdk.api` is 369 lines, `frak-sdk-ui.api` is an empty file (BCV does
  write one for a module with no public API). **Neither is committed** — see
  [`06-abi-decisions.md`](./06-abi-decisions.md).
- **D3** — `FrakLogSink` shipped on both platforms. Still true: **no request is logged at any level** —
  neither HTTP client logs a URL, status or duration, and there is still no transport-injection seam.
- **T8** — test counts, the "everything is internal" claims and `AGENTS.md`'s "only real source file"
  line are corrected. Every other claim in that table is still false.

**Introduced by the remediation and then fixed within it** (recorded so the pattern is not repeated)

- iOS `ResolvedPlacement.translations` was made non-optional for Android parity while the type used
  *synthesized* `Decodable`, which ignores memberwise defaults and hard-requires the key. The backend
  omits it routinely, and the parent's `try?` swallowed the throw into dropping **every** placement.
  Fixed with a hand-written forgiving `init(from:)` plus a regression fixture. **Any non-optional
  stored property on a synthesized-`Decodable` wire type is this bug.**
- Entry-point `withContext(ioDispatcher)` wrappers starved a 2-slot pool shared with blocking socket
  reads and moved dispatch outside `frakCall`'s error boundary. Reverted; the narrow `withContext`
  inside `ConfigStore` was already sufficient.

**Unchanged** — everything else, including all six ship blockers in §1 other than B1 and B2:
B3 (nothing builds/tests/publishes in CI), B4 (iOS toolchain floor), B5 (strict concurrency not
enabled for consumers), B6 (GPL-3.0), and all of §2 security/privacy, §4, and most of §5–§7.

§3 concurrency: **C1 and C2 are now fixed [verified]** — the iOS `SingleFlight` was rewritten to match
its Kotlin twin's guarantees. Waiters no longer `await task.value` (which ignores the awaiter's
cancellation, proven by probe); each registers a continuation resumed by whichever comes first, the
flight settling or its own cancellation. Eviction is identity-guarded and reuse requires the flight to
still be running, closing the join-a-finished-task window that made `forceRefresh` skip the network.
Five tests added; all four failure modes reproduce against the old implementation. C3–C8 are unchanged.

**Open decisions this pass surfaced but deliberately did not take**

Moved to [`06-abi-decisions.md`](./06-abi-decisions.md), which restates them against the *actual*
generated dump rather than a predicted one — the `$default` constructor freeze (15 public types, not
10), `@InternalFrakApi` vs promoting 51 properties, iOS's now-public `init(from:)`, and
`FrakLogSink`'s cross-platform divergence. **They block committing the `.api` dump.**

---

## 0. Verdict

The internals are genuinely good. The SWR cache, jittered backoff with `Retry-After`
as a floor, `frakCall`'s cancellation-first error boundary, the `internal`-until-there-
is-a-reader discipline, the manifest hygiene, and the error *messages* are all better
than most shipped commercial SDKs. The code reasons about its own hazards in comments,
frequently correctly.

The problem is that **the reasoning stayed in prose and never became a control**, and
that the two most load-bearing invariants are actually broken:

1. Android's `SingleFlight` — the class every network path funnels through — contains
   an illegal `ConcurrentHashMap` operation that the team already hit, worked around in
   a *test comment*, and never fixed.
2. Nothing in the repo builds, tests, lints, size-checks, or publishes either SDK. Every
   "green" claim in both READMEs is a local, unreproduced observation.

Roughly: **A− on design, D on enforcement.**

---

## 1. Ship blockers

### B1 — Android `SingleFlight` mutates its own map from inside `computeIfAbsent`

`android/.../config/SingleFlight.kt:33-41`

```kotlin
inFlight.computeIfAbsent(key) { computedKey ->
    scope.async { runCatching { block() } }
        .apply { invokeOnCompletion { inFlight.remove(computedKey, this) } }  // same map, same key
}
```

`invokeOnCompletion` on an already-complete `Job` fires **synchronously on the calling
thread**. `scope.async` dispatches to a different thread (`Dispatchers.IO.limitedParallelism(2)`,
`DefaultFrakClient.kt:116`), which is free to finish `block()` before the calling thread
reaches `.apply { … }`. The handler then re-enters the same map on the same key, from
inside the mapping function — explicitly forbidden by `ConcurrentHashMap`'s contract.

Two outcomes, both bad:

- **Empty bin:** the thread spins forever inside `computeIfAbsent` holding the bin
  monitor, or throws `IllegalStateException("Recursive update")`.
- **Non-empty bin:** the nested `remove` is a no-op, an already-completed deferred is
  installed, and its completion handler has already fired and will never fire again.
  The entry is **immortal** — every subsequent `resolveConfig`/`bestReward` for that key
  returns the same cached `Result` for the rest of the process lifetime. If it was a
  failure, the SDK throws the same error forever, with no network call, no backoff
  progression, and `forceRefresh = true` cannot break out.

The team already hit this. `core/DefaultFrakClientTest.kt:93-96` documents it as a
*test-configuration constraint*:

> `// Unconfined here completes the async before ConcurrentHashMap.computeIfAbsent returns,`
> `// which recurses into the same map from invokeOnCompletion and throws "Recursive update".`

Every existing test runs on a single-threaded `StandardTestDispatcher` — the one
configuration where this cannot fire. Production runs on a real 2-thread pool.

**Fix:** install the entry before the work can complete, and clean up outside the callback.

```kotlin
val fresh = CompletableDeferred<Result<T>>()
val existing = inFlight.putIfAbsent(key, fresh)
if (existing == null) {
    scope.launch { fresh.complete(runCatching { block() }); inFlight.remove(key, fresh) }
}
return ((existing ?: fresh) as Deferred<Result<T>>).await().getOrThrow()
```

### B2 — Android does all blocking I/O on the caller's thread

`grep -rn "withContext" android/frak-sdk/src/main/kotlin/` → **zero hits.**

`suspend` confers no thread affinity. Trace the read path from the idiomatic call site:

| hop | dispatcher |
| --- | --- |
| `lifecycleScope.launch { Frak.client.resolveConfig() }` | `Main.immediate` |
| `DefaultFrakClient.resolveConfig` (`:62`) | Main |
| `ConfigStore.resolve` (`:71`) → `readCache` (`:95`) | Main |
| `readPersisted` (`:181`) — plain `fun`, blocking | Main |
| `SharedPreferencesStore.getString` (`KeyValueStore.kt:46`) | Main |

The `by lazy` at `KeyValueStore.kt:42` guarantees the **first** call is the one that runs
`getSharedPreferences()`, which blocks on `awaitLoadedLocked()` until the XML is read off
flash — then `JSONObject(raw)` and a full `ResolvedConfigDecoder.decode()` run on top.
Only `HttpClient.attempt` hops to `ioDispatcher` (`HttpClient.kt:88`).

Result: StrictMode `DiskReadViolation` in every merchant app (`penaltyDeath` → crash),
cold-start jank, ANR risk on contended flash. The KDoc at `ConfigStore.kt:91-94` asserts
the opposite — *"Disk is touched here — inside a suspend call"* — conflating `suspend`
with "off the main thread".

Compounding: the mutex is held across that disk read and across `writePersisted`
(`ConfigStore.kt:96-101`, `:114-119`), so a main-thread stall inside the lock blocks the
IO-thread fetch behind it.

**Fix:** `withContext(ioDispatcher)` at each `DefaultFrakClient` entry point, and make
`readPersisted`/`writePersisted` suspend so the guarantee cannot be lost by a new call
site. Do the I/O and decode outside the mutex; take the lock only to publish the `Entry`.

### B3 — Nothing builds, tests, lints, or publishes either SDK

- **CI:** `.github/workflows/apps.yaml:8` triggers on `sdk/**` but its only job runs
  `bun run build:sdk`, whose directory list is `(core legacy react components)`. No
  `setup-java`, no `./gradlew`, no macOS runner for `swift build`. `sdk/ios` appears in
  zero workflows. The 97 Kotlin `@Test`s and 122 Swift `@Test`s have never run in CI.
- **Unreachable gates:** `checkSdkVersionMatchesArtifact` and `checkDexSizeBudget` hang
  off `check` (`frak-publish.gradle.kts:178`, `:255`), and `scripts/run.sh` exposes only
  `build` → `assembleRelease` and `test` → `test`. **No documented command runs `check`.**
- **Publishing:** there is no `publishing { repositories { … } }` block anywhere and no
  Central Portal plugin. `grep -i "central\|sonatype\|portal"` over `sdk/android` returns
  comments and `mavenCentral()` *resolution* repos only. The only reachable target is
  `publishToMavenLocal`. `android/README.md:57-64` states Central Portal distribution as
  fact.
- **Wrapper:** no `distributionSha256Sum` in `gradle/wrapper/gradle-wrapper.properties`,
  and the committed `gradle-wrapper.jar` is byte-identical to `example/native-android`'s,
  whose `distributionUrl` is Gradle **8.7** — i.e. the wrapper was copied and the
  properties hand-edited, not regenerated. No `gradle/actions/wrapper-validation`.

### B4 — iOS: the advertised toolchain floor cannot compile the sources

`Package.swift:1` is `// swift-tools-version: 5.9`; `ios/README.md:4` says "Swift 5.9+".

- `Core/FrakCall.swift:10` and `Config/Backoff.swift:79` use `isolated (any Actor)? = #isolation`
  — SE-0420, **Swift 6.0 / Xcode 16**.
- `Frak.swift:16` uses `nonisolated(unsafe)` — SE-0412, **Swift 5.10**.

A merchant on Xcode 15.x resolves the package because the manifest says 5.9, then fails
to compile it — and a SwiftPM dependency that fails to build is unfixable from the
consumer side.

### B5 — iOS: Swift 6 strict concurrency is enabled for nobody who consumes the package

`Package.swift:27-40` declares **no `swiftSettings` on any target**. The only place
`-swift-version 6` appears is `scripts/run.sh:44`. A merchant compiles `FrakSDK` in
Swift 5 language mode with *minimal* concurrency checking. The headline claim in
`sdk/AGENTS.md:52` and `ios/README.md:4` describes a configuration no consumer ever uses.

The manifest comment blames tools-version 5.9 for blocking `.swiftLanguageMode(_:)` —
true — but `.enableUpcomingFeature("StrictConcurrency")` has been available since
tools-version 5.8, is the SE-0337 complete-checking flag, and (unlike `.unsafeFlags`) is
permitted in a resolved dependency. It was available and was not used.

That this is not merely cosmetic: `HTTPClient.swift:17` declares `struct HTTPClient: Sendable`
while `:51` stores `private let redirectDelegate = NoRedirectDelegate()`, a
`final class: NSObject` with no `Sendable` conformance. That is a hard error under
Swift 6 and is invisible today. The one `HTTPClient` value is shared across two actors
(`DefaultFrakClient.swift:22-24`).

### B6 — Licensing: GPL-3.0 on a statically-linked mobile SDK

`LICENSE` is GPLv3; `sdk/ios/` has no LICENSE of its own; `frak-publish.gradle.kts:48`
hardcodes GPL-3.0 into the POM. `android/README.md:82-89` already flags this as an open
question and is right to. GPLv3's anti-Tivoization and "further restrictions" clauses are
well-established as incompatible with App Store distribution, and no merchant legal team
will approve statically linking copyleft into a proprietary app. Every comparable SDK
(Branch, AppsFlyer, Adjust) ships MIT or Apache-2.0. Relicensing after merchants have
integrated is far harder than choosing now.

---

## 2. Security & privacy

### S1 — iOS forces `privacy: .public` on every logged value

`Core/FrakLogger.swift:38-44` — all four levels interpolate `\(message, privacy: .public)`.

`os_log` redacts dynamic interpolations to `<private>` **by default**, specifically so an
SDK cannot write user data into the unified log. This inverts that for 100% of output,
unconditionally, with no per-call-site opt-in. The unified log store is persistent, read
by Console.app from any paired Mac, and captured wholesale in a sysdiagnose.

Today that leaks the merchant UUID and raw backend response bodies. The moment the
anonymous identity / `x-frak-client-id` lands, it flows through the same funnel with the
same annotation, and nobody will remember to revisit this file.

### S2 — Raw backend response bodies logged at `ERROR` on both platforms

`android/.../config/ConfigStore.kt:146` — `logger.error("… rejected as malformed: ${response.body.take(200)}")`
`ios/.../Config/ConfigStore.swift:123-124` — same, via `text.prefix(200)`

A 422 body is exactly the thing that echoes the offending input back. Two aggravators:
it fires at `ERROR` (the most conservative non-silent level — a merchant setting `ERROR`
expects "tell me when something breaks", not "dump response bodies"), and on Android it
lands in logcat, which in-process crash reporters attach to crash reports by default.
Move both to `debug`; log the status and the error `code`, never the body.

### S3 — Android: the backup exclusion is inert, and wrong for API 24–30

`res/xml/frak_data_extraction_rules.xml` is referenced by **nothing** —
`grep -rn "dataExtractionRules\|fullBackupContent"` across the repo returns zero manifest,
Gradle or doc hits. Two independent gaps:

- **Not wired.** The manifest comment (`:44-49`) correctly explains why a library cannot
  declare the attribute, and concludes the file ships "for merchants to reference". There
  is no integration section telling a merchant to do that. Net effect: on every merchant
  app with the default `allowBackup="true"`, `id.frak.sdk.config.xml` **is** uploaded to
  Google Drive and **is** cloned by device-to-device transfer.
- **Wrong format for most of the range.** `<data-extraction-rules>` is honoured on API 31+
  only. `minSdk` is 24. API 24–30 need `android:fullBackupContent` with a
  `<full-backup-content>` document, which does not exist.

The file's own comment says carrying the prefs to a new device "resurrects a 'fresh'
user's identity — the exact behaviour that makes Keychain unusable on iOS". The mechanism
meant to prevent that does not run. This is the SDK failing its own stated threat model.

### S4 — iOS has no backup story at all, and contradicts itself on identity at rest

`Config/KeyValueStore.swift:11-21` writes to `UserDefaults(suiteName: "id.frak.sdk.config")`,
i.e. `~/Library/Preferences/…plist`, which is in the iCloud/iTunes backup set.
`NSURLIsExcludedFromBackupKey` cannot be applied to a `UserDefaults` suite.

Android has a mechanism (however broken); iOS has none, and neither the code nor the
README acknowledges the asymmetry. Worse, `PrivacyInfo.xcprivacy:39-41` says the anonymous
id will live in this same suite, while `ios/README.md:22` says it will be a **Secure
Enclave keypair**. One of those is wrong, and the privacy manifest is the merchant-facing
one. The two platforms currently have contradictory identity-lifetime semantics baked in
*before the identity code exists*.

Also: the resolve-response cache belongs in `Library/Caches/` (purgeable, not backed up),
not `UserDefaults`.

### S5 — Unbounded response body read on both platforms

`android/.../net/HttpClient.kt:115` — `stream?.use { it.readBytes().toString(UTF_8) }`
`ios/.../Net/HTTPClient.swift:107` — `session.data(for:)` buffers fully

No size cap, no `Content-Length` check. The 20s deadline is not a size bound. A hostile or
merely broken backend OOMs the **host app**. `Accept-Encoding` is deliberately unset so
the platform inflates transparently, meaning the advertised compressed length tells you
nothing — a ~1 MB gzip bomb inflates past a 192 MB Android heap.

Android amplifies it: `ConfigStore.kt:204-212` persists the raw body verbatim into
SharedPreferences, so one oversized response **permanently poisons the install** — it is
re-parsed on every cold start forever, because `readPersisted` discards only on decode
failure, never on size.

### S6 — No runtime consent gate, no opt-out, no erasure

`trackingEnabled` is a `val`/`let` on an immutable `FrakConfig`, `initialize` is
first-write-wins (`Frak.kt:50-53`, `Frak.swift:26-29`), and there is no setter, no getter,
no `Frak.shutdown()`, and no public way to delete what is already stored
(`KeyValueStore.remove` is `internal`).

A user who withdraws consent mid-session cannot be honoured until the process is killed
and relaunched with a different config. GDPR Art. 7(3) requires withdrawal to be as easy
as consent and to take effect; Art. 17 requires an erasure path. Every incumbent ships
this (`Adjust.setEnabled`, `AppsFlyerLib.stop`, `Branch.disableTracking`).

The *gating* itself is correct — `requireTrackingEnabled()` sits at the right chokepoint
and nothing issues a request when disabled. The switch just has no runtime handle.

### S7 — No scheme validation; cleartext and `file:` reachable via `FrakEnvironment.Custom`

`android/.../core/FrakEnvironment.kt:53-59`, `ios/.../Core/FrakEnvironment.swift:22,44-46`

`Custom(wallet:backend:)` is public and accepts any string; neither platform validates the
scheme, only trims a trailing slash. `Custom(backend = "http://…")` ships to production
because it worked in a debug build, and any merchant with a `usesCleartextTraffic` /
`NSAllowsArbitraryLoads` exception for their own API silently drops SDK traffic to
plaintext too. On Android a non-HTTP scheme additionally produces a `ClassCastException`
at `HttpClient.kt:25` or a `MalformedURLException` at `:51` — the latter thrown *outside*
the mapping `try` at `:54`, so it escapes as `FrakError.Decoding("unexpected failure")`.

Separately, `FrakEnvironment.Development` is public and shippable with no warning, and
certificate pinning is absent and **undocumented** — that needs to be a recorded decision,
not an omission.

### S8 — Crash-capable constructs (exhaustive)

Both codebases are unusually clean here and this deserves saying: **zero** `!!`, `error()`,
`require`/`check`, `lateinit` or literal index access in Android `src/main`; **zero** force
unwraps, `try!`, `as!`, `fatalError`, `precondition` or IUOs in `sdk/ios/Sources` — every
`!` in the Swift tree is a boolean negation. `.swift-format` enforces `NeverForceUnwrap` /
`NeverUseForceTry` and the code holds to it.

The real ones:

| Platform | Location | Construct | Reachable today |
| --- | --- | --- | --- |
| iOS | `Net/Deadline.swift:17` | `UInt64(seconds * 1_000_000_000)` — traps on negative/NaN/∞/overflow, **uncatchable** | No (`overallDeadlineSeconds` is internal, default 20) — becomes reachable the moment a timeout is configurable |
| Android | `net/HttpClient.kt:25` | `it.openConnection() as HttpURLConnection` — unchecked cast | Yes, via `Custom` env |
| Android | `net/HttpClient.kt:51` | `URL(...)` throws `MalformedURLException` outside the `try` | Yes, via `Custom` env |
| Android | `net/HttpClient.kt:115` / iOS `Net/HTTPClient.swift:107` | unbounded read → OOM / jetsam | Yes (S5) |
| Android | `config/SingleFlight.kt:33-40` | `ISE("Recursive update")` or spin | Yes (B1) |
| Android | `config/SingleFlight.kt:41` | `@Suppress`ed `as Deferred<Result<T>>` | Not today (disjoint key namespaces); one refactor away |
| Android | `config/KeyValueStore.kt:40` | `context.applicationContext` — platform type → NPE if no attached Application | Yes (init from a `ContentProvider` before `attachInfo`) |
| Both | `JSONObject(body)` / `JSONSerialization` | `StackOverflowError` on deeply nested JSON — an `Error`, not catchable on iOS | Yes, hostile backend |

Android's `frakCall` catches `Throwable` and so contains most of these on the foreground
path (at the cost of mislabelling — see A4); the background revalidation path
(`ConfigStore.kt:164`, `catch (failure: FrakError)`) does not, and lands in the
`CoroutineExceptionHandler`.

---

## 3. Concurrency

### C1 — iOS `SingleFlight` clears the slot on the leader's resumption, not on task completion

`Config/SingleFlight.swift:9-15`

```swift
if let existing = inFlight[key] { return try await existing.value }
let task = Task { try await work() }
inFlight[key] = task
defer { inFlight[key] = nil }
return try await task.value
```

Two distinct defects:

- **Join-after-completion.** `defer` runs when the *leader's* continuation is rescheduled
  on the actor. Between the task completing and the leader resuming, `inFlight[key]` still
  holds a **finished** task, and Swift actor executors are explicitly not FIFO. A caller
  arriving in that window — including `resolve(query, forceRefresh: true)` — takes the
  `if let existing` path and is served the already-completed result **with no network
  call**. `forceRefresh` silently does nothing.
- **Leader cancellation evicts a live flight.** The `defer` also runs if the leader's
  `await` throws or is cancelled while the unstructured `Task` keeps running, so the next
  caller starts a duplicate request.

The Kotlin twin's `remove(key, value)` + `invokeOnCompletion` is the correct shape for
both (setting aside B1). Fix: clear from inside the task body, identity-guarded
(`if inFlight[key] === task`), and fold `forceRefresh` into the key.

### C2 — iOS `SingleFlight` makes every public SDK call non-cancellable

`Config/SingleFlight.swift:12-15`. `Task { }` is unstructured — it does not inherit the
caller's cancellation — and `await task.value` is not resumed early by the awaiter's
cancellation. Every network path goes through here (`ConfigStore.swift:77,136`,
`RewardRepository.swift:55`).

So a SwiftUI `.task` that is cancelled on disappear: the URLSession request keeps running,
the connection is held, and the caller is parked for the full 20s deadline. The genuine
cancellation support in `HTTPClient`/`Deadline` — proven by `HTTPClientTests.swift:155` —
is entirely insulated from callers by this one layer, and `frakCall`'s carefully-documented
`CancellationError` arm (`FrakCall.swift:7-8`) is dead code for every real call site.

`SingleFlightTests.swift:21-42` is the only cancellation test and it never awaits
`cancelled.value`. Adding `#expect(throws: CancellationError.self)` would fail today.

### C3 — `configUpdates` never fires from the background revalidation it exists for

`android/.../core/DefaultFrakClient.kt:66` — `configState.value` is assigned in exactly one
place, inside `resolveConfig`. `ios/.../DefaultFrakClient.swift:49` — same for `latestConfig`.

`ConfigStore.revalidateInBackground` (`ConfigStore.kt:161`, `ConfigStore.swift:133`)
refreshes memory and disk but has no channel back to the client. A merchant subscribing to
`configUpdates` to react to a dashboard change will not see it until they *actively call*
`resolveConfig()` again — at which point they didn't need the flow. The KDoc at
`FrakClient.kt:22-27` implies otherwise. A `StateFlow` whose only writer is the caller's
own return value has no reason to exist.

### C4 — Lost update on `configUpdates` across the `await`

`ios/.../DefaultFrakClient.swift:45-52` (and the Android equivalent). The read-compare-write
at `:48-49` follows a suspension point on a reentrant actor, so **resumption order, not
resolution order, decides the winner**: a caller served a stale cache entry can resume
after a caller whose network fetch landed a newer config, and roll `latestConfig` back.
`configUpdates` then emits new-then-old and `currentConfig` permanently reports the older
value. Guard with a monotonic sequence or compare `fetchedAt`.

### C5 — `revalidating` can be leaked permanently, disabling revalidation for the process

`android/.../config/ConfigStore.kt:169` — `finally { mutex.withLock { revalidating.remove(key) } }`.
`Mutex.withLock` is a suspend function; invoked in an already-cancelling coroutine it
throws at the first suspension attempt and the `remove` never runs. `key` then stays in
`revalidating` forever, and `:157` disables **all** future background revalidation for it.
Since `ConfigStore` has no hard expiry by design, the config is served stale indefinitely
with no network attempt. Fix: `withContext(NonCancellable) { … }`.

### C6 — `Backoff` takes the caller's non-reentrant `Mutex` as a parameter

`android/.../config/Backoff.kt:73-93`. The class doc says "callers hold it behind their own
mutex", yet `runOrRecordFailure(mutex, …)` and `recordFailureAndThrow(mutex, …)` acquire it
themselves. `kotlinx.coroutines.sync.Mutex` is **not reentrant** — any future call site
that invokes either helper from inside `mutex.withLock { }` parks forever, with no timeout,
and never releases. All four current call sites are outside the lock (verified), but
nothing in the type system, the naming or the tests prevents the next one. Related:
`isBackingOff` *mutates* `state` despite reading as a pure query.

### C7 — The SDK scope is never cancelled; there is no shutdown on either platform

`android/.../core/DefaultFrakClient.kt:46-53`, `ios/.../Frak.swift:16`,
`ios/.../Net/HTTPClient.swift:39`. No `Job.cancel`, no `close()`, no `shutdown()` anywhere.
`Frak.resetForTesting()` (`Frak.kt:97`) drops the reference while leaving the scope and any
in-flight revalidation running — so in a JVM suite, work from test N can call
`writePersisted` into shared storage during test N+1. iOS's `revalidateInBackground` `Task`
retains no handle and pins `ConfigStore → HTTPClient → URLSession` for up to 20s past app
backgrounding or client teardown. For an SDK embedded in someone else's app, "no way to
stop me" is a real hazard, and it makes S6's consent story unimplementable.

### C8 — The 2-slot dispatcher runs both blocking socket reads and the entire SDK scope

`android/.../core/DefaultFrakClient.kt:116` — `Dispatchers.IO.limitedParallelism(2)` is
passed to both the SDK `CoroutineScope` (`:49`) and every `HttpClient` (`:38`). Two
concurrent requests against a black-holing network occupy both slots for ~20-40s, during
which no `SingleFlight` coroutine can start, no revalidation can start, and a coroutine
holding `ConfigStore.mutex` cannot be resumed — so it holds the lock for the full socket
timeout. `limitedParallelism` is a view and reserves nothing, so the stated rationale
(don't starve the merchant's disk I/O) isn't achieved; it only starves the SDK.

---

## 4. Networking & data correctness

### N1 — Money is `Double` on both platforms

`android/.../rewards/Rewards.kt:12-18`, `ios/.../Rewards/Rewards.swift:7-10`

`amount` is documented as **raw token units**. An 18-decimal ERC-20 expresses 1 token as
`1e18`; `Double` is exact only to 2^53 ≈ 9.007e15. Anything above that is silently rounded
at decode time — no error, no warning. Tests only ever use `1000`/`100`/`5000`.

Two more edges:

- **Non-finite values pass through.** AOSP `JSONTokener` falls back to `Double.valueOf`
  with no finiteness check, so `{"eurAmount": 1e400}` decodes to `+∞` and is handed to the
  merchant as a reward. Nothing rejects a negative amount either.
- **The contract is fragile in the direction the backend will move.** The backend already
  computes these as raw JS float multiplies, so artefacts like `12.100000000000001` are on
  the wire today. The standard fix — stringifying amounts — makes `opt(key) as? Number`
  return null and **every already-shipped binary hard-fails the entire rewards decode**.

Fix now, while the ABI is unpublished: `Decimal`/`BigDecimal` (or minor-units + scale) for
raw units, reject non-finite and negative, and accept a `String`-encoded number as a
fallback so a future bigint migration doesn't brick shipped builds.

### N2 — Two different percent-encoders on the wire

`android/.../net/HttpClient.kt:146-158` is a correct RFC 3986 strict allowlist
(`A-Za-z0-9-._~`), byte-wise over UTF-8 — genuinely well done, and it correctly avoids
`URLEncoder`'s `+`-for-space. `ios/.../Net/HTTPClient.swift:127-131` uses
`URLComponents.queryItems` (`urlQueryAllowed`), which leaves `: / , ; ! $ ' ( ) * @`
unescaped, then patches only `+`.

A merchant-supplied `targetInteraction` like `purchase:v2` or `cart,add` produces
**different request URLs on the two platforms** while producing the *same* cache key.
Both encoding tests are too weak to see it (Android asserts only space→`%20`, iOS only
`a b+c`).

### N3 — One malformed element fails the entire response

`android/.../net/JsonReader.kt:93-102` + `rewards/RewardsDecoder.kt:75-83`. `objectArray`
skips non-object entries but does nothing about a `transform` that throws. A backend with
50 campaigns, one of which has a tier carrying neither `percent` nor `amount`, returns
**nothing at all** instead of the 49 good campaigns. This contradicts the decoder's own
stated rationale ("a merchant's binary is frozen the day they ship it while the backend
deploys continuously"). iOS's `ForgivingArray` has the same shape
(`JSONDecoding.swift:85`, `try Element(from: entry)`).

Related iOS-only divergence: a `tiered` payout with an **absent** `tiers` key throws
`keyNotFound` (`RewardsDecoder.swift:60` uses `decode`, not `decodeIfPresent`) where
Android returns an empty list.

### N4 — Timeout constants are mutually inconsistent (Android)

`net/HttpClient.kt:170-174` — connect 10s + read 15s = 25s worst case for a single attempt,
against a 20s overall deadline. So `READ_TIMEOUT_MILLIS` is dead code on a slow-but-alive
server, and the retry at `:62` is unreachable whenever the first failure was itself a
timeout. **No test exercises `OVERALL_DEADLINE_MILLIS` at all** — and it has no injection
seam, unlike iOS's `overallDeadlineSeconds`.

### N5 — A 204/205/304 is misread as a transport failure (Android)

`net/HttpClient.kt:114` — `if (status in 200..399) inputStream else errorStream`. AOSP's
`getInputStream()` throws `IOException("No response body exists")` for a body-less
response, so a 204 lands in `catch (retryable: IOException)`, **issues a duplicate
request**, and surfaces as `FrakError.Network`. This directly contradicts the design note
at `:105` that a 3xx should surface as a server error — it never does, and `Location` is
dropped. `HttpClientTest.kt:173` ("redirects are declined") asserts the flag on a *200*.

### N6 — Retries are too broad and immediate

- Android retries any `IOException` — including `SSLHandshakeException` /
  `SSLPeerUnverifiedException`. An active MITM produces one silent automatic retry and
  then a generic "network request failed", indistinguishable from a train tunnel.
- iOS retries any `URLError` (`HTTPClient.swift:83`) — including `.secureConnectionFailed`,
  `.serverCertificateUntrusted`, `.cannotFindHost`, `.notConnectedToInternet`.
- Neither delays. Zero backoff, zero jitter, `Retry-After` parsed but not consumed by this
  retry — so a fleet-wide backend blip produces instant 2× amplification at exactly the
  moment the backend is failing, which is the opposite of what `Backoff` exists for.

### N7 — Clock skew can pin the cache as fresh forever

All TTL and backoff arithmetic uses wall clock (`System.currentTimeMillis()` / `Date()`),
and `fetchedAt` comes off disk unvalidated (`ConfigStore.kt:188`, `ConfigStore.swift:155`).
If the clock was ahead at write time, `now - fetchedAt` is negative, which is `< TTL`, so
the entry is fresh — and since `ConfigStore` has no hard expiry by design, it is served
**forever, across launches**. The same negative-age path applies to `RewardRepository`'s
30s TTL, i.e. serving a stale money figure indefinitely, which is precisely what that
class's doc says it exists to prevent. Use a monotonic source for in-memory TTLs and
clamp `fetchedAt > now` on read.

### N8 — iOS session accepts and replays cookies

`Net/HTTPClient.swift:39-46` correctly uses `.ephemeral` with `urlCache = nil` — good — but
leaves `httpShouldSetCookies` at `true`. Because `defaultSession` is a process-wide
`static let` that is never invalidated, any `Set-Cookie` persists for the app lifetime and
is replayed on every SDK request: a de facto session identifier the SDK neither creates
nor declares, against a `PrivacyInfo.xcprivacy` that says `NSPrivacyTracking = false` and
`NSPrivacyCollectedDataTypes = []`.

---

## 5. Public API / binary compatibility

### A1 — No binary-compatibility gate on either platform

`grep -rn "binary-compatibility\|apiValidation\|metalava"` → nothing; no `.api` dump exists.
`explicitApi()` forces you to *write* `public`; it does not tell you that you *changed*
something public. Every hazard below is invisible to CI today — and CI doesn't run anyway
(B3). For a library whose entire design rationale is "a merchant's binary freezes at store
submission", this is the cheapest possible guard and it is absent. Add
`binary-compatibility-validator`, commit `frak-sdk.api`, wire `apiCheck` into `check`, and
do it **before** the first publish.

### A2 — Sealed/enum hierarchies make an exhaustive `when`/`switch` a consumer break

`FrakError`, `FrakEnvironment`, `RewardTier`, `RewardAudience`, `FrakCurrency`, `FrakLanguage`
on both platforms. Adding `FrakError.RateLimited` in 0.3.0 fails every merchant's source
build on upgrade, and throws `NoWhenBranchMatchedException` in an already-shipped binary.
The KDoc frames this as a feature — *"Sealed so a `when` over it stays exhaustive as arms
are added"* — which is backwards for a published library.

Note `EstimatedReward.Unknown(payoutType)` (`Rewards.kt:69`, `Rewards.swift:49`) gets this
exactly right. The pattern was understood and then not applied to the other five.

### A3 — Adding a field to `FrakConfig` is already a binary break

`core/FrakConfig.kt:63-90`. `FrakConfig` correctly avoided `data class` to keep `copy()`
out of the ABI — but a public constructor with default arguments has the same problem: the
synthetic `$default` bridge signature changes when a parameter is added, so already-compiled
merchant code gets `NoSuchMethodError`. There is no `Builder`, and no `@JvmOverloads`
anywhere. The `deepLink` field is already referenced by `android/README.md:135`, the
manifest comment, and both example harnesses — so this break is *scheduled*, not
hypothetical.

### A4 — `frakCall` reports every internal bug as a decoding error

`android/.../core/DefaultFrakClient.kt:134-138`, `ios/.../Core/FrakCall.swift:19-20`. An NPE,
an `IllegalStateException`, an OOM or a `StackOverflowError` in SDK code is reported to the
merchant as *"Frak could not decode a backend response"* — so they file a bug against the
wire contract. iOS additionally **drops the underlying error entirely** (`.decoding(message:)`
has no `underlying`). Needs an `Internal`/`unexpected` arm — which is itself an A2 break,
so it must land before 1.0.

### A5 — The error taxonomy can't answer the three questions merchants ask

Arms are `notInitialized / network / server / decoding / trackingDisabled / merchantResolutionFailed`.
Missing: *offline vs timeout vs TLS* (all collapse into `.network`, distinguishable only by
casting to `IOException`/`URLError` — exactly the abstraction leak an SDK exists to prevent);
*retryable vs fatal* (nothing is signposted; a 401, a 429 and a 500 are all `.server(status:)`);
and *"am I being throttled by the SDK itself"* — backoff refusal is reported as
`.network` wrapping a fabricated `IllegalStateException("backing off")`
(`RewardRepository.kt:61`), so the merchant sees "network request failed" when the network
was never touched.

`FrakError` is also not `Equatable`/`equals`-implemented on either platform, so merchants
cannot assert on it in tests.

### A6 — Android: `Frak.client` throws from a property getter; iOS doesn't

`android/.../Frak.kt:80-81` — `val client get() = instance ?: throw FrakError.NotInitialized`.
Kotlin exceptions are unchecked and nothing at the call site signals this, so a merchant
reading `Frak.client` from a `ContentProvider`, a WorkManager worker or a Compose preview
gets an uncaught crash **in their app, attributed to Frak**. iOS gets this right
(`Frak.swift:51`, `get throws`). Neither offers `clientOrNull`.

Related: `FrakError` extends `Exception` (checked from Java's view) with no `@Throws`
anywhere, so Java merchants literally cannot `catch (FrakError e)` — javac rejects it as
never thrown. Use `RuntimeException`; decide now, it's a source break later.

### A7 — Android's public API is Java-hostile with no bridge

Every `FrakClient` member is `suspend`, plus a `StateFlow`. From Java, `resolveConfig` is
`Object resolveConfig(boolean, Continuation)` — a Java merchant must hand-author a
`Continuation` and unwrap `kotlin.Result.Failure` by reflection. That is a de-facto
Java-unsupported SDK. Branch/Adjust/AppsFlyer all ship first-class Java APIs because a
large fraction of merchant Android codebases still are.

### A8 — `FrakError.NotInitialized` / `TrackingDisabled` are `object`s with one stale stack trace

`core/FrakError.kt:21-25,75-79`. `Throwable`'s constructor calls `fillInStackTrace()` once,
at class init. Every throw propagates that single trace, pointing at `<clinit>`. In
Crashlytics every occurrence from every merchant deduplicates into **one** issue with a
useless frame list — and these are the two most common integration errors.

### A9 — Public reward models have no `equals`/`hashCode`/`toString` (Android)

`rewards/Rewards.kt` — `TokenAmount`, `RewardTier`, `EstimatedReward`, `Campaign`, `BestReward`
are plain classes with identity semantics, while `FrakResolvedConfig` hand-writes all three.
Consequences: `distinctUntilChanged` never conflates, `DiffUtil.areContentsTheSame` always
reports changed, Compose `remember(bestReward)` re-keys every recomposition, and logs read
`id.frak.sdk.rewards.BestReward@6f2b8a1` in merchant bug reports.

### A10 — Merchant test fakes cannot round-trip through the SDK's own equality

`config/FrakResolvedConfig.kt:51-58,65-75` — the public "for merchant tests" constructor
always sets `sdkConfig = null`, and the hand-written `equals` **includes** `sdkConfig`. So
a merchant-built value never equals an SDK-produced one from the same response, and
`toString` prints only 3 of 7 fields so the failure diff is unreadable. Same asymmetry via
`Hashable` synthesis on iOS.

---

## 6. Architecture & the merchant's first 15 minutes

### D1 — The UI artifact physically cannot read the config it exists to render

`config/FrakResolvedConfig.kt:43,95-176` and `Config/FrakResolvedConfig.swift:20,64`.
`ResolvedSdkConfig`, `ResolvedComponents`, `ResolvedPlacement`, `ButtonShareConfig`,
`BannerConfig`, `PostPurchaseConfig`, `AttributionDefaults` — ~170 lines of decoded
merchant copy — are `internal` to `frak-sdk` / the `FrakSDK` target. The sharing sheet lives
in `frak-sdk-ui` (separate Gradle module) and `FrakSDKUI` (separate SwiftPM target).
**A separate module sees only `public`.**

So the justification for keeping this tree internal ("promoting internal→public later is
non-breaking") collapses: to build the sheet at all, the whole tree must become public API
in one shot, with no incremental review. Kotlin has no friend-module mechanism without
`androidx.annotation`'s `@RestrictTo`, which violates the zero-dependency rule. This is an
architectural dead end that is invisible today and blocking on day one of the sharing work.

Decide now: either the copy tree is public API, or the UI ships in-module.

### D2 — Neither example harness compiles against the real SDK

`example/native-android/.../sdk/FrakSDK.kt:88-135` and
`example/native-ios/.../SDK/FrakSDK.swift:102-132` are hand-written stubs whose API is
*incompatible in shape* with what shipped: `FrakClient.shared` vs `Frak.client`;
`FrakConfig(merchantId:deepLink:environment:)` vs the real 6-parameter constructor;
callback-based `presentSharing(onResult:)` vs `suspend`/`async throws`; a completely
different `FrakError`. **There is zero end-to-end evidence that the shipped public API is
usable**, and the one artifact documenting intended ergonomics teaches a nonexistent API.

### D3 — Merchants are blind by default and have no logger hook

`FrakLogger` is `internal` on both platforms, so Timber / CocoaLumberjack / OSLog-subsystem
routing is impossible and merchant crash reporters get nothing. Worse: **no request is ever
logged, at any level** — neither `HttpClient.kt` nor `HTTPClient.swift` logs the URL, status
or duration. Combined with `logLevel` defaulting to `NONE` and no transport injection seam
(`HTTPClient.defaultSession` is a private static; Android's `open:` lambda is `internal`),
a merchant debugging "why is `bestReward` nil" has no path at all.

Add `FrakLogSink` to `FrakConfig` **now** — adding a constructor parameter post-publish is
exactly the break A3 describes.

### D4 — There is no test seam for the merchant

Every seam exists and every one is `internal`, including `Frak.resetForTesting()`.
`FrakClient` is a public interface specifically so merchants can fake it — but there is no
way to *give* the fake to `Frak`. A merchant whose ViewModel calls `Frak.client.bestReward()`
cannot make that deterministic in a unit test. Every merchant's first deliverable will be a
`FrakWrapper` class. That wrapper is the API this SDK should have shipped.

### D5 — A typo in `targetInteraction` fails silently

`FrakClient.kt:76` / `FrakClient.swift:26` take a free `String`, and `RewardRepository.kt:41`
documents that an unrecognised value "degrades to no best reward". So
`bestReward(targetInteraction = "purchases")` returns `null`, indistinguishable from "no
campaign". No constants, no validation. This is the most likely first-integration mistake
and the SDK is designed to hide it.

### D6 — `forceRefresh` does not force a config refresh

`DefaultFrakClient.kt:95` / `DefaultFrakClient.swift:87` hardcode `resolveConfig(forceRefresh: false)`
inside `fetchRewards`. `campaigns(forceRefresh = true)` refreshes rewards against a config
that may be arbitrarily old — potentially forever, given N7. Undocumented.

### D7 — Baked-in future breaking changes

| Change that *will* happen | What breaks |
| --- | --- |
| Any new `FrakError` case (A4/A5 make this mandatory) | Every merchant exhaustive `switch`/`when` |
| Any new `FrakClient` member (identity, tracking, sharing, applink) | Every merchant test fake; `-Xjvm-default=all` only helps if each new member ships a body, and the build comment claiming otherwise is wrong |
| Any new `FrakConfig` field (`deepLink` is already referenced in docs) | `NoSuchMethodError` on the `$default` bridge (A3) |
| `placement:` on `bestReward`/`campaigns` for 4-tier copy | Positional parameter lists, not a request object; `placements` already decodes, so this is guaranteed |
| The sharing sheet | Forces ~170 LOC internal→public in one release (D1) |
| Anonymous identity | Breaks *"initialize does no I/O and never throws"* — Keystore/Secure Enclave derivation is I/O and **can** fail, and `initialize` has no error channel on either platform |
| The offline queue | Needs a flush-on-background hook → a new public API merchants must call, i.e. a silent behavioural break for anyone who upgrades and doesn't |
| Runtime consent (S6) | `trackingEnabled` is `let` and `initialize` is first-write-wins |

Cheapest mitigations, all still free pre-1.0: make `FrakError` a struct with a `Code` enum;
give `FrakConfig` a Builder; replace positional reward parameters with a request value type;
add `Frak.setClient(_:)` / `Frak.shutdown()`; resolve D1.

---

## 7. Tests, parity and docs

### T1 — `SingleFlight` — the entire point of the class — is never tested concurrently

Android has **no `SingleFlightTest.kt` at all**; the only coverage is indirect, inside
`runTest`, whose `StandardTestDispatcher` is single-threaded with virtual time — which is
precisely the one configuration where B1 cannot fire. iOS's `SingleFlightTests.swift:9-19`
runs three `async let`s whose work closure is non-suspending, proving the happy-path
collapse and nothing else. No N≥50 test, no real thread pool, no failure propagation to
joiners, no cancellation assertion.

### T2 — Both `Frak` entry points are entirely untested

Zero test references `Frak.initialize`, `Frak.client`, `Frak.isInitialized` or
`Frak.resetForTesting` on either platform. Untested: second-init no-op, the neither-id
error path, `NotInitialized`, and iOS's silent `UserDefaultsStore()` nil bail
(`Frak.swift:39-42`) which leaves the SDK permanently dead while logging at a level that
defaults to off. `resetForTesting` is dead code — it exists for tests that were never
written.

### T3 — Zero device/simulator coverage

No `androidTest` source set exists. `SharedPreferencesStore`, `Frak.initialize`, and
`android.util.Log` have no executed line of coverage. iOS compiles for the simulator triple
then **runs on the macOS host**, so `os.Logger`, `UserDefaults` suite semantics and
`URLSession`-on-iOS are asserted against macOS behaviour or not at all. Worse, that host
stage drops `-swift-version 6` — so **no configuration is both compiled under Swift 6 and
executed**.

### T4 — 99 of 105 golden fixtures are loaded by nobody

Both loaders correctly point at the single `sdk/core` corpus (good — the corpus itself is
not duplicated). But the tests only *parse*: they assert `formatVersion == 1`, `size > 0`
and non-empty descriptions. **No payload byte is ever compared.** `GoldenFixtures.CONTEXT_CODEC`
and `.REWARDS` are never referenced; `Corpus.byName` / `.named` are dead. `04-golden-fixtures.md`
§9 is honest about it: *"Conformance suites — Not written"*, *"Has the corpus ever caught a
real divergence? No."* The mechanism chosen instead of a shared core is carrying zero load.

The two *loaders*, meanwhile, are hand-duplicated re-implementations including duplicated
failure-message text, and have already drifted: `byName` throws a diagnostic on Android and
returns `nil` on iOS.

### T5 — iOS asserts "some `FrakError`" where Android asserts the case

`#expect(throws: FrakError.self)` accepts any case, so "a transport failure becomes a
network error" (`ConfigStoreTests.swift:187`) would pass on `.decoding`, and "trackingEnabled
false throws **trackingDisabled**" (`FrakClientTests.swift:177`) would pass on
`.merchantResolutionFailed`. Eight sites. Android's twins check the specific type.

### T6 — Real sleeps

`HttpClientTest.kt:99` parks a `Dispatchers.IO` thread for a full 10s **after the test
finishes**. iOS has eight `Task.sleep` races (`SingleFlightTests:27,33`, `ConfigStoreTests:65`,
`FrakClientTests:84,88,114,117`, `HTTPClientTests:164`), plus wall-clock assertions
(`elapsed < 1`) that will flake first on a loaded runner.

### T7 — Notable parity divergences beyond those already listed

| Area | Android | iOS | Right |
| --- | --- | --- | --- |
| Backoff clock | injected `now` | ignores injected `now`, uses `Date()` — so **no iOS test can advance a backoff window** | Android |
| Required-string emptiness | `""` rejected → `Decoding` | `""` accepted → blank UI | Android |
| Query parameter order | `LinkedHashMap`, deterministic | Swift `Dictionary`, varies per process | Android |
| Persisted `fetchedAt` | epoch **millis** | `Date` → seconds since **2001** | Same key, same field name, two formats differing by 1000× and 31 years |
| Wrong-typed `sdkConfig` | → null, config decodes | → `typeMismatch`, whole resolve throws | Android |
| Partial `placements` corruption | per-entry skip | `try?` nils the entire map | Android |
| `initialize` I/O | defers `getSharedPreferences` | opens the `UserDefaults` suite | Android (spec §1.2 says no I/O) |
| Version drift guard | Gradle task (unreachable, B3) | none | neither enforced |

### T8 — Documentation defects

| Claim | Verdict |
| --- | --- |
| "Zero third-party runtime deps" | **FALSE** — `frak-sdk-ui/build.gradle.kts:66-69` adds compose-bom + ui + foundation + material3 to a *published* artifact that today contains only `.gitkeep` |
| "< 150 KB budget" | **FALSE as a gate** — d8s only the module's own `classes.jar`; `api(kotlinx-coroutines-core)` and the whole Compose graph are invisible, and a module with no `classes.jar` records `ok`, so `frak-sdk-ui` passes by being empty. No iOS size gate at all |
| "Swift 6 strict concurrency" | **repo-local only** (B5) |
| "Swift 5.9+" | **FALSE** (B4) |
| "Maven Central Portal" | **no publish path exists** (B3) |
| "The POM is Central-valid today" | plausible by inspection, never executed |
| "67 JVM unit tests" / "100 Swift Testing tests" | **stale** — 97 and 122 |
| "Only real source file per platform is `FrakSdkVersion` … no SDK behaviour exists" (`sdk/AGENTS.md:55`, `native-sdk/README.md:136`) | **flatly false** |
| "the codec and reward-formatting vectors still do not exist" (`03` §…) | **false** — 32 + 67 vectors exist; `03` and `04` contradict each other |
| "Kotlin/Swift loader parses all three files" (`04` §…) | **over-claim** — both load only `golden-proofs.json` |
| Rate limiting listed as the one open security item | **shipped** — `services/backend/src/api/user/merchant/index.ts:36,87` |
| `explicitApi()`, iOS 15 floor, no exported activity | **verified** |
| Native SDKs updated for the `env` two-origin change | **verified** — origins match `sdk/core/src/config/environment.ts:43-52` exactly, `BackendUrl.kt`/`BackendURL.swift` deleted in the same commit |

Plus: `FrakConfig.deepLink` is referenced by `android/README.md:135`, the manifest comment
and both harnesses, and **does not exist**; `defaultLockupSeconds` is documented as
*"Whole days"* (`Rewards.kt:89`) — the JS reference divides by 86 400 to reach days, so a
merchant rendering off the KDoc is 86 400× off; the `formatted` NBSP claim
(`Rewards.kt:102`, `Rewards.swift:93`) is true only for `eur`→fr-FR (usd/gbp have no space,
and fr-FR ≥1000 uses `U+202F` as the *group* separator, a different character the comment
never mentions); `frak-sdk-ui/consumer-rules.pro:6-9` plans a `@JavascriptInterface` bridge
that `02` §7 explicitly forbids; and percentage-reward suppression is asserted as
implemented in both `Rewards.kt:47` and `Rewards.swift:44` while nothing suppresses anything.

---

## 8. Reviewer claims that did NOT survive verification

Recorded so they don't get actioned:

- **"iOS `SingleFlight`'s `defer` runs for every caller including joiners."** It does not —
  the `if let existing` path returns before the `defer` is registered. The real defects are
  the completion/resumption window and leader-cancellation eviction (C1).
- **"iOS `Package.swift` uses `.unsafeFlags`."** It does not; it declares no `swiftSettings`
  at all, which is a different (and still blocking) problem (B5).
- **"`FrakSDKUI` privacy manifest is missing and will fail ITMS-91053 today."** Today
  `FrakSDKUI` depends on `FrakSDK`, so the resource bundle rides along. It becomes true
  under the planned per-framework XCFramework distribution — file it as a pre-req of that
  work, not as a current defect.
- **"`PrivacyInfo.xcprivacy` uses the wrong required-reason code."** `CA92.1` is correct for
  an SDK reading/writing its own container. `C56D.1` — which both the in-file comment and
  the README recommend as "the better fit" — is for an SDK exposing a *UserDefaults wrapper
  for the app to call*, which this is not. The **code is right and the comment is wrong**;
  fix the comment before someone follows it.
- **"Android `HttpClient` follows redirects / leaks headers cross-host."** It does not —
  `instanceFollowRedirects = false` is set before `responseCode` triggers the request. The
  real issue is what happens to the resulting 3xx (N5).
- **"`percentEncode` / `Retry-After` clamping / `useCaches=false` are hazards."** All three
  are correct and well-reasoned. `org.json`'s `optString`/`JSONObject.NULL` quirks are also
  correctly avoided throughout `JsonReader` via `opt()` + `as?`.

---

## 9. Suggested order

**Before anything else** — these unblock or invalidate everything downstream:

1. **B3** — CI that runs `./gradlew check assembleRelease` and `swift build`/`swift test` on
   a macOS runner. Nothing below can be verified without it, and half the findings above
   exist *because* nothing runs.
2. **B4 + B5** — fix the Swift toolchain floor and enable strict concurrency for consumers.
   B5 will surface further diagnostics this static review could not compile for (H1's
   `NoRedirectDelegate` is one certain hit).
3. **B6** — the licence is a legal decision that invalidates all distribution work if it
   lands the wrong way.

**Then, correctness:**

1. **B1** (`SingleFlight` recursive update) and **C1** (iOS join-after-completion), each
   with the concurrency test that would have caught it.
2. **B2** (`withContext`) and the mutex scoping.
3. **S1, S2, S3, S4** — the logging and data-at-rest holes. All four are things the
   anonymous identity will fall straight through, and each is far cheaper now than after a
   merchant has shipped against it.
4. **S5, N1** — unbounded body read and `Double` money.

**Then, one-way doors that are still free:**

1. **A1** (`.api` dump), **A2/A3/A4** (error taxonomy + `FrakConfig` Builder), **D1** (decide
   the UI/config visibility boundary), **D3** (`FrakLogSink`), **S6** (consent toggle).

**Then:** D2 (make the harnesses consume the real SDK — it is the only end-to-end proof the
public API works), T1–T4, and the doc corrections in T8.
