# Frak native SDKs — merchant setup & developer experience audit

Scope: `sdk/android/README.md`, `sdk/ios/README.md`, `sdk/ios/README.mirror.md`, `sdk/android/PRIVACY.md`,
`example/native-android/**`, `example/native-ios/**`, checked against `sdk/android/frak-sdk/api/frak-sdk.api`,
`sdk/android/frak-sdk-ui/api/frak-sdk-ui.api` and every `public` declaration under `sdk/ios/Sources/`.
Persona: an Android + iOS engineer at Groupe SEB integrating into `com.groupeseb.moulinex.food` with only the repo.
Worktree read-only @ `c0a0cec`. No toolchain — every claim is from source, cited `path:line`.

## Summary

Both SDKs are code-complete for the MVP surface, but the *merchant-facing* path is not: there is no way for
Groupe SEB to acquire either artifact today (Android has no publish path and no dependency snippet anywhere;
the iOS mirror README pins `0.1.0-alpha.1` against a source tree that says `0.0.1`), so time-to-first-track is
formally infinite on both platforms without a Frak engineer in the loop.

Below that blocker sit three DX traps that will each cost a day. (1) `logLevel` defaults to `NONE` on both
platforms and the iOS merchant quickstart never sets it, so every diagnostic the SDK carefully writes —
including "FrakConfig has neither a merchantId nor a packageId" — is dropped on the floor. (2) The single most
important onboarding fact, that Frak must allow-list your package/bundle id against the merchant id, appears
**only** in the two example-app READMEs, never in an SDK README; without it every call fails
`MerchantResolutionFailed` while `tracking.purchase` still returns `Success`. (3) `.manual` is the only
deep-link mode on iOS and the only routing code shipped anywhere is `.onOpenURL`, which does not receive
https universal links — the exact links this SDK generates — and no Associated Domains guidance exists.

The doc-vs-API check found real mismatches, not just prose drift: the iOS "Public API surface" table lists ~20
`internal` types as public and one type (`InteractionTracker`) that does not exist; the merchant-facing iOS
quickstart snippet does not compile (missing `try`); the Android README lists `FrakLogger` as a public type
when it is `internal` and absent from the ratified ABI dump; and the Android README contradicts itself three
times about whether the ABI dumps are committed, whether a publish path exists and whether the signing key
exists.

Finally, everything a merchant asks for on day two is missing: no theming or localisation on the sharing sheet
(one `heightFraction` knob), no merchant-usable staging environment, no test seam (`FrakClient` is a `final`
class behind a singleton), and no "did my event arrive" signal at all.

## Findings

### F1. No merchant can obtain either artifact; the Android README has no dependency snippet at all
- **Severity**: blocker
- **Axis**: distribution / merchant setup
- **Complexity to fix**: high (publish path) + low (docs)
- **Evidence**:
  - `sdk/android/README.md:168` "There is no publish path."; `sdk/android/README.md:258` "Generating the real GPG key and wiring the Portal repository — neither has started."
  - `sdk/android/README.md:36-37` is the only place the coordinates `id.frak.sdk:core` / `id.frak.sdk:ui` appear; grep for `implementation(` / `mavenCentral` in `sdk/android/README.md` returns nothing.
  - The only working consumption path in the repo is a Gradle composite build: `example/native-android/settings.gradle.kts:25-30`, `example/native-android/app/build.gradle.kts:66-67` (`id.frak.sdk:core:0.0.1`).
  - iOS: `sdk/ios/README.mirror.md:17` `.package(url: "https://github.com/frak-id/frak-ios-sdk.git", exact: "0.1.0-alpha.1")` vs `sdk/ios/Sources/FrakSDK/FrakSDKVersion.swift:3` `current = "0.0.1"` and `sdk/ios/scripts/run.sh:208` (`check_sdk_version`) — the mirror is force-pushed from this tree, so no `0.1.0-alpha.1` payload exists.
- **What actually happens**: a Groupe SEB Android engineer reads `sdk/android/README.md` end-to-end and never finds a line to paste into `app/build.gradle.kts`; if they infer `implementation("id.frak.sdk:core:0.0.1")` the resolve fails against Maven Central. On iOS, Xcode's "Add Package Dependencies" against the pinned tag fails resolution.
- **Fix sketch**: publish `0.1.0-alpha.1` to Central and tag `ios-v0.1.0-alpha.1` before announcing alpha; add an "Install" section to `sdk/android/README.md` (or, better, an `sdk/android/README.mirror.md` mirroring iOS's split) with `repositories { mavenCentral() }`, both coordinates, `minSdk 24`, Java 17; make `check_sdk_version` also assert the version quoted in `README.mirror.md`.
- **Register status**: NEW

### F2. `logLevel` defaults to `NONE` on both platforms, and the merchant-facing iOS quickstart never sets it — total silence on every failure
- **Severity**: blocker
- **Axis**: failure modes / DX
- **Complexity to fix**: low
- **Evidence**:
  - Android default: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/FrakConfig.kt:139` `public var logLevel: FrakLogLevel = FrakLogLevel.NONE`; gate at `core/FrakLogger.kt:33` `if (level.ordinal < at.ordinal) return`.
  - iOS default: `sdk/ios/Sources/FrakSDK/Core/FrakConfig.swift` `init(... logLevel: FrakLogLevel = .none ...)` (the `k2a` init block); `Core/FrakConfig.swift:15-25` `FrakLogLevel.none` is first.
  - The messages that get dropped: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/Frak.kt:63-67` ("FrakConfig has neither a merchantId nor a packageId. Every SDK call will fail with MerchantResolutionFailed."), `Frak.kt:186-188`, `identity/MerchantIdentity.kt:83-85` ("FrakConfig.merchantId '…' does not match the backend's '…'"), `sdk/ios/Sources/FrakSDK/Frak.swift` (`.missingStore` / `.missingIdentityStore` / `missingIdentity` branches).
  - `sdk/ios/README.mirror.md:43-48` — the only quickstart a merchant sees — passes no `logLevel`. (`sdk/android/README.md:82-88` does set `INFO`, so Android is one notch better.)
- **What actually happens**: an iOS integrator who mistypes the merchant id, ships without allow-listing, or hits the "SDK will not initialize" path sees an app that behaves normally and reports nothing, anywhere. The SDK has genuinely good, actionable error strings and by default emits none of them.
- **Fix sketch**: default `logLevel` to `.error`/`ERROR` (errors only — this is what every comparable SDK does), or at minimum emit the initialize-time misconfiguration errors unconditionally via `os_log`/`Log.e`; add `logLevel: .info` to the mirror quickstart and a "Troubleshooting: turn logging on first" section to both READMEs.
- **Register status**: NEW

### F3. The mandatory onboarding step — allow-listing your package/bundle id — is documented only in the example-app READMEs
- **Severity**: blocker
- **Axis**: merchant setup
- **Complexity to fix**: low
- **Evidence**:
  - `example/native-android/README.md:5` "That merchant must have this app's bundle id, `id.frak.example.android`, on its allow list, or calls fail with `MerchantResolutionFailed`."; identically `example/native-ios/README.md:5` and `:56-57`.
  - No occurrence of "allow list" / "allowlist" in `sdk/android/README.md`, `sdk/ios/README.md`, `sdk/ios/README.mirror.md` or `sdk/android/PRIVACY.md`.
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/FrakConfig.kt:95-96` "Never validated at construction; an unusable config surfaces later as `FrakError.MerchantResolutionFailed`."
- **What actually happens**: `com.groupeseb.moulinex.food` integrates, ships `merchantId = "<the uuid Frak mailed us>"`, and every `config.resolve()` throws `MerchantResolutionFailed` with the reason (id not allow-listed for this package) knowable only to Frak — and, per F2, logged nowhere by default. This is the single most likely first-day support ticket and it is invisible in the docs a merchant reads.
- **Fix sketch**: put a "Before you start" block at the top of both merchant READMEs: you need (a) a merchant id from the Frak dashboard, (b) your `applicationId`/`CFBundleIdentifier` registered against it, (c) how to check (`config.resolve()` succeeding, or the debug panel pattern from the harnesses).
- **Register status**: NEW

### F4. The merchant-facing iOS quickstart snippet does not compile
- **Severity**: high
- **Axis**: docs vs API
- **Complexity to fix**: trivial
- **Evidence**: `sdk/ios/README.mirror.md:54` `let reward = await Frak.clientOrNull?.rewards.best(...)` against `sdk/ios/Sources/FrakSDK/RewardsAPI.swift:26-31` `public func best(targetInteraction:audience:forceRefresh:products:) async throws -> BestReward?`. Same defect in the contributor doc: `sdk/ios/README.md:67` "`await client()?.rewards.best(...)`".
- **What actually happens**: `error: call can throw but is not marked with 'try'`. Also `best(...)` is shown with a literal `...`, so the merchant must open the source to learn the four argument labels; and `SharingRequest` is never constructed anywhere in `README.mirror.md` (the sheet snippet at `:60-72` references an undefined `request`) even though `sdk/ios/Sources/FrakSDK/Sharing/SharingRequest.swift:71-78` has a perfectly quotable memberwise init.
- **Fix sketch**: `let reward = try? await Frak.clientOrNull?.rewards.best(targetInteraction: "purchase")`; expand every `...` in the mirror README into a real argument list; add a `SharingRequest(link:products:targetInteraction:placement:)` example.
- **Register status**: NEW

### F5. iOS README's "Public API surface" table lists ~20 `internal` types as public, and one type that does not exist
- **Severity**: high
- **Axis**: docs vs API
- **Complexity to fix**: low
- **Evidence**: `sdk/ios/README.md:47-57` vs the declarations:
  | README claim | line | Actual |
  |---|---|---|
  | `FrakLogger`, `Base64URL`, `Hex` | :49 | `Core/FrakLogger.swift:16`, `Core/Base64URL.swift:6`, `Core/Hex.swift:5` — all `internal` |
  | `HTTPClient`, `JSONDecoding`, `URLQuery` | :50 | `Net/HTTPClient.swift:24`, `Net/JSONDecoding.swift:3`, `Net/URLQuery.swift:14` — internal (only `Net/PercentEncoding.swift:5` is `public`) |
  | `ConfigStore`, `MerchantQuery`, `KeyValueStore`, `SingleFlight`, `Backoff` | :51 | `Config/ConfigStore.swift:15`, `MerchantQuery.swift:5`, `KeyValueStore.swift:4`, `SingleFlight.swift:76`, `Backoff.swift:8` — all internal |
  | `RewardRepository` | :52 | `Rewards/RewardRepository.swift:6` — internal actor |
  | `DeviceKey`, `ProofCodec`, `AnonymousIdStore` | :53 | `Identity/DeviceKey.swift:8`, `ProofCodec.swift:21`, `AnonymousIdStore.swift:7` — internal |
  | `FrakContextCodec`, `SharingLinkBuilder` | :54 | `Sharing/FrakContextCodec.swift:18`, `SharingLinkBuilder.swift:8` — internal |
  | `EventQueue`, **`InteractionTracker`** | :55 | `Tracking/EventQueue.swift:116` internal; **`InteractionTracker` does not exist in the tree** |
  | `AppLauncher`, `InstallLinks`, `ReferralArrival` | :56 | `AppLink/AppLauncher.swift:4`, `InstallLinks.swift:1`, `ReferralArrival.swift:3` — internal |
  | `DefaultFrakClient` | :57 | `DefaultFrakClient.swift:7` — internal actor |
  Conversely the table omits genuinely public surface: `ConfigAPI.current` / `ConfigAPI.updates` (`ConfigAPI.swift:8,13`), `OpenAppResult` (`FrakClient.swift:94`), `FrakSharingDefaults` (`FrakSDKUI/SharingSheetLogic.swift:245`), `SharingResult` (`FrakSDKUI/SharingResult.swift:4`).
- **What actually happens**: this table is the contributor doc, but it is the only API inventory in the repo (iOS has no ABI dump — `sdk/ios/README.md` says so). Anyone using it to plan an integration — or to answer "can I reuse your HTTPClient?" — is wrong about two thirds of it.
- **Fix sketch**: regenerate the table from `grep -rn "^public "`; mark the folder rows as *contents*, not *public API*, and give the merchant-facing README a single "Public API" list that matches reality.
- **Register status**: NEW

### F6. Android README lists `FrakLogger` as a public supporting type; it is `internal` and absent from the ratified ABI dump
- **Severity**: high
- **Axis**: docs vs API
- **Complexity to fix**: trivial
- **Evidence**: `sdk/android/README.md:72` "Supporting public types: … `FrakError`, `FrakLogger`." vs `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/FrakLogger.kt:9` `internal class FrakLogger(` and `grep FrakLogger sdk/android/frak-sdk/api/frak-sdk.api` → no match. (The other 15 names on that line all check out against the dump: `FrakContext` :654, `SharingRequest` :696, `SharingProduct` :674, `ProductDetails` :431, `RewardRequest` :547, `AttributionParams` :611, `Interaction` :735, `FrakResult` :418, `OpenAppResult` :54, `DeepLinkHandling` :199, `FrakLogSink` :386, `FrakConfig` :208, `FrakEnvironment` :266, `FrakMetadata` :390, `FrakError` :302.)
- **What actually happens**: a merchant who wants to route SDK diagnostics writes `FrakLogger` and gets an unresolved reference; the actual hook is the `FrakLogSink` fun interface (`frak-sdk.api:386`), which the same README does mention at `:144` — so the reader gets two answers, one wrong.
- **Fix sketch**: delete `FrakLogger` from `:72` (it is legitimately listed at `:45` as a *package content*).
- **Register status**: NEW

### F7. iOS deep-link routing: the only code shipped is `.onOpenURL`, which does not receive the https universal links this SDK generates
- **Severity**: high
- **Axis**: deep-link routing / merchant setup
- **Complexity to fix**: medium
- **Evidence**:
  - `sdk/ios/README.mirror.md:67-71` and `sdk/ios/README.md:72-75` both show only `.onOpenURL { url in … handleReferral(url) }`.
  - The example app does the same and nothing more: `example/native-ios/Sources/FrakExampleiOSApp/FrakExampleApp.swift:226-228` (`.onOpenURL`), with only a custom scheme registered (`Sources/FrakExampleiOSApp/Info.plist:42-55`, `merchantapp`) and **no** `com.apple.developer.associated-domains` entitlement anywhere in `example/native-ios/project.yml`.
  - The links the SDK builds and expects back are the merchant's own https URLs with `?fCtx=` — cf. the Android harness registering an `https` App Links intent-filter for exactly that (`example/native-android/app/src/main/AndroidManifest.xml:24-40`) and `MainActivity.kt:310`.
  - `DeepLinkHandling` on iOS is `.manual`/`.disabled` only (`sdk/ios/Sources/FrakSDK/Core/FrakConfig.swift:27-37`), so this is 100% merchant-written code.
- **What actually happens**: SwiftUI delivers a universal link through `onContinueUserActivity(NSUserActivityTypeBrowsingWeb)`, not `onOpenURL`. A merchant who copies the documented snippet gets referral attribution that works when they paste a `merchantapp://` URL by hand and silently never fires for real shared links — the worst kind of failure, because everything looks wired.
- **Fix sketch**: ship copy-pasteable routing for both entry points (`.onOpenURL` **and** `.onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { $0.webpageURL.map(handle) }`, plus the UIKit `application(_:continue:restorationHandler:)` twin), list the Associated Domains entitlement (`applinks:moulinex.example`) and `apple-app-site-association` as required setup steps, and add a universal-link path to the iOS harness so it is exercised.
- **Register status**: confirms "iOS README omits LSApplicationQueriesSchemes and Associated Domains" (extends it: the routing code itself is wrong for the link type the SDK produces)

### F8. iOS merchants get no consent, privacy-label or GDPR guidance at all; `PRIVACY.md` is Android-only and is not in the mirror payload
- **Severity**: high
- **Axis**: privacy / merchant setup
- **Complexity to fix**: low
- **Evidence**:
  - `grep -n "setTrackingEnabled\|consent\|GDPR\|opt-out" sdk/ios/README.md sdk/ios/README.mirror.md` → **no matches**, although the API exists (`sdk/ios/Sources/FrakSDK/FrakClient.swift:65`) and `FrakConfig.trackingEnabled` is a documented hard floor (`Core/FrakConfig.swift`, the `trackingEnabled` doc block).
  - The mirror payload is `Sources/`, `Package.swift`, `LICENSE`, `README.mirror.md` only: `sdk/ios/scripts/run.sh:213-215`. `sdk/android/PRIVACY.md` never ships to an iOS merchant, and `PRIVACY.md:4-5` claims "the two are kept deliberately consistent" while living outside the iOS payload.
  - `README.mirror.md:74-84` covers only `PrivacyInfo.xcprivacy`/ITMS-91053 — i.e. the *upload gate* — and says nothing about the App Store "App Privacy" questionnaire, which is mandatory and which the manifest (`sdk/ios/Sources/FrakSDK/PrivacyInfo.xcprivacy`, `NSPrivacyCollectedDataTypeUserID` + `ProductInteraction`) directly implies answers for.
- **What actually happens**: Groupe SEB's iOS release manager fills in the App Privacy form with no vendor guidance, and the app ships with no CMP wiring because nothing told them a consent switch exists. The Android side gets a genuinely good `PRIVACY.md`; iOS gets nothing.
- **Fix sketch**: add `PRIVACY.md` (iOS flavour: App Privacy label answers, `setTrackingEnabled` + CMP wiring, `resetAnonymousId`, the deletion URL) to the mirror payload in `do_mirror_stage`, and link it from `README.mirror.md`.
- **Register status**: NEW

### F9. "Did my event arrive?" is unanswerable, and `Success` is returned for events that will never be delivered
- **Severity**: high
- **Axis**: failure modes / observability
- **Complexity to fix**: medium
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:236-250` + `:379-387`: `track`/`trackPurchase` resolve the merchant `CachedOnly` and return `FrakResult.Success` as soon as the row is durable — `merchantId` may be `null`.
  - Rows then die silently: 3 failures (`tracking/EventOutbox.kt:309` `MAX_FAILURES = 3`, drop at `:134`), 14 days (`tracking/EventQueue.kt:335`), or the 1000-row cap (`EventQueue.kt:336`, trim at `:180`). Same contract on iOS: `sdk/ios/Sources/FrakSDK/TrackingAPI.swift:7` "Succeeds once durable, not once delivered." and `sdk/ios/README.md:159-166`.
  - No public queue-depth, drain-result or delivery callback anywhere: `frak-sdk.api:79-84` (`TrackingApi`) exposes only `track`/`purchase` and their twins; iOS `TrackingAPI.swift` the same. iOS at least has `ConfigAPI.updates` (`ConfigAPI.swift:13`); Android has no equivalent (`frak-sdk.api:11-16`).
  - The docs never state the contract where a merchant reads it: `sdk/android/README.md:69` lists `track`, `purchase` with no note; `README.mirror.md:55` shows `purchase` with no note.
- **What actually happens**: with a wrong/unallow-listed merchant id (F3) and logs off (F2), `tracking.purchase(...)` returns `Success` forever, nothing is ever delivered, and the merchant's only feedback loop is asking Frak to look in a dashboard. There is no way to write an integration test that asserts "my event arrived".
- **Fix sketch**: (a) document the enqueue-vs-deliver contract in both merchant READMEs; (b) expose a minimal observability hook — a `TrackingApi.pendingCount()` or a `FrakLogSink` line per drain outcome; (c) log at WARN when a row is dropped for exhaustion/age with the merchant id and kind (the strings exist internally: `EventOutbox` "Dropping an event: $reason.").
- **Register status**: NEW

### F10. No merchant staging mode and no test seam — the SDK cannot be faked in a merchant's own tests
- **Severity**: medium
- **Axis**: DX / testability
- **Complexity to fix**: medium
- **Evidence**:
  - `FrakEnvironment.Development` is public (`frak-sdk.api:282-289`) but explicitly not for merchants: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/FrakConfig.kt:99` "Merchants never set this; exists for Frak's own dev/local builds"; identically `sdk/ios/Sources/FrakSDK/Core/FrakConfig.swift` ("Merchants never set this; for Frak's own dev/local builds"). `FrakEnvironment.Custom` exists (`frak-sdk.api:273-280`) but points at Frak-hosted origins the merchant does not have.
  - `FrakClient` is a `final class` with an `internal` constructor and no protocol/interface: `frak-sdk.api:29-44` (no supertype), `sdk/ios/Sources/FrakSDK/FrakClient.swift:14`; the entry point is a singleton (`public object Frak`, `frak-sdk.api:18-27`; `public enum Frak`, `Frak.swift:10`). iOS's `Frak.resetForTesting()` is `internal` (`Frak.swift`, `resetForTesting`).
  - Nothing in either README describes how to test an integration; the only pattern shown anywhere is the harness debug panel (`example/native-android/.../MainActivity.kt:380-420`).
- **What actually happens**: My Moulinex's CI cannot run a single test that touches a checkout screen with Frak wired in, because `Frak.client` reaches the network or throws. The merchant's only options are to hand-wrap every call site or to disable Frak in tests — both of which mean their integration is untested until QA on a device.
- **Fix sketch**: extract a `FrakClientProtocol`/interface (or ship a `FrakTesting` artifact with an in-memory client + `Frak.setClientForTesting`), and give merchants a sandbox environment that is allow-list-free.
- **Register status**: NEW

### F11. The sharing sheet offers no theming and no localisation — one knob, `heightFraction`
- **Severity**: medium
- **Axis**: DX / product fit
- **Complexity to fix**: high
- **Evidence**: the entire `frak-sdk-ui` public surface is `FrakSharing` (`present`, `warm`), `Builder(ResultCallback)` + `heightFraction`, `FrakSharingDefaults.HEIGHT_FRACTION`, `SharingResult` (`sdk/android/frak-sdk-ui/api/frak-sdk-ui.api:1-73`); iOS is the same modifier signature (`sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:22-27`: `isPresented`, `request`, `heightFraction`, `onResult`). No locale/language parameter reaches the page builders (`sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift` has no `lang`/`locale` occurrence; the same holds for the Kotlin sheet).
- **What actually happens**: a Moulinex product owner sees a web sheet in the wrong language and in Frak's colours, inside their own app, and there is no API to change either. `FrakMetadata.lang` (`frak-sdk.api:393`) sets the *backend copy* language but is not forwarded to the sheet URL.
- **Fix sketch**: forward `FrakMetadata.lang` (falling back to the device locale) into the sharing/install page URLs; add a `theme`/token parameter to the Builder and the modifier before the surface freezes further.
- **Register status**: confirms "the wallet web sheet defaults to FRENCH because native forwards no locale" (adds: no theming knob either, and the ABI is about to freeze without one)

### F12. The Android and iOS READMEs contradict themselves on facts an integrator uses to judge readiness
- **Severity**: medium
- **Axis**: docs accuracy
- **Complexity to fix**: trivial
- **Evidence**:
  - ABI dumps: `sdk/android/README.md:168` and `:239` say "not committed … `check` is red until they are"; `:256` says "**Done** — both are committed and `apiCheck` passes in CI". The files exist (`sdk/android/frak-sdk/api/frak-sdk.api`, 758 lines; `frak-sdk-ui/api/frak-sdk-ui.api`, 73 lines), so `:168`/`:239` are the stale halves.
  - Publish path: `:168` "There is no publish path." vs the whole `## Publishing` section (`:180-253`) describing an end-to-end wired path.
  - Signing key: `:200` "**The signing key exists.**" (with a fingerprint) vs `:258` "Generating the real GPG key … neither has started."
  - CI: `sdk/ios/README.md:155` "No CI builds either native SDK." vs `sdk/ios/README.md:88-90` and `.github/workflows/apps.yaml:118` (`android-sdk`) / `:177` (`ios-sdk`).
  - Install handoff: `sdk/ios/README.md:85-87` "Not implemented: … the install-code + pasteboard + `SKStoreProductViewController` handoff" vs `sdk/ios/Sources/FrakSDK/AppLinkAPI.swift:37` `installPageURL(returnScheme:sessionId:)` and `sdk/ios/Sources/FrakSDKUI/StoreOverlay.swift:12-39` (an `SKOverlay`-based handoff, plus `SharingResult.installStarted` at `SharingResult.swift:10`).
  - Verified-mechanism claim contradicts itself in-file: `sdk/android/README.md:76` "including what about that is still unverified" vs `:245` "That mechanism is now **verified**".
  - Broken cross-reference: `sdk/android/README.md:260` "see 'Testing' above" — there is no Testing section.
- **What actually happens**: a merchant's tech lead reading these to decide whether to adopt cannot tell what is true; a Frak engineer answering "is it published?" gets two answers from one file.
- **Fix sketch**: one pass over both READMEs reconciling §Status / §Publishing / §Open decisions against the tree; consider generating the Status block from CI rather than prose.
- **Register status**: NEW

### F13. A merchant-facing error message names an API that does not exist
- **Severity**: medium
- **Axis**: failure modes
- **Complexity to fix**: trivial
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/Frak.kt:186-188` "DeepLinkHandling.Automatic needs an Application context. Inbound referral links will be ignored; call handleReferralLink from your own router." — the public method is `AppLinkApi.handleReferral` (`frak-sdk.api:2`, `AppLinkApi.kt:12`); `handleReferralLink` is the `internal` `DefaultFrakClient` method (`core/DefaultFrakClient.kt:261`). The same wrong name is in the shipped manifest comment: `sdk/android/frak-sdk/src/main/AndroidManifest.xml:28`.
- **What actually happens**: the one merchant who ever sees this message (assuming they turned logging on, F2) greps their IDE for `handleReferralLink`, finds nothing, and files a ticket.
- **Fix sketch**: s/handleReferralLink/`FrakClient.appLink.handleReferral(url)`/ in both places.
- **Register status**: NEW

### F14. Android README §Java miscounts the async twins and claims one that does not exist
- **Severity**: medium
- **Axis**: docs vs API
- **Complexity to fix**: trivial
- **Evidence**:
  - `sdk/android/README.md:124` "eighteen twins for fifteen members" — the ratified dump contains **17** `*Async` declarations (`grep -c "Async " sdk/android/frak-sdk/api/frak-sdk.api` → 17: `frak-sdk.api:3,5,8,14,15,26,31,39,41,43,66,67,70,71,76,81,83`).
  - `sdk/android/README.md:62` "`FrakClient`: `environment`, `anonymousId`, `resetAnonymousId`, `setTrackingEnabled`, `isTrackingEnabled` (each with an `*Async` twin)" — there is no `environmentAsync`; `getEnvironment()` is a plain getter (`frak-sdk.api:34`) and correctly has no twin.
- **What actually happens**: a Java-first team (plausible for a large SEB app) writes `getEnvironmentAsync()` from the doc and does not compile. Low blast radius, but this is exactly the section a Java integrator trusts.
- **Fix sketch**: correct the count to 17 and move `environment` out of the "each with a twin" clause.
- **Register status**: NEW

### F15. The install handoff has no documented call path on either platform, and its parameters are unexplained
- **Severity**: medium
- **Axis**: install handoff / docs
- **Complexity to fix**: medium
- **Evidence**: `frak-sdk.api:4-5` `installPageUrl(String,String)` / `installPageUrlAsync`; `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/AppLinkApi.kt:34-37` `returnScheme: String, sessionId: String`; iOS `AppLinkAPI.swift:37`. Neither README shows a call, explains what `returnScheme` must be (a URL scheme the merchant registers — `CFBundleURLTypes` / a `<data android:scheme>` intent-filter, cf. `example/native-ios/.../Info.plist:42-55` and `example/native-android/.../AndroidManifest.xml:41-46`), nor what `sessionId` should contain. `sdk/android/README.md:70` merely lists the name; `README.mirror.md` never mentions it. The Android store handoff also builds a Play `referrer=` payload (`applink/InstallLinks.kt:28-40`) with no merchant-facing note about whether the Play Install Referrer library is needed (it is not — `PRIVACY.md:17-18` — but only the privacy doc says so).
- **What actually happens**: the install handoff — the feature that makes referral attribution survive an install, i.e. the reason to buy this SDK — cannot be integrated from the docs. It is also un-run on any device (`sdk/android/README.md:168`, `README.mirror.md:5-7`).
- **Fix sketch**: one worked example per platform: register scheme → mint `installPageUrl` → present → handle the return URL; state explicitly that no Play Install Referrer dependency is required.
- **Register status**: NEW

### F16. The Android quickstart snippet needs unstated project setup
- **Severity**: low
- **Axis**: docs / merchant setup
- **Complexity to fix**: trivial
- **Evidence**: `sdk/android/README.md:82-88` and `:95-102` both use `BuildConfig.FRAK_MERCHANT_ID`. `BuildConfig` generation is off by default in AGP 8+/9 (the SDK's own build disables it — `sdk/android/README.md:60` in the build-facts list), so the merchant additionally needs `android { buildFeatures { buildConfig = true } }` and a `buildConfigField`. The snippet also passes a bare `context`, while `DeepLinkHandling.Automatic` is the **default** (`core/FrakConfig.kt:135`) and needs an `Application` (`Frak.kt:184-189`); the KDoc says "Call `initialize` once from `Application.onCreate`" (`Frak.kt:30`) but the README never does.
- **What actually happens**: copy-paste gives an unresolved `BuildConfig`, and the reader is not told where `initialize` belongs.
- **Fix sketch**: use a plain string literal (or show the `buildConfigField` line), and show the call inside `Application.onCreate` with `applicationContext`, as the harness does (`example/native-android/.../MainActivity.kt:173-191`).
- **Register status**: NEW

### F17. `PRIVACY.md` drift: the 1000-row cap is omitted, and the header casing is wrong
- **Severity**: low
- **Axis**: privacy accuracy
- **Complexity to fix**: trivial
- **Evidence**: verified-correct claims first — keystore alias `id.frak.sdk.identity` (`PRIVACY.md:60` vs `identity/AndroidKeystoreDeviceKeyStore.kt:72`), prefs files `id.frak.sdk` / `id.frak.sdk.config` (`:61-62` vs `Frak.kt:208`, `config/KeyValueStore.kt:46`), `noBackupFilesDir/frak-events.jsonl` (`:63` vs `Frak.kt:88-91,210`), 14 days (`:73` vs `EventQueue.kt:335`), three rejections (`:73` vs `EventOutbox.kt:309`), both purges (`:74` vs `core/DefaultFrakClient.kt:130,160`), endpoints (`:46-50` vs `ConfigStore.kt:241`, `InteractionSender.kt:49`, `PurchaseSender.kt:27`, `IdentityMerge.kt:27`), `INTERNET` + `<queries>` and no `QUERY_ALL_PACKAGES` (`:80-82` vs `frak-sdk/src/main/AndroidManifest.xml:16-22`), no Install Referrer library (`:17-18` — no `installreferrer` reference exists in `sdk/`). Drift:
  - `:73` "Rows leave the file when they are delivered, when the backend rejects them three times, or after 14 days, **whichever comes first**" — omits the 1000-row cap that silently drops the oldest rows (`EventQueue.kt:336`, `:180`).
  - `:41` "`X-Frak-Sdk-Version`" vs the actual header `x-frak-sdk-version` (`FrakSdkVersion.kt:15`) — harmless over HTTP, but a merchant's proxy allow-list is written from this string.
  - `:4-5` claims iOS/Android parity "so a declaration written from one holds for the other", while `:144-147` admits nothing checks either against the code — and the iOS payload never receives this file (F8).
- **What actually happens**: a DPO writing a retention statement from `:73` under-describes the drop conditions.
- **Fix sketch**: add the cap to the retention sentence; fix the header casing; state the iOS-parity claim as "reviewed by hand at <commit>".
- **Register status**: NEW

### F18. There is no merchant-facing Android README at all
- **Severity**: medium
- **Axis**: docs structure
- **Complexity to fix**: low
- **Evidence**: `sdk/ios` ships a contributor README plus a merchant one (`sdk/ios/README.md:31-32` "`README.mirror.md` is the merchant-facing README and this file is the contributor-facing one; they are meant to diverge"; staged at `sdk/ios/scripts/run.sh:215`). `sdk/android/` has only `README.md` + `PRIVACY.md` (`find sdk -name "*.md"`), and that README is 260 lines of build/ABI/publishing internals in which the entire integration story is `## Basic usage` (`:80-103`) — no install, no manifest requirements, no consent snippet, no deep-link setup, no sharing-sheet prerequisites beyond one code block.
- **What actually happens**: the Android engineer's first read is 60% content that only a Frak contributor needs (BCV wiring, GPG fingerprints, Gradle wrapper pinning), and the pieces they need (F1, F3, F15) are absent.
- **Fix sketch**: split it the way iOS is split; the merchant half should be: install → allow-listing → initialize (in `Application.onCreate`) → consent → track → sharing sheet → deep links → PRIVACY.md → troubleshooting.
- **Register status**: NEW

### F19. `Frak.shutdown` is the only entry point that is not `@JvmStatic`
- **Severity**: nit
- **Axis**: API consistency
- **Complexity to fix**: trivial
- **Evidence**: `sdk/android/frak-sdk/api/frak-sdk.api:18-27` — `initialize`, `getClient`, `getClientOrNull`, `isInitialized`, `parseReferralLink`, `shutdownAsync` are `public static final`; `shutdown` alone is `public final fun shutdown (…Continuation;)` (instance). README prose says "`Frak.shutdown()`" throughout (`:60`, `:136`, `:142`).
- **What actually happens**: Kotlin is unaffected (object member); a Java reader following `:142` writes `Frak.shutdown()` and must discover `Frak.INSTANCE` or `shutdownAsync()`.
- **Fix sketch**: it is a suspend function so `@JvmStatic` gains little; instead say "Java: `Frak.shutdownAsync()`" at `:142`.
- **Register status**: NEW

---

## Derived integration checklist (from code), and what the docs get wrong

### Android — required by code
| Step | Source of truth | In the docs? |
|---|---|---|
| Add `mavenCentral()` + `implementation("id.frak.sdk:core:<v>")`, `:ui` for the sheet | `example/native-android/app/build.gradle.kts:66-67`, `sdk/android/README.md:36-37` | **No snippet anywhere** (F1) |
| `minSdk 24`, Java/JVM 17, Kotlin/Compose for the sheet | `sdk/android/README.md:39`; `frak-sdk-ui` is Compose-hosted (`:37`) | Partly (buried in Module layout) |
| Get a merchantId **and** have `applicationId` allow-listed | `example/native-android/README.md:5` | **No** (F3) |
| `Frak.initialize(applicationContext, FrakConfig(...))` in `Application.onCreate` | `Frak.kt:30`, `:184-189` | Snippet shows a bare `context`, no host (F16) |
| Set `logLevel` (or see nothing) | `core/FrakConfig.kt:139`, `FrakLogger.kt:33` | Yes in the snippet; no "turn this on" guidance (F2) |
| `<queries>` + `INTERNET`: **nothing to add** — merged from the SDK manifest | `frak-sdk/src/main/AndroidManifest.xml:16-22`, `example/.../AndroidManifest.xml:3-5` | Yes, in `PRIVACY.md:80-82` only |
| Inbound links: your own `https` intent-filter + `autoVerify` + `assetlinks.json` | `example/.../AndroidManifest.xml:24-40` and its comment | Example only, not the SDK README |
| Deep-link mode: `Automatic` is the default and handles arrival itself; calling `handleReferral` too double-tracks | `core/FrakConfig.kt:42-45`, `MainActivity.kt:242` | Yes (`README.md:70`, terse) |
| Consent: drive `setTrackingEnabled` from your CMP | `PRIVACY.md:86-100` | Yes (Android only) |
| Sharing sheet: build in `onCreate` after `super`, `warm()`, `present()` | `README.md:148-160`, `MainActivity.kt:171` | Yes — the best-documented part |
| Play Data Safety: User IDs / App interactions / Purchase history + deletion URL | `PRIVACY.md:11-15`, `:133-140` | Yes |
| Play Install Referrer library: **not needed** | no `installreferrer` reference in `sdk/` | Only implied by `PRIVACY.md:17-18` (F15) |
| R8/ProGuard: nothing shipped, nothing tested | both `consumer-rules.pro` empty | Not mentioned (pre-established) |

### iOS — required by code
| Step | Source of truth | In the docs? |
|---|---|---|
| SwiftPM dependency, iOS 15+, **Xcode 16+** | `sdk/ios/Package.swift:1,13-16`, `README.mirror.md:35-36` | Yes, but the pinned version does not exist (F1) |
| Merchant id **and** allow-listed `CFBundleIdentifier` (or rely on bundleId resolution) | `example/native-ios/README.md:5`, `Frak.swift` (`withBundleIdFromMainBundle`) | **No** (F3) |
| `Frak.initialize(FrakConfig(...))` in `App.init()` / `didFinishLaunching` | `example/.../FrakExampleApp.swift:126-144` | Snippet has no host (F4-adjacent) |
| Set `logLevel` | `Core/FrakConfig.swift` default `.none` | **No** (F2) |
| `LSApplicationQueriesSchemes` = `frakwallet`, `frakwallet-dev` — or `isFrakAppInstalled()` always false | `AppLinkAPI.swift:19` (comment), `example/.../Info.plist:37-41` | **No** (pre-established) |
| `CFBundleURLTypes` scheme for the install-handoff `returnScheme` | `AppLinkAPI.swift:37`, `example/.../Info.plist:42-55` | **No** (F15) |
| Associated Domains + `onContinueUserActivity` for https referral links | absent from `project.yml`; only `.onOpenURL` shipped | **No / wrong** (F7) |
| Route inbound URLs to `appLink.handleReferral(_:)` — mandatory, `.manual` is the only mode | `Core/FrakConfig.swift:27-37` | Yes, but incomplete (F7) |
| ATS: nothing to add — all traffic is HTTPS | `PRIVACY.md:40`; no `NSAppTransportSecurity` in `example/.../Info.plist` | Not stated (fine) |
| `PrivacyInfo.xcprivacy` rides in the package; `Interaction.custom` payload is yours to declare | `README.mirror.md:74-84`, `run.sh:217-223` | Yes — good |
| App Store privacy labels, consent, deletion route | `sdk/ios/Sources/FrakSDK/PrivacyInfo.xcprivacy`, `FrakClient.swift:65` | **No** (F8) |
| Sharing sheet: `.frakSharingSheet(isPresented:request:heightFraction:onResult:)`, screen-level only | `FrakSharingSheet.swift:11-27` | Yes, but `request` is never constructed (F4) |

### Doc steps that are unnecessary or harmful
- `sdk/android/README.md:82-88`'s `BuildConfig.FRAK_MERCHANT_ID` implies a build-config setup the merchant is never told to enable (F16).
- `sdk/android/README.md:168`/`:239` tell a contributor `check` is red and to run `apiDump` — it is green; following that advice rewrites a ratified ABI file for no reason (F12).
- `PRIVACY.md:102-131` correctly *withdraws* the old backup-rules instruction — this is a good pattern and should be kept; nothing else in the docs asks for unnecessary work.

## Failure-mode walkthrough (what a merchant actually gets)

| Scenario | Behaviour | Actionable? |
|---|---|---|
| Wrong / unallow-listed `merchantId` | `config.resolve()`/`rewards.best` throw `MerchantResolutionFailed` (`core/FrakConfig.kt:95-96`); `tracking.*` still return `Success` and queue rows with a null merchant (`DefaultFrakClient.kt:379-387`). If the id merely disagrees with the backend's, it is **silently overridden** with a WARN (`identity/MerchantIdentity.kt:71-85`) | **No** — good strings, but `logLevel` is `NONE` by default (F2) and the docs never mention allow-listing (F3) |
| No wallet installed | Android `isFrakAppInstalled()` false via `<queries>` (`AndroidAppLauncher.kt:21-22`); iOS false unless `LSApplicationQueriesSchemes` is declared (`AppLinkAPI.swift:19`) — undocumented, so it reads as "no wallet" forever | **No** on iOS |
| No network | Config/rewards throw `FrakError.Network`/`BackingOff` (`frak-sdk.api:311-314,346-348`); tracking succeeds and queues, drained later | Partially — errors are typed and good; the queue behaviour is undocumented (F9) |
| Consent withdrawn | `setTrackingEnabled(false)` purges the queue (`DefaultFrakClient.kt:130`); calls then fail `TrackingDisabled` (`frak-sdk.api:362`). Written with `apply()`, so a process kill can lose the withdrawal — honestly disclosed at `README.md:144` and `PRIVACY.md:97-100` | Yes on Android; **nothing at all on iOS** (F8) |
| Called before `initialize` | Android `Frak.client` throws `FrakError.NotInitialized` (`frak-sdk.api:350`), `clientOrNull` returns null; iOS `Frak.client` is `get throws` (`Frak.swift`) | Yes — clean, and the harnesses model the `clientOrNull` pattern |
| Off the main thread / on the main thread | Kotlin members are `suspend`; Java twins complete on the main thread and `get()`/`join()` on main is a deterministic ANR — documented loudly at `README.md:134-136`. `FrakSharing.Builder(...).build(activity)` throws without a `ViewModelStore` (`README.md:150-154`) | Yes — the best-documented failure mode in the repo |
| Double `initialize` | WARN "first configuration is kept" (`Frak.kt:56-58`, `Frak.swift` `.alreadyInitialized`) | Only if logging is on (F2) |

## What a merchant will ask for on day two and cannot have

- **Theming / brand colours on the sharing sheet** — impossible; only `heightFraction` (F11).
- **Localisation** — impossible; no locale reaches the sheet URL, defaults to French (F11).
- **A staging/sandbox environment** — `FrakEnvironment.Development` is Frak-internal and allow-list-gated (F10).
- **A testing seam** — `FrakClient` is `final` with an `internal` init behind a singleton (F10).
- **Per-user opt-out** — exists (`setTrackingEnabled`), documented on Android only (F8).
- **GDPR deletion** — `resetAnonymousId()` + `https://frak.id/account-deletion` (`PRIVACY.md:133-140`); Android only, and it is a static page, not a `clientId`-keyed API (`docs/plans/native-sdk/06-open-findings.md:43`).
- **"Did my event arrive?"** — no signal of any kind (F9).
- **A Fragment build site for the sheet** — explicitly absent (`sdk/android/README.md:162`).
- **`FrakClient.copy` / 4-tier copy precedence, `referralStatus`, analytics stream** — not implemented (`sdk/android/README.md:78`, `sdk/ios/README.md:85-87`).

## Time-to-first-successful-`track`

- **Android**: **blocked / unbounded today** — no artifact exists to depend on (F1). Given a private Maven repo or an AAR handed over by Frak, and an allow-listed merchant id: ~3–4 h of build wiring and reading, plus a realistic 4–8 h lost to the two silent traps (logs off, allow-list) → **~1.5 days**, or ~4 h with a Frak engineer on a call.
- **iOS**: **blocked today** — the pinned tag does not exist (F1). Given a path/git dependency that resolves: the documented quickstart does not compile (F4), logs are silent (F2), and referral links will not route (F7) — first `track` in ~2–3 h, first *believed-working* referral flow measured in days, because F7 fails silently.

### Top 5 changes that would most shorten it
1. **Ship the artifacts and fix the version pins** (F1) — until Central + the `ios-v*` tag exist, every other number is hypothetical.
2. **Default `logLevel` to errors, and emit initialize-time misconfiguration unconditionally** (F2) — this single change converts three of the six failure modes above from silence to a one-line fix.
3. **Add a "Before you start: merchant id + package/bundle-id allow-listing + how to verify" block to both merchant READMEs** (F3) — removes the most likely first-day ticket.
4. **Ship copy-pasteable, *correct* iOS deep-link routing** — `onOpenURL` **and** `onContinueUserActivity`, plus the Associated Domains and `LSApplicationQueriesSchemes` steps — and exercise a universal link in the harness (F7).
5. **Give Android a merchant-facing README with an install snippet, and make both quickstarts compile** (F1/F4/F18) — including a real `SharingRequest` and a real `rewards.best(...)` argument list.

## Verified-OK

- Android Java snippet `sdk/android/README.md:127-130` — `Frak.getClient()` (`frak-sdk.api:20`), `getRewards()` (`:35`), `bestAsync(RewardRequest)` (`:66`), `RewardRequest.Builder().targetInteraction(...).build()` (`:556-568`), `BestReward.getFormatted()` (`:473`). Compiles as written.
- Android Kotlin snippet `:82-88` — `FrakConfig(String, Function1)` (`frak-sdk.api:251`), `Builder.logLevel` var (`:240`), `FrakLogLevel.INFO` (`:378`). Java form `:98-102` — `FrakConfig.Builder(String)` (`:221`), `.logLevel(...)` (`:233`), `.build()` (`:222`).
- Android sharing snippets `:154`/`:159` — `FrakSharing.Builder(ResultCallback)` (`frak-sdk-ui.api:9`) is a Kotlin `fun interface` (`FrakSharing.kt:31`) so `::onShareResult` SAM-converts; `build(ComponentActivity)` (`:10`), `@Composable build()` (`:11`), `warm()` (`:4`), `present(SharingRequest)` (`:3`).
- Android §Construction claims `:107-118` — all seven Builder types + same-named Kotlin functions exist (`frak-sdk.api:219-254, 398-416, 443-468, 556-573, 624-652, 682-694, 705-733`); `Interaction` static factories (`:737-745`); explicit overloads on `FrakEnvironment.Custom` (`:274-275`), `FrakError.Server`/`Decoding` (`:355-356`, `:317-318`); public reward-model constructors (`:471, 485, 503, 511, 522, 531, 581, 591, 601`); no `DefaultConstructorMarker` on any public ctor except the `synthetic` `FrakError` base (`:303`).
- Android §Public API `:74` resolved-config tree — every listed type and `displayName`/`displayLogoUrl` present (`frak-sdk.api:86-197`, `:130-131`), all constructors absent from the dump as claimed.
- `PercentEncoding` is annotated `@InternalFrakApi` and absent from both dumps (`README.md:76`, `:245`; grep of both `.api` files → no match).
- iOS `.onOpenURL` snippet (`README.md:72-75`, `README.mirror.md:67-71`) compiles: `handleReferral` is `@discardableResult` (`AppLinkAPI.swift:9,14`).
- iOS `frakSharingSheet` signature matches the modifier (`README.mirror.md:60-72` vs `FrakSharingSheet.swift:22-27`); `try await Frak.client.tracking.purchase(...)` (`README.mirror.md:55`) compiles — `purchase` is `@discardableResult` and non-throwing, `try` covers the `Frak.client` getter (`TrackingAPI.swift:13-16`, `Frak.swift` `client`).
- iOS quickstart `FrakConfig(merchantId:metadata:)` / `FrakMetadata(name:currency:)` (`README.mirror.md:43-48`) match `Core/FrakConfig.swift` inits.
- `sdk/android/PRIVACY.md` factual table — see F17 for the full verified list (alias, prefs files, queue path, 14 d, 3 rejections, purges, endpoints, permission/queries, no Install Referrer). Everything checked out except the two drift items noted.
- Example harnesses compile-consistently against the public API (spot-checked `MainActivity.kt:171-361` and `FrakExampleApp.swift:126-240` against both dumps / public Swift decls) and are the best integration reference in the repo — they are simply not linked from either SDK README as such.

## Could not verify

- Whether `github.com/frak-id/frak-ios-sdk` exists, and whether any tag is published (no network).
- Whether the backend actually keys the allow-list on package/bundle id, or what status a wrong merchant id returns — `services/backend` has no `merchant/resolve` route in this tree.
- Runtime behaviour of any kind: no JDK, Android SDK or Swift toolchain, so no compile check of the README snippets (findings F4/F14/F16 are read from signatures, not from a compiler).
- Whether `PrivacyInfo.xcprivacy` actually propagates into a merchant binary (the repo itself flags this as unvalidated, `sdk/ios/README.md:156-158`).
- Play Console Data Safety / App Store Connect form acceptance of the declarations in `PRIVACY.md` and the manifests.
- Whether `example/native-android` still compiles (nothing in CI builds it — `sdk/android/README.md:168`, `:260`).
