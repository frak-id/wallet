# Register challenge — adversarial verification of `docs/plans/native-sdk/06-open-findings.md`

Worktree: `/home/dev/wallet-audit` @ `c0a0cec` (read-only, nothing modified). No JDK/Android SDK/Swift toolchain: every claim below is verified by reading the tree, never by executing a build.

## Summary

The register's *code-level* claims hold up far better than its *numbers* and its *process* claims. Every load-bearing "Closed" row I could check by reading source is genuinely closed: the ABI dumps are committed and internally consistent (`PercentEncoding` and the two `@InternalFrakApi` version constants really are absent, exactly one `synthetic <init>` survives, on `FrakError`), no public declaration in either Android module carries a default argument, `SharingResult.Kind`/`FrakError.Kind` wire strings match byte-for-byte across platforms, the backup-rules files and their manifest pointer are gone, the drain-time foreign-merchant check exists on both platforms, and `FrakStorageTests` does exist (as a suite inside `FileKeyValueStoreTests.swift`, not a file of its own).

What does not hold: **a CI gate the register counts as landed coverage — `checkDexSizeBudget` — does not exist anywhere in the repo and never has** (`git log -S` finds no commit), yet `06` §2 (1.2b) and §4 both list "dex budget" as part of the green `check`, `09` §5b claims it was *run and was red at 321 KB*, and `sdk/AGENTS.md:66` cites a budget property that is not in `gradle.properties`. That is the single worst thing here: it is the one place the register asserts an executed result that provably did not happen, which contaminates every other "verified this pass" claim I could not execute.

Second worst: two sharing-sheet rows are filed as **closed** while the mechanisms described in them are *absent from the tree* — 9.1's `AttributionLedger`/`abandonGrace`/`selfUntilSettled` (reverted; the revert is buried mid-paragraph inside a §4 "Closed" bullet) and 9.16's `pendingLaunch`/`pendingReports` (gone, replaced by a different design, with no revert note at all). And 9.14 — a real dropped merchant callback — is still filed as "branch-only", but the branch is on `dev` and the defect is live at `SharingHost.kt:157-161`.

Numbers: iOS is **473 `@Test`** in **50 suites**, not "396 in 42"; Android is **514**, not "451 (321 + 130)". Both were already wrong at the register's own last commit (457 / 511 at `0c978b1`), so "a real count off the test XML this pass" is not what happened.

## Findings

### F1. `checkDexSizeBudget` — a CI gate claimed as landed, run and red — does not exist and never has

- **Severity**: high
- **Axis**: docs-accuracy / build-release
- **Complexity to fix**: small (<1d) — either write the task or delete four claims
- **Evidence**:
  - `grep -rn "DexSize" sdk/android` → no match; `grep -rn "checkDexSizeBudget"` across the repo matches **only** `.md` files (`docs/plans/native-sdk/06-open-findings.md:125`, `02-sdk-design.md:27`, `09-android-api-surface.md:229,712`, `08-sharing-sheet-api.md:501`).
  - `git log --oneline -S "checkDexSizeBudget" --all` → one commit, `32ecd20`, which only added the doc text. The task has never existed in code.
  - `sdk/android/gradle.properties` (whole file read) contains no budget property; `sdk/AGENTS.md:66` — "**Android dex budget: 256 KB per artifact** (`sdk/android/gradle.properties`)" — points at nothing. `09-android-api-surface.md:712-715` claims it was "Run, and it was red… `:frak-sdk` measured **321 KB against the 256 KB budget**… the budget is now 384 KB… the 150 → 256 → 384 history is in `sdk/android/gradle.properties`". None of those numbers exist in the tree.
  - `sdk/android/scripts/run.sh:9,63` describes `check` as "ktlint, version drift, apiCheck, tests, Android Lint" — no dex step; `frak-publish.gradle.kts` wires only `checkSdkVersionMatchesArtifact` and `apiCheck` into `check`.
- **What actually happens**: nobody notices when `:frak-sdk`'s dex size regresses; a merchant integrating on a method-count-sensitive app has no guard, and the plan says one is enforced. Worse for the audit itself: `06` 1.2b's "That makes Android Lint, the dex size budget and the version-drift check part of CI for the first time" is one third false, and `09`'s measured-321-KB paragraph is unfalsifiable prose presented as measurement.
- **Fix sketch**: add a `checkDexSizeBudget` task (d8 the release AAR's `classes.jar`, compare to a `frak.dex.budget.*` property) and wire it into `check`; until then strike the claim from `06` 1.2b, `06` §4, `02` §3, `09` §5b and `sdk/AGENTS.md`.
- **Register status**: NEW (contradicts 1.2b, `09` §5b and `08` §501)

### F2. 9.14 is live on `dev`, not "branch-only": a real sharing outcome is dropped permanently

- **Severity**: medium (high for the sheet, which is the one surface with zero device evidence)
- **Axis**: correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:157-161`
  ```kotlin
  pendingResult?.let { pending ->
      pendingResult = null
      mainHandler.post { if (!cleared && this.activity === activity) callback.onResult(pending) }
  }
  ```
  `pendingResult` is buffered at `:374` and cleared at `:158` **before** the posted delivery, which no-ops if the Activity changed. Register cites "`SharingHost.kt:242-247` (branch)" and files it under "Branch-only, narrow" — the branch has landed (`FrakSharing`/`SharingHost` are in `frak-sdk-ui/api/frak-sdk-ui.api:1-16`).
- **What actually happens**: a rotate-rotate (or `recreate(); recreate()`) inside one main-loop turnaround loses a `Shared`/`Copied`/`InstallStarted` callback forever; the merchant's `ResultCallback` never fires for that session, against `frakSharingSheet`'s documented one-report-per-presentation contract.
- **Fix sketch**: clear `pendingResult` inside the posted lambda, after `callback.onResult(pending)` actually runs.
- **Register status**: confirms 9.14, but the row's "branch-only" framing and its line anchors are STALE.

### F3. 9.1 is listed Closed while its fix is reverted — both platforms knowingly report `.dismissed` over a share/copy that happened

- **Severity**: medium
- **Axis**: correctness / docs-accuracy
- **Complexity to fix**: medium (few days) — the register itself argues the previous remedy was mis-sized
- **Evidence**:
  - `grep -rn "AttributionLedger|abandonGrace|selfUntilSettled|pendingLaunch|pendingReports" sdk/ios` → **no matches**. Everything §4's 9.1 bullet describes as landed is gone.
  - `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:57-75` — the in-source admission: "Synchronous: an outcome still resolving loses to the `.dismissed` the caller is about to report"; `dispose()` sets `model.onOutcome = nil` / `model.onClose = nil` (`:73-74`).
  - Android's gesture path bypasses its own counter: `SharingSheetState.kt:454` `fun dismiss() = finish(SharingResult.Dismissed)`, while the `inFlight`/`abandonRequested` counter lives only on `abandon()` (`SharingOutcome.kt:21,47,66`).
  - The revert is disclosed, but only mid-paragraph inside a §4 **Closed** bullet ("REVERTED in the first-QA pass"), with no open row anywhere.
- **What actually happens**: a user copies the link, swipes the sheet away while `trackSharing()` is still in flight, and the merchant is told `dismissed`. Their analytics undercount shares, and any "did the user share?" UI lies.
- **Fix sketch**: keep the revert, but re-file the residual race as an **open** row (both platforms) with its accepted-risk rationale, rather than leaving it as a closure footnote.
- **Register status**: overstated in 9.1 (§4) — a reverted fix should not sit in "Closed, for the record" with a 40-line description of code that is not in the tree.

### F4. 9.16 is listed Closed but the mechanism it describes is absent; the presenter was redesigned instead

- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h) — rewrite the bullet
- **Evidence**: §4 says "`SharingPresenter.launch()` now holds a launch that arrives while `disposing` and replays it from `finish`'s completion, after `onSettled`… `teardown` clears a held launch and deliberately does not clear the reports". In the tree, `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:197-253` is a three-state `phase` machine (`.idle/.live/.reported`) with a synchronous `finish(onlyIfUnpresented:onSettled:)`; there is no `disposing` state, no held launch, no `pendingReports` (`grep` above).
- **What actually happens**: the bug class 9.16 named (a launch dropped during teardown, leaving a skeleton with no session) is plausibly structurally gone with the deferral — but nobody reading the register can tell that, and the next person "restoring" the documented mechanism would reintroduce the deferral machinery that the 9.1 revert deliberately removed.
- **Fix sketch**: rewrite the 9.16 bullet to describe the `phase` machine, and state explicitly that the deferral it was built on was removed.
- **Register status**: STALE in 9.16 (§4)

### F5. A merchant-observable decoder divergence is parked in a `.disabled` test with no register row, while 9.3t says "Closed for iOS"

- **Severity**: medium
- **Axis**: correctness / parity
- **Complexity to fix**: small (<1d)
- **Evidence**: `sdk/ios/Tests/FrakSDKTests/Config/ResolvedConfigDecoderTests.swift:267-297`
  > `.disabled("Known divergence from Kotlin ResolvedConfigDecoder: the `try?` in ResolvedSdkConfig.init(from:) swallows the entire components block when any nested leaf is wrong-typed. `sdkConfig` is now public…, so this is no longer merely a dead-code concern — a merchant reading `ResolvedComponents` can observe a sibling field dropped by an unrelated wrong-typed leaf… Tracked separately")
  "Tracked separately" resolves to exactly one un-numbered mention in prose: `06-open-findings.md:119` ("three real divergences (2.10, block-level forgiveness, and 9.3)"). No row, no id, no severity.
- **What actually happens**: the backend ships a components block where one leaf has the wrong JSON type (e.g. `imageUrl: 42`); iOS drops the merchant's `buttonShare.text` too and the app renders default copy, Android renders the good field. Silent, per-merchant, config-driven.
- **Fix sketch**: port `decodeForgiving*` down the nested `ResolvedComponents` tree (or file it as a numbered open row with a severity), then re-enable the test.
- **Register status**: NEW as a row; contradicts the "Closed for iOS" tone of 9.3t (the *placement* half is genuinely closed, the *component-leaf* half is not).

### F6. Both headline test counts are wrong, and were already wrong when written

- **Severity**: medium
- **Axis**: docs-accuracy / tests
- **Complexity to fix**: trivial (<1h)
- **Evidence** (counts of `^\s*@Test`, no matches inside comments — verified with a second grep):
  | Claim | Register | Actual @ `c0a0cec` | Actual @ `0c978b1` (register's own commit) |
  |---|---|---|---|
  | iOS tests | 396 | **473** decls (≈492 cases: `AnonymousIdStoreTests.swift:163` is `arguments: 0..<20`) | 457 |
  | iOS suites | 42 | **50** (`^\s*@Suite`) | — |
  | Android `frak-sdk` | 321 | **372** | — |
  | Android `frak-sdk-ui` | 130 | **142** | — |
  | Android total | 451 | **514** | 511 |
  Also `05-build-and-release.md:92` cites "the 386-test suite" for iOS — a third, different number.
  One test is skipped, not counted by the register at all: `ResolvedConfigDecoderTests.swift:269` `.disabled(...)` (F5).
- **What actually happens**: "451 … is a real count off the test XML this pass, replacing the stale round-3 132 and the README's `@Test` grep estimate" is the register's own credibility claim, and it is off by 63 against a grep it says it superseded.
- **Fix sketch**: stop hand-carrying counts; if they must be quoted, quote them with the commit they were measured at.
- **Register status**: STALE/FALSE in §0 preamble and §4 ("iOS 396 tests in 42 suites green").

### F7. A7's arithmetic is wrong: seventeen `*Async` twins for seventeen members, not "eighteen for fifteen"

- **Severity**: low
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - 17 twins in source: `AppLinkApi.kt` (`handleReferralAsync`, `installPageUrlAsync`, `openFrakAppAsync`), `ConfigApi.kt` (×2), `FrakClient.kt` (×4), `RewardsApi.kt` (×4), `SharingApi.kt` (×1), `TrackingApi.kt` (×2), `Frak.kt:shutdownAsync`. Same 17 in `frak-sdk/api/frak-sdk.api:3,5,8,14,15,26,31,39,41,43,66,67,70,71,76,81,83`.
  - 17 suspending members: 16 `public suspend fun` across `FrakClient` + the five `*Api` files, plus `Frak.shutdown` (`Frak.kt:125`). So the "three of the suspending members are overload pairs, hence 18 for 15" reasoning is simply arithmetic that does not reconcile with either file.
  - Fixture naming resolved — **both files exist and are distinct**: `frak-sdk/src/test/java/id/frak/sdk/FrakSdkJavaCallSiteFixture.java` (115 lines, calls all 17 twins at `:27-30,38,39,53,54,61,62,70,73,75,99,100,102,109`) and `frak-sdk-ui/src/test/java/id/frak/sdk/ui/JavaCallSiteFixture.java` (109 lines, the Builder/SAM fixture). No contradiction, just two fixtures.
  - `AsyncTwinTest.kt` has **3** `@Test`s and pins `DefaultFrakClient.asFuture` generically — it does not "pin the threading for the seventeen".
- **What actually happens**: nothing user-visible; it is a precision claim that fails on inspection, in the row that argues the Java story is complete. `09-android-api-surface.md:229` repeats "eighteen twins".
- **Fix sketch**: 17/17, and say AsyncTwinTest covers the shared funnel, not each twin.
- **Register status**: FALSE in A7 (counts), otherwise VERIFIED.

### F8. `README.md` §Status contradicts the tree and `05` on three points

- **Severity**: low (medium if it is what a new integrator reads first)
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `docs/plans/native-sdk/README.md:54-57` — "there is no publish path, and the binary-compatibility gate is wired but **its first dump is not committed**… **Two findings still block the first publish**, the `api/*.api` dumps are the last action of the ABI work".
  - Dumps committed: `sdk/android/frak-sdk/api/frak-sdk.api` (758 lines), `sdk/android/frak-sdk-ui/api/frak-sdk-ui.api` (73 lines). `05-build-and-release.md:77` says so explicitly ("gate wired, dumps committed, `apiCheck` in CI").
  - Publish path exists: `.github/workflows/release-android-sdk.yml`, `.github/workflows/release-ios-sdk.yml`; `06` B3 agrees ("Both publish paths now exist").
  - "Two findings still block": `06` §1 now marks A1 and A6 closed and A3/D7 fully landed ("Only step 5 — BCV and the dump — remains", itself stale since step 5 landed).
  - Root `AGENTS.md` repeats the retired diagnosis: "Still no publish path, and now for a known reason: `publishToMavenLocal` fails in AGP's bundled Dokka, which cannot parse Kotlin 2.4 class files" — `06` A6 says that diagnosis was wrong and the stub jar landed (`frak-publish.gradle.kts`, `javadocStub`/`javadocJar`, applied to **both** modules via `id("frak-publish")` in `frak-sdk/build.gradle.kts:3` and `frak-sdk-ui/build.gradle.kts:4`).
- **Fix sketch**: regenerate README §Status from `06` §1 + `05` §5 in the same pass that edits either.
- **Register status**: CONTRADICTS README (README is the stale side).

### F9. 8.2's per-file line counts are stale by up to 128 lines and miss two whole untested files

- **Severity**: low
- **Axis**: docs-accuracy / tests
- **Complexity to fix**: trivial (<1h)
- **Evidence** (`wc -l sdk/ios/Sources/FrakSDKUI/*.swift`): `SharingSheetModel` 624→**612**, `SharingWebView` 379→**507**, `SharingWebViewPool` 152→**165**, `SharingPresentation` 318→**279**, `FrakSharingSheet` 248→**254**, `NativeShare` 126→**131**; the six total **1,948**, not 1,847. Two further UIKit-gated files exist and are not in the row at all: `SharingSheetSkeleton.swift` (78) and `StoreOverlay.swift` (57) — both `#if canImport(UIKit)`. Android side: `SharingSheetState.kt` is **493** lines (row says 725), `SharingSheetStateTest.kt` is **1,233** (row says 1,115), web view + pool tests are **939** (row says 761).
- **What actually happens**: the row's own argument (uncovered iOS surface is growing while Android's is tested) is *stronger* than stated, but the numbers are re-quoted as "re-counted against the current tree", which they are not.
- **Register status**: STALE in 8.2. The substance — `SharingHost.kt` (512 lines) has no test constructing one; `FrakSharingLauncherTest.kt` is gone — is VERIFIED.

### F10. 9.13 cites a fix mechanism (`AtomicBoolean`) that no longer exists anywhere in `frak-sdk-ui`

- **Severity**: low
- **Axis**: docs-accuracy / tests
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `grep -rn "Atomic" sdk/android/frak-sdk-ui/src/main` → no matches. `SharingSheetState.kt:28-48` now documents main-confinement instead ("Confined to [scope]'s dispatcher — Main in production, the test scheduler under test"), and the cited "`SharingSheetState.kt:215` says so in-source" line is now `navigateNow`'s visual-state callback. The `EmptyCoroutineContext` half is VERIFIED (`SharingSheetStateTest.kt:58` `workContext = EmptyCoroutineContext`). The CSS half is VERIFIED but mis-anchored: the file is `packages/wallet-shared/src/sharing/component/SharingPage/chromeless.test.tsx` and the test is at `:169`, not `:183`.
- **Register status**: STALE in 9.13 (one of three cases), the other two VERIFIED.

### F11. §3.7's recount is itself stale: 507 raw / 325 code, not "303 (478 raw)"

- **Severity**: low
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence** (`wc -l` / non-blank non-comment): `sdk/core/src/utils/url/queryParams.ts` 57/26, `sdk/android/.../net/UrlQuery.kt` 107/83, `sdk/ios/.../Net/URLQuery.swift` 110/77, `sdk/core/src/context/mergeAttribution.ts` 75/30, `sdk/android/.../sharing/AttributionParams.kt` 89/61, `sdk/ios/.../Sharing/SharingLinkBuilder.swift` 69/48 → **507 raw / 325 code**. The finding itself (no `golden-sharing-links.json`) is VERIFIED — only `sdk/core/src/context/fixtures/` holds a shared corpus.
- **Register status**: STALE in §3.7 (numbers), VERIFIED in substance.

### F12. "`@InternalFrakApi`'s first and so far only use" is false — three sites on Android, two on iOS

- **Severity**: nit
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `net/PercentEncoding.kt:10`, `FrakSdkVersion.kt:14` (`HEADER_NAME`), `FrakSdkVersion.kt:19` (`QUERY_PARAMETER_NAME`); the marker's own KDoc says why (`InternalFrakApi.kt:12-14`, "PROPERTY as well as CLASS"). iOS: `FrakSDKVersion.swift:10,14` both carry `@_spi(FrakInternal)`, so A3/D7's "each marker now has exactly one call site" is false on both sides. Silver lining, and worth recording as a *positive*: the dump proves member-level `nonPublicMarkers` works — `frak-sdk.api:46-49` shows `FrakSdkVersion` with only `getCURRENT()`.
- **Register status**: FALSE in §3.3 smaller-items and in A3/D7.

### F13. NEW parity gap: web's "disable attribution entirely" has no native expression, and the TS doc for it is wrong too

- **Severity**: low
- **Axis**: parity
- **Complexity to fix**: small (<1d)
- **Evidence**: `sdk/core/src/context/mergeAttribution.ts:11,50` — `perCall: null` is an explicit disable documented as "no UTM/ref/via params are added", and returns `undefined`. But `frakContext.ts:141` still calls `resolveAttributionValues(attribution ?? {})`, which unconditionally fills `utm_source` (`:121`, `DEFAULT_ATTRIBUTION_SOURCE`) — so even web adds one param. Native has no three-state parameter at all: `SharingLinkBuilder.kt:20-30` treats `attribution == null` as "no per-call override" and applies merchant defaults plus `utm_source=frak`; iOS's `SharingLinkBuilder.swift` is the same shape.
- **What actually happens**: a merchant migrating from the web SDK who relied on `attribution: null` to keep UTMs off their URLs cannot express that natively, and the TS docstring they read to check is itself wrong.
- **Register status**: NEW (§3.7 asserts "All three platforms agree on the actual, simpler behaviour" — true for the fallback set, not for the null case).

### F14. Two smaller-item rows are stale and should be retired

- **Severity**: nit
- **Axis**: docs-accuracy
- **Evidence**: "`FrakSdkVersion.kt`'s KDoc points at a `version` in `build.gradle.kts` that doesn't exist" — it now reads "Keep in step with `frak.sdk.version` in `gradle.properties`; the build checks it" (`FrakSdkVersion.kt:8`), and `frak.sdk.version=0.0.1` is at `sdk/android/gradle.properties`, checked by `checkSdkVersionMatchesArtifact` (`frak-publish.gradle.kts`). Also 9.4's anchor `tracking/InteractionTracker.kt:57,75,93` and 3.2's "Android's `InteractionTracker.isForeignMerchantArrival`" both name a file that no longer exists — the code is `tracking/EventOutbox.kt:69,86,111` and `tracking/InteractionSender.kt:39`.

## (a) Every claim now FALSE or STALE

| Row | Claim | Verdict |
|---|---|---|
| 1.2b, §4 A2 bullet, `09` §5b, `sdk/AGENTS.md:66,78`, `02:27` | "dex budget" part of `check`/CI; "Run, and it was red… 321 KB against the 256 KB budget… budget is now 384 KB" | **FALSE** — task and properties do not exist (F1) |
| §0 preamble, §4 | "iOS **396 tests in 42 suites**", "Android **451** (321 + 130) … a real count off the test XML" | **FALSE** — 473/50 and 514; 457/511 at the register's own commit (F6) |
| A7 | "eighteen twins for fifteen members"; "`AsyncTwinTest` pins the threading for the seventeen" | **FALSE** — 17/17; AsyncTwinTest is 3 tests over the shared funnel (F7) |
| 9.14 | "Branch-only… `SharingHost.kt:242-247` (branch)" | **STALE** — live on `dev` at `:157-161` (F2) |
| §4 9.1 | `AttributionLedger`, `selfUntilSettled`, `abandonGrace`, `SharingSheetLogic.swift:113` | **STALE** — all absent (reverted) (F3) |
| §4 9.16 | held launch / `pendingLaunch` / `pendingReports` / `teardown` clears a held launch | **STALE** — absent; presenter is a `phase` machine (F4) |
| 9.3t | "**Closed for iOS**" | **PARTIAL** — placements closed; the components-block divergence is live and only in a `.disabled` test (F5) |
| 8.2 | 1,847 lines / per-file figures / "725-line state machine" / "1,115 lines" / "761" | **STALE** — 1,948 (+135 in two unlisted files); 493 / 1,233 / 939 (F9) |
| 9.13 | "the `AtomicBoolean` fix that replaced eight unsynchronised booleans"; `SharingSheetState.kt:215`; `chromeless.test.tsx:183` | **STALE** — no atomics in the module; test is at `:169` (F10) |
| §3.7 | "303 lines of code (478 raw)" | **STALE** — 325 / 507 (F11) |
| §3.3 smaller items, A3/D7 | `@InternalFrakApi` "first and so far only use"; "each marker now has exactly one call site" | **FALSE** — 3 Android sites, 2 iOS (F12) |
| §3.3 smaller items | "`FrakSdkVersion.kt`'s KDoc points at a `version` in `build.gradle.kts` that doesn't exist" | **STALE** — corrected in source (F14) |
| 9.4, 3.2 | `tracking/InteractionTracker.kt:57,75,93`; "Android's `InteractionTracker.isForeignMerchantArrival`" | **STALE anchors** — `EventOutbox.kt:69,86,111`, `InteractionSender.kt:39` (F14) |
| T6 | "20 real `Task.sleep` calls"; `HttpClientTest.kt:165` | **STALE** — 33 real `Task.sleep` in `sdk/ios/Tests` (one further mention is a doc comment at `TestSupport.swift:51`); the 10 s park is `HttpClientTest.kt:170` (`BLOCKED_READ_MILLIS = 10_000L`, `:415`) |
| README §Status | dump not committed / no publish path / two findings block publish | **FALSE** (F8) |
| root `AGENTS.md` | "Still no publish path… `publishToMavenLocal` fails in AGP's bundled Dokka" | **STALE** — `06` A6 retired both halves (F8) |

## (b) Where confident prose hides a still-open problem

1. **§4 "Closed" hosting a reverted fix (9.1).** The word REVERTED appears once, ~600 words in, inside a bullet that opens by describing the fix as landed. The residual defect — a real `.shared`/`.copied` reported as `.dismissed` on the gesture path, on *both* platforms — has no open row. `SharingPresentation.swift:57-58` and `SharingSheetState.kt:454` are the live code. (F3)
2. **9.16 "closed" by a mechanism that is not in the tree.** (F4)
3. **9.3t "Closed for iOS"** while `ResolvedConfigDecoderTests.swift:267-297` documents a merchant-observable divergence and disables the test that proves it; §3.7:119 downgrades it to two words of prose ("block-level forgiveness") with no id. (F5)
4. **9.5 "Investigated and argued moot"** — the argument is sound as far as it goes (`SharingWebViewPool.swift` never inserts the view into a hierarchy), but the row's own last line concedes "**Unconfirmed without a simulator pass**". Filed under §2 "Deliberate deferrals" it reads as resolved; it is an unverified hypothesis about compositing cost.
5. **4.2 "Accepted with rationale"** — iOS `EventQueue` does synchronous file I/O on the cooperative pool with a ≤1100-row bound; the acceptance rests on that bound and on there being no device evidence at all (T3). It is accepted, not measured.
6. **S4 "Narrowed … Decide and record, or move it and delete the row"** — this is an open decision presented as a narrowing. The iOS resolve cache is still in Preferences, unexcluded (`Config/KeyValueStore.swift`), and nobody owns the decision.
7. **1.2b "Android Lint … is **clean**"** — plausible (no `lint {}` block, no `lint-baseline.xml`, no `lint.xml` anywhere under `sdk/android`, so nothing is suppressed) but unexecutable here, and it arrives in the same sentence as the dex-budget claim that is false (F1). Treat as unverified.
8. **A1's "both regenerate byte-identically after a `clean`, so the gate does not flap"** — unverifiable without a JDK. What I *can* say is the dumps are internally consistent with the sources and no public declaration changed in the four commits since the dumps were last written (`c863486`, `ade62d1`, `52430e8`, `79d753e` — `git show … | grep '^[+-].*public '` is empty for all four), so `apiCheck` should still pass.

## (c) Rows mis-prioritised for an alpha

**Filed too low / too calmly:**

- **9.2 (Android `percentDecode` truncates non-ASCII)** — filed as a plain §3.2 row. `UrlQuery.kt:97` `out.write(char.code)` keeps 8 bits of a UTF-16 unit, so any value containing one `%` plus an unescaped accented character is corrupted (`é` → `0xE9` → U+FFFD). The first merchant is **My Moulinex**, a French app: accented `utm_content`/product names in a share URL are the expected input, and the decoder is deliberately tolerant so malformed input is normal. iOS is byte-safe (`URLQuery.swift:91-108`, `Array(value.utf8)`). This is a five-line fix and should be blocking for a French-market alpha.
- **Q4 (iOS `FrakLogSink` is non-throwing, a trap in a merchant's sink kills the host)** — filed as a smaller row; `05:126` already says it is "cheaper before publication than after". For an alpha where the merchant writes the sink, this is a crash in *their* app attributed to *your* SDK.
- **9.14** — see F2: a dropped merchant callback, filed as "branch-only, narrow".
- **T2 (Android `Frak` facade structurally untestable)** — the facade is the single entry point every merchant calls first (`Frak.kt:34` `public object`, `:46` `@Volatile`, no reset seam), and it has zero tests; the only Java exercise is compile-only (`FrakSdkJavaCallSiteFixture.java:109`). For a first alpha, untested `initialize` is worse than an untested sheet internal.
- **S10's remaining half** (Android consent lost to a process kill, `config/KeyValueStore.kt:37-38` `apply()`) — a privacy regression (a withdrawal silently reverting to enabled) filed at the same weight as line-count staleness.

**Filed too high / should be retired for an alpha:**

- **A3/D7 sitting in §1 "Blocking the first publish"** — it is done. My independent sweep of both modules' `main` source found **no public declaration with a Kotlin default argument** (all `= ` defaults are on `internal`/`private` declarations: `FrakLogger.kt:15,20`, `DefaultFrakClient.kt:187-190` — `internal class` at `:49` —, `SharingLinkBuilder.kt:20`, `ReferralArrival.kt:16`, `SharingPageUrl.kt:32-38`, etc.), and neither `.api` dump contains a single `$default` bridge. Keeping it in §1 makes the section look blocked when only alpha-irrelevant items remain.
- **9.15 / 9.17 (call-site and namespace divergences)** — real, but they are shape differences, not defects; for an alpha they are documentation, not work.
- **5.1–5.4 (simplification)** — pure deletion opportunities; nothing here should compete with T3/D2b.
- **The genuine alpha blocker is the one filed as a "deliberate deferral": T3/D2b.** The sharing sheet, the install handoff and inbound deep links have executed on **no** device or simulator on either platform, and §4 says outright the sheet defects "were closed *before* that pass rather than found by it". Every §3.2/8.2 sheet row inherits that.

## Verified-OK (coverage)

- **A1/1.6** — both dumps committed (`frak-sdk/api/frak-sdk.api` 758 lines, `frak-sdk-ui/api/frak-sdk-ui.api` 73); `PercentEncoding` **absent from both** (grep, rc=1) and so are `getHEADER_NAME`/`getQUERY_PARAMETER_NAME` (`frak-sdk.api:46-49`), proving `nonPublicMarkers` fires at member level; **exactly one** `synthetic` line in either dump — `frak-sdk.api:303`, `FrakError.<init>(Kind;String;Throwable;DefaultConstructorMarker)`, the sealed-constructor bridge; the `@Composable` overload with its tail is present (`frak-sdk-ui.api:11` `build (Landroidx/compose/runtime/Composer;I)`); the gate is hand-rolled from `KotlinApiBuildTask`/`KotlinApiCompareTask` and `dependsOn`'d from `check` (`frak-publish.gradle.kts`, last 40 lines); `nonPublicMarkers` at `sdk/android/build.gradle.kts:18`; `strictly` constraint at `frak-sdk-ui/build.gradle.kts` (`constraints { api("id.frak.sdk:core") { version { strictly(...) } } }`) with `project.version` set. The `frak-sdk-ui` dump matches its module's public surface exactly (only `FrakSharing`, `Builder`, `ResultCallback`, `FrakSharingDefaults`, `SharingResult*` are `public` in `frak-sdk-ui/src/main`).
- **A6 (structural half)** — `javadocStub`/`javadocJar` are in the shared convention plugin, and **both** modules apply `id("frak-publish")` (`frak-sdk/build.gradle.kts:3`, `frak-sdk-ui/build.gradle.kts:4`), so the stub is symmetric as claimed; `withJavadocJar()` is absent, `withSourcesJar()` present.
- **A3/D7** — verified by exhaustive sweep, see (c).
- **A2** — `FrakError.Kind` nine members, wire strings `notInitialized/network/backingOff/server/decoding/trackingDisabled/alreadyPresenting/merchantResolutionFailed/internalFailure` identical in `core/FrakError.kt:20-28` and `Core/FrakError.swift:32-40`; `SharingResult.Kind` five members `shared/copied/installStarted/dismissed/failed` identical in `ui/SharingResult.kt:20-23` and `FrakSDKUI/SharingResult.swift:17-22`. `FrakEnvironment`/`RewardTier` are indeed still bare hierarchies.
- **S3** — no `frak_data_extraction_rules.xml` / `frak_full_backup_content.xml` anywhere; `frak-sdk/src/main/AndroidManifest.xml` has no `<application>` block and no `dataExtractionRules`/`fullBackupContent`; the only `allowBackup` in the tree is the harness's (`example/native-android/app/src/main/AndroidManifest.xml:10`). Consent + marker really do share `id.frak.sdk` (`Frak.kt:75-98`, `IDENTITY_FILE_NAME` at `:208`) while the config cache is a separate file (`KeyValueStore.kt:FILE_NAME = "id.frak.sdk.config"`).
- **3.2** — drain-time check present on both: `tracking/InteractionSender.kt:19,39-44` and `Tracking/InteractionSender.swift:25,44-49`, both via case-insensitive `ReferralArrival.sameMerchant` (`ReferralArrival.swift:24-27`); V1 still unfixable (`ReferralArrival.kt:19-21`).
- **3.3** — `FrakStorage.directory()` sets `isExcludedFromBackup` on the directory (`Core/FrakStorage.swift:25`); **`FrakStorageTests` does exist** — as a `@Suite("FrakStorage")` at `Tests/FrakSDKTests/Config/FileKeyValueStoreTests.swift:145-165`, asserting `isExcludedFromBackup == true` on the *real* directory (`:152-153`) and idempotency (`:163`). The register's file/suite ambiguity is harmless.
- **9.2, 9.4, 9.7, 9.9, 9.11, 9.15, 9.17, T2, T7, 8.5, 8.7, 9.3t** — all VERIFIED as still-open with the stated substance (anchors sometimes stale): `UrlQuery.kt:97`; `EventOutbox.kt:69,86,111` unconditional `scope.launch { flush() }` vs iOS `drainTask`/`drainAgain` (`EventOutbox.swift:45-47,181-201`); `DefaultFrakClient.swift:182-192` vs the unstructured `Task`s at `ConfigStore.swift:229` and `DefaultFrakClient.swift:154`; `FrakConfig`/`FrakMetadata`/`SharingProduct`/`SharingRequest` have no `equals` in the dump while 3 input types do; `frakContext.ts:177-181` `URL.toString()` round-trip and the stale `resolveAttributionValues` docstring at `:112-115`; `RewardsAPI.swift:26-31` four defaults vs Android's `RewardRequest`; `ConfigAPI.swift:8,13` `current`/`updates` with no Android twin; `Frak.kt:34,46` no reset seam and no test; `Backoff.swift:23` default clock with `ConfigStore.swift:57` / `RewardRepository.swift:21` both taking it; `PersistedDeviceKeyStoreTests.swift` exists while `AndroidKeystoreDeviceKeyStore` has zero test references; `Base64UrlTest.kt`/`HexTest.kt` exist with no iOS twins; Android's `ResolvedConfigDecoderTest.kt:119-167` still never pairs a good and a bad placement.
- **1.2b (CI shape)** — `.github/workflows/apps.yaml:152-171` really does run five Android steps (`lint`, `build`, `test`, `apiCheck`, `check`) and three iOS steps (`:196-208`), and no lint baseline exists to hollow it out.
- **B3** — both release workflows exist; `FrakSDKVersion.swift:3` and both `package.json`s are still `0.0.1`; `do_xcframework` still unimplemented (`sdk/ios/scripts/run.sh:11,175`).
- **S7 / 3.1** — the `Custom` environment allowlist (`FrakEnvironment.kt:86-103`) and the sub-frame / return-scheme gating in `SharingWebView.kt:289-310` are real, as §4 claims.
- **S11** — confirmed: zero `TrackingConsent`/`trackingEnabled` references in either UI module's `main` source.

## Could not verify (no toolchain)

- `apiCheck` actually passing, and byte-identical regeneration after `clean` (no JDK/Android SDK). Circumstantially supported: no public declaration changed in the four commits since the dumps were last written.
- `publishToMavenLocal` succeeding, the GMM `{"strictly": "0.0.1"}` variants and the POM `<dependencyManagement>` (A6's second half).
- "Android Lint … is clean"; the `check` task's actual green status.
- Any executed test count, pass/fail, or the 15.4 s / 10.03 s timing figures in T6.
- Every device/simulator claim (T3, D2b, 9.5, §3.8) — by the register's own admission none of it has run.
- The Central Portal `VALIDATED` probe in B3.
