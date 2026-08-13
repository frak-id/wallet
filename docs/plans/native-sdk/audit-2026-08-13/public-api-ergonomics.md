# Frak native SDKs — public API as a merchant experiences it

Scope: API **shape** only. Android ABI read from the frozen dump (`sdk/android/frak-sdk/api/frak-sdk.api`, 758 lines; `sdk/android/frak-sdk-ui/api/frak-sdk-ui.api`, 73 lines) plus the Kotlin sources; iOS from every `public` declaration under `sdk/ios/Sources/`. No compilation was possible; every claim below is a read of a cited line.

## Summary

Not alpha-ready as *one* SDK. Each platform is individually coherent and unusually well-documented in-source, but they are not the same API: `rewards.best` takes a `RewardRequest` on Android and four loose defaulted parameters on iOS; six merchant-input types are Builders on Android and memberwise `init`s on iOS; `heightFraction` throws on Android and clamps on iOS; the retry hint in `FrakError` is **milliseconds on Android and seconds on iOS**. A merchant integrating both writes two integrations and two sets of docs, and Frak writes two sets of samples forever.

The single worst thing is that **Android's ABI is already frozen by a ratified `apiCheck` gate while iOS's equivalent surface has not been reconciled against it.** The moment `id.frak.sdk:core` publishes, every divergence above becomes permanent on one side and source-breaking on the other. The rewards read models (`Campaign`, `BestReward`, `TokenAmount`, `EstimatedReward.*`, `RewardTier.*`) publish their constructors into that dump, directly contradicting the "read models get `internal` constructors" policy that `06-open-findings.md` A3/D7 claims to have completed — so the first backend field added to `Campaign` is an ABI break the gate will red-flag with no clean fix.

Secondary but merchant-fatal for the named first merchant: on iOS the sharing sheet exists **only** as a SwiftUI `View` modifier and there is not one `@objc` declaration in the package. A UIKit-hosted or ObjC-heavy retail app (My Moulinex's likely shape) cannot reach the sheet at all without writing its own `UIHostingController` shim, and cannot reach `FrakSDK` from ObjC under any circumstances.

Also real: `resetAnonymousId()` returns a Boolean whose contract is *defined* cross-platform and *false* on iOS; `FrakSharing.present()` can silently do nothing with no callback and no log; and the iOS README's "Public API surface" table is wrong on roughly fifteen of twenty rows.

---

## Compact side-by-side (the shape a merchant sees)

| Concept | Android (frozen ABI) | iOS (`public`) | Verdict |
|---|---|---|---|
| Entry | `Frak.initialize(Context, FrakConfig)` `@JvmStatic`, void | `Frak.initialize(_ config: FrakConfig)`, void | ok |
| Client | `Frak.getClient()` throws / `getClientOrNull()` | `Frak.client` `get throws` / `Frak.clientOrNull` | ok (`clientOrNull` is un-Swifty) |
| Version | `FrakSdkVersion.CURRENT` | `FrakSDKVersion.current` | type spelled differently |
| Config build | `FrakConfig.Builder` + 3 top-level DSL fns | memberwise `init` w/ 8 defaults | divergent call site |
| `packageId` | `FrakConfig.packageId` | `FrakConfig.bundleId` | intentional |
| Deep link modes | `Automatic`, `Manual`, `Disabled` | `.manual`, `.disabled` | intentional; **defaults differ** (`Automatic` vs `.manual`) |
| Config read | `config.resolve()` / `resolve(Boolean)` | `config.resolve(forceRefresh:)` + `current` + `updates` | Android has no `current`/`updates` (9.17, deliberate) — but its KDoc claims it does |
| Rewards | `rewards.best(RewardRequest[, Boolean])` | `rewards.best(targetInteraction:audience:forceRefresh:products:)` | **different API** |
| Tracking | `tracking.track(Interaction): FrakResult<Unit>` | `tracking.track(_:) -> Result<Void, FrakError>` | ok |
| Purchase | `purchase(String, String, String)` | `purchase(customerId:orderId:token:)` | Android unlabeled triple |
| Sharing link | `sharing.buildLink(SharingRequest): String?` @Throws | `buildLink(_:) async throws -> String?` | ok |
| App link | `handleReferral(String)`, `isFrakAppInstalled(): Boolean` (**sync**), `openFrakApp()`, `installPageUrl(...)` | `handleReferral(String|URL)`, `isFrakAppInstalled() async`, `openFrakApp()`, `installPageURL(...)` | sync-vs-async split |
| Identity | `anonymousId()`, `resetAnonymousId(): Boolean` | `anonymousId` (`get async`), `resetAnonymousId() -> Bool` | Boolean means different things |
| Errors | `sealed class FrakError : Exception` + `Kind` (9) | `enum FrakError: Error` + `Kind` (9) + `LocalizedError` | units diverge; see F5 |
| Result | `FrakResult<T>` (Success/Failure) | stdlib `Result` | ok |
| Sheet | `FrakSharing.Builder(cb).build(activity)` **and** `@Composable build()`; `warm()`, `present()` | `View.frakSharingSheet(isPresented:request:heightFraction:onResult:)` only | **UIKit locked out on iOS** |
| Sheet result | `sealed interface SharingResult` + `Kind` | `enum SharingResult` + `Kind` | ok |
| Java/ObjC | 18 `*Async` twins, `@JvmStatic`, `fun interface`, Java fixture compiles | **zero `@objc`**, no ObjC header, async/enums-with-payloads unrepresentable | see F4 |

---

## Findings

### F1. The two SDKs are not the same API: `rewards.best`, and the Builder-vs-`init` split across six input types
- **Severity**: high
- **Axis**: parity
- **Complexity to fix**: small (<1d) — port `RewardRequest` to iOS
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/RewardsApi.kt:40-50` — `public suspend fun best(request: RewardRequest, forceRefresh: Boolean): BestReward?`
  - `sdk/ios/Sources/FrakSDK/RewardsAPI.swift:26-31` — `public func best(targetInteraction: String? = nil, audience: RewardAudience? = nil, forceRefresh: Bool = false, products: [ProductDetails]? = nil)`
  - `sdk/android/frak-sdk/api/frak-sdk.api:69-72` freezes `best (Lid/frak/sdk/rewards/RewardRequest;...)`; there is no `RewardRequest` type anywhere under `sdk/ios/Sources` (`rg 'RewardRequest' sdk/ios/Sources` → nothing).
  - Same class of split, verified: `FrakConfig.Builder`/`FrakMetadata.Builder` (`core/FrakConfig.kt:122,65`), `SharingRequest.Builder`/`SharingProduct.Builder` (`sharing/SharingRequest.kt`, ABI lines for `SharingRequest$Builder`), `ProductDetails.Builder`, `AttributionParams.Builder` — all six are `public init(... = default)` on iOS (`Core/FrakConfig.swift:46,85`, `Sharing/SharingRequest.swift:13,43,71`, `Core/ProductDetails.swift:24`).
- **What actually happens**: a merchant shipping both platforms writes `RewardRequest.Builder().targetInteraction("purchase").build()` on Android and `best(targetInteraction: "purchase")` on iOS. Frak maintains two quickstarts, two sample apps and two support answers for one feature, forever. On iOS, changing `best` to take a request object after the alpha is a **source break** for every merchant.
- **Fix sketch**: port `RewardRequest` (struct, memberwise `init`) to iOS and make `best(_:forceRefresh:)` the only signature; keep the loose form only as a deprecated shim if the alpha has already shipped (it hasn't).
- **Register status**: confirms 9.15 (which files it accurately but leaves as "either port it or accept it"). This audit says port it, now — 9.15's own framing that "iOS ships source so defaults are source-compatible" does not apply, because the break here is the *call-site shape*, not a defaulted parameter.

### F2. Rewards read models publish their constructors into the frozen Android ABI — contradicting the policy A3/D7 says it completed
- **Severity**: high
- **Axis**: build-release / forward compatibility
- **Complexity to fix**: trivial (<1h) — add `internal constructor`
- **Evidence**:
  - `sdk/android/frak-sdk/api/frak-sdk.api:298` `public fun <init> (Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;Ljava/lang/Double;Ljava/lang/Double;ZLjava/util/List;)V` (`BestReward`); `:313` (`Campaign`, 8 args); `:345,:353,:363,:372` (`EstimatedReward.Fixed/Percentage/Tiered/Unknown`); `:414,:425` (`RewardTier.Amount/Percentage`); `:435` `TokenAmount (DDDD)V`.
  - Source: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/rewards/Rewards.kt:6,39,60,85,99,128,144,160,210` — every one is `public class X(...)` with a public primary constructor.
  - Contrast the config read models, which *did* get the treatment: `config/FrakResolvedConfig.kt:7` `public class FrakResolvedConfig internal constructor(` — and correspondingly the ABI has **no** `<init>` for `id/frak/sdk/config/FrakResolvedConfig` (`frak-sdk.api:124-137`). Same for `FrakContext.V1/V2` (`sharing/FrakContext.kt:10,21`).
  - `docs/plans/native-sdk/06-open-findings.md` A3/D7 states "the config tree is a read model and wants `internal` constructors instead"; the rewards tree is the same kind of read model and was missed.
- **What actually happens**: `TokenAmount` has exactly `eur/usd/gbp`; `FrakCurrency` is documented as a closed set that will grow. The day the backend prices a fourth currency, or `Campaign` gains `startsAt`, the constructor descriptor changes, `apiCheck` goes red, and the only non-breaking escape is to keep the old constructor as a permanent overload with a lying default. Also `TokenAmount(DDDD)` is four positional doubles a Java caller can silently transpose.
- **Fix sketch**: make the constructor `internal` on `TokenAmount`, `RewardTier.*`, `EstimatedReward.*`, `Campaign`, `BestReward`, re-run `apiDump`, before the first publish.
- **Register status**: NEW (A3/D7 claims this class of work closed; it closed for `config/` and `sharing/` only).

### F3. `resetAnonymousId()`'s Boolean is a defined cross-platform contract that iOS cannot honour
- **Severity**: high
- **Axis**: correctness / security (privacy signal)
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDK/FrakClient.swift:40-44` — *"Returns false when erasure failed and the id did NOT rotate. On this platform the underlying delete cannot fail, so this always returns true — the value exists to keep one cross-platform contract."*
  - `sdk/ios/Sources/FrakSDK/Identity/AnonymousIdStore.swift:100-110` — `keyStore.delete(); store.removeValue(...); return true` — unconditional.
  - `sdk/ios/Sources/FrakSDK/Identity/DeviceKey.swift:83-85` — `delete()` is `store.removeValue(forKey:)`, returns Void.
  - `sdk/ios/Sources/FrakSDK/Config/FileKeyValueStore.swift:54-67,69-70` — the write is fire-and-forget and *"The memo keeps the change even when the write fails … the next launch mints a fresh one."* If `write(next)` fails, the on-disk blob still holds the old key, so the **next launch reloads the old identity** — the opposite of the comment, and `resetAnonymousId()` already returned `true`.
  - Android: `FrakClient.kt:44-46` / `core/DefaultFrakClient.kt:115-122` — `false` genuinely means the AndroidKeyStore refused and the queue was *not* purged.
- **What actually happens**: a merchant writes one shared "delete my data" flow keyed on the Boolean. On Android it can legitimately report failure; on iOS it reports success even when the key file was not rewritten, so a GDPR-adjacent UI says "identity rotated" when it did not. Two same-named methods, two meanings, one of them not implementable as specified.
- **Fix sketch**: make `FileKeyValueStore.removeValue`/`write` report failure, thread it through `PersistedDeviceKeyStore.delete() -> Bool` and `AnonymousIdStore.reset() -> Bool`; or change the return type on both platforms to `Void` and stop making a promise neither can keep.
- **Register status**: NEW (S10/3.3 cover consent persistence, not the reset return value).

### F4. iOS: no ObjC surface at all, and the sharing sheet is SwiftUI-only — a UIKit retail app cannot use `FrakSDKUI`
- **Severity**: high
- **Axis**: merchant-setup / parity
- **Complexity to fix**: medium (few days) for a `FrakSharingPresenter`; structural for real ObjC
- **Evidence**:
  - `rg '@objc' sdk/ios/Sources` → three hits, all private implementation details (`Net/HTTPClient.swift:5`, `FrakSDKUI/NativeShare.swift:103`, `FrakSDKUI/SharingWebView.swift:74`) and **zero** on any public declaration.
  - The public surface is structurally un-`@objc`-able anyway: `Frak` is a caseless `enum` (`Frak.swift:10`), `FrakConfig` a struct (`Core/FrakConfig.swift:62`), `FrakError` an enum with associated values (`Core/FrakError.swift:4`), and every call is `async`.
  - Sheet entry point is exactly one thing: `sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:5-30` — `extension View { public func frakSharingSheet(...) -> some View }`. No `UIViewController`-based presenter exists (`rg 'UIViewController' sdk/ios/Sources/FrakSDKUI` → only the private `topViewController()` helper in `NativeShare.swift:71`).
  - Android closed the equivalent gap: `frak-sdk-ui/api/frak-sdk-ui.api:9-10` freezes **both** `build (Landroidx/activity/ComponentActivity;)` and the `@Composable build(Composer;I)`.
- **What actually happens**: My Moulinex (`com.groupeseb.moulinex.food`) on iOS, if UIKit-hosted — which most large retail apps still are — must hand-roll a `UIHostingController` wrapping a dummy `View` with a `@State` binding just to raise the sheet, and get none of the lifecycle guarantees the modifier documents. An ObjC-only module cannot `#import` anything from `FrakSDK`.
- **Fix sketch**: ship `FrakSharingPresenter.present(from: UIViewController, request:onResult:)` on iOS (option C in `08-sharing-sheet-api.md:454`) and state in `sdk/ios/README.md` that ObjC callers need a Swift shim; do not attempt `@objc` on this API shape.
- **Register status**: confirms `docs/plans/native-sdk/07-sharing-sheet-audit.md:635` and `08-sharing-sheet-api.md:454` option C/D — but **absent from `06-open-findings.md` §3.3**, which is the register anyone triaging alpha reads. The ObjC half is filed nowhere.

### F5. Error surface: retry hints in different units per platform, no retryable/fatal axis, and iOS advertises dev strings as user-facing
- **Severity**: high
- **Axis**: correctness / UX
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - Unit divergence: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/FrakError.kt:51-52` `public class BackingOff(public val retryAfterMillis: Long)` vs `sdk/ios/Sources/FrakSDK/Core/FrakError.swift:11` `case backingOff(retryAfter: TimeInterval)` (seconds). Also `Server.retryAfterSeconds: Long?` (`FrakError.kt:66`) vs `server(..., retryAfterSeconds: Int?)` (`FrakError.swift:13`).
  - No retryable/fatal classification anywhere: `Kind` (`FrakError.kt:17-29`, `FrakError.swift:31-41`) is nine flat discriminators; nothing says `network`/`backingOff`/`server(503)` are retryable while `merchantResolutionFailed`/`trackingDisabled` are terminal. A merchant must hardcode that table themselves.
  - `sdk/ios/Sources/FrakSDK/Core/FrakError.swift:58-87` — `extension FrakError: LocalizedError { public var errorDescription: String? }` returning `"Frak backend returned HTTP \(status) (\(code))"`, `"Frak hit an internal error: \(message)"`. In Apple's ecosystem `LocalizedError.errorDescription` *is* the "show this to the user" channel — it is what `error.localizedDescription` and every default alert render.
  - Android's messages are `Exception` messages only (`FrakError.kt:38,45,55,70`), i.e. not advertised as presentable — so the two platforms also disagree on whether these strings are user-facing.
- **What actually happens**: shared retry logic written against `retryAfter` schedules a retry 1000× too early or too late on one platform. And an iOS merchant doing the idiomatic `catch { showAlert(error.localizedDescription) }` shows an end user `"Frak could not resolve a merchant: packageId com.x not registered"` — an internal diagnostic, untranslated, leaking merchant configuration.
- **Fix sketch**: unify on `retryAfterSeconds` (`Double`/`Long`) on both; add `FrakError.isRetryable` (or `Kind.isRetryable`) on both; drop `LocalizedError` conformance (or make `errorDescription` a generic localized string and keep the diagnostic on a separate `debugDescription`).
- **Register status**: NEW. A4/A5 is marked closed and explicitly says the fourth complaint was "answered by not doing it" — that answer covers equality, not units, retryability or `LocalizedError`.

### F6. `heightFraction` throws on Android and clamps on iOS
- **Severity**: medium
- **Axis**: parity / correctness
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/FrakSharing.kt:47-57` — `@throws IllegalArgumentException if [fraction] is outside 0.3..1.0, or is not finite` … `require(...)`.
  - `sdk/ios/Sources/FrakSDKUI/SharingSheetLogic.swift:252-256` + `FrakSharingSheet.swift:13` — *"heightFraction: fraction of screen height, clamped to `0.3...1.0`"*, and a non-finite input silently answers the default.
- **What actually happens**: one shared config value (say a remote-config float that arrives as `0.0`) crashes the Android app in `Builder.heightFraction()` and silently renders a default-height sheet on iOS. The MIN/MAX constants are not even public on Android (`frak-sdk-ui.api:15-19` exposes only `getHEIGHT_FRACTION`), so a merchant cannot pre-validate.
- **Fix sketch**: clamp on both (matching iOS) and log at `warn`; or throw on both. Changing iOS from clamp→throw after publication introduces a crash, so this must be decided pre-alpha.
- **Register status**: NEW.

### F7. `FrakSharing.present()` can do nothing at all, with no callback and no log
- **Severity**: medium
- **Axis**: UX/DX / observability
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:251-254` —
  ```kotlin
  SharingPresentDecision.Ignore -> { return }
  ```
  no `report(...)`, no `logger` call, while the sibling `Refuse` branch does `report(callback, SharingResult.Failed(FrakError.AlreadyPresenting()))` (`:256-258`). Documented only as "No-op if the hosting Activity is finishing, destroyed, or not at least `STARTED`" (`FrakSharing.kt:112-115`). `present()` returns `Unit` (`frak-sdk-ui.api:3`).
- **What actually happens**: a merchant's share button taps into the void — no sheet, no `onResult`, nothing in logcat — and the bug reproduces only in the specific lifecycle window. This is the single hardest support ticket shape in a UI SDK.
- **Fix sketch**: log the ignored presentation at `warn` with the decision reason; consider reporting `SharingResult.Dismissed` so every `present()` has exactly one outcome.
- **Register status**: NEW (9.14 is about the buffered-result replay, a different path).

### F8. The threading contract lives in the README, not on the API, and is inconsistent for `isFrakAppInstalled`
- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: trivial (<1h) for docs; small for the sync/async split
- **Evidence**:
  - The deadlock rule is stated once, in prose: `sdk/android/README.md:134` — *"**Never `get()` or `join()` a twin on the main thread.** … the future never completes — a deterministic ANR, not a race."* Mechanism at `core/DefaultFrakClient.kt:99-107` (`scope.future(mainDispatcher, UNDISPATCHED)`).
  - Of the eighteen public twins, exactly two repeat it in KDoc: `ConfigApi.kt:25` and `Frak.kt:141-143`. The other sixteen say only "`[x]` for Java." — e.g. `TrackingApi.kt:15`, `:26`, `FrakClient.kt:34,48,58,68`, `AppLinkApi.kt:14,23,39`, `RewardsApi.kt:22,25,52,55`, `SharingApi.kt:25`.
  - Sync/async split: `AppLinkApi.kt:18` `public fun isFrakAppInstalled(): Boolean` — non-suspending, and it performs a binder IPC on the caller's thread (`applink/AppLauncher.kt:21-22`, `packageManager.getPackageInfo`). iOS makes the same probe `async` (`AppLinkAPI.swift:20`).
  - `Frak.initialize`'s KDoc says *"Non-blocking, does no I/O, never throws"* (`Frak.kt:49`) — but `Frak.kt:91` evaluates `context.noBackupFilesDir`, which `mkdirs()`/`stat`s on the calling thread (`Application.onCreate`, i.e. cold start). The `SharedPreferences` half genuinely is lazy (`config/KeyValueStore.kt:27-29`), so the claim is 90% true and the KDoc states it as 100%.
- **What actually happens**: a Java merchant hovers `trackAsync`, sees "track for Java", writes `.get()` on a click handler, and ships a deterministic ANR. And an Android merchant calls `isFrakAppInstalled()` on the main thread because the signature invites it, adding a synchronous binder round trip to a tap.
- **Fix sketch**: put one `@param`-level "never `get()`/`join()` on the main thread" line on all eighteen twins; annotate `isFrakAppInstalled` `@WorkerThread` or make it `suspend` with an `*Async` twin (breaking — do it now); soften the `initialize` KDoc.
- **Register status**: partially confirms A7 (which records the threading design as done and correct); the *documentation reach* and the `isFrakAppInstalled` inconsistency are NEW.

### F9. `FrakContext` is a versioned public hierarchy with no discriminator and no unknown arm — on both platforms
- **Severity**: medium
- **Axis**: parity / forward compatibility
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/sharing/FrakContext.kt:8-21` — `public sealed interface FrakContext { class V1 …; class V2 … }`, no `kind`.
  - `sdk/ios/Sources/FrakSDK/Sharing/FrakContext.swift:2-6` — `public enum FrakContext { case v1(wallet: String); case v2(V2) }`, no `kind`.
  - It is handed straight to merchants: `Frak.parseReferralLink(...): FrakContext?` (`frak-sdk.api:25`, `Frak.swift:133,137`).
  - Compare the two hierarchies that *did* get discriminators: `FrakError.Kind` (`FrakError.kt:17`), `SharingResult.Kind` (`SharingResult.swift:16`).
- **What actually happens**: the arms are literally named after wire versions, so a V3 is the expected future. The day it lands, every merchant `when (ctx)` / `switch ctx` fails to compile (or throws `NoWhenBranchMatchedException` for an already-shipped binary). This is the *most* likely hierarchy to gain an arm and the only merchant-facing one with no escape hatch.
- **Fix sketch**: add `FrakContext.Kind` (`v1`/`v2`) with the same `wireValue`/rawValue treatment as `FrakError.Kind`, now, so merchant code written during alpha matches on the discriminator.
- **Register status**: extends A2 — A2 enumerates `FrakError`, `FrakEnvironment`, `RewardTier`, `Interaction`, `SharingResult` and explicitly names `RewardTier` as "the strongest remaining candidate". `FrakContext` is stronger and is missing from that list.

### F10. The iOS README's "Public API surface" table is wrong on most rows and names a type that no longer exists
- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/ios/README.md:45-56` lists as *Public API*: `FrakLogger`, `Base64URL`, `Hex`, `HTTPClient`, `JSONDecoding`, `URLQuery`, `PercentEncoding`, `ConfigStore`, `MerchantQuery`, `KeyValueStore`, `SingleFlight`, `Backoff`, `RewardRepository`, `DeviceKey`, `ProofCodec`, `AnonymousIdStore`, `FrakContextCodec`, `SharingLinkBuilder`, `EventQueue`, `InteractionTracker`, `AppLauncher`, `InstallLinks`, `ReferralArrival`, `DefaultFrakClient`.
  A grep for `public (final )?(struct|class|enum|actor|protocol) <name>` across `sdk/ios/Sources` matches **none** of them except `PercentEncoding` (`Net/PercentEncoding.swift:5`). `InteractionTracker` does not exist at all — it was renamed `EventOutbox` (`Tracking/EventOutbox.swift`), per `06-open-findings.md` 9.4.
  Meanwhile the table omits the entire real surface: `FrakClient`, `ConfigAPI`, `RewardsAPI`, `SharingAPI`, `TrackingAPI`, `AppLinkAPI`, `Campaign`, `BestReward`, `TokenAmount`, `EstimatedReward`, `RewardTier`, `ProductDetails`, `SharingRequest`, `SharingProduct`, `AttributionParams`, `FrakResolvedConfig` (+9 config types), `OpenAppResult`, `SharingResult`, `Interaction`, `FrakSDKVersion`.
- **What actually happens**: the only per-platform API document a merchant has on iOS is unusable. Android has a correct one (`sdk/android/README.md:58-79`).
- **Fix sketch**: replace the table with the actual `public` surface (a `rg '^\s*public ' Sources` pass is the generator) and add the missing setup facts — notably `LSApplicationQueriesSchemes`, which `AppLinkAPI.swift:19` requires for `isFrakAppInstalled()` to ever answer `true` and which appears in `example/native-ios/Info.plist` but nowhere in `sdk/ios/README.md`.
- **Register status**: NEW.

### F11. `Campaign.defaultLockupSeconds` is documented as days
- **Severity**: medium
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/rewards/Rewards.kt:169-170` —
  ```kotlin
  /** Whole days a reward is locked before it can be claimed, when configured. */
  public val defaultLockupSeconds: Double?,
  ```
  The wire value is seconds: `sdk/core/src/rewards/fixtures/golden-rewards.json:1188` `"defaultLockupSeconds": 172800` against `"lockupDurationDays": 2` at `:2052`; `apps/business/.../utils.ts:420` divides by `SECONDS_PER_DAY`. iOS carries the same field with no doc at all (`Rewards.swift:64`).
- **What actually happens**: a merchant renders "locked for 172800 days" in a campaign detail screen. The sibling field on the sibling type (`BestReward.lockupDurationDays`, `Rewards.kt:216`) genuinely *is* days, which makes the mistake maximally easy.
- **Fix sketch**: fix the KDoc; add the same one-liner to iOS.
- **Register status**: NEW.

### F12. `tracking.purchase(String, String, String)` — three unlabeled Strings on the revenue path
- **Severity**: medium
- **Axis**: correctness / DX
- **Complexity to fix**: small (<1d), breaking after publish
- **Evidence**: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/TrackingApi.kt:20-24,27-31`; frozen at `frak-sdk.api:82-83` as `purchase (Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;...)`. iOS labels them (`TrackingAPI.swift:14`) so only Android is exposed.
- **What actually happens**: from Java (the audience the twins exist for) `purchaseAsync(orderId, customerId, token)` compiles, sends a transposed payload, and either 4xx's silently into the queue or attributes the purchase to the wrong customer. Every other multi-field input in this SDK got a Builder in step 2/4; this one did not.
- **Fix sketch**: `purchase(PurchaseEvent)` with a Builder, matching the `RewardRequest`/`SharingRequest` precedent — before the dump publishes.
- **Register status**: NEW (A3's Builder sweep covered constructors, not this method).

### F13. No merchant observability: no correlation id, no delivery signal, no debug mode
- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: medium (few days)
- **Evidence**:
  - Only one SDK header is sent on either platform: `net/HttpClient.kt:167-169` (`Accept`, `x-frak-sdk-version`) and `Net/HTTPClient.swift:280`. No request id, no session id.
  - `track` succeeds "once durable, not once delivered" (`TrackingApi.kt:12`, `TrackingAPI.swift:8`); nothing public reports the queue depth, the last drain outcome, or a per-event delivery result. `DeliveryOutcome` is internal on both (`tracking/DeliveryOutcome.kt`, `Tracking/DeliveryOutcome.swift`, neither `public`).
  - The whole diagnostic surface is `FrakLogLevel`+`FrakLogSink` (`core/FrakConfig.kt:21-37`, `Core/FrakLogger.swift:11-13`), which is unstructured text.
- **What actually happens**: the first alpha support ticket is "we fired 40 purchases in staging and see 12 in the dashboard". With no correlation id and no delivery signal, neither the merchant nor Frak can answer it from the client side at all.
- **Fix sketch (for alpha)**: (1) send a per-request `x-frak-request-id` UUID and include it in the `FrakError.Server` payload so a merchant can quote it; (2) add `client.tracking.pendingCount` (or a `FrakDiagnostics` snapshot: queue depth, last drain time, last error kind); (3) make `anonymousId` prominent in the README as the support handle it already is.
- **Register status**: NEW (D3/D4 covers transport injection for *tests*, not runtime observability).

### F14. Equality/`Hashable` split — completing register 9.9's list
- **Severity**: low
- **Axis**: parity
- **Complexity to fix**: trivial (<1h) per type, **breaking-ish after publish** (behaviour change under an unchanged descriptor)
- **Evidence** (from the frozen dump + iOS sources). iOS types are `Hashable`; Android column is what `frak-sdk.api`/`frak-sdk-ui.api` actually declares:

  | Type | Android `equals`/`hashCode` | iOS |
  |---|---|---|
  | `FrakConfig` | **no** (`frak-sdk.api:180-189`) | `Hashable`, hand-written `==` excluding `logSink` (`Core/FrakConfig.swift:62,120-134`) |
  | `FrakMetadata` | **no** (`:255-261`) | `Hashable` (`Core/FrakConfig.swift:38`) |
  | `SharingRequest` | **no** (`:635-642`) | `Hashable` (`Sharing/SharingRequest.swift:59`) |
  | `SharingProduct` | **no** (`:604-610`) | `Hashable` (`Sharing/SharingRequest.swift:33`) |
  | `FrakEnvironment.Custom` | **no** (`:212-218`) | `Hashable` via the enum (`Core/FrakEnvironment.swift:4`) |
  | `FrakResult.Success`/`Failure` | **no** (`:280-287`) | n/a (stdlib `Result`, and `FrakError` is not `Equatable` either) |
  | `OpenAppResult` | enum ⇒ identity (`:54-61`) | `Hashable` (`FrakClient.swift:94`) |
  | `SharingResult.Copied`/`Shared` | **no** (`frak-sdk-ui.api:26,68`) | not `Hashable` either (`SharingResult.swift:4`) — the one honest match |
  | `ProductDetails`, `AttributionParams`, `RewardRequest`, `Interaction`, all rewards + config read models, `FrakContext.V1/V2` | yes | yes |
- **What actually happens**: `FrakConfig.Builder("m").build() == FrakConfig.Builder("m").build()` is `false` on Android and `true` on iOS. Merchant test assertions and `distinctUntilChanged`-style caching behave differently per platform. `FrakError` is comparable on neither, so a merchant's unit test cannot assert which error it got without matching on `kind`.
- **Fix sketch**: add structural `equals`/`hashCode` to the five Android types above before the dump publishes (adding it after is a silent behaviour change the ABI gate will not flag).
- **Register status**: confirms 9.9, and completes its list — 9.9 names four types (`FrakConfig`, `FrakMetadata`, `SharingProduct`, `SharingRequest`); `FrakEnvironment.Custom`, `FrakResult.Success/Failure` and `OpenAppResult` are also in the split and unlisted.

### F15. Small docs/API lies a merchant will hit in the first hour
- **Severity**: low
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/FrakClient.kt:74` — *"Config resolution **and its live stream**."* Android's `ConfigApi` has neither `current` nor `updates` (`ConfigApi.kt:14-31`, `frak-sdk.api:11-16`). The removal was deliberate (9.17); the doc was not updated.
  - `Frak.kt:186-189` — a runtime `logger.error` telling the merchant to *"call handleReferralLink from your own router"*. No such public method exists; it is `client.appLink.handleReferral(url)` (`AppLinkApi.kt:12`). `handleReferralLink` is the internal name (`Frak.kt:194`).
  - `Frak.kt:49` "does no I/O" vs `Frak.kt:91` `context.noBackupFilesDir` (see F8).
  - `Frak.parseReferralLink` takes `String` only (`frak-sdk.api:25`); iOS takes `String` **and** `URL` (`Frak.swift:133,137`). On Android the merchant always holds an `android.net.Uri`; there is no `Uri` overload on `parseReferralLink` or `handleReferral`. Additive, so not urgent — but it is the very first line of integration code.
  - `FrakSdkVersion.HEADER_NAME`/`QUERY_PARAMETER_NAME` are `public` in bytecode and merely filtered out of the dump by `nonPublicMarkers` (`sdk/android/build.gradle.kts:18`), so `@InternalFrakApi` restrains Kotlin callers only — a Java merchant reaches them with no opt-in and no warning. The `.api` file therefore is **not** a complete statement of the public surface.
- **Register status**: NEW.

### F16. Frozen-forever API noise on the Android Builders
- **Severity**: low (nit-adjacent, but permanent)
- **Axis**: UX/DX / build-release
- **Complexity to fix**: trivial now, impossible later
- **Evidence**: every Builder publishes **both** a `public var` (hence `getX`/`setX`) and a fluent `x(...)`: `core/FrakConfig.kt:127-157` → `frak-sdk.api:191-220` shows `getMerchantId`, `setMerchantId`, and `merchantId(...)` all three. Same for `FrakMetadata.Builder`, `ProductDetails.Builder`, `SharingRequest.Builder`, `AttributionParams.Builder`, `RewardRequest.Builder`. The `var`s exist only so the Kotlin DSL (`FrakConfig(configure:)`, `core/FrakConfig.kt:196`) has a receiver.
  Related: `FrakLogSink` is a `fun interface` on Android (SAM-convertible from a lambda, `core/FrakConfig.kt:30`) but a `Sendable` protocol on iOS (`Core/FrakLogger.swift:11`) — an iOS merchant must declare a `Sendable` conforming type just to forward lines to their existing logger, under Swift 6 strict concurrency.
- **What actually happens**: Java autocomplete on `FrakConfig.Builder` shows three ways to set every field, two of which return `void`. Permanent from the first artifact.
- **Fix sketch**: make the Builder `var`s `@JvmSynthetic` or `internal` with an internal DSL receiver; add a closure-based `FrakLogSink` convenience on iOS.
- **Register status**: partially confirms Q4 (the throwing-sink half); the dual mutation surface is NEW.

---

## Breaking changes that must land before the first published artifact

Ranked by cost-of-delay. Everything here is cheap today and either impossible or expensive after `id.frak.sdk:core` 0.0.1 and the SwiftPM `ios-v*` tag exist.

1. **Port `RewardRequest` to iOS and delete `best`'s loose parameter list** (F1). After alpha this is a source break on every iOS merchant. It is also the single biggest driver of "two SDKs, one product" documentation cost.
2. **Make the Android rewards read models' constructors `internal`** (F2): `TokenAmount`, `RewardTier.Amount/Percentage`, `EstimatedReward.Fixed/Percentage/Tiered/Unknown`, `Campaign`, `BestReward`. Removing a public constructor post-publish is a hard binary break; keeping them means every new backend field is one.
3. **Unify the retry unit** (F5): `retryAfterMillis: Long` (Android) vs `retryAfter: TimeInterval` (iOS), and `Long?` vs `Int?` for `Server.retryAfterSeconds`. Renaming a frozen getter on Android is a break; leaving it is a permanent 1000× trap.
4. **Add `FrakError.isRetryable` and `FrakContext.Kind`** (F5, F9). Both are technically additive, but they must exist *before* merchants write their `when`/`switch` — after that, the merchant code you break is already in an app-store binary.
5. **Replace `tracking.purchase(String, String, String)` with a request object** (F12). A frozen 3-String signature on the revenue path is the one API here whose misuse is silent and monetarily meaningful.
6. **Decide `heightFraction`: clamp or throw, both platforms** (F6). iOS clamp→throw later introduces a crash; Android throw→clamp later changes documented behaviour.
7. **Add structural `equals`/`hashCode` to `FrakConfig`, `FrakMetadata`, `SharingRequest`, `SharingProduct`, `FrakEnvironment.Custom`** (F14). Adding equality later changes behaviour under an unchanged ABI descriptor — the gate cannot catch it and merchant collections silently change semantics.
8. **Hide the Builder `var`s behind `@JvmSynthetic`** (F16). Purely cosmetic, and permanently un-fixable once frozen.
9. **Make `isFrakAppInstalled()` `suspend` + `*Async` on Android** (F8), matching iOS and getting the binder IPC off the caller's thread. Changing a non-suspending public method to suspending is a hard break later.
10. **Not breaking, but must ship with the alpha**: a UIKit presenter on iOS (F4) and a correlation id (F13). Both are additive, so they can follow — but the first merchant is the one who needs them.

---

## Verified-OK

- The Android `.api` dumps match the Kotlin sources everywhere I cross-checked (`FrakClient`, the five `*Api` namespaces, `FrakConfig`, `FrakError`, `Rewards`, `SharingRequest`, `Interaction`, `frak-sdk-ui`). No stale entries found.
- `@JvmStatic` coverage is correct and complete on the entry points that need it: `Frak.initialize/client/clientOrNull/isInitialized/parseReferralLink/shutdownAsync` (`Frak.kt:50,145,156,161,166,171`), `Interaction`'s seven factories (`Interaction.kt:36,53,57,65,75,…`), `FrakSdkVersion.CURRENT` as a `val` not a `const` (`FrakSdkVersion.kt:9-10` — correctly avoids inlining the merchant's compile-time version).
- No Kotlin default argument reaches the dump: no `$default` synthetic bridge appears anywhere in `frak-sdk.api`/`frak-sdk-ui.api`. A3 step 4's claim holds.
- `FrakEnvironment` is a `sealed interface` on Android (`core/FrakEnvironment.kt:4`), so merchants cannot implement it and break future additions — matching iOS's enum.
- `FrakError.Kind` and `SharingResult.Kind` wire strings are spelled identically across platforms (`FrakError.kt:20-28` vs `FrakError.swift:32-40`; `SharingResult.Kind` both sides) — telemetry does aggregate as claimed.
- `FrakSharing.ResultCallback` is a `fun interface` annotated `@MainThread` (`FrakSharing.kt:31-34`) and appears as a SAM interface in the dump (`frak-sdk-ui.api:15-17`). Java lambda ergonomics are genuinely delivered, and `JavaCallSiteFixture.java` / `FrakSdkJavaCallSiteFixture.java` compile-test it.
- The `*Async` twins do complete on the main thread through one funnel (`DefaultFrakClient.kt:104-107` + `core/MainThreadDispatcher.kt`), and `Frak.shutdownAsync` correctly uses a separate scope (`Frak.kt:146-153`).
- `CustomOrigin`'s allowlist is byte-for-byte equivalent across the two platforms (`core/FrakEnvironment.kt:72-134` vs `Core/FrakEnvironment.swift:72-123`), including the `10.0.2.2`/`10.0.3.2` emulator hosts.
- `FrakConfig`/`FrakResolvedConfig` nullability is consistent across platforms (Android `lang`/`currency` are `?` in source — the `.api` dump simply does not record nullability, so this is a gate blind spot, not a divergence).
- `Interaction` is opaque on both platforms with matching factory sets (`Interaction.kt:30-90` vs `Interaction.swift:18-46`). 9.8 is genuinely closed.
- `FrakClient` is a final class with namespaces on both, not a protocol — the stated additive-forever choice (`FrakClient.swift:5-13`, `FrakClient.kt:25`) holds.

## Could not verify

- Whether `apiCheck` actually passes at this commit (no JDK; I read the committed dump and the sources, not a build).
- Whether iOS compiles under Swift 6 strict concurrency as claimed (no toolchain). In particular the `Sendable` requirement on `FrakLogSink` and the ergonomics cost to a merchant wrapping an existing logger is read, not compiled.
- Whether `context.noBackupFilesDir` measurably costs anything on a real cold start (F8) — it is a `mkdirs`/`stat` by inspection of the Android framework contract, not a measurement.
- Whether an ObjC-only consumer *definitely* cannot see anything (F4) — this rests on there being no `@objc` on any public declaration plus the enum/struct/async shapes, not on an attempted ObjC import.
- Whether `FileKeyValueStore.write` failure is reachable in practice (F3) — the swallowed-failure path is read from source; no fault-injection test exists (`rg` finds no test asserting a failed write).
- The `example/native-{android,ios}` harnesses were only skimmed; I did not verify that every public entry point has a call site there.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "16 findings written to /tmp/frak-audit/public-api-ergonomics.md, each with severity, axis, complexity, path:line evidence, concrete failure mode, fix sketch and register cross-reference; plus a ranked 10-item pre-publish breaking-change list, a Verified-OK section and a Could-not-verify section."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "cat sdk/android/frak-sdk/api/frak-sdk.api; cat sdk/android/frak-sdk-ui/api/frak-sdk-ui.api",
      "result": "passed",
      "summary": "Read the frozen ABI dumps line by line (758 + 73 lines)."
    },
    {
      "command": "rg -n '^\\s*(@[A-Za-z@() .]*\\s*)?(public|open)\\s' sdk/ios/Sources --glob '*.swift'",
      "result": "passed",
      "summary": "Enumerated every public declaration in FrakSDK and FrakSDKUI for the side-by-side."
    },
    {
      "command": "rg -n '@objc' sdk/ios/Sources",
      "result": "passed",
      "summary": "Three hits, all private implementation details; zero on any public declaration."
    },
    {
      "command": "rg -c 'public (final )?(struct|class|enum|actor|protocol) <T>' sdk/ios/Sources for 18 README-claimed types",
      "result": "passed",
      "summary": "None of the 18 types the iOS README lists as Public API are public; InteractionTracker no longer exists."
    },
    {
      "command": "rg -n 'defaultLockup|lockupDuration' (repo-wide, excluding native)",
      "result": "passed",
      "summary": "golden-rewards.json 172800 vs lockupDurationDays 2 confirms defaultLockupSeconds is seconds, not days as the KDoc claims."
    }
  ],
  "validationOutput": [
    "Read-only audit: no repo file was modified; the only file written is /tmp/frak-audit/public-api-ergonomics.md.",
    "Register cross-check: F1 confirms 9.15; F4 confirms 07/08 option C but is absent from the 06 register; F8 partially confirms A7; F9 extends A2's hierarchy list; F14 confirms and completes 9.9; F16 partially confirms Q4. F2, F3, F5, F6, F7, F10, F11, F12, F13, F15 are NEW.",
    "Overstated-in-register calls: A3/D7 claims the read-model constructor sweep is complete — it covered config/ and sharing/ only, rewards/ still publishes 9 public constructors (F2). A4/A5 is marked closed but leaves retry-unit divergence, no retryability axis and LocalizedError untouched (F5)."
  ],
  "residualRisks": [
    "No toolchain available: apiCheck, swift build and Swift 6 strict-concurrency claims were not executed, only read.",
    "The .api dump does not record Kotlin nullability and filters @InternalFrakApi members, so it is not a complete statement of the Android public surface (F15) — some divergences are invisible to the ABI gate by construction.",
    "Findings about runtime behaviour reached through the API (FileKeyValueStore write failure in F3, noBackupFilesDir I/O in F8) rest on source reading and platform contracts, not on execution.",
    "example/native-{android,ios} harnesses were skimmed, not audited; a public entry point with no harness call site may exist."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repo changes. One artifact written: /tmp/frak-audit/public-api-ergonomics.md.",
  "reviewFindings": [
    "high: sdk/ios/Sources/FrakSDK/RewardsAPI.swift:26 vs sdk/android/.../RewardsApi.kt:40 - rewards.best has a different call-site shape per platform; RewardRequest exists only on Android (F1)",
    "high: sdk/android/frak-sdk/api/frak-sdk.api:298,313,345,414,435 - rewards read models publish constructors into the frozen ABI, contradicting the A3/D7 internal-constructor policy applied to config/ and sharing/ (F2)",
    "high: sdk/ios/Sources/FrakSDK/Identity/AnonymousIdStore.swift:100-110 + Config/FileKeyValueStore.swift:54-70 - resetAnonymousId() returns true unconditionally while the underlying delete can silently fail; its documented cross-platform Boolean contract is unimplementable on iOS (F3)",
    "high: sdk/ios/Sources/FrakSDKUI/FrakSharingSheet.swift:5-30 - sharing sheet is a SwiftUI View modifier only, and no public declaration in the package is @objc; UIKit/ObjC merchants are locked out (F4)",
    "high: sdk/android/.../core/FrakError.kt:51-52 vs sdk/ios/.../Core/FrakError.swift:11 - retry hint is milliseconds on Android, seconds on iOS; no retryable/fatal axis; iOS LocalizedError advertises raw diagnostics as user-facing (F5)",
    "medium: sdk/android/frak-sdk-ui/.../FrakSharing.kt:47-57 vs sdk/ios/.../SharingSheetLogic.swift:252-256 - heightFraction throws on Android, clamps on iOS (F6)",
    "medium: sdk/android/frak-sdk-ui/.../SharingHost.kt:251-254 - present() silently returns with no callback and no log (F7)",
    "medium: sdk/android/README.md:134 vs 16 of 18 *Async KDocs - the get()/join() ANR rule is documented only in the README; isFrakAppInstalled is sync on Android and async on iOS (F8)",
    "medium: sdk/android/.../sharing/FrakContext.kt:8 and sdk/ios/.../Sharing/FrakContext.swift:2 - versioned public hierarchy with no Kind discriminator and no unknown arm (F9)",
    "medium: sdk/ios/README.md:45-56 - the Public API surface table is wrong on ~15 of 20 rows and names the deleted type InteractionTracker (F10)",
    "medium: sdk/android/.../rewards/Rewards.kt:169-170 - defaultLockupSeconds documented as 'whole days'; wire value is seconds (F11)",
    "medium: sdk/android/.../TrackingApi.kt:20-31 - purchase takes three unlabeled Strings on the revenue path, frozen at frak-sdk.api:82 (F12)",
    "medium: sdk/android/.../net/HttpClient.kt:167-169, sdk/ios/.../Net/HTTPClient.swift:280 - no correlation id, no delivery signal, no queue-depth accessor (F13)",
    "low: frak-sdk.api:180,255,604,635,212,280 vs iOS Hashable conformances - equality split across 8 types, wider than register 9.9 records (F14)",
    "low: sdk/android/.../FrakClient.kt:74, Frak.kt:49,91,186-189 - doc claims a config live stream Android does not have, names a nonexistent method handleReferralLink, and asserts no I/O while touching noBackupFilesDir (F15)",
    "low: sdk/android/.../core/FrakConfig.kt:127-157 -> frak-sdk.api:191-220 - Builders freeze both getX/setX and fluent x() into the ABI permanently (F16)"
  ],
  "manualNotes": "Two register entries are overstated and worth correcting in docs/plans/native-sdk/06-open-findings.md: A3/D7's read-model constructor sweep never reached rewards/ (9 public constructors still in the dump), and A4/A5 is marked closed while the retry-unit divergence, the missing retryable/fatal axis and iOS's LocalizedError conformance are all still open. 9.17 (Android deliberately has no ConfigApi.updates/current) is correct, but FrakClient.kt:74's KDoc still advertises the removed stream. The most decision-shaped item for the parent: F1, F2, F3, F5, F6, F12 and F14 are all cheap today and either impossible or expensive the day after the first artifact publishes."
}
```
