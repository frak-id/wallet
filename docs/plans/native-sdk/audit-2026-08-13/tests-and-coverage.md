# Frak native SDK audit — test suites, both platforms

Worktree `/home/dev/wallet-audit` @ `c0a0cec`. Read-only. No JDK/Android SDK/Swift toolchain — every claim below is derived by reading code, not by running it.

## Summary

Both suites are large and, in the arithmetic sense, healthy: **514 `@Test` methods across 59 Android files** and **473 `@Test` cases in 51 suites across 48 iOS files**. Density is not the problem; *placement* is. Three whole layers have zero executed coverage on both platforms at once: the public façade (`FrakClient` + the five `*Api`/`*API` namespaces — 296 Kotlin / 233 Swift lines of hand-written adapter, F2), the entire UIKit-gated half of `FrakSDKUI` (**2,083 lines**, not the 1,847 the register claims, F5), and `golden-rewards.json` (92.8 KB, 67 vectors, declared by both loaders and loaded by neither, F10).

The single worst item is not an absence but a *false positive*: Android's one test named for percent-decoding, `SharingLinkBuilderTest.kt:100-105`, mangles a base64url string that contains no `-` and no `_`, so the "mangling" is a no-op and the URL never contains a `%` at all (F1). Its iOS twin was written specifically to avoid that trap and says so in a comment. That test is the entire reason anyone would believe `UrlQuery.percentDecode` — the function carrying register bug 9.2 — is exercised. It is not.

Two structural test defects follow: iOS's `PersistedDeviceKeyStoreTests` gates itself on a call to the very production function it tests, so the regression it exists to catch also silently deletes the suite (F3); and Android's `SharingSheetStateTest` calls the **real** `Frak.initialize` in `@Before`, which constructs a production-pointed client whose `init` fires a live HTTPS resolve at `https://backend.frak.id` from a JVM unit test and leaks an un-`shutdown()` global across five Robolectric classes (F4).

The register (`06-open-findings.md`) is materially stale on this area: its test counts (132/366), its `Task.sleep` count (20 vs an actual 33), its `AtomicBoolean`-at-`SharingSheetState.kt:215` rationale (there are no atomics anywhere in `frak-sdk-ui`), and its claim that iOS `Base64URL` has no tests of its own (it has a four-case suite) are all wrong today.

---

## Coverage map

### Android — production files with **zero direct test reference** (grepped by declared type/function name across both `src/test` trees)

| File | LOC | Indirectly exercised? | Note |
|---|---|---|---|
| `frak-sdk/src/main/kotlin/id/frak/sdk/FrakClient.kt` | 95 | **No** | Only named in `src/test/java/.../FrakSdkJavaCallSiteFixture.java:26` — compile-only, no assertions. F2 |
| `.../ConfigApi.kt` | 31 | **No** | F2 |
| `.../RewardsApi.kt` | 60 | **No** | Unpacks `RewardRequest` into 4 positional args (`RewardsApi.kt:44-52`). F2 |
| `.../SharingApi.kt` | 31 | **No** | F2 |
| `.../TrackingApi.kt` | 32 | **No** | F2 |
| `.../AppLinkApi.kt` | 47 | **No** | F2 |
| `.../applink/DeepLinkObserver.kt` | 47 | **No** | Zero refs. Carries the established warm-start `activity.intent` bug |
| `.../core/MainThreadDispatcher.kt` | 30 | **No** | `AsyncTwinTest.kt:41` injects a `RecordingDispatcher`; the production dispatcher (posts to `Looper.getMainLooper()`) and `Frak.shutdownAsync` (`Frak.kt:139`) run in no test |
| `.../net/UrlQuery.kt` | 107 | **Vacuously** | See F1 — the only indirect test is inert |
| `.../net/PercentEncoding.kt` | — | Partly | `encode` only, via `SharingLinkBuilderTest.kt:80` and `SharingPageUrlTest.kt:47-50`. iOS has a dedicated 4-case `@Suite("PercentEncoding")` (`URLQueryTests.swift:66-88`) |
| `.../config/KeyValueStore.kt` → `SharedPreferencesStore` | 47 | **No** | The *only* production `KeyValueStore` impl. iOS has `FileKeyValueStoreTests` (11) + `UserDefaultsStoreTests` (1). F11 |
| `.../identity/AndroidKeystoreDeviceKeyStore.kt` | — | **No** | Named once, in a comment (`TestKeys.kt`). Confirms 8.5 |
| `frak-sdk-ui/.../SharingHost.kt` | 512 | Only `sharingPresentDecision` | The lifecycle/`ViewModelStore`/replay state machine itself is untested. Confirms 8.2 |
| `frak-sdk-ui/.../FrakSharingSheet.kt` | 262 | **No** | Compose |
| `frak-sdk-ui/.../SharingSheetSkeleton.kt` | 119 | **No** | Compose |
| `frak-sdk-ui/.../SharingSheetDialog.kt` | 69 | **No** | — |
| `frak-sdk-ui/.../SharingWarmup.kt` (`resolveWarmUrl`) | 40 | **No** | Reaches `Frak.client`; the warm-path entry point has no test |
| `frak-sdk-ui/.../SharingOutcome.kt` | 70 | Yes | Via `SharingSheetState.abandon()` — `SharingSheetStateTest.kt:1025,1041,1061,1120` |
| `frak-sdk-ui/.../NativeShare.kt` | 63 | Yes | Robolectric reaches `Intent.createChooser` (`SharingSheetStateTest.kt:35`) |
| `frak-sdk-ui/.../SharingSession.kt` | 79 | Yes | Via `SharingSheetState` |

### iOS — production files with **zero direct test reference**

| File | LOC | Note |
|---|---|---|
| `Sources/FrakSDK/FrakClient.swift` (+ `OpenAppResult`) | 98 | F2 — `FrakClientTests.swift` tests `DefaultFrakClient`, never `FrakClient` |
| `Sources/FrakSDK/{Config,Rewards,Sharing,Tracking,AppLink}API.swift` | 135 | F2 |
| `Sources/FrakSDK/Net/JSONDecoding.swift` (`ForgivingArray`, `AnyCodingKey`) | — | Zero direct; indirect via the two decoders. Android's `JsonReader.kt` has 2 direct test files |
| `Sources/FrakSDK/Core/Hex.swift` | — | Used as an **oracle** inside `FrakContextCodecTests.swift:47,62,98,115` and `ProofCodecTests.swift:32-40`. No suite of its own. Android has `HexTest.kt` (7 cases). **8.7's iOS half is still open for `Hex` but CLOSED for `Base64URL`** — `@Suite("Base64URL")` exists at `URLQueryTests.swift:90` |
| `Sources/FrakSDKUI/SharingTrace.swift` | 39 | Zero coverage and *not* UIKit-gated — testable today, untested |
| `Sources/FrakSDKUI/StoreOverlay.swift` | 57 | UIKit-gated |
| `Sources/FrakSDKUI/{SharingSheetModel,SharingWebView,SharingWebViewPool,SharingPresentation,FrakSharingSheet,NativeShare,SharingSheetSkeleton}.swift` | 2,026 | All `#if canImport(UIKit)` at line 1 → cannot compile on the macOS test host. F5 |

### Asymmetries (a property covered on one platform and not the other)

| Property | Android | iOS |
|---|---|---|
| URL query parse / tolerant percent-decode | **none** (F1) | `URLQueryTests.swift` — 9 cases incl. `decodesMultiByteUTF8` (`:33`) |
| `PercentEncoding` | none | 4 cases (`URLQueryTests.swift:66-88`) |
| `Base64Url` | `Base64UrlTest.kt` (5) | `@Suite("Base64URL")` (4) — **parity, register 8.7 is stale** |
| `Hex` | `HexTest.kt` (7) | **none** (oracle only) |
| Activation fragment / warm-path fragment | **none** (F9) | `SharingPageURLTests.swift:129-166` (3) + `SharingWarmFragmentTests` (4) |
| Full-string URL equality on `build`/`warm` | none — `contains()` only | `SharingPageURLTests.swift:56-63,104-113` |
| `logoUrl` / `seededReward` params on `build` | **never passed** in any Android test | `SharingPageURLTests.swift:73-83` |
| Persistence layer | none (`SharedPreferencesStore`) | `FileKeyValueStoreTests` (11) + `UserDefaultsStoreTests` (1) |
| Device key store | untestable on JVM | `PersistedDeviceKeyStoreTests` (8) — **self-disabling**, F3 |
| Sheet reclaim decision | `SharingWebViewPoolTest.kt` (19, incl. 3 renderer-gone cases) | `SharingReclaimTests.swift` (5) — pure decision only, the pool itself is UIKit-gated |
| `Frak` global façade | **no test at all**, no reset seam (`Frak.kt` has none) | `FrakTests.swift` (4) + `Frak.resetForTesting()` |
| Java/ObjC call-site compile fixture | `JavaCallSiteFixture.java`, `FrakSdkJavaCallSiteFixture.java` | none |
| `ResolvedConfigDecoder` good-and-bad-placement-together | **none** (9.3t open) | 4 cases, incl. one `.disabled` (F15) |
| Reward-request encoding | via `RewardRepositoryTest` | dedicated `ProductDetailsQueryEncoderTests` (14) |
| `Interaction` factory | `InteractionFactoryTest.kt` (5) | none as such; `RowBodyTests.swift` (6) covers the wire shape |

---

## Findings

### F1. Android's only percent-decoding test is inert — `UrlQuery.percentDecode` has zero exercised coverage, and it is the function carrying bug 9.2

- **Severity**: high
- **Axis**: tests / correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/sharing/SharingLinkBuilderTest.kt:100-105`
    ```kotlin
    fun `parses a context a channel percent-encoded in transit`() {
        // Messaging apps re-encode links; base64url's `-` and `_` survive as `%2D` / `%5F`.
        val encoded = expectedContext.replace("-", "%2D").replace("_", "%5F")
        assertEquals(context, SharingLinkBuilder.parse("https://acme.example/p?fCtx=$encoded"))
    ```
  - `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/sharing/SharingLinkBuilderTest.kt:21` — `expectedContext = "ElUOhADim0HUpxZEZlVEAABl50GAVQ6EAOKbQdSnFkRmVUQAAQ"`. Verified against `sdk/core/src/context/fixtures/golden-context.json`: the `c-only` fixture's `base64url` contains **no `-` and no `_`**.
  - The iOS twin was written to dodge exactly this and documents it: `sdk/ios/Tests/FrakSDKTests/Sharing/SharingLinkBuilderTests.swift:19-21` — *"The corpus's `timestamp-uint32-max` fixture, whose wire string actually contains the two characters a channel re-encodes; `c-only`'s does not, and mangling it would prove nothing"* — plus a guard at `:126`, `#expect(mangled != Self.encodedMangleable)`.
- **What actually happens**: `encoded == expectedContext`. The parsed URL contains no `%`, so `UrlQuery.percentDecode` never executes an escape branch. The test asserts the same thing as `parses a context back out of a link it built` two tests up. Combined with `UrlQuery.kt` having zero direct tests (established item (d)), **not one line of Android's tolerant percent-decoder is executed by any test** — including the `char.code` byte-truncation path filed as 9.2, which would still pass this test.
- **Fix sketch**: switch the fixture to the `timestamp-uint32-max` wire string (contains `_`) and add `assertNotEquals(expectedContext, encoded)` as a guard, exactly as the Swift file does; then add `UrlQueryTest.kt` mirroring `URLQueryTests.swift` case for case (including `?a=caf%C3%A9`, which is 9.2's reproducer).
- **Register status**: NEW (builds on established (d) and on 9.2; the register lists `UrlQuery` as untested but does not notice that the one test implying otherwise is vacuous)

### F2. The entire public façade — `FrakClient` + all five API namespaces — has zero executed coverage on **both** platforms

- **Severity**: high
- **Axis**: tests / parity
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - Android, 296 LOC uncovered: `FrakClient.kt` (95), `ConfigApi.kt` (31), `RewardsApi.kt` (60), `SharingApi.kt` (31), `TrackingApi.kt` (32), `AppLinkApi.kt` (47). Grep of all six type names across `sdk/android/*/src/test` returns only `sdk/android/frak-sdk/src/test/java/id/frak/sdk/FrakSdkJavaCallSiteFixture.java:26,37,52` — a fixture with no assertions whose contract is only that `javac` accepts it.
  - The adapter is not trivial: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/RewardsApi.kt:44-52` unpacks a `RewardRequest` into four **positional** arguments of `core.bestReward(...)` and applies `request.products.takeIf { it.isNotEmpty() }`.
  - iOS, 233 LOC uncovered: `FrakClient.swift` (98) + the five `*API.swift` (135). `FrakClientTests.swift:10` is `@Suite("DefaultFrakClient")` and constructs `DefaultFrakClient(...)` directly (`:38`); it never builds a `FrakClient`.
- **What actually happens**: swap two positional args in `RewardsApi.best`, or point `ConfigApi.resolve()` at `core.campaigns`, and every gate stays green: ktlint passes, `assembleRelease` passes, all 514 JVM tests pass, `apiCheck` passes (signatures unchanged), and the Java fixture compiles. It ships. Same on iOS. This is the layer *every merchant call site goes through* and the only one nothing exercises.
- **Fix sketch**: one `FrakClientFacadeTest`/`FrakClientFacadeTests` per platform that builds a `FrakClient(core)` over the existing fake transport and asserts each namespace member reaches the right `DefaultFrakClient` method with the right arguments (a recording `DefaultFrakClient` subclass is not needed — assert on `FakeHttpTransport`/`StubURLProtocol` request paths and query strings).
- **Register status**: NEW

### F3. `PersistedDeviceKeyStoreTests` is self-disabling: the skip gate calls the production function under test

- **Severity**: high
- **Axis**: tests
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/ios/Tests/FrakSDKTests/Identity/PersistedDeviceKeyStoreTests.swift:11-17`
  ```swift
  private enum HostKeyMaterial {
      static let isMintable: Bool = {
          (try? PersistedDeviceKeyStore(store: InMemoryKeyValueStore()).loadOrCreate()) != nil
      }()
  }
  @Suite("PersistedDeviceKeyStore", .enabled(if: HostKeyMaterial.isMintable))
  ```
- **What actually happens**: the eight tests that pin identity minting, persistence, blob-length rejection and reload — the SDK's whole identity durability story on iOS — run **only if `loadOrCreate()` already works**. Any regression that makes `loadOrCreate()` throw (a keychain-attribute change, a Secure Enclave availability check, an entitlement assumption) flips `isMintable` to `false`, the suite reports zero tests, and `swift test` stays green. The gate and the assertion are the same call.
- **Fix sketch**: gate on an environment probe that does **not** call `PersistedDeviceKeyStore` (e.g. a raw `SecKeyCreateRandomKey` with the same attributes), or make the gate itself an assertion: one always-enabled test that records an `Issue` when `isMintable` is false on a host where it should be true (CI).
- **Register status**: NEW

### F4. `SharingSheetStateTest` initialises the **real** SDK against the production backend, and never tears it down

- **Severity**: high
- **Axis**: tests / build-release
- **Complexity to fix**: small (<1d) — blocked on T2 (Android has no `resetForTesting`)
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/SharingSheetStateTest.kt:42-46`
    ```kotlin
    @Before fun initializeFrak() {
        // `prepare` only checks Frak.isInitialized; the real client is never used.
        Frak.initialize(context, frakConfig(merchantId = "b7c2e1a4-..."))
    }
    ```
  - `SharingInputFixtures.kt:58` — `frakConfig(merchantId) = FrakConfig.Builder(merchantId).build()`; `FrakConfig.kt:133` — `var env: FrakEnvironment = FrakEnvironment.Production`; `FrakEnvironment.kt:20` — `Production.backend = "https://backend.frak.id"`.
  - `Frak.kt:81-107` builds a real `DefaultFrakClient`, a real `SharedPreferencesStore`, a real `AndroidKeystoreDeviceKeyStore`, a real `EventQueue` on `context.noBackupFilesDir`, and registers `ActivityLifecycleCallbacks` (`Frak.kt:111-113`).
  - `DefaultFrakClient.kt:146-171` — the `init` block launches `identity.startEagerGeneration(scope)`, `resolveConfig()`, `tracker.flush()` and a never-completing `configStore.updates` collector.
- **What actually happens**: the comment is wrong. `Frak.initialize` is not a flag flip — it starts a real background config resolve that issues an outbound HTTPS `GET` to `https://backend.frak.id` from a JVM unit test (Robolectric does not sandbox the network), with a 20 s deadline (`HttpClient.kt:238`) and one retry. On a CI runner with egress this is a live production request per run; without egress it burns the connect timeout. The session is never `shutdown()` — Android has no reset seam (`Frak.kt` has no `resetForTesting`) — so the `SupervisorJob`, the lifecycle callbacks and the queue file leak for the whole Robolectric sandbox, which is shared with the four other `@Config(sdk = [33])` classes in the module (`SharingHostStyleTest.kt:13`, `SharingWebViewPoolTest.kt:23`, `SharingWebViewContextTest.kt:17`, `SharingWebViewClientTest.kt:27`). Test order becomes observable.
- **Fix sketch**: point the fixture at `FrakEnvironment.Custom("https://127.0.0.1:1", "https://127.0.0.1:1")` (already allowlisted for loopback) and add the `Frak.resetForTesting()` seam T2 asks for, called from `@After`.
- **Register status**: NEW (T2 names the missing seam; nobody has filed the live production request or the cross-class leak)

### F5. iOS `FrakSDKUI` — 2,083 UIKit-gated lines with zero executed coverage, and the register's own citation for the coverage that supposedly closed 9.1 no longer exists

- **Severity**: high
- **Axis**: tests / docs-accuracy
- **Complexity to fix**: structural
- **Evidence**:
  - `#if canImport(UIKit)` at line 1 of `SharingPresentation.swift` (279), `SharingSheetSkeleton.swift` (78), `SharingSheetModel.swift` (612), `SharingWebView.swift` (507), `FrakSharingSheet.swift` (254), `StoreOverlay.swift` (57), `SharingWebViewPool.swift` (165), `NativeShare.swift` (131) = **2,083 lines**.
  - Register 8.2 states 1,847 and lists per-file figures (`SharingSheetModel` 624, `SharingWebView` 379, `SharingWebViewPool` 152, `SharingPresentation` 318, `FrakSharingSheet` 248, `NativeShare` 126) — five of six are wrong against the current tree.
  - Register 8.2 and 9.1 both cite `AttributionLedgerTests in SharingSheetLogicTests.swift` as the host-tested regression proof for 9.1. `grep -rn AttributionLedger sdk/ios` returns **nothing**; the suite list in `SharingSheetLogicTests.swift` is `SharingDecision`, `sharingChooserCompleted`, `sharingExternalRoute`, `SharingPageProductsJSON`, `clampedSharingHeightFraction`, `sharing build retry ladder` (`:7,209,244,284,370,403`). §4 of the same document admits the ledger was reverted — §3.6 was never updated to match.
- **What actually happens**: the sheet's model, web view, pool, presentation and share sheet — the one MVP surface the register itself says has no device evidence — are neither host-tested nor simulator-tested. And a reader of §3.6 is told the 9.1 fix has a regression test that does not exist.
- **Fix sketch**: extract the launch-queue/`pendingReports` sequencing out of the gate into `SharingSheetLogic.swift` (as `SharingReclaim`/`sharingDecision` already are) and correct §3.6's figures and its `AttributionLedgerTests` citation.
- **Register status**: overstated in 8.2 / CONTRADICTS 9.1's coverage claim

### F6. One Android test parks a thread for 10 s — roughly two-thirds of the whole Android suite's wall time

- **Severity**: medium
- **Axis**: tests / performance
- **Complexity to fix**: small (<1d)
- **Evidence**: `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/net/HttpClientTest.kt:415` — `const val BLOCKED_READ_MILLIS = 10_000L`; used at `:170` inside `getResponseCode()`. The stub runs under `async(ioDispatcher)` inside `coroutineScope` (`HttpClient.kt:143-152`), and `coroutineScope` waits for its child even after cancellation, so `job.cancelAndJoin()` at `:184` blocks for the full 10 s — `disconnect()` cannot interrupt `Thread.sleep`, which the test's own comment at `:187` acknowledges.
- **What actually happens**: `:frak-sdk:test` spends ~10 s in one test. The register (T6) measured 10.03 s of a 15.4 s two-module run — confirmed by reading. The assertion itself is sound (the success path of `attemptUnlogged` deliberately does *not* `disconnect()`, `HttpClient.kt:153`), so this is cost, not vacuity.
- **Fix sketch**: replace `Thread.sleep(10_000)` with a `CountDownLatch` the test releases after asserting `disconnected`, or drop the constant to ~500 ms — the property is "cancellation reaches `disconnect()`", which does not need ten seconds to demonstrate.
- **Register status**: confirms T6/8.4

### F7. iOS concurrency is sequenced by 33 real `Task.sleep` calls, not 20, and two production call sites still take the wall clock

- **Severity**: medium
- **Axis**: tests / performance
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - 34 grep hits for `Task.sleep` under `sdk/ios/Tests`, of which one (`TestSupport.swift:51`) is a doc comment → **33 executed sites**. Register T6 says 20.
  - Longest: `SingleFlightTests.swift:14,33,39,65,90` (200–500 ms each), `ConfigStoreTests.swift:68,88,402` (100/100/200 ms), `FrakClientTests.swift:339,635,667,697,739` (200–300 ms each).
  - Root cause is unchanged: `sdk/ios/Sources/FrakSDK/Config/Backoff.swift` takes an injectable clock and neither production caller passes one (register T7). Android threads a `TestCoroutineScheduler` into both, which is why its config/backoff tests need no sleeps.
  - Wall-clock assertion: `DeadlineTests.swift:25` — `#expect(elapsed < 1)` against a 0.1 s deadline. 10× headroom, so unlikely to flake, but it is a real timing assertion.
  - `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/core/DefaultFrakClientTest.kt:547` is the Android equivalent — `Thread.sleep(1_100)` with the comment *"ConfigStore's backoff is keyed off wall-clock time, not the test scheduler"*, i.e. Android has one hole of the same shape.
- **What actually happens**: ≥3.5 s of deliberate sleeping per iOS run, and every one of those tests degrades on a loaded runner. Nothing here is a *race* test; all of it is sequencing.
- **Fix sketch**: pass `ConfigStore`'s existing injectable `now` into its `Backoff` (`ConfigStore.swift:57`) and give `RewardRepository` (`RewardRepository.swift:21`) the same, then convert the sleeps to clock advances.
- **Register status**: confirms T7; **overstated (understated) in T6** — the count is 33, not 20

### F8. The Android sheet's "concurrency" tests run on one virtual scheduler, and the register's stated reason for that is stale

- **Severity**: medium
- **Axis**: tests / docs-accuracy
- **Complexity to fix**: structural
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/SharingSheetStateTest.kt:56-57` — `// Keeps build() on the TestScope scheduler, so advanceUntilIdle covers it.` / `workContext = EmptyCoroutineContext,`.
  - Production default: `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingSheetState.kt:48` — `private val workContext: CoroutineContext = Dispatchers.Default`, with the hop back through `stateContext` at `:140` and `:169`.
  - Register 9.13 justifies this by citing an `AtomicBoolean` fix documented in-source at `SharingSheetState.kt:215`. **There is no atomic anywhere in `frak-sdk-ui`**: `grep -rn "Atomic\|@Volatile\|synchronized" sdk/android/frak-sdk-ui/src/main` returns nothing. The current design is main-confinement (`SharingSheetState.kt:31-35`), and `SharingOutcome.kt:9-11` says so explicitly — *"Deliberately not thread-safe. Every caller reaches it on `SharingSheetState`'s own dispatcher"*.
- **What actually happens**: all 54 `SharingSheetStateTest` cases collapse `Dispatchers.Default` and the main dispatcher onto one virtual scheduler, so the `withContext(stateContext)` hop — the single mechanism the confinement invariant rests on — is never a real thread hop in any test. That is a genuine hole (the invariant is untestable in-harness), but the register's stated cause and line citation are both wrong, which will mislead the next person who tries to close it.
- **Fix sketch**: add a handful of cases that pass a real `Dispatchers.Default` for `workContext` and a `newSingleThreadContext` for `scope`, asserting only end-state (no `advanceUntilIdle`); correct 9.13's citation.
- **Register status**: confirms 9.13's *conclusion*; **CONTRADICTS** its stated evidence (`SharingSheetState.kt:215` / `AtomicBoolean`)

### F9. Android has no test at all for the warm-path activation fragment; iOS has seven

- **Severity**: medium
- **Axis**: tests / parity
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingPageUrl.kt:88-108` — `activationFragment(...)`, whose KDoc states the load-bearing rule: *"Only keys with something to say are written: the page spreads this over the warm URL's own params, so an empty value would erase the config value under it."*
  - `grep -rn activationFragment sdk/android/frak-sdk-ui/src/test` → **no hits**. The only test-tree occurrence is the string `state=live` asserted once inside `SharingSheetStateTest.kt:941`.
  - iOS: `SharingPageURLTests.swift:129-166` (three cases, including full-string equality and *"omits every key it was not given"*) plus `@Suite("SharingPageURL.warmFragment")` in `SharingReclaimTests.swift:75-104` (four cases, including *"states `warm` outright rather than relying on the page's default"*).
  - Also uncovered on Android: `SharingPageUrl.build`'s `logoUrl` and `seededReward` branches are never passed a value by any test (`SharingPageUrlTest.kt:34-50,57-64,70-76`), and no Android test asserts a full URL string — only `contains()`.
  - `SharingWarmup.kt:10` `resolveWarmUrl` has zero references.
- **What actually happens**: the fragment-activation path is the *warm* path — the common case once the pool is in play — and on Android an added key with an empty value, a missed `state=live`, or a wrong `sid` would be caught by nothing.
- **Fix sketch**: port `SharingPageURLTests.swift:129-166` and `SharingWarmFragmentTests` verbatim into `SharingPageUrlTest.kt`, asserting full strings rather than `contains()`.
- **Register status**: NEW

### F10. `golden-rewards.json` is declared by both loaders and consumed by neither native suite

- **Severity**: medium
- **Axis**: tests / docs-accuracy
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/fixtures/GoldenFixtures.kt:24-25` — `const val REWARDS: String = "sdk/core/src/rewards/fixtures/golden-rewards.json"`; `sdk/ios/Tests/FrakSDKTests/Fixtures/GoldenFixtures.swift:18` — `static let rewards = "..."`.
  - Grep of `GoldenFixtures.REWARDS` / `GoldenFixtures.rewards` across both test trees: **zero call sites**. The only loads are `IDENTITY_PROOFS`/`identityProofs` (`GoldenFixturesTest.kt:11`, `ProofCodecTest.kt:25`, `GoldenFixturesTests.swift:8`, `ProofCodecTests.swift:29`) and `CONTEXT_CODEC`/`contextCodec` (`FrakContextCodecTest.kt:15`, `FrakContextCodecTests.swift:11`).
  - The file is real and large: 92.8 KB, 67 vectors across 6 kinds (`docs/plans/native-sdk/04-golden-fixtures.md:15`), and it *is* consumed by TypeScript (`sdk/core/src/rewards/{format,value,select}.test.ts`, `sdk/core/src/utils/format/formatAmount.test.ts`).
- **Path resolution / missing-file behaviour** (verified, and it is good on both sides): Android walks up from `codeSource.location` then `File(".")` looking for a dir containing `sdk/core` **and** `.git`-or-`package.json` (`GoldenFixtures.kt:126-149`); iOS walks up from `#filePath` with the same two-part marker (`GoldenFixtures.swift:139-171`). A missing file throws `AssertionError`/`CorpusError` with a regeneration hint, an empty `fixtures` array is rejected (`GoldenFixtures.kt:104-110`, `GoldenFixtures.swift:117-125`), and both behaviours are pinned by `GoldenFixturesTest.kt:31-48` / `GoldenFixturesTests.swift:20-35`. Neither can silently pass on an absent corpus.
- **What actually happens**: reward selection, tier discrimination and currency formatting — the values a merchant renders — are pinned cross-platform in TypeScript only. `RewardsDecoderTest.kt` (20) and `RewardsDecoderTests.swift` (28) assert hand-written expectations, so Kotlin and Swift can drift from the TS reference and from each other without any gate noticing.
- **Fix sketch**: have `RewardsDecoderTest`/`RewardsDecoderTests` load `GoldenFixtures.REWARDS` and assert the `select`/`format` vectors, the way `FrakContextCodecTest` already does for the codec corpus.
- **Register status**: NEW (§3.7 discusses a *missing* `golden-sharing-links.json`; nobody has noticed the corpus that exists is unused)

### F11. Android's only production `KeyValueStore` implementation is untested, and lacks the `isReadable` invariant iOS tests

- **Severity**: medium
- **Axis**: tests / parity / correctness
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/config/KeyValueStore.kt:23-46` — `SharedPreferencesStore`, backing both the config cache and identity (`Frak.kt:70,84`). Zero test references; the tests use `InMemoryKeyValueStore.kt` throughout.
  - iOS: `KeyValueStore.swift:9-11` declares `var isReadable: Bool` with the invariant *"False only while the backing exists but cannot be read — a file-backed store before first unlock. Distinct from empty: minting over an unreadable store destroys the identity in it."* Covered by `FileKeyValueStoreTests.swift` (11 cases, incl. `replacesAnUnreadableFile` at `:57`) and `UserDefaultsStoreTests.swift` (1).
  - Android's `KeyValueStore` interface (`:8-15`) has **no** `isReadable` member.
- **What actually happens**: the Android identity store has neither the guard nor a test. `Context.getSharedPreferences` throws before first unlock in direct-boot; the interface has no way to express "exists but unreadable", so an `AnonymousIdStore` read in that window is indistinguishable from "empty" — the exact condition iOS's comment says destroys an identity.
- **Fix sketch**: add `isReadable` to the Kotlin interface with the same semantics, and a `SharedPreferencesStoreTest` under Robolectric covering round-trip, key independence and the unreadable case.
- **Register status**: partially confirms 8.5 (which covers only `AndroidKeystoreDeviceKeyStore`); the `SharedPreferencesStore` + `isReadable` half is NEW

### F12. Cross-platform contracts pinned only by hand-written mirrors of the other side's rules

- **Severity**: medium
- **Axis**: tests / parity
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/SharingPageUrlTest.kt:12` — `private val walletPattern = Regex("^frak-[a-z0-9._-]{1,60}$")`, a copy of `apps/wallet/app/module/common/utils/sanitizeReturnScheme.ts:8`. iOS re-implements the same rule a third way, in Swift, at `sdk/ios/Tests/FrakSDKUITests/SharingPageURLTests.swift:9-15`.
  - `sdk/android/frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/SharingHostStyleTest.kt:18-19` — `assertEquals("--frak-host-top-radius", ...)` / `assertEquals("--frak-host-surface", ...)`, with the comment *"changing either means changing `packages/design-system/src/hostSheet.ts` in the same commit"*.
  - `sdk/android/frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/SharingResultTest.kt:26-33` — five wire strings spelled out, with *"Spelled out, not derived: nothing but this test and its Swift twin keeps the two in step."*
- **What actually happens**: three separate contracts (the return-scheme grammar, the CSS custom-property names, the `SharingResult.Kind` wire values) are each asserted by two or three independent hand-copied literals. Every one of them passes a rename on both sides and fails only at runtime, in the field.
- **Fix sketch**: emit the three from one source (a tiny generated JSON alongside the golden fixtures) and have all sides load it, exactly as `golden-context.json` does for the codec.
- **Register status**: confirms §3.8 and A2's "hand-mirrored literal" note; the `sanitizeReturnScheme` instance is NEW (§3.8 names only the CSS vars)

### F13. Vacuous assertions catalogue

- **Severity**: low
- **Axis**: tests
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  1. **Register-cited, confirmed.** `FrakContextCodecTest.kt:33-42` — `assertEquals("the corpus lost its encode fixtures", corpus.entries.count { it.getString("kind") == "encode" }, checked)`. `checked` is incremented once per iteration of a loop over `corpus.entries.filter { it.getString("kind") == "encode" }` at `:20`. The two sides are the same expression; it cannot fail. The iOS twin uses `#expect(!fixtures.isEmpty)` (`FrakContextCodecTests.swift:56`), which can.
  2. `SharingHostStyleTest.kt:69-73` — `the sheet's own radius is what the page is told to draw` asserts `script(SHEET_CORNER_RADIUS_DP).contains("--frak-host-top-radius:${SHEET_CORNER_RADIUS_DP}px")`. Value compared against the expression that produced it; already covered by `takes the radius it is given` (`:46-49`).
  3. `SharingSheetStateTest.kt:90-94` and `:111-115` — `assertEquals(state.session?.url(confirmed = false), shadowOf(view).lastLoadedUrl)`. If the session failed to build, both sides are `null` and the test passes while asserting the opposite of its name. (`:959-961` does it right — it `requireNotNull`s the loaded URL first.)
  4. `SharingPageUrlTest.kt:75` — `assertFalse(url.contains("confirmed"))`. `SharingPageUrl.build` emits `&view=confirmation`, never the token `confirmed` (`SharingPageUrl.kt:58`), so this cannot fail on any input. Same file `:70-76`, `assertFalse(url.contains("logoUrl"))` is only meaningful because the call omits `logoUrl` — and no test anywhere passes one.
  5. `SharingLinkBuilderTest.kt:100-105` — see F1, the worst instance.
- **Register status**: 8.3/8.6/8.9's `FrakContextCodecTest.kt:38-42` confirmed; items 2–5 are NEW

### F14. iOS asserts "some `FrakError`" at 18 sites, not 16

- **Severity**: low
- **Axis**: tests / parity
- **Complexity to fix**: small (<1d)
- **Evidence**: 18 occurrences of `#expect(throws: FrakError.self)` / `catch is FrakError` across `MerchantQueryTests.swift:79`, `ConfigStoreTests.swift:279,474`, `ResolvedConfigDecoderTests.swift:157,171`, `MerchantIdentityTests.swift:76`, `RewardsDecoderTests.swift:332`, `RewardRepositoryTests.swift:327`, `HTTPClientTests.swift:140,153,231,251,314`, `FrakClientTests.swift:172,396,581`, `FrakTests.swift:70`. Two of them (`FrakClientTests.swift:396,581`) bind the result and narrow further; the other sixteen do not. `HTTPClientTests.swift:181` shows the suite knows the problem: *"A bare `#expect(throws: FrakError.self)` would also pass if `URLSession` itself rejected…"*. Android asserts the concrete case, e.g. `AsyncTwinTest.kt:110` — `failure?.cause is FrakError.MerchantResolutionFailed`.
- **What actually happens**: a `.network` where a `.server(404)` was meant — the exact confusion 2.10 and N5 were about — passes.
- **Register status**: confirms T5, count understated by 2

### F15. A `.disabled` test documents a live decoder divergence that ships to alpha

- **Severity**: low
- **Axis**: tests / parity
- **Complexity to fix**: medium (few days)
- **Evidence**: `sdk/ios/Tests/FrakSDKTests/Config/ResolvedConfigDecoderTests.swift:267-280` — `@Test("a wrong-typed leaf drops only its own field, not the whole components block", .disabled("Known divergence from Kotlin ResolvedConfigDecoder: the `try?` in `ResolvedSdkConfig.init(from:)` swallows the entire components block when any nested leaf is wrong-typed. `sdkConfig` is now public … a merchant reading `ResolvedComponents` can observe a sibling field dropped by an unrelated wrong-typed leaf."))`.
- **What actually happens**: this is the only skipped/ignored test in either tree (no `@Ignore`, no `.disabled` files, no `xctest` skips elsewhere). The property being skipped is *block-level vs field-level forgiveness in the resolve decoder* — a merchant-visible behaviour that differs between Android and iOS today, on the path 9.3 was filed against. Skipping it is honest, but it means the divergence has no failing signal anywhere.
- **Register status**: 9.3t records the *Android* half (no good-and-bad placement together); the iOS `components` block half is NEW

### F16. Test-count and coverage claims in the register are materially stale

- **Severity**: low
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: register §4 — *"both suites compile and pass: iOS 366/366, Android 132/132"*; later in the same file, *"iOS 396 tests in 42 suites green"*. Actual today: **Android 514** `@Test` methods (`frak-sdk` 372, `frak-sdk-ui` 142); **iOS 473** `@Test` cases in **51** suites (`FrakSDKTests` 415, `FrakSDKUITests` 58). Also stale in the same section: 8.7's *"iOS still uses `Hex`/`Base64URL` as an oracle … with no tests of their own"* — `@Suite("Base64URL")` exists at `URLQueryTests.swift:90` with four cases (only `Hex` is still oracle-only).
- **Register status**: CONTRADICTS §4 and 8.7 (partially)

### F17. iOS tests leak temporary directories

- **Severity**: nit
- **Axis**: tests
- **Complexity to fix**: trivial (<1h)
- **Evidence**: 11 uses of `FileManager.default.temporaryDirectory` across `FrakClientTests.swift` (6), `EventOutboxTests.swift` (3), `EventQueueTests.swift` (1), `FileKeyValueStoreTests.swift` (1); exactly one `removeItem` in the whole tree (`FileKeyValueStoreTests.swift:17`). `FrakClientTests.swift:22-25` builds `temporaryDirectory/<UUID>/frak-events.jsonl` per client; `EventQueue.swift:420-424` creates the directory, nobody deletes it.
- **What actually happens**: ~10 orphaned directories per `swift test`, each with a queue file. Harmless locally, unbounded on a long-lived CI runner, and it means no test can assert on "the temp dir is clean".
- **Register status**: NEW

### F18. Android's `Frak` façade remains structurally untestable; iOS's reset seam is protected only within one suite

- **Severity**: nit (Android half is medium but already filed)
- **Axis**: tests
- **Complexity to fix**: small (<1d)
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/Frak.kt` — a Kotlin `object` with `@Volatile private var session` and no reset seam; grep confirms no `resetForTesting`. iOS: `FrakTests.swift:26` — `@Suite("Frak", .serialized)` with `Frak.resetForTesting()` in each test's body and `defer`. Swift Testing serialises tests *within* a suite but runs suites in parallel; today no other suite touches `Frak`'s globals (checked), so the guard holds — but nothing enforces that, and the first suite that does will race.
- **Register status**: confirms T2; the iOS cross-suite caveat is NEW

---

## The tests to add before alpha

**#1, highest value — `sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/net/UrlQueryTest.kt`**: a direct port of `URLQueryTests.swift`, and specifically the property `parse("…?a=caf%C3%A9").value("a") == "café"`. It is one file, it is free, and it is the *only* thing standing between register bug 9.2 (`char.code` truncating a UTF-16 code unit into a byte) and the first merchant's inbound `fCtx`. Fixing F1's vacuous test in the same commit is a prerequisite, or the new file will look redundant.

Then, in order:

2. **`sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/FrakClientFacadeTest.kt`** (and the iOS twin `FrakClientFacadeTests.swift`) — property: *every member of every `*Api` namespace reaches the `DefaultFrakClient` method it claims to, with its arguments in the right order*. Assert on `FakeHttpTransport` / `StubURLProtocol` request paths and query strings. Closes F2 on both platforms.
3. **`sdk/android/frak-sdk-ui/src/test/kotlin/id/frak/sdk/ui/SharingPageUrlTest.kt`** — add the `activationFragment` cases from `SharingPageURLTests.swift:129-166` plus `SharingWarmFragmentTests`. Property: *the activation fragment omits every key it was not given, and states `state=live` outright*. Closes F9; this is the warm path, which is now the default path.
4. **`sdk/ios/Tests/FrakSDKTests/Identity/PersistedDeviceKeyStoreTests.swift`** — replace the self-referential gate. Property: *the suite runs, or CI fails loudly*. Closes F3; without it the identity durability suite can vanish silently at any time.
5. **`sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/rewards/RewardsDecoderTest.kt`** + `sdk/ios/Tests/FrakSDKTests/Rewards/RewardsDecoderTests.swift` — load `GoldenFixtures.REWARDS` / `.rewards` and assert the 67 select/format vectors. Property: *Kotlin, Swift and TypeScript pick and format the same reward*. Closes F10 and turns a 92.8 KB dead file into the cross-platform gate it was generated to be.
6. **`sdk/android/frak-sdk/src/test/kotlin/id/frak/sdk/config/SharedPreferencesStoreTest.kt`** (Robolectric) — property: *round-trip, key independence, and a store that exists but cannot be read reports so rather than reporting empty*. Closes F11 and forces the missing `isReadable` seam onto the Android interface before the identity-destroying case can be hit in the field.

---

## Verified-OK

- **Golden-fixture path resolution and missing-file behaviour, both platforms.** Two-part repo-root marker (`sdk/core` **and** `.git`/`package.json`), started from `codeSource.location`/`#filePath` rather than the CWD (`GoldenFixtures.kt:126-149`, `GoldenFixtures.swift:139-171`); a missing file, invalid JSON, a wrong `formatVersion`, a missing `fixtures` array and an **empty** `fixtures` array are all hard failures with regeneration instructions, and both the missing-file and non-empty behaviours are themselves pinned (`GoldenFixturesTest.kt:31-48`, `GoldenFixturesTests.swift:20-35`). `golden-context.json` and `golden-proofs.json` are loaded by both suites.
- **`AsyncTwinTest.kt`** — a genuinely good test: `RecordingDispatcher` proves the body runs on IO and completion is signalled from main (`:63-79`), and post-`shutdown` behaviour is asserted as *finished-and-failed*, not merely "doesn't hang" (`:82-97`).
- **`SharingWebViewPoolTest.kt`** — 19 cases covering lend/return, re-warm, pause/resume, pool destruction while lent, and all three renderer-gone paths (`:229,246,263`). The strongest file in either tree.
- **`RowSenderTest.kt:16-45`** — small but load-bearing: the retry/reject boundary including the deliberate 404-is-a-verdict case, and `Retry-After` carried through.
- **`FileKeyValueStoreTests.swift`** — a fresh UUID directory per test with `defer { removeItem }` (`:13-18`); no shared-temp-dir assumptions.
- **`JavaCallSiteFixture.java` / `FrakSdkJavaCallSiteFixture.java`** — compile-time assertions where a runtime one is impossible. Correct instinct; they just must not be mistaken for coverage of the types they name (see F2).
- **No `@Ignore`, no `.disabled` files, no skipped Kotlin tests** anywhere in the Android tree; exactly one skipped iOS test (F15) and one conditionally-gated iOS suite (F3).
- **No timezone or locale dependence** found in either tree. The only wall-clock reads are `System.currentTimeMillis()` at `DefaultFrakClientTest.kt:509,582` and `EventQueueTest.kt:351` / `EventOutboxTest.kt:636` (all used as "now", not as a fixed instant), and `Date()` inside `TestSupport.swift:53` and `DeadlineTests.swift:19`.
- **Android temp-file hygiene**: all four file-touching test classes use JUnit's `TemporaryFolder` rule (`DefaultFrakClientTest`, `AsyncTwinTest`, `EventQueueTest`, `EventOutboxTest`); nothing writes to a fixed path.

## Could not verify

- **Actual pass/fail state and runtime of either suite** — no JDK, no Android SDK, no Swift toolchain. F6's 10 s figure is derived from reading `HttpClient.kt:143-152`'s `coroutineScope` semantics (a cancelled `async` child still blocks scope completion while inside `Thread.sleep`), not measured; the register's independent 10.03 s measurement agrees.
- **Whether Robolectric's sandbox is genuinely shared across the five `@Config(sdk = [33])` classes in `frak-sdk-ui`** in this Gradle configuration (F4's cross-class-leak half). The `Frak.initialize` live-network half of F4 does not depend on it and holds regardless. Gradle `forkEvery`/`maxParallelForks` were not inspected.
- **Whether CI runners have egress to `backend.frak.id`** (F4's blast radius). Either way the test is non-hermetic.
- **Line-precise `@Test` counts for iOS parameterized cases** — 473 counts `@Test` attributes; a `@Test(arguments:)` expands to several executed cases, so the executed total is ≥473. No `arguments:` usage was found, so the two are probably equal.
- **`example/native-android` / `example/native-ios`** were out of scope for this pass and were not inventoried for tests.
