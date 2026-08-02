# 07 — Native SDK audit, round 2

Full read-only audit of `sdk/android/` and `sdk/ios/` at `51d923ded` (`feat/native-mobile-sdk`),
run as ten parallel focused passes: Android core / Android features / Android UI+build /
iOS core / iOS features / iOS UI+packaging / cross-platform parity / prior-audit regression /
doc-claim verification / test-suite quality.

No toolchain on the audit host (no JDK, Gradle, Android SDK, Swift, Xcode), so nothing was
built or executed. Every finding is from source; every "green"/"clean" claim in the docs is
**structurally** verified only (does the gate exist and is it wired) and marked unverifiable
otherwise.

---

## 0. Headline

The port is **faithful and the hard parts are right**. The two wire formats — the identity
proof envelope and the FrakContext v2 codec — are byte-for-byte identical across TypeScript,
Kotlin and Swift, and both are pinned to the shared golden corpus on both platforms. Every
endpoint path, query key, header name, timeout, TTL, backoff constant and retry limit matches
across the two platforms; the constants diff is clean. There is no `fatalError`, `try!`,
force-unwrap or `GlobalScope` anywhere. That is the expensive half of a native port and it
landed.

Three things are not right, and they are structural rather than local:

1. **The previous audit was largely not acted on.** Of the 55 findings in `05-audit-findings.md`,
   **7 are fixed, 10 partially, 37 untouched**. Zero of the eight §2 security/privacy findings
   are fully closed. Several are now *worse* in blast radius because identity, the tracking
   queue and the sharing sheet all landed on top of them.

2. **The same bug is usually on both platforms.** Backoff bypassed on a cold cache, `configUpdates`
   never firing from background revalidation, the startup drain ignoring `trackingEnabled`, the
   event queue growing without bound exactly while backoff is armed, the rewards cache never
   evicting, identity minted synchronously on the main thread. These are not port errors — the
   port is accurate. They are holes in the shared design that got faithfully copied twice. More
   per-platform review will not find them; a shared spec plus shared fixtures will.

3. **The docs are ahead of the code.** `sdk/AGENTS.md` states four toolchain versions that are all
   wrong, documents an `apiDump` command that does not exist, claims a `<150 KB` budget two lines
   after stating it is 256 KB, and lists `apiCheck` in `check` when BCV was deliberately removed.
   `docs/plans/native-sdk/README.md:15` says the API dump "is committed"; there is no tracked
   `.api` file. Every one of these would be trusted by the next implementer.

Nothing here is a reason to restart. The list below is roughly two weeks of contained work,
and about a third of it deletes code.

> **Two remediation passes have since run.** Pass 1 closed the licence, the privacy manifests
> and every doc claim in point 3 above. Pass 2 closed the quick wins — §2.3, §2.5, §2.9,
> §2.11, §2.4b, §2.7's lock window, §4.1, §4.3, §5.3, §5.5, §5.8 — with per-section notes
> throughout. Point 2 held up under both: **every quick-win bug that existed at all existed on
> both platforms**, and the one that did not (§2.4b, where Swift's `defer` already covered it)
> only became visible by checking rather than assuming symmetry. Point 1's ratio is the one
> that has moved.

---

## 1. Ship blockers

These must close before the first publish. Ordered by cost-of-being-wrong.

> **Remediation pass 1 — status.** §1.3 (licence), §1.4 (privacy manifests) and the
> documentation half of §7 are **fixed**; each subsection below is annotated. §1.1 and §1.2
> are **reclassified as deliberate deferrals**, not open blockers — publishing and CI land
> once the first local and dev-environment tests have exercised the SDKs on a device. §1.5
> and §1.6 remain open. Nothing in §2–§6 or §8 has been touched yet.

### 1.1 There is no publish path, on either platform — **DEFERRED**

> **Reclassified, not fixed.** Everything below still describes the tree. It is a sequencing
> decision: the Portal transport lands once the first local and dev-environment tests have
> exercised the SDK on a device, because publishing an artifact nothing has run burns a
> version number for nothing. What is fixed is the *documentation* — `sdk/AGENTS.md`,
> `sdk/android/README.md` and the plan README no longer present Portal distribution as
> wired. The POM's licence field is now Apache-2.0 (§1.3).

`sdk/android/buildSrc/src/main/kotlin/frak-publish.gradle.kts:18-63` declares `publications` and
signing but **no `repositories { maven { … } }`** and no Central Portal plugin. OSSRH's
`nexus-staging` was retired in 2024; Central now requires the Portal bundle API, which bare
`maven-publish` does not speak. `scripts/run.sh:126-136` `publishLocal` is the only path that
works — it publishes to `~/.m2`.

`sdk/ios/scripts/run.sh:154-162` `do_xcframework()` is a `die` with the design in comments.

The POM content is genuinely complete and correct (name, description, url, GPL-3.0 licence,
developers, SCM at `:29-64`; sources and javadoc jars wired per-module). Only the transport is
missing. Apply `com.vanniktech.maven.publish` in the convention plugin — it subsumes the manual
`publications`/`signing`/`javadocJar` wiring too.

### 1.2 No CI builds, tests or lints either SDK — **DEFERRED**

> **Reclassified, not fixed.** Still accurate, and it lands with §1.1 once the SDKs have run
> on a device. Two consequences to keep in view meanwhile: every "green" claim is a local run
> by hand (the READMEs and plan README now say exactly that), and **Android Lint has still
> never executed even once** — which for a WebView-centric SDK is the finding in this
> subsection with the shortest fuse. Running `lint` locally is worth doing before CI exists.

`.github/workflows/` has seven workflows; none references `gradle`, `swift`, `sdk/android` or
`sdk/ios`. **Android Lint has never been executed** (`sdk/android/scripts/run.sh:98-107` says so
outright), and there is no `lint {}` block in either module — for a published SDK whose central
component is a WebView, that is the mechanical gate for `SetJavaScriptEnabled`,
`JavascriptInterface`, `WebViewApiAvailability` and `NewApi`.

Every verdict in this document, and every "green" in the READMEs, is unenforced until this
exists. Two jobs, path-filtered on `sdk/**`: one Linux running `./gradlew :frak-sdk:test
:frak-sdk-ui:test ktlintCheck lint checkDexSizeBudget`, one macOS running
`bun run --cwd sdk/ios test`.

### 1.3 The licence is still GPL-3.0 — **FIXED**

> **Resolved: Apache-2.0.** `sdk/android/LICENSE` and `sdk/ios/LICENSE` now carry the full
> canonical Apache-2.0 text (202 lines, copyright 2026 Frak Labs), and
> `frak-publish.gradle.kts` declares `The Apache License, Version 2.0` in the POM with a
> comment recording why the native subtree diverges from the monorepo. Apache-2.0 rather than
> MIT for two reasons that matter here: the explicit patent grant, which covers the identity
> proof-of-possession scheme, and the trademark clause. The `sdk/{android,ios}/LICENSE` files
> scope the change to the native SDKs; the rest of the repo stays GPL-3.0. Original finding
> below.

`LICENSE:1-2`, hardcoded into the POM at `frak-publish.gradle.kts:35-38`, no `sdk/ios/LICENSE` at
all. GPL-3.0 on a statically-linked artifact that merchants embed in closed-source App Store /
Play binaries. This was `B6` in the last audit and is a one-way door: relicensing after the first
integration is far harder than before it. It is a business decision, not an engineering one, but
it blocks.

### 1.4 The iOS privacy manifest under-declares, and FrakSDKUI has none at all — **FIXED**

> **Resolved.** `Sources/FrakSDK/PrivacyInfo.xcprivacy` now declares four collected types —
> `DeviceID`, `PurchaseHistory`, **`ProductInteraction`** and **`UserID`** — each with a
> comment naming the call site that justifies it. The `CA92.1` vs `C56D.1` speculation is
> resolved in the file rather than left as doubt: `CA92.1` is correct because the SDK reads
> and writes UserDefaults in the app's container on the app's behalf, while `C56D.1` is for an
> SDK exposing a UserDefaults *wrapper API for the app to call*, which this does not.
>
> **`Sources/FrakSDKUI/PrivacyInfo.xcprivacy` is new**, wired into `Package.swift` as
> `.copy("PrivacyInfo.xcprivacy")` alongside the existing `.process("Resources")`. It declares
> the subset FrakSDKUI is itself responsible for (`DeviceID` + `ProductInteraction`, since
> `SharingPageURL.build` puts `clientId` and `merchantId` in the page URL) and an **explicit
> empty** `NSPrivacyAccessedAPITypes` — verified, not assumed: the module touches none of the
> five required-reason categories, and `UIPasteboard` is not one.
>
> Both files parse as valid plists. Two things this does **not** close: propagation still has
> to be checked against a real consumer app in the static SPM variant (the AppsFlyer #281
> failure mode), and `Interaction.custom(_:data:)` remains a channel the SDK cannot declare
> for — now documented in `sdk/ios/README.md` as the merchant's own responsibility. Original
> finding below.

`sdk/ios/Sources/FrakSDK/PrivacyInfo.xcprivacy:28-73` declares only `DeviceID` and
`PurchaseHistory`. Missing:

- **`NSPrivacyCollectedDataTypeProductInteraction`** — `track(_:)` posts `arrival`/`sharing`/`custom`
  interaction events (`Tracking/Interaction.swift:3-15`). In-app interaction events are the textbook
  definition, and it is the SDK's headline feature.
- **`NSPrivacyCollectedDataTypeUserID`** — `trackPurchase(customerId:orderId:token:)` transmits the
  merchant's own customer identifier. Classifying that solely as Purchase History under-declares it.

`find . -name '*.xcprivacy'` returns exactly one file. **FrakSDKUI is a separately shipped library
product** (`Package.swift:24-27`) that sends the anonymous id and merchant id off-device via
`SharingPageURL.build` and writes the pasteboard (`NativeShare.swift:39`), and it ships with no
manifest. An absent file is not a declaration; an explicit empty `NSPrivacyAccessedAPITypes` array
is.

Required-reason API coverage *is* correct and was verified: no file-timestamp, disk-space,
boot-time or active-keyboard APIs are used; `UserDefaults` is the only category touched and
`CA92.1` is the right code (delete the `C56D.1` speculation at `:82-84` — that code is for an SDK
that wraps UserDefaults *for the app to call*, which this does not).

ITMS-91053 lands on the merchant's upload, not ours. That is what makes this a blocker rather
than a cleanup.

### 1.5 Swift 6 concurrency is verified in exactly one configuration no merchant compiles

`Package.swift:1` is `// swift-tools-version: 5.9` and neither target declares `swiftSettings`.
Swift 6 language mode exists **only** as `-Xswiftc -swift-version -Xswiftc 6` inside
`scripts/run.sh:35-37`. A merchant adding this package as a SwiftPM dependency compiles it in
Swift 5 mode with minimal concurrency checking — every `@MainActor`/`Sendable` guarantee the
codebase is designed around is unchecked in the shipping configuration.

There is already at least one hole hiding behind this: `Net/HTTPClient.swift:17` is
`struct HTTPClient: Sendable` storing `private let redirectDelegate = NoRedirectDelegate()`
(`:51`), where `NoRedirectDelegate` (`:5`) is a `final class: NSObject, URLSessionTaskDelegate`
with no `Sendable` conformance. Under real Swift 6 that is an error.

Fix: bump to tools-version 6.0 and add `swiftSettings: [.swiftLanguageMode(.v6)]` to both targets
(the iOS 15 floor is unaffected), then delete the flag from `run.sh` so there is one source of
truth. The sources already use Swift 6.0-only syntax (`isolated (any Actor)? = #isolation` in
`Config/Backoff.swift:79`, `nonisolated(unsafe)` in `Frak.swift:12`), so the 5.9 declaration is
already false.

### 1.6 No binary-compatibility gate, and the docs claim there is one

BCV was wired and then deliberately reverted (`frak-publish.gradle.kts:10`: "the public shape
isn't frozen. Re-add before first publish"). That is a defensible pre-1.0 call. What is not
defensible is that `sdk/AGENTS.md:72-73` documents `apiCheck` as part of `check` and an `apiDump`
command that does not exist in `package.json`, and `docs/plans/native-sdk/README.md:15` says the
dump "is committed" when `find sdk/android -name '*.api' -not -path '*/build/*'` is empty.

Meanwhile the predicted breaks have started landing: a new `FrakError` arm (`AlreadyPresenting`),
three new `FrakConfig` constructor parameters (`deepLink`, `logSink`, `preloadSharing`), four new
`FrakClient` members. Each is free only until first publish. `explicitApi()` cannot catch a
breaking change to an already-public symbol.

---

## 2. Correctness bugs — user-visible or data-losing

> **Remediation pass 2 — status.** Fixed on both platforms: **§2.3** (backoff bypass),
> **§2.5** (`trackingEnabled` drain gate). Fixed where it applied: **§2.4b** (the
> `revalidating` cancellation leak, Android only — Swift's `defer` already covered it),
> **§2.9** (iOS `tiers`), **§2.11** (2 of 3 parts). Also fixed opportunistically, because
> detaching the drain in §4.3 widened it: the **§2.7 read/compact window**, on both
> platforms. Still open: §2.1, §2.2, §2.4a, §2.6, §2.7's idempotency-key half, §2.8, §2.10.

### 2.1 Android sharing sheet reports a failed load as ready — the offline path is dead — **FIXED**

> One `navigationFailed` field, set in `handleMainFrameFailure`, cleared in `onPageStarted`,
> read at the top of `onPageFinished`. Deliberately a boolean and not an enum: `retried`,
> `retryPending` and `settled` already carry the rest of the state, and no code would branch on
> the extra cases. It is set *before* the `settled` guard so a reload that fails after tier 3
> has fired still suppresses its error page, and *before* the `retryPending` return so the
> duplicate-callback case is covered too.
>
> Three regression tests, all of which fail against the old code: the error page's own
> `onPageFinished` with no intervening `onPageStarted` (the sequence the framework actually
> produces and the old test never modelled), the retry painting after it, and a first-load
> happy path that the renamed test no longer covered.

`sdk/android/frak-sdk-ui/.../SharingWebView.kt:147-155`

`onPageFinished` unconditionally resets `cacheMode = LOAD_DEFAULT` and calls `onPageReady()`.
Android fires `onPageFinished` **for the internal error page**, after `onReceivedError`, in the
same load cycle:

```
onPageStarted(url)
onReceivedError(mainFrame) → handleMainFrameFailure: retried=true, retryPending=true,
                             cacheMode=LOAD_CACHE_ONLY, loadUrl(url)   [:174-192]
onPageFinished(url)        → cacheMode reset to LOAD_DEFAULT, onPageReady()   [:153-154]
```

Two consequences, both user-visible. The cache-only pinning is undone before the retry's posted
navigation dispatches, so the retry goes to the network — exactly what the `retryPending` field at
`:105-109` exists to prevent, but that guard only covers a duplicate *error* callback. And
`onPageReady()` sets `pageLoaded = true`, so `onLoadDeadline()` early-returns at
`SharingSheetState.kt:152` and the tier-3 native-share fallback never fires. **An offline user gets
a blank WebView error page inside the sheet, permanently, instead of the OS share chooser.**

The test misses it because `SharingWebViewClientTest.kt:255-269` injects an `onPageStarted` between
the error and the `onPageFinished`, which is not what the framework does. Track the failure
explicitly, gate the success path on it, and add the no-intervening-`onPageStarted` regression test.

### 2.2 iOS sharing sheet treats an HTTP error document as a successful load — **FIXED**

> The mirror of §2.1, with the same field name and the same three mutation sites so the two
> files diff cleanly. What iOS additionally needed was a way to *see* the failure:
> `decidePolicyFor navigationResponse:` now inspects the main-frame status, which is Android's
> `onReceivedHttpError` equivalent.
>
> It answers `.allow`, not `.cancel`, and then calls `handleMainFrameFailure` explicitly.
> Cancelling would surface as a cancellation error, which `isCancellation` filters out — so the
> obvious-looking `.cancel` dead-ends into neither path firing.
>
> `webViewWebContentProcessDidTerminate` is implemented alongside it. Both platforms treat a
> dead renderer as a fallback trigger rather than trying to recover: reloading is reloading the
> content that just killed a process, and tier 3 has a working local link. Android's override
> must return `true` — `false` lets the framework kill the merchant's app, not just the sheet.
>
> **Not fixed, and now explicit:** a renderer dying *after* the page painted leaves a blank
> sheet. Falling back there would raise an OS chooser on top of a sheet the user is using and
> queue a share they never asked for, so `onPageUnavailable` returns early on `pageLoaded` on
> both platforms. The native Copy/Share footer still works, so the user is not stranded.

`sdk/ios/Sources/FrakSDKUI/SharingWebView.swift:159-161`

The mirror-image of 2.1, by a different route: `didFinish` calls `onPageReady()` unconditionally and
there is **no `decidePolicyFor navigationResponse:`**, so the main-frame status code is never
inspected. `didFail*` only fires for transport errors. Android gets this right
(`SharingWebView.kt:166-172`, `onReceivedHttpError` + `isForMainFrame` → tier 2 → tier 3).

When the wallet returns 500 or 503 for `/sharing`, Android falls back to the OS share sheet with a
working locally-built link; iOS renders the error document, cancels the 1.5s deadline and strands
the user. Also missing: `webViewWebContentProcessDidTerminate(_:)` — a jetsammed content process
(common on low-memory devices while an `UIActivityViewController` is up) leaves a permanently white
sheet, since `didFail*` is not called and `pageLoaded` is already true.

### 2.3 Backoff is bypassed on a cold cache — on both platforms — **FIXED**

> Both stores now throw when backing off with nothing cached, matching `RewardRepository`
> exactly, so the two callers of the same helper no longer disagree about what backoff means.
> On iOS the ad-hoc `BackingOff` error that `RewardRepository` kept privately moved to
> `Backoff.BackingOff(what:)` and is shared. Regression tests added on both platforms
> (`ConfigStoreTest.kt`, `ConfigStoreTests.swift`): they assert the *request count is
> unchanged* across three further calls, which is the assertion that fails against the old
> code — the throw alone does not discriminate, since the old path threw too, just after
> dialling.

`sdk/android/.../config/ConfigStore.kt:66-71` and `sdk/ios/.../Config/ConfigStore.swift:73-77`

Both read: *if backing off **and** there is a cached copy, serve it.* When the cache is empty —
the first-launch-offline / misconfigured-`merchantId` case the backoff exists for — control falls
through and the request is issued anyway. A merchant retrying `resolveConfig()` in a loop makes one
real network attempt per call, forever, with no rate limit at all.

`RewardRepository` gets it right on both platforms (`RewardRepository.kt:61-63`,
`RewardRepository.swift:51-53`: throw `FrakError.Network(BackingOff)`), so the two callers of the
same helper disagree about what backoff means. Four lines each, mirroring the rewards path. This is
the finding that costs someone else money.

### 2.4 `configUpdates` never fires from background revalidation — on both platforms

`DefaultFrakClient.kt:62,64,96` / `DefaultFrakClient.swift:84-99`, against
`ConfigStore.kt:143-164` / `ConfigStore.swift:129-143`

`configState.value` / `latestConfig` is assigned in exactly one place: inside `resolveConfig()`.
The stale-while-revalidate background refresh publishes the fresh entry to memory and disk and has
**no channel back to the client**. So the SDK's only push-shaped API emits exactly the value the
caller already received as a return value — always the stale one when SWR fires — and never emits
asynchronously at all. The whole SWR mechanism is invisible to its only consumer.

Either give `ConfigStore` an emission channel (`MutableStateFlow` / `AsyncStream`) and have the
client forward it, or delete the background revalidation and serve stale-until-next-call, which is
what actually happens today. Carrying the cost of both halves while one is dead is the worst option.

Compounding it: `ConfigStore.kt:161` removes the key from `revalidating` in a `finally` **without**
`withContext(NonCancellable)`. A cancelling coroutine throws at the first suspension and the key
stays in `revalidating` forever, disabling all future revalidation for it. Combined with wall-clock
TTLs that have no `fetchedAt > now` clamp (`ConfigStore.kt:28,60,175`), the SDK can serve a stale
config *across launches, indefinitely, with no network attempt*. That pair is the worst live-
correctness combination in the codebase.

### 2.5 The startup drain ignores `trackingEnabled` — on both platforms — **FIXED**

> Both `init` blocks now purge and return early when tracking is off, so a backlog captured
> before the opt-out is dropped rather than POSTed with the old `x-frak-client-id`. Skipping
> the keystore warm-up costs nothing: `AnonymousIdStore` already returns nil without I/O when
> tracking is off, on both platforms. **Shipped without a regression test** — it is four lines
> inside an `init`-spawned task, which is exactly the shape that regresses silently.

`DefaultFrakClient.swift:44-47` and `DefaultFrakClient.kt:81-85`

`FrakConfig.trackingEnabled` is documented as *"When false, generates no anonymous id and issues no
network request."* Both `init` blocks unconditionally run `identity.anonymousId()` then
`tracker.flush()`. Only *enqueue* is gated (`trackingCall`). A merchant who ships
`trackingEnabled: false` after a user opts out still POSTs every event captured before the opt-out,
on the next cold launch, with the old `x-frak-client-id` attached — a header declared in
`PrivacyInfo.xcprivacy` as a **Linked** `DeviceID`. Data transmitted after the SDK told the merchant
it would not be.

Four lines: gate the drain, and `purge()` when tracking is off.

### 2.6 The event queue grows without bound exactly while it cannot drain — both platforms

`EventQueue.kt:79-82` / `EventQueue.swift:63,131`, with `InteractionTracker.kt:76` /
`InteractionTracker.swift:97`

`MAX_EVENTS = 1000` and `MAX_AGE = 14d` are enforced **on read**, and compaction only happens inside
`flush()`. But `flush()` returns *before reading anything* while backoff is armed. So during the one
scenario the cap exists for — extended offline, backend down, 429 — every `track()` appends a row
and nothing ever prunes. `EventQueue.swift:19-20` even calls the file "the SDK's only unbounded
on-disk footprint".

When backoff finally lifts, `read()` slurps the entire file into memory (`file.readLines()` /
`Data(contentsOf:)`), JSON-decodes every line, and throws away all but the last 1000.

Enforce the bound on the **write** path: an append counter or a byte budget checked in `append`,
triggering compaction independently of the backoff gate.

### 2.7 Android event-queue reconciliation loses events two ways — **HALF FIXED**

> **The lock window is closed on both platforms** — and it turned out not to be Android-only.
> §4.3 detaching the drain meant the SDK now generates this concurrency *itself* from two
> sequential `track` calls, so the window had to close in the same change rather than later.
> Android now holds one `queueMutex` across read and compact. iOS had the identical bug by a
> different mechanism: `queue.read` and `queue.replace([])` are two hops onto the `EventQueue`
> actor, and an append landing between them was erased by the second — now one hop through
> `reconcile`, the method whose own doc comment forbids exactly this split.
>
> **Still open: the merchant-supplied `idempotencyKey` as reconciliation key.** That needs an
> SDK-owned row id and is a queue-format change, not a quick win.

`sdk/android/.../tracking/InteractionTracker.kt`

- **`:78-83`** — `queueMutex` is released between the read and the compaction. An `enqueue` landing
  in that window is deleted by `queue.replace(emptyList())`, because `replace` with an empty list
  deletes the file (`EventQueue.kt:99-102`). `track()` calls `flush()` unconditionally (`:42`), so
  two concurrent `track()` calls are enough — this is the normal case, not the exotic one.
- **`:40,126-133`** — reconciliation is keyed on `Interaction.Custom.idempotencyKey`, which is
  **merchant-supplied**. A merchant who reuses an idempotency key — precisely what an idempotency
  key is for — silently loses every other queued event sharing it the moment one is delivered.

Both are silent event loss that will be blamed on the backend for weeks. Fix: hold one lock across
read+compact, and give `QueuedEvent` an SDK-owned row id that is never merchant-visible, keeping the
merchant's `idempotencyKey` as a body field only.

### 2.8 An iCloud restore permanently bricks the iOS identity — **FIXED on both platforms**

> Both stores now answer "nothing usable here" the same way and let `loadOrCreate` mint. iOS
> gained a private `load()` returning nil so the two files read alike; Android's already did.
>
> **The recommended negative cache was deliberately NOT added**, and the audit was wrong to
> ask for it. Key operations legitimately fail before a device's first unlock, so caching the
> failure would leave an app launched by a push on a rebooted phone inert until the user
> force-quit it — a worse bug than the one being fixed, and much harder to diagnose. The hot
> loop the cache was meant to stop is gone anyway: after this fix the second call mints
> instead of re-reading poisoned material. Both platforms now have a test pinning that a
> keystore which recovers gets an id without a restart. If log volume from a genuinely dead
> device ever matters, throttle in `FrakLogger` — not by caching identity state.
>
> **Nothing is deleted before a replacement exists**, on either platform, and this is the
> subtle half. The obvious shape — clear the bad material, then mint — destroys a healthy key
> whenever the read failed for a passing reason and the mint then fails too. iOS relies on
> `generate()` overwriting the same key on success, so the clear was a no-op on every path
> that works and data loss on the paths that do not. Android relies on `create()` targeting
> the same alias. On Android the keystore handle is also opened *outside* the `try`: a
> provider that will not load is unavailable, not damaged, and must surface as a retry rather
> than be answered by minting over the user's key.
>
> Coverage is inverted from the sharing sheet. `PersistedDeviceKeyStore` had never been
> executed by anything; it now has seven tests that run for real on the host, including the
> §2.8 regression. Android's `AndroidKeystoreDeviceKeyStore` has none and can have none — the
> stubbed `android.jar` throws on every `android.*` call and Robolectric ships no
> `AndroidKeyStore` provider — so that half is verified by reading only.

`Identity/DeviceKey.swift:54-66,92-103` + `AnonymousIdStore.swift:94-101`

The Secure Enclave key blob lives in the `id.frak.sdk.identity` `UserDefaults` suite, and
`UserDefaults` plists in `Library/Preferences/` **are included in device backups** (unlike the event
queue, which is explicitly excluded at `EventQueue.swift:104-106`). After a device restore: the old
device's blob is read, `SecureEnclave.P256.Signing.PrivateKey(dataRepresentation:)` throws because
the blob is wrapped by the old chip's key, and `loadOrCreate` **deliberately never regenerates**
(`:54-55`). `anonymousId` is `nil` for the life of that install. Tracking, sharing links and the
install handoff are all permanently inert, and nothing ever clears the poisoned blob.

The stated reason for not regenerating — "regenerating would irrecoverably rotate the anonymous id"
— is backwards here: the id is *already* unrecoverable, because the key that defines it is gone. And
the SDK's own model says a fresh device is a fresh user.

Fix: distinguish "no material" / "material this device cannot use" / "material we should not touch".
On a restore failure: log at info, clear the stored blob, fall through to `generate()`. Pair it with
a negative cache (`AnonymousIdStore.swift:98-100` currently re-attempts the full keystore read plus
`logger.error` on *every* `anonymousId()` call after a failure, on a hot path).

Android has a narrower version of the same shape: `AndroidKeystoreDeviceKeyStore.kt:18,24-29`
`loadOrCreate() = load() ?: create()` only falls through on a *null* return, but `KeyStore.getKey`
throws `UnrecoverableKeyException` for a corrupted or OS-upgrade-damaged entry. Wrap `load()` in
`runCatching`, and `delete()` before returning null so `create()` mints fresh.

### 2.9 iOS drops the entire rewards response when a tiered campaign omits `tiers` — **FIXED**

> One line, plus a regression test. The blast radius was re-verified end to end rather than
> assumed, because two layers *look* like they would swallow it and do not:
> `ForgivingArray` skips non-object entries but decodes objects with `try`, and
> `decodeForgivingObject` is forgiving only about whether the key is an object — once it is,
> it decodes strictly. So the `keyNotFound` really did propagate to `FrakError.decoding` for
> the whole response.

`Rewards/RewardsDecoder.swift:60` uses `container.decode(...)`, not `decodeIfPresent` — two lines
below where `rewards` correctly uses `decodeIfPresent` (`:25`). An absent `tiers` throws
`keyNotFound`, which is not swallowed, so `campaigns()`/`bestReward()` throw `FrakError.decoding`
for the whole response. Android returns `emptyList()` and the campaign survives
(`RewardsDecoder.kt:68` + `JsonReader.kt:71-80`). One-line fix.

### 2.10 Empty strings survive on iOS and become null on Android

`JsonReader.kt:29` normalises `""` → `null` for every optional string. `JSONDecoding.swift:53` and
`FrakResolvedConfig.swift:109-111` keep `""`.

Concrete consequence: a backend `sdkConfig.homepageLink: ""` makes Android's `buildSharingLink` fall
through to `FrakMetadata.homepageLink` and produce a link; iOS takes `""` as `baseURL`,
`URLQuery.parse("")` returns nil for want of `://`, and `buildSharingLink` returns nil — surfaced to
the merchant as `merchantResolutionFailed`. Same class of divergence for `logoUrl`, `expiresAt`,
`appName` and every `ResolvedComponents` copy field.

### 2.11 Android `track`/`trackPurchase` can throw out of a `FrakResult`-returning method — **MOSTLY FIXED**

> Two of the three parts landed: `URL(...)` moved inside the deadline block behind a
> `urlOrThrow` helper that maps `MalformedURLException` to `FrakError.Network` (placed so the
> GET retry cannot mistake it for a retryable transport error, since it *is* an
> `IOException`), and the tracker's catch widened from `FrakError.Network` to `FrakError` —
> which also stops a `FrakError.Server` from `post` escaping `flush` uncaught.
>
> **`trackingCall` still does not route through `frakCall`**, so the class KDoc's guarantee is
> still not enforced by construction. No live escape remains — `Interaction.Custom.data` is
> `Map<String, String>` so `JSONObject.put` cannot throw, and `EventQueue.append` swallows its
> own IO — but that is correctness by luck.

`DefaultFrakClient.kt:148-162,234-240`. The class KDoc at `:37` states every public entry point lets
only `FrakError`/`CancellationException` escape — but `trackingCall` is the one path that does *not*
go through `frakCall`, and catches only `FrakError`. The escape hatch is real:
`HttpClient.kt:59` constructs `URL(baseUrl + path)` **outside** the `try`, so a
`MalformedURLException` from a bad `FrakEnvironment.Custom` origin propagates through
`InteractionTracker.kt:99` (which catches only `FrakError.Network`) and out of the public API.

Three parts: move `URL(...)` inside the `try` in both `get`/`post`, widen the tracker's catch to
`FrakError`, and route `trackingCall` through `frakCall`.

---

## 3. Security & privacy

### 3.1 The WebView can start arbitrary activities — **FIXED on both platforms**

> Two guards, both mirrored:
>
> **Scheme allowlist** in `openExternally` — `http`/`https` only, so `intent:`, `market:`,
> `content:` and vendor schemes can no longer reach an installed handler. Android additionally
> calls `Uri.normalizeScheme()` first, because it folds neither the comparison nor intent
> resolution on its own; Darwin's `URL` already normalises.
>
> **Frame guard** in the navigation policy, placed *above* the result branch. This is the half
> that matters most: without it a frame could navigate to
> `returnScheme://result?action=install&sid=...` and forge an outcome. Note the honest limit —
> a *same-origin* frame can set `top.location` and reach the main-frame path anyway, so the
> guard's real value is that a frame cannot be launched externally and a cross-origin frame
> cannot render full-bleed in a sheet with no URL bar.
>
> Two subtleties the first attempt got wrong, both caught in review:
> - Only *remote* schemes are judged. `about:blank`, `srcdoc`, `blob:` and `data:` frames have
>   no host to compare against and are routine inside a React page; cancelling them would have
>   broken the hosted page.
> - iOS's `targetFrame == nil` is a **new window**, not a sub-frame. `target="_blank"` and
>   gesture-driven `window.open` both produce one and neither is stopped by
>   `javaScriptCanOpenWindowsAutomatically = false`. Treating it as a sub-frame silently killed
>   every external link on the page, because `.allow` asks a `WKUIDelegate` that does not exist.
>   Same-origin new windows now load in the main frame, which is what Android's
>   `setSupportMultipleWindows(false)` does for free; cross-origin ones go to the browser.
>
> The audit's optional user-gesture check was **not** taken: `hasGesture` is unreliable for
> legitimate programmatic navigation, and with the scheme allowlist the residual risk is "an
> XSS'd page opens an https URL in the browser".

`SharingSheetState.kt:229-232` — `openExternally` does `Uri.parse(url)` → `startActivity(ACTION_VIEW,
uri)` with `FLAG_ACTIVITY_NEW_TASK`, with **no scheme allowlist**. `isSameOrigin`
(`SharingWebView.kt:133-136`) rejects `file:`, `content:`, `intent:`, `market:` and arbitrary app
schemes equally, so all of them land here. A compromised or XSS'd wallet page — or any third-party
frame it embeds — can launch arbitrary registered activities in the merchant's app, and `content://`
URIs get handed to a viewer with the merchant app's grant context.

`SharingWebView.kt:112-131` — `shouldOverrideUrlLoading` **ignores `request.isForMainFrame`**, which
the same class uses correctly at `:163` and `:171`. So any iframe navigating to a third-party host
kicks the user out of the sheet mid-flow, and an iframe can reach the `returnScheme://result` branch
at `:118-124` and drive `onAction` (`Install` → `openFrakApp()`, `Dismiss`); the `sid` check narrows
this but a same-origin frame can read the session id out of `location.search`.

iOS has both of the same holes: `SharingSheetModel.swift:144-146` opens any URL scheme, and
`SharingWebView.swift:123-153` never inspects `navigationAction.targetFrame`.

Four guards total, two per platform: `guard scheme == "https" || scheme == "http"` before opening,
and an early return for non-main-frame navigations. Consider also requiring
`navigationAction.navigationType == .linkActivated` / `request.hasGesture()` on the external-open path.

### 3.2 Android: inbound `fCtx` is not checked against this SDK's merchant

`DefaultFrakClient.kt:169-181` + `ReferralArrival.kt:9-16`

`handleReferralLink` decodes an attacker-reachable `fCtx` and tracks an arrival with no check that
`context.merchantId` is this SDK's merchant; it flows straight into the wire body as
`referrerMerchantId`. Combined with `DeepLinkObserver` firing on any intent carrying a data URI, any
app on the device — or any web page that can navigate to the merchant's app link — can post a forged
arrival naming an arbitrary referrer under an arbitrary merchant. The self-referral guard only
compares `clientId`, and a **V1 context is never treated as self-referral at all** (`:14`), so
wrapping an attacker wallet in a V1 payload bypasses it entirely.

`02-native-sdk-overview.md:212` states the invariant ("a native app maps to exactly one merchant");
the code does not enforce it. One case-insensitive equality check, plus the V1 arm on the
self-referral guard, plus a sanity bound on `context.timestamp` (the codec accepts anything up to
`0xFFFFFFFF`).

### 3.3 iOS: the software key fallback writes the raw P-256 private scalar into a plist

`DeviceKey.swift:73-76` — when `SecureEnclave.isAvailable` is false, `P256.Signing.PrivateKey()`'s
`rawRepresentation` (the 32-byte private scalar) is base64url'd into
`Library/Preferences/id.frak.sdk.identity.plist`: backed up, default file protection, readable from
any container dump. The class comment at `:38` ("Stores a key reference, not the key itself") is
false for this branch, and proof-of-possession degrades to possession-of-a-backup.

In practice this is simulator-only on iOS 15+ devices — but nothing in the code says so. There is no
`#if targetEnvironment(simulator)` and no assertion, so any device where the SEP is unavailable or
generation fails silently downgrades. Gate the branch on the simulator and throw on device.

### 3.4 iOS: `signProof` has zero production callers

`grep -rn "signProof" sdk/ios/Sources/` matches only its own definition
(`AnonymousIdStore.swift:57`). The entire signing half — `DeviceKey.sign`, `ProofCodec.message`,
`ProofCodec.proof`, `ProofOp` — is unreachable from any iOS public API. `InstallLinks.swift:6-8`
emits `<scheme>://install?m=&a=`: an unauthenticated assertion of an anonymous id. Android *does*
mint the proof (`InstallLinks.kt:22-30`, called from `DefaultFrakClient.kt:230`).

`sdk/ios/README.md` documents the *store-fallback* gap ("the install fallback carries nothing") —
but the **deep-link** path is not the store fallback and could carry a proof today. As it stands,
everything the Secure Enclave buys on iOS is 16 bytes of entropy for a UUID, which
`SecRandomCopyBytes` would give with none of §2.8's failure mode. Either wire `signProof` into
`InstallLinks.deepLink`, or write down in the wire contract that `install?m&a` is a hint the wallet
must independently verify.

### 3.5 iOS logs everything at `privacy: .public`

`Core/FrakLogger.swift:59-65` — all four levels interpolate the message *and* the error suffix as
`.public`, defeating OSLog's default redaction. In the clear today: `error.localizedDescription` for
arbitrary `URLError`s, up to 200 bytes of a rejected request body echoed by the backend
(`ConfigStore.swift:124`), the merchant UUID (`RewardRepository.swift:99`), and — via
`ProofCodec.swift:31`'s `"…must be a UUID string, got: \(value)"` surfaced through
`AnonymousIdStore.swift:79,114` — **the anonymous id, which the privacy manifest declares as a Linked
DeviceID**. Readable from any sysdiagnose. An SDK embedded in third-party apps should not widen the
host's privacy envelope. Default to `.private`; mark only known-safe static content `.public`.

Android's twin: `ConfigStore.kt:139` logs the raw 422 body at ERROR into logcat, from where crash
reporters pick it up.

### 3.6 Backup exclusion is still unwired on Android and impossible on iOS

Android's `frak_data_extraction_rules.xml` is referenced by **no manifest or Gradle wiring**
(`AndroidManifest.xml:45` explains why it cannot be), and `<data-extraction-rules>` is API 31+ only
against `minSdk 24` — there is no `full-backup-content` document for 24–30. The file's own comment
is also now wrong: it says `id.frak.sdk.xml` "holds the anonymous identity", but since the move to
AndroidKeystore that file holds only the merchant marker.

On iOS both `UserDefaults` suites (`id.frak.sdk.config`, `id.frak.sdk.identity`) are fully backed up
and device-transferred, with no exclusion possible — which is §2.8's root cause. The resolve cache
also belongs in `Library/Caches/`, not `Preferences`. The event queue's file protection class is
never set either (`EventQueue.swift:145,165`), though it holds `x-frak-client-id` and, for purchases,
`customerId`/`orderId`/`token` in cleartext; set
`NSFileProtectionCompleteUntilFirstUserAuthentication` on the **directory** so it survives atomic
replaces.

### 3.7 Unbounded response body reads

`HttpClient.kt:120` (`readBytes()`) and `HTTPClient.swift:137` (`session.data(for:)`) — no size cap,
no `Content-Length` check, on either platform. Android additionally *persists the raw body verbatim*
(`ConfigStore.kt:186-192`), so an oversized or hostile response permanently poisons the install.
This was `S5` last time and is unchanged.

---

## 4. Performance

### 4.1 One 2-slot dispatcher for blocking sockets, disk and every SDK coroutine — **FIXED**

> `defaultNetworkDispatcher()` (4 slots) now backs `HttpClient` alone; `defaultIoDispatcher()`
> (2) keeps disk and the SDK scope. One knock-on the change created and then had to repair:
> the comment above `resolveConfig` justified *not* wrapping in `withContext(ioDispatcher)`
> partly by the shared-pool starvation this fix removes. Half that rationale is now void; the
> `frakCall` error-boundary half still stands, and the comment says so rather than continuing
> to cite a tree that no longer exists.

`DefaultFrakClient.kt:266` — `Dispatchers.IO.limitedParallelism(2)` feeds the client's scope,
`ConfigStore`'s disk I/O, the `EventQueue` file I/O, **and** the fully blocking
`HttpURLConnection.perform()`. A request holds a slot for its whole life, up to
`OVERALL_DEADLINE_MILLIS = 20_000`. Two concurrent HTTP calls — e.g. the common
`resolveConfig()` + `bestReward()` pair — occupy both slots, and every disk read, every queue flush
and every SDK coroutine body queues behind them for up to 20 seconds.

`limitedParallelism` is the right instinct; the budget must not be shared between blocking socket
reads and everything else. Split into `defaultIoDispatcher()` (2) and `defaultNetworkDispatcher()`
(4), pass the latter only to `HttpClient`. This was `C8` last time and the contention window has
since got *tighter*, because `Frak.kt:62` now puts the tracking queue on the same two slots.

### 4.2 iOS `EventQueue` blocks the Swift cooperative thread pool

`Tracking/EventQueue.swift:59` is a plain `actor` on the default executor, and every method does
**synchronous blocking I/O**: `Data(contentsOf:)` (`:118`), `FileHandle.write` (`:142-143`),
`Data.write(to:options:.atomic)` (`:145,165`), `FileManager.createDirectory` (`:195`). The
cooperative pool has one thread per core and is documented as "never block" — a slow flash write or
a protected-file stall parks a pool thread and starves unrelated `async` work in the **merchant's**
app, not just ours. Android gets this right with `withContext(ioDispatcher)`.

This is the most expensive finding to discover in the field, because it degrades someone else's app.
Fix: a custom serial executor (`DispatchSerialQueue.asUnownedSerialExecutor()`), or bridge each
blocking call through a dedicated queue.

### 4.3 `track()` awaits the entire backlog drain — both platforms — **FIXED**

> Android detaches onto the client's own `CoroutineScope`, now a constructor parameter on
> `InteractionTracker`. iOS detaches onto an actor-isolated `Task`.
>
> **This fix had the widest blast radius of the batch, and two follow-on defects had to be
> repaired before it was safe** — worth recording, because both were invisible without
> reading the callers rather than the call:
>
> 1. On iOS the first attempt replaced the `isDraining`/`drainRequested` pair with a chained
>    task, which silently deleted *coalescing*: N concurrent tracks became N full drains,
>    each one a `Data(contentsOf:)` plus a per-line JSON decode. That amplifies §4.4 rather
>    than leaving it alone. The shipped version keeps a single in-flight task and a
>    `drainAgain` flag, so N tracks still collapse to one follow-up pass — while `flush()`
>    now genuinely means "a pass covering my event has completed", which the old
>    early-returning version did not.
> 2. Detaching turned §2.7's read/compact window from a two-caller race into something the
>    SDK triggers itself from sequential `track` calls. Closed on both platforms — see §2.7.
>
> Test impact: the iOS suite asserted on delivery immediately after `track`, which the detach
> makes racy. Eleven `await tracker.flush()` calls were added. One test (`backsOffAfterAFailure`)
> sampled the request count *between* `track` and `flush` and would have failed outright; two
> more would have kept passing while silently no longer arming the backoff they claim to test.
>
> **Not covered by a test on either platform**: that `track` now returns *before* delivery.
> Android's suite cannot see the difference at all — `UnconfinedTestDispatcher` runs the
> detached drain inline, so every assertion passes against the old awaited-flush code too.

`InteractionTracker.kt:35-43,74-75` and `InteractionTracker.swift:5-6,49-53,71-72` both document
*"returns once the event is durable, not once delivered"*, and both then `await flush()`, which
drains the whole queue synchronously. On a 1000-event backlog with a slow network that is minutes,
and the merchant is awaiting it from a button handler. The durability guarantee is satisfied by
`enqueue` alone — detach the drain onto the SDK's own scope.

### 4.4 O(N) disk and JSON work per tracked event, i.e. O(N²) per session

`InteractionTracker.kt:78,126-133` + `EventQueue.kt:62-83,97-116`. Every event triggers a full-file
read + JSON parse of N rows, then a **second** full read + parse at `:129`, then a full re-serialise
+ temp write + rename. On iOS the same shape plus three full-file copies per read
(`String(decoding:)` → `.split` → `Data($0.utf8)`), and the body is JSON-encoded three times: built
with `JSONSerialization` into a `String`, re-encoded as an escaped JSON string field by
`JSONEncoder`, then re-encoded to `Data` on send. Kotlin stores the body as a nested `JSONObject`,
so the two on-disk formats also diverge.

The second read is straightforwardly redundant. Longer term: append-only delivery marks with
periodic compaction beats rewriting the file per event.

### 4.5 Identity is minted synchronously on the main thread — both platforms

`FrakClient.kt:32` / `DefaultFrakClient.swift:54-56` expose `anonymousId` as a **non-suspend,
non-async** property that on a cold cache does SharedPreferences/UserDefaults I/O plus
AndroidKeystore or Secure Enclave P-256 key generation — hundreds of milliseconds on real hardware —
under a lock. Both `init` blocks pre-warm it, but that warm-up is unordered against a merchant
reading `Frak.client.anonymousId` right after `initialize`, which is the obvious usage. On iOS the
lock is an `NSLock`, which does no priority donation, so a main-thread reader blocking on a
background-QoS holder is a textbook priority inversion and a watchdog-hang candidate.

This is the **ABI-shaped** one: once published, `val anonymousId: String?` can never become
`suspend`. `resetAnonymousId()` is on the same footing and is reachable at any point in the app's
life. Make the accessors `suspend`/`async` and keep a cache-only synchronous property that returns
null until warm — before the freeze, not after.

Related: `Frak.initialize`'s KDoc promises "Non-blocking, does no I/O, never throws" on both
platforms and both do I/O. Android calls `context.noBackupFilesDir` (`Frak.kt:71` → `mkdirs()`);
iOS opens two `UserDefaults` suites and calls `EventQueue.defaultFileURL` (`Frak.swift:38-58` →
`createDirectory` + `setResourceValues`), all inside a lock, from
`application(_:didFinishLaunchingWithOptions:)`. Make the file URL lazy, or make the comment true.

### 4.6 Unbounded caches

`RewardRepository.kt:19,113` and `RewardRepository.swift:22,103` — `cache` is never evicted, and the
key includes `targetInteraction`, which the KDoc explicitly describes as "open on the wire". A
merchant calling `bestReward(targetInteraction = productSku)` in a list adapter grows this without
limit for the process lifetime, holding a full campaign list per entry. Expired entries are dropped
only on read of the same key. `Backoff.state` has the same key space and the same problem. A
`LinkedHashMap` with `removeEldestEntry` capped at ~16, or an expiry sweep on write.

---

## 5. Simplification, deduplication, overcomplication

This section is where the codebase gets *smaller*.

### 5.1 `ConfigStore` is a per-key state machine with exactly one key

`ConfigStore.kt:30-49,83-99,144-164` carries `hydrationAttempted: HashSet`, `revalidating: HashSet`,
`backoff: HashMap`, `singleFlight: ConcurrentHashMap`, a `"hydrate:$key"` sub-flight, and a
re-check-after-hydration merge at `:93-98` — all keyed. But the key comes from
`MerchantQuery.from(config).cacheKey()` where `config` is the immutable `FrakConfig` frozen at
`Frak.initialize`, so it is a **process-lifetime constant**. `memory` and the persisted slot already
acknowledge this by being single-slot. That is ~60 lines of state machine plus a 6-line KDoc
reasoning about a race between two keys that cannot occur.

`revalidating` additionally duplicates what `SingleFlight` already provides — `singleFlight.run(key)`
collapses concurrent revalidations by itself; the only thing the set adds is the `isBackingOff` gate,
checkable inline. Collapse to one `@Volatile Entry?`, one `Mutex`, one `Boolean`, one `Job?`.

### 5.2 iOS `SingleFlight` is ~120 lines and two `@unchecked Sendable` classes for a dictionary

`Config/SingleFlight.swift:5-64,77` is an `actor` stored inside two other actors, whose only state is
a `[String: Flight]` already fully serialised by its owner — every call pays two extra actor hops for
nothing. This directly contradicts the design note the codebase already wrote for `Backoff`
(`Backoff.swift:6-8`: *"A plain struct, held as isolated state inside an owning actor rather than
being an actor itself"*). The same reasoning applies verbatim.

Inside it, `CompletionFlag` + `Waiter` + a per-waiter relay `Task` exist to give one waiter early
return on its own cancellation without cancelling the shared flight. The shared flight is already
bounded by `overallDeadlineSeconds = 20` and resolves in well under a second in practice, so the
worst case being engineered away is "a cancelled caller waits up to the request deadline" — the
standard structured-concurrency behaviour. `CompletionFlag` and the identity-guarded eviction *are*
needed and correctly reasoned; `Waiter` is the part carrying its weight poorly. And
`Waiter.attach`'s `if finished { unlock; return }` (`:33-36`) is unreachable — and would drop a
`CheckedContinuation` without resuming it, hanging the caller forever, if it ever fired.

Make `SingleFlight` a struct on the owning actor, matching `Backoff`. Keep `CompletionFlag`. Delete
`Waiter` unless per-waiter early cancellation is a stated product requirement — and if it is, say so
in the doc comment, which currently explains *how* it works but never *why anyone needs it*.

### 5.3 `Backoff.runOrRecordFailure`'s justification does not hold — **FIXED on iOS**

> Deleted on iOS: a generic function, an `isolation:` parameter and an 8-line comment whose
> premise was wrong, replaced by a plain `do`/`catch` at each of the two call sites. The
> claimed restriction never applied — `backoff.recordFailure` is a synchronous `mutating` call
> inside an already-isolated method, with no exclusive access spanning an `await`.
>
> **Android's mirror is untouched.** Its problem is the opposite one described below (lock
> ownership split across the boundary), which is a design pick rather than a deletion, so it
> did not belong in a quick-win batch.

`Backoff.swift:74-92` is a generic `#isolation`-carrying higher-order function whose comment says
Swift does not allow an `async` mutating method on an actor-isolated stored property. That
restriction is about `await`-ing a mutating method *on* the stored `Backoff`; a plain `do`/`catch`
inside the owning actor's own method has no such problem. Both call sites are exactly equivalent to
five lines of local `do { … } catch let error as FrakError { backoff.recordFailure(...); throw }`.
Deleting it removes a generic function, an `isolation:` parameter and a misleading 8-line comment.

Android's mirror has the opposite problem: `Backoff.kt:12-14` declares itself "not thread-safe;
callers hold it behind their own mutex", yet two of its five methods take the caller's `Mutex` as a
parameter and lock it themselves. Lock ownership split across the boundary in both directions is how
lock-ordering bugs are born. Pick one.

### 5.4 `ConfigStore` and `RewardRepository` are the same 40 lines, twice, per platform

`ConfigStore.kt:30-34,101-123` vs `RewardRepository.kt:15-18,70-116` (and the Swift equivalents):
`SingleFlight` + `Backoff` + `Mutex` + TTL entry + `runOrRecordFailure` → `recordFailureAndThrow` →
decode → `withLock { recordSuccess; cache[key] = … }`. They differ only in TTL, decoder and the
SWR/no-SWR policy — and, per §2.3, they *accidentally* differ in backoff semantics too. One
`CachedEndpoint<T>` parameterised by `(ttl, path, params, decode, serveStale)` removes the
duplication and makes the two policies a visible parameter instead of an invisible divergence.

### 5.5 The Android convention plugin owns nothing — **HALF FIXED**

> The whole `android {}` half — `compileSdk`, `minSdk`, `consumerProguardFiles`,
> `compileOptions`, `buildConfig = false`, `publishing { singleVariant }` — now lives once in
> `frak-publish.gradle.kts`. Both modules keep only what genuinely differs: `namespace`,
> `compose = true`, `testOptions`, the Robolectric JDK-17 pin.
>
> **The `kotlin {}` half stays duplicated**, and that is the half that drifted. buildSrc
> carries AGP but not KGP, so the Kotlin extension is not on that classpath; moving it means
> adding KGP to buildSrc and keeping its version in step with the catalog by hand. The actual
> drift — `:frak-sdk-ui` missing `jvmDefault = NO_COMPATIBILITY` while publishing
> `public sealed interface SharingResult` — is fixed, but nothing structural stops it
> recurring. A `checkKotlinInvariantsMatch` task, or KGP on the buildSrc classpath, would.
>
> The audit's own suggestion of `lint { abortOnError = true }` was **not** taken: it is
> already AGP's default, so it would have been a line that reads like a fix and changes
> nothing. The real gap is that Lint has still never been executed once.

`frak-sdk/build.gradle.kts:11-52` and `frak-sdk-ui/build.gradle.kts:10-51` independently repeat
`compileSdk`, `minSdk`, `consumerProguardFiles`, `compileOptions`, `buildConfig = false`,
`publishing { singleVariant }`, and the whole `kotlin { explicitApi(); jvmTarget; apiVersion;
languageVersion }` block — ~35 lines verbatim — even though `frak-publish` already applies
`com.android.library` and is the natural owner. It has **already drifted**:
`frak-sdk/build.gradle.kts:54` pins `JvmDefaultMode.NO_COMPATIBILITY` with a comment about not
`AbstractMethodError`-ing merchants, and `:frak-sdk-ui` — which publishes the `public sealed
interface SharingResult` — does not. Two artifacts that ship in lockstep with different
ABI-evolution guarantees.

Move everything invariant into the convention plugin, add `lint { abortOnError = true }` and
`jvmDefault` there once.

### 5.6 Duplicated primitives inside each platform

- Android: `ProofCodec.kt:36-63,132` and `FrakContextCodec.kt:33-37,137-169` carry **two independent
  copies** of the UUID regex, `UUID_BYTES`, the `HEX` alphabet, hex→bytes, bytes→hex and
  bytes→UUID. Both must agree byte-for-byte with the same TS source and nothing structurally forces
  them to; a fix to one is invisible to the other. One `internal object Hex`/`Uuids` in `core/`.
- iOS: the inverse layering problem — `Sharing/FrakContextCodec.swift:72,79,102-104` reaches into
  `Identity/ProofCodec` for UUID↔bytes, making the sharing codec depend on the proof layout. Move it
  to `Core/`.
- iOS: `FrakResolvedConfig.swift:109-119,155-157` hand-writes thirteen
  `try? container.decodeIfPresent(…)` expressions that are character-for-character the body of the
  `decodeForgiving` helper already at `JSONDecoding.swift:53-55` and used by `RewardsDecoder`. Two
  decoders in one package forgiving in two different idioms.
- iOS: `Net/HTTPClient.swift:65-131` has four near-identical `catch` ladders re-deriving the same
  error mapping with different subsets each time (`get` is missing the `URLError.cancelled` arm that
  `post` has). One `mapTransportError`.
- iOS: `JSONDecoding.swift:25-31` uses `JSONSerialization` to pull one error code, bridging the whole
  body to `NSDictionary`, while everything else uses the shared `JSONDecoder`. A four-line
  `ErrorEnvelope: Decodable` replaces it.

### 5.7 Three overlapping timeout mechanisms on iOS, and arithmetic that cancels itself on Android

iOS: `timeoutIntervalForRequest = 15`, `timeoutIntervalForResource = 20`, **and** a `Deadline` task
group at 20s, plus `urlCache = nil` *and* `.reloadIgnoringLocalCacheData` on an already-`.ephemeral`
configuration. `Deadline` only bites when a retry pushes past the resource timeout — a narrow window
for a whole `withThrowingTaskGroup` + `Task.sleep` per request.

Android: `OVERALL_DEADLINE_MILLIS = 20_000` wraps both attempts, but one attempt alone can legitimately
consume `CONNECT (10_000) + READ (15_000) = 25_000`. So the documented "one retry" can **never** fire
for a timeout-shaped failure. It only helps the fast-failing `IOException` case it names — which is
fine, but the constants should say so.

### 5.8 Dead code and unused API — **MOSTLY FIXED**

> Deleted: `JsonReader.stringArray`, `Frak.resetForTesting`, the `frak_sharing_close` string
> in both locales, five version-catalog aliases and the two versions behind them, and
> `Backoff.runOrRecordFailure` (§5.3). The two stale comments are rewritten —
> `consumer-rules.pro` no longer says "there is no SDK code yet", and `run.sh`'s `xcframework`
> message no longer tells the reader the package is scaffolding with no SDK behaviour.
> `ConfigStore`'s provably-null `cached ?: readCache(key)` went with the §2.3 fix.
>
> **Deliberately kept**: `HttpClient.get(headers:)` (a default parameter, not dead weight),
> `FrakError.alreadyPresenting` on iOS and `ProofOp.Ensure`/`.Merge` on both. Those three are
> parity questions, not dead code — iOS *should* probably produce `alreadyPresenting` the way
> Android does, and deleting them would widen the cross-platform gap the audit is trying to
> close. The 422 branch stays too: it is defensive logging for a case the code says is
> unreachable, which is exactly when you want the log.

| Item | Location |
|---|---|
| `HttpClient.get(headers:)` — no production caller, absent on iOS | `net/HttpClient.kt:33` |
| `JsonReader.stringArray` — 0 production + 0 test references | `net/JsonReader.kt:83` |
| `frak_sharing_close` string — unreferenced, ships in every merchant app, both locales | `frak-sdk-ui/src/main/res/values{,-fr}/strings.xml` |
| `FrakError.alreadyPresenting` — declared on iOS, **no producer anywhere**; Android does produce it | `ios Core/FrakError.swift:18` |
| `signProof` — no production caller on iOS | `ios Identity/AnonymousIdStore.swift:57` |
| `ProofOp.Ensure`/`.Merge` — never minted by production code on either platform | `ProofCodec.kt:9,11`, `ProofCodec.swift:5-7` |
| `resetForTesting()` — internal, 0 references on Android | `Frak.kt:139` |
| Five dead version-catalog entries + two versions backing them | `libs.versions.toml:73,76,77,81,82` and `:34,35` |
| `ConfigStore` 422 branch documented as unreachable-by-construction, which it is | `ConfigStore.kt:133-137`, `ConfigStore.swift:117-121` |
| `cached ?: readCache(key)` where `cached` is provably null | `ConfigStore.kt:68` |
| `consumer-rules.pro` rationale: "there is no SDK code yet" | `frak-sdk/consumer-rules.pro:14` |
| `xcframework` die message: "this package is scaffolding, no SDK behaviour exists" | `ios/scripts/run.sh:158-159` |

The last two are the tell: both files still describe a repository that stopped existing several
commits ago.

---

## 6. Best practices worth fixing before the freeze

### Kotlin / Android

- **`FrakConfig` (9 params) and `FrakMetadata` (5) are all-default-argument constructors with no
  `@JvmOverloads`**, while `Frak.initialize` is `@JvmStatic` — so Java interop is clearly intended
  but a Java merchant must pass every argument. Note this interacts with the Builder question in
  `06-abi-decisions.md`: `@JvmOverloads` bakes N `<init>` descriptors into the ABI, so decide the
  Builder question *first*.
- **`FrakClient` is a public non-sealed interface with 14 members**, several with default arguments,
  and `DefaultFrakClient.kt:68`'s KDoc already assumes merchants write hand-written fakes. Adding any
  method is then a binary *and* source break. Either document "we will never add a method", or make
  it an abstract class with an internal constructor.
- **`NotInitialized`, `TrackingDisabled`, `AlreadyPresenting` are `object`s extending `Exception`.**
  A `Throwable` singleton captures its stack trace once at class init, so every throw hands the
  merchant a trace pointing at `<clinit>`. They are also process-wide mutable — `addSuppressed` from
  anywhere corrupts them globally, and `HttpClient.kt:46` already uses `addSuppressed`.
- **`frakCall` catches `Throwable`** (`DefaultFrakClient.kt:276`) — including `OutOfMemoryError` and
  `LinkageError` — and maps everything unexpected onto `FrakError.Decoding`, whose public KDoc says
  "2xx response that couldn't be read as the expected shape". Catch `Exception`, add
  `FrakError.Internal` (cheap now, impossible after the freeze).
- **`FrakError` is exception-as-control-flow on the normal offline path**: `buildSharingLink`,
  `installIdentity` and `trackingCall` all `try { resolveConfig() } catch (FrakError) { null }`,
  constructing an exception and walking the stack on every share and every tracked event while
  offline. Override `fillInStackTrace`, or add a non-throwing `resolveOrNull()`.
- **Public reward models have no `equals`/`hashCode`/`toString`** (`rewards/Rewards.kt`), so
  `distinctUntilChanged`, `DiffUtil` and Compose `remember` all misbehave — while
  `FrakResolvedConfig` hand-writes all three. Money is `Double` throughout, with no non-finite or
  negative rejection.
- **`FrakEnvironment` defaults `walletPackageId`/`walletScheme` to the *dev* wallet on the interface
  itself**, so a `Custom` environment that forgets to override points a production build at the dev
  wallet, silently. Make both abstract.
- **`resourcePrefix` is not set** on `frak-sdk-ui` even though `strings.xml:5-8` explains at length
  that every name must be `frak_`-prefixed. One line makes AGP enforce it.
- **`Project.copy {}` / `zipTree()` inside `doLast`** (`frak-publish.gradle.kts:166-167`) breaks the
  configuration cache — the same class of problem already fixed one line group earlier for
  `ExecOperations`. Use `FileSystemOperations`/`ArchiveOperations`.
- No `distributionSha256Sum` on the Gradle wrapper, for a build that produces signed artifacts.

### Swift / iOS

- **`FrakError` is a public non-frozen enum with an existential payload** (`case network(underlying:
  any Error)`), so it cannot be `Equatable` — merchants cannot assert on it in their own tests — and
  adding a case is a source break for every `switch`. A `struct FrakError { let code: Code; let
  underlying: (any Error)? }` with a closed `Code` fixes both.
- **`PercentEncoding` is `public` solely so `FrakSDKUI` can link it**, as its own comment admits.
  That is permanent public API in merchant autocomplete. `@_spi(FrakSDKUI)` or an internal shared
  target. Worth a pass over the rest of the `public` surface.
- **`SharingSheetModel`'s prepare task is never cancelled** (`:88-93`): `release()` cancels only the
  deadline. Swipe the sheet away mid-`buildSharingLink` and `prepare` resumes afterwards, assigns
  `self.webView` and calls `webView.load(url)` — creating and loading a WKWebView for a sheet that is
  gone. `release()` also does not set `closed`, so a late `report(...)` leaves `best` non-nil and the
  **next** presentation reports a stale result from the previous session. One `Task` handle plus one
  `closed = true` fixes both; better, replace `.onAppear { Task { … } }` with `.task`, which SwiftUI
  cancels for free.
- **`NativeShare.share()` can hang forever** (`:28-33`) — **FIXED, partially.** The double-resume
  crash is closed outright by a locked one-shot latch: the handler is documented as firing once
  and some share extensions fire it twice, and a `CheckedContinuation` resumed twice is a hard
  crash rather than a warning. The hang is *narrowed*, not closed — a refused presentation is now
  detected by reading `presentingViewController` straight after `present`, so every synchronous
  refusal becomes an ordinary `false`; a presentation accepted and then torn down before the
  handler fires still leaks, and needs a device to reproduce.

  Two shapes were tried and rejected. A **wall-clock timeout** is unsound in principle, not just
  hard to tune: a share sheet is legitimately open for as long as the user takes to write a
  message, so no constant separates "wedged" from "in use", and firing one would report
  `.dismissed` and tear the sheet down underneath a live share. A **pre-flight guard** on the
  presenter's state was written, reviewed, and removed: `isBeingPresented` is true while the Frak
  sheet is animating in, which is exactly when tier 3 fires offline, so it turned the fallback
  into a sheet that flashed open and closed with `.dismissed`. Guessing at UIKit's refusal
  conditions up front rejects presentations it would have accepted; asking afterwards does not.

  (Credit where due: the iPad popover *is* anchored at `:19-26`, and window lookup is scene-based,
  not the deprecated `UIApplication.shared.windows`.)
- **Fixed 480pt page height in a non-scrollable `VStack`** (`FrakSharingSheet.swift:62,71-106`, and
  the same at `FrakSharingSheet.kt:150` on Android). At accessibility text sizes on a 667pt iPhone SE
  the Share and Copy buttons are pushed off the sheet with no way to reach them. No
  `.presentationDetents`, no `ScrollView`. Android additionally applies the identical size modifier
  twice (`:102-103` and `:111-112`).
- **Accessibility gaps**: a bare `ProgressView()` with no label announces "in progress" with no
  context for 1.5s while the buttons are disabled; the "Link copied" confirmation — the only feedback
  the copy action gives — appears silently to VoiceOver.
- **The page URL carries no `lang` and no `theme`** (`SharingPageURL.swift:24-49`), so a French device
  can get English page copy inside a French-titled sheet, and dark mode gives a light page on a dark
  sheet — made worse by the web view being deliberately transparent.
- **Two unstructured fire-and-forget `Task {}`s with no stored handle** (`DefaultFrakClient.swift:44,
  64`), neither cancellable in `deinit`. `resetAnonymousId()` is documented as GDPR erasure yet
  returns before the purge has happened — it should be `async`.
- **Wall-clock `Date()` for every in-memory TTL and backoff window.** A clock moved backwards makes
  `retryAt` unreachable for the duration of the skew and cache entries look fresh indefinitely.
  `fetchedAt` genuinely needs wall clock because it is persisted; the in-memory windows do not.
  Android has the identical issue.
- **`WKWebViewConfiguration` sets only two knobs.** Also worth setting: `dataDetectorTypes = []`
  (stops phone numbers becoming tappable app-switches — same class as §3.1),
  `mediaTypesRequiringUserActionForPlayback = .all`, `preferredContentMode = .mobile`, and
  `scrollView.bounces = false` (a bouncing inner scroll view fights the sheet's drag-to-dismiss).
  Note `websiteDataStore = .default()` means wallet cookies persist in the **merchant's** container —
  the rationale is sound but belongs in the README. Android's hardening block is genuinely good;
  `safeBrowsingEnabled` and a `CookieManager.flush()` are the two gaps there.
- **`WarmSharingWebView`'s web view is never inserted into a view hierarchy** — `body` is
  `Color.clear` — so WebKit deprioritises and can suspend the content process. Only the DNS/TLS
  warming reliably survives; the "heats web view engine" claim is the part least likely to hold.
  Also `returnScheme: ""` puts a sentinel into the live `url.scheme == returnScheme` comparison.

---

## 7. Plan divergence and documentation accuracy — **FIXED**

> **Every row in the table below has been corrected in the source docs.** Specifically:
> `sdk/AGENTS.md` now states the real toolchain (Gradle 9.5.0, AGP 9.1.1, Kotlin 2.4.10,
> language/API level 2.2, JVM 17, `compileSdk 36`), says plainly that `apiCheck`/`apiDump` do
> not exist and why, splits the "zero third-party runtime deps" claim into the `:frak-sdk`
> case (true) and the `:frak-sdk-ui` case (false — it ships Compose), drops the `<150 KB`
> contradiction, and adds a bullet recording that publishing and CI are deliberately deferred.
> `sdk/android/README.md`'s package table now lists the types that **exist**, and calls out by
> name the seven the plan proposed that never became declarations. The `FrakSdkVersion`
> "mirrors exactly" claim now states the casing difference. `sdk/ios/README.md` corrects the
> seam count, replaces the bare "Swift 5.9+, clean under Swift 6" header with an explicit
> warning about §1.5, and says outright that `signProof` has no production caller. Both
> READMEs now describe `golden-rewards.json` accurately: declared on both platforms, loaded by
> neither. The plan README no longer claims a committed `.api` dump, and its "green" row now
> says "last passed on a maintainer's machine" with a callout explaining that stale
> `sdk/android/**/build/` output is from an older tree and is not evidence.
>
> The original findings are kept below as written, so the next pass can tell what was corrected
> from what was always right.

The three documented iOS divergences are real and the code does exactly what the docs say —
verified: `UserDefaults` in a separate `id.frak.sdk.identity` suite, `DeepLinkHandling` with no
`.automatic` case, plain App Store URL carrying nothing. Good.

What does not hold:

| Claim | Source | Reality |
|---|---|---|
| "Gradle 8.14.3, AGP 8.11.0, Kotlin 2.0.21 → language level 1.9" | `sdk/AGENTS.md:55` | Gradle **9.5.0**, AGP **9.1.1**, Kotlin **2.4.10**, language level **2.2**. All four wrong. |
| "`check` … dex budget, **apiCheck**" and "`apiDump` — regenerate the BCV dump" | `sdk/AGENTS.md:72-73` | BCV removed; no `apiDump` script in `package.json`; no tracked `.api` file. |
| "budget < 150 KB" | `sdk/AGENTS.md:63` | 256 KB — contradicted by `AGENTS.md:62`, two lines above. |
| "Zero third-party runtime deps … `kotlinx-coroutines-core` is the single exception" | `sdk/AGENTS.md:63` | True for `:frak-sdk` (verified — exactly one `api` dependency). **False** for `:frak-sdk-ui`, which ships compose-bom, ui, foundation and material3 in a published artifact. |
| "the dump (**which is committed**)" | `plan README:15` | No tracked `.api` file exists. |
| corpus "covering … **reward formatting** … that Kotlin, Swift and TypeScript **all** assert against" | `android/README.md:198-201`, `ios/README.md:309-313` | `golden-rewards.json` is asserted by TypeScript only. Both native constants are declared and loaded by nothing. |
| "no Swift suite loads it, so **iOS** reward formatting is still asserted against hand-written JSON" | `plan README:173-175` | Understates it: **neither** platform loads it. |
| "`ProofCodec` and `signProof` **ship anyway**, asserted against the corpus" | `ios/README.md:70-72` | The code ships in the binary but nothing on iOS ever invokes it (§3.4). |
| "`FrakSdkVersion` mirrors Swift's `FrakSdkVersion` exactly" | `android/README.md:537` | The Swift type is `FrakSDKVersion`. Values match; the name does not. |
| "`FrakSDKUI` has six [platform-conditional seams]" | `ios/README.md:297-300` | Six is the total across both modules; FrakSDKUI has five. |
| Package table listing `PlacementResolver`, `RewardSelector`, `PurchaseTracker`, `DeepLinkBuilder`, `InstallRedirector`, `AppInstalledProbe`, `AttributionMerger` | `android/README.md:173-182` | **None of these types exist.** iOS's README adds the "these are plan names, not type names" caveat; Android's does not, and presents it as an inventory. |
| "`assembleRelease` / `ktlintCheck` / `test` / `publishToMavenLocal` green" | `plan README:134-135` | Unverifiable and unreproducible. The only on-disk evidence is `sdk/android/**/build/`, which is from an **older tree** — it contains a `ReferralArrivalTest` that no longer exists in the source, and an API dump predating `preloadSharing`. |

Claims that *are* true and worth keeping: the test counts (209 Android, 238 iOS — both verified
exactly), the public-surface inventory, the "not implemented" lists on both platforms, the manifest
hygiene claims (no exported components, no permission beyond INTERNET, scoped `<queries>`, never
`QUERY_ALL_PACKAGES`), the identity storage description, the queue's caps and eviction policy, "zero
third-party dependencies" on iOS, and "nothing has run on a device, no CI builds either".

**No `TODO`/`FIXME`/`XXX`/`HACK` markers exist anywhere in either SDK.** The unfinished work is
entirely structural, which is why it needs an inventory rather than a grep.

Also still open from the plan: the example harnesses (`example/native-{android,ios}`) are still
type-only stubs that open with "⚠️ SCAFFOLDING — the real SDK does not exist yet" and are not wired
to `mavenLocal()` or the SwiftPM package. There is no end-to-end proof anywhere that the public API
is usable — and the plan calls the example apps "not a demo but the only way to run a native SDK at
all".

---

## 8. Tests

> **§8.2 partially addressed.** `SharingSession` and a new pure `sharingDecision` predicate moved
> out of `SharingSheetModel`'s `#if canImport(UIKit)` into `SharingSheetLogic.swift`, with nine
> tests that genuinely execute on the macOS host. That covers the tier matrix — deadline vs
> page-loaded vs already-fallen-back — which is where the §2.1/§2.2 class of bug lives.
>
> Be clear about what it does **not** cover, because the number is small: roughly ten lines of a
> 328-line file. `SharingSheetModel` and all of `SharingWebView` still have zero executed
> coverage on iOS — `navigationFailed`, the navigation-response policy, content-process
> termination and the frame guard included. Their Android twins in `SharingWebViewClientTest.kt`
> are the only executed evidence for that logic on either platform, which is exactly the
> asymmetry §0 warns about. Protocol extraction for `WKWebView`/`NativeShare` was considered and
> rejected: its payoff is gated behind the same missing simulator runner, so it would be a large
> refactor buying nothing today.

Both suites are well-commented and the *why* comments are mostly accurate. `BackoffTest`/`BackoffTests`
are a genuinely well-matched pair, and the golden-fixture loaders (repo-root discovery, hard failure
on missing file / bad JSON / wrong `formatVersion` / empty array) are the right design.

The gaps that matter:

1. **`golden-rewards.json` is declared as a contract and consumed by nothing**, on both platforms. A
   declared-but-unloaded corpus is worse than none, because it reads as coverage in review. The 16
   `format-amount` vectors carry `formattedCodepoints` specifically to make this checkable, and
   `RewardsDecoderTest.kt:224-230` / `RewardsDecoderTests.swift:36-42` hand-type `"12\u00a0€"`
   instead. (Fair nuance: 41 of the 67 vectors cover selection and formatting the natives do not
   implement — the backend returns pre-formatted values. The 16 decode-fidelity vectors *are*
   applicable and 0 are used.) Either wire them or delete the constants.

2. **The iOS sharing sheet has zero executed coverage.** `run.sh` stage 2 runs on the macOS host,
   where every `#if canImport(UIKit)` path does not exist, and `FrakSDKUITests` contains one file.
   So `SharingSheetModel.swift:41-328` — a 287-line state machine with a deadline, three fallback
   tiers and one-shot reporting — plus the entire web-view origin-pinning and stale-session defence
   have **no executed assertions**. Android has 18 tests for the same behaviours under Robolectric,
   and found five bugs there. §2.2, §5.9's `release()` bugs and the `NativeShare` hang are exactly
   the class of defect that coverage catches. `SharingSheetModel` depends on UIKit only for
   `@MainActor` and the pasteboard — inject those as closures (as `client` already is) and it is
   host-testable today.

3. **A guard that cannot fail.** `FrakContextCodecTest.kt:42-46` increments `checked` once per
   element of the same filtered list it then compares against: `n == n`, including when `n == 0`.
   iOS gets it right with `#expect(!fixtures.isEmpty)`. Both platforms' reject-fixture guards are
   also `> 0` floors — deleting 20 of 21 rejection vectors would fail neither suite.

4. **iOS concurrency tests are sequenced by wall-clock sleeps.** `SingleFlightTests.swift` has eight
   `Task.sleep`s and asserts `Date().timeIntervalSince(start) < 0.2` at `:109`; `ConfigStoreTests.swift:65`
   sleeps 100ms then asserts a request count for a *background* revalidation. 17 `Task.sleep`
   occurrences across the iOS suite, up from 8 at the last audit. Android solved the same problem
   properly — `SingleFlightTest.kt:35-60` gates registration on a `CompletableDeferred` barrier
   dispatched FIFO onto a single-thread context, with 50 concurrent callers — and its own doc comment
   explains why sleeps were rejected. Port the barrier.

5. **Neither real key store has any test**, on either platform. Both suites test only
   `FakeDeviceKeyStore`. Untested: corrupt blob, `Backing` tag mismatch, Secure Enclave unavailable,
   `create()` on a locked device, `delete()` on a missing entry — i.e. every path in §2.8. The
   blob-parsing half of `PersistedDeviceKeyStore` is pure and host-testable *today*.

6. **iOS has no redirect/cache/`Accept-Encoding` assertions.** Android pins all three explicitly
   (`HttpClientTest.kt:145-193`). `URLSession` follows redirects by default; a regression in
   `NoRedirectDelegate` is silent and security-relevant.

7. **`Base64URL.swift` and `Hex.swift` have no tests, and are used as the oracle** for the iOS context
   corpus assertions. A wrong `Hex.decode` feeds garbage into the reject-direction assertions, which
   then pass vacuously. Android's `Base64UrlTest.kt` is thorough (including the non-canonical-tail
   case at `:52`) and already table-shaped — port it.

8. **The Android `Frak` facade is entirely untested** — `initialize`, double-init, `client`,
   `isInitialized`, `parseReferralLink`, and `DeepLinkObserver`, which is the `Automatic` deep-link
   path that is Android's headline divergence. iOS has `FrakTests.swift`. `resetForTesting()` exists
   for tests that were never written.

9. Neither platform tests concurrent queue writers, an append racing a compaction, or a corrupt
   *first* line (only the tail is torn in the existing test). iOS is also missing Android's
   no-`.tmp`-left-behind atomicity assertion.

10. Housekeeping: three near-identical `FakeFrakClient` implementations (two of them intra-Android,
    genuinely consolidatable via a `testFixtures` source set — the iOS one must stay separate because
    `PublicSurfaceTests` deliberately avoids `@testable`); `ProofCodecTest.kt:98,117` use Kotlin's
    `assert(...)`, a no-op without `-ea`, for the two most security-relevant assertions in the file;
    temp directories and `UserDefaults` suites are never torn down; `RewardsDecoderTests.swift`
    repeats the same 7-line `do/catch` five times and has eight malformed-JSON cases Android lacks
    entirely.

Framework consistency is good on both sides: Android is uniformly JUnit 4, iOS uniformly
swift-testing, Robolectric correctly confined to `frak-sdk-ui`.

---

## 9. Suggested sequencing

**Wave 0 — done.** The licence (§1.3, Apache-2.0), the privacy manifests (§1.4, both targets),
and the documentation corrections (§7). §1.1 and §1.2 were reclassified as deliberate
deferrals: publishing and CI land once the SDKs have run on a device.

**Wave 0b — done: the quick wins.** §2.3, §2.5, §2.9, §2.11 (2 of 3), §2.4b, the lock half of
§2.7, §4.1, §4.3, §5.3 (iOS), §5.5 (the `android {}` half), §5.8. Net effect on line count is
roughly neutral — the deletions paid for the fixes. Two lessons worth carrying into the next
wave, both of which cost a full re-review to catch:

- **§4.3 was not a local change.** Detaching the drain widened §2.7's window and, on the first
  attempt, silently deleted iOS's drain coalescing. A fix whose whole point is "stop awaiting
  this" changes the concurrency assumptions of everything downstream of it.
- **A passing suite proved less than it looked.** Android's tracker tests run the detached
  drain inline under `UnconfinedTestDispatcher`, so they pass identically against the old code
  — they cannot see the fix at all. On iOS the same change broke one test outright and hollowed
  out two others. Neither platform has a test for the actual new guarantee.

**Still to decide, don't code:** the `06-abi-decisions.md` questions, because §6's
`@JvmOverloads`/Builder choice and the `FrakError`-as-struct choice both depend on them and
both get harder every week.

**Wave 1 — make the work verifiable.** Swift 6 mode in `Package.swift` (§1.5); actually *run*
Android Lint, which has still never executed once (`abortOnError` is already its default, so
there is nothing to configure — the gap is execution, not settings). Restore BCV with a
committed dump (§1.6) when the ABI questions land. Each of these will immediately find things
this audit could not, because nothing was executed.

**Wave 2 — the correctness bugs still open, both platforms in one PR each.** §2.4a
`configUpdates` (decide the API shape first), §2.6 write-path queue bound, §2.7's SDK-owned row
id, §2.10 empty-string normalisation. Every one is on both platforms — doing them together is
what stops the divergence from re-opening. §2.6 pairs naturally with §4.4, since both are the
queue's read path.

**Wave 3 — the sharing sheet. Done.** §2.1, §2.2, §3.1 and the testable half of §8.2 landed
together, as one change on both platforms. Two things worth carrying forward:

- **The first attempt at the frame guard broke more than it fixed.** Treating iOS's nil
  `targetFrame` as a sub-frame killed every external link on the hosted page, and cancelling
  non-remote sub-frames would have broken `about:blank`/`srcdoc` frames. Neither is visible
  without knowing what the *page* does — the fix needed the wallet route read alongside the SDK.
- **An attempted §6 `release()` fix was reverted.** Setting `closed` there and gating `report`
  on it looks obviously right and makes a successful share report `.dismissed`, because
  `.onDisappear` also fires when `UIActivityViewController` covers the sheet and both share
  paths suspend across exactly that window. §6 stays open; it needs a signal that distinguishes
  "covered" from "dismissed", which cannot be settled without a device.

Wave 3's remaining §6 item, `NativeShare.share`'s continuation, is now done — see §6 for what it
closes and what it only narrows.

**Found while fixing waves 3 and 4, not in the original audit, not fixed:**

- **The load deadline is not cancelled when the user shares or copies by hand — both platforms.**
  Tap Copy or Share on the native footer while the page is still loading, and the 1.5s deadline
  fires afterwards, raises a *second* OS chooser the user never asked for, and on iOS `close()`s
  the sheet. Narrow window (the page must still be unloaded), but the symptom is severe. The fix
  is to settle the content on any manual action — `deadline?.cancel()` on iOS,
  `contentSettled.complete(…)` on Android — and it needs the same both-platform care as the rest
  of the sheet, which is why it is recorded rather than tacked on here.
- **Android `reset()` can silently fail to erase.** `AnonymousIdStore.reset()` wraps
  `keyStore.delete()` in `runCatching`, so if `deleteEntry` throws, the identity survives, the
  next read re-derives the *same* id, and `resetAnonymousId()` — documented as the erasure API,
  with `DefaultFrakClient` purging the queue on the assumption the id rotated — has lied. iOS
  cannot fail here (`removeValue` on a `UserDefaults` suite). Deserves a deliberate design pass,
  not a blind patch.

**Wave 4 — identity and the ABI freeze.** §2.8 restore recovery is **done** (and the negative cache
it was paired with is declined, with reasoning, in §2.8). Still open: §3.3 the software key
fallback — which on a device with no usable enclave writes the raw private scalar into a plist
that *is* backed up, and whose own class comment claims it "stores a key reference, not the key
itself" — and §4.5 the `suspend`/`async` accessors. §4.5 in particular *must* land before the
first publish; it is unfixable afterwards.

**Wave 5 — performance and simplification.** §4.1 dispatcher split, §4.2 iOS executor, §4.3/§4.4 the
drain and the O(N²) reconciliation, then §5 — which is mostly deletion and should leave the codebase
several hundred lines smaller.

**Throughout:** correct the doc claims in §7 as each one is touched, rather than in a batch. Half of
them became false because the code moved and nobody looked back at the prose; a batch fix will decay
the same way.

**One structural recommendation.** The single highest-leverage item that is not a bug: there is no
golden corpus for URL query editing, gap-fill and attribution merge. That is ~230 lines hand-ported
three ways (`queryParams.ts` / `UrlQuery.kt` / `URLQuery.swift`, plus `mergeAttribution` /
`AttributionParams.kt` / `SharingLinkBuilder.swift`), encoding case-insensitive `fCtx` lookup,
tolerant percent-decoding, "never re-encode the merchant's URL", empty-value skipping and a
seven-field precedence rule. It is the largest un-pinned surface in the port, drift there silently
mis-attributes revenue, and no existing test on any platform would notice. A
`golden-sharing-links.json` of `{baseUrl, context, attribution, defaults, productUtmContent} →
expectedUrl` would close it the same way `golden-context.json` closed the codec. The resolve-response
decoder is the second candidate — it has already produced two real divergences (§2.10 and the
documented block-level forgiveness), which is exactly what a corpus prevents.
