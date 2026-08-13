# Round-3 review — `74e43c4c3` (breaking SDK commit) and `1cdf7aa99` (ktlint)

Scope: audit §2.1 (install-proof leak), §2.3 (warm-start referrals), §4 row 1 (reward read-model ABI),
and the ktlint `no-unused-imports` commit. Branch read at `review/alpha-fixes` (tip `388b8c5b3`);
diffs against `6cd61d665` and `f1dc693`. No JDK/Swift toolchain — everything below is read from source,
plus two things I could actually execute: the repo's own comment-budget linter and an independent
unused-import scan of every `.kt`/`.kts` under `sdk/android` and `example/native-android`.

## Verdict

The Android half of all three rows genuinely lands, and the ABI change is the cleanest work on the branch:
exactly the nine reward constructors leave `frak-sdk.api`, the source annotations match the dump 1:1, and
nothing else moved. The `!` is real and it is free — nothing is published, `frak.sdk.version=0.0.1`.
§2.1 on Android is correct and complete: the wallet rung is package-pinned, the store rung deliberately is
not, and the `ActivityNotFoundException` fallback still works because `runCatching` swallows it.
§2.3 is fixed for the documented integration path only. Two things stop it being a full close: the
listener is subscribed **only** from `onActivityCreated`, so any merchant who calls `Frak.initialize`
from an Activity rather than `Application.onCreate` reproduces the original bug in silence (N1); and the
`compileOnly(androidx.core)` that buys the zero-dependency POM breaks R8 for exactly the androidx-free
merchant the fallback was written for (N2). The commit's own claim — "an app without androidx at all
falls back" — is false under minification.
iOS is where the commit message oversells: §2.1's iOS half was not touched at all by this commit (the
universal-link rung predates it), and the reward-ABI twin closes 3 of 9 equivalents, because two of the
five iOS reward types are enums whose cases cannot be `@_spi`'d. `12-alpha-audit-response.md:368` calls
that "to match"; it does not match.
The ktlint commit is correct, useful, and honest, and it retro-explains §3.8a — but it leaves the
merchant-facing README stating the exact opposite of the ABI policy the same branch just shipped (N4).

## Fixes that land

- **§2.1 (Android)** — implicit `ACTION_VIEW` for the wallet handoff is now package-pinned; store rung left unpinned on purpose → `applink/AppLauncher.kt:40`, `core/DefaultFrakClient.kt:339` (pinned) vs `:344` (store, unpinned).
- **§2.1 (Android), fallback intact** — `startActivity` still wrapped in `runCatching`, so `ActivityNotFoundException` from a pin that matches nothing returns `false` and falls through to the store → `applink/AppLauncher.kt:41`.
- **§2.1, `OpenedApp` honesty** — `OpenAppResult.OpenedApp` can now only be returned when a component **inside the wallet package** accepted the intent → `core/DefaultFrakClient.kt:339-341`.
- **§2.1, dev/prod pairing** — pinning uses `settings.env.walletPackageId`, which pairs with `walletScheme` per environment (`id.frak.wallet`/`frakwallet` vs `id.frak.wallet.dev`/`frakwallet-dev`), and both ids are already in `<queries>` → `core/FrakEnvironment.kt:12,14,19-20,68-69`, `frak-sdk/src/main/AndroidManifest.xml:16-19`.
- **§2.3** — `DeepLinkObserver` subscribes to `OnNewIntentProvider` and consumes the intent the callback hands it, instead of re-reading the stale `activity.intent` → `applink/DeepLinkObserver.kt:28,38-50,52-64`.
- **§2.3, dedupe across both paths** — the identity-keyed `handled` WeakHashMap is checked in `consumeIntent`, which is the single funnel for both the listener and the `activity.intent` read, so `setIntent` + `onResume` cannot re-track → `applink/DeepLinkObserver.kt:54-64,88`.
- **§2.3, no Activity leak** — the `Consumer` captures the observer, not the activity; the map is keyed weakly on the activity and the listener is removed on destroy → `applink/DeepLinkObserver.kt:47-49,77-80,91`.
- **§2.3, harness stops manufacturing confidence** — `onNewIntent` now calls `setIntent` and logs `INFO` "reached the activity" + "check Debug info", instead of `SUCCESS` "SDK auto-handles it" → `example/native-android/.../MainActivity.kt:237-252`.
- **§4 row 1 (Android)** — all nine reward read-model constructors carry `@InternalFrakApi public constructor` → `rewards/Rewards.kt:8,43,67,94,110,141,159,177,229`; `@Target` gains `CONSTRUCTOR` → `InternalFrakApi.kt:17-22`; decoder opts in → `rewards/RewardsDecoder.kt:1`.
- **§4 row 1, dump complete and consistent** — exactly the nine `<init>` lines at `6cd61d665:frak-sdk.api:471,485,503,511,522,531,581,591,601` are gone and nothing else moved; the only `<init>` left in `rewards/` is `RewardRequest$Builder.<init>()`, which is a merchant *input* type and must stay → `frak-sdk/api/frak-sdk.api:470-601`.
- **§4 row 3 (partly)** — every iOS `backingOff` call site renamed to `retryAfterSeconds:`, no stragglers anywhere in `sdk/ios`/`example/native-ios` → `Core/FrakError.swift:11,65`, `Config/ConfigStore.swift:152`, `Rewards/RewardRepository.swift:72`, tests at `FrakErrorTests.swift:11`, `RewardRepositoryTests.swift:369,404`, `SharingSheetLogicTests.swift:410`.
- **§3.5** — `SharingWebViewPool.warm` now guards `!lent` → `Sources/FrakSDKUI/SharingWebViewPool.swift:44`.
- **1cdf7aa99** — `ktlint_standard_no-unused-imports = enabled` in both editorconfigs, inside the `[*.{kt,kts}]` section of files that are the ktlint roots for their trees → `sdk/android/.editorconfig:33`, `example/native-android/.editorconfig:24`; two genuine unused imports removed (`DefaultFrakClientTest.kt`, `HttpClientTest.kt`).

## Fixes that DO NOT fully land

### P1. §2.3 — the listener is only ever attached in `onActivityCreated`

- **Claimed in** commit body: "Now it subscribes to `OnNewIntentProvider`, which every `ComponentActivity` implements"; `12-alpha-audit-response.md:363`.
- **Reality** `applink/DeepLinkObserver.kt:24-30` calls `subscribeToNewIntents` from `onActivityCreated` only; `onActivityResumed` (`:32`) calls `consume` and never subscribes. `Application.dispatchActivityCreated` fires **inside** `super.onCreate()`, so a merchant who calls `Frak.initialize(...)` from `MainActivity.onCreate` (after `super.onCreate`) registers the lifecycle callbacks *after* that activity's `onActivityCreated` has already been dispatched — `Frak.kt:120-124`. That activity never gets a listener, for the life of the process, and falls straight back to the stale `activity.intent` read: the original §2.3 bug, silently.
- **Residual severity** Medium. Blast radius is the merchant who ignores `Frak.kt:32` ("Call [initialize] once from `Application.onCreate`") — a common shortcut, and the one integration mistake that costs referral attribution rather than throwing. Partly masked by `sdk/android/README.md:40`, which still tells merchants to call `setIntent` themselves, so a merchant who reads both docs is fine.
- **What to do** One line: call `subscribeToNewIntents(activity)` from `onActivityResumed` too. The `listeners.containsKey` guard at `:39` already makes it idempotent, and `DeepLinkObserverTest`'s fourth case already asserts single-registration.

### P2. §4 row 1 — the iOS twin closes 3 of 9, and "to match" is not what happened

- **Claimed in** commit body: "iOS's three initialisers become `@_spi(FrakInternal)`"; `12-alpha-audit-response.md:368` — "iOS's three initialisers got `@_spi(FrakInternal)` **to match**".
- **Reality** `Rewards.swift:12,69,111` mark `TokenAmount`, `Campaign`, `BestReward`. `RewardTier` (`:24-25`) and `EstimatedReward` (`:45-46`) are public **enums**: their cases are their constructors and cannot carry `@_spi`. Android closed six constructors on exactly those two families (`Rewards.kt:43,67,94,110,141,159`). So the hazard the row names — "any new backend reward field is a merchant-breaking change forever" — is closed on Android and still open on iOS for the two tier/payout hierarchies. `RewardModelConstructionTests.swift:13-14` builds `RewardTier.amount`/`EstimatedReward.fixed` through the SPI import, which reads as coverage but proves nothing: those two lines compile with a plain import too.
- **Residual severity** Medium (irreversibility class — this is the row that says "cheap today, impossible later"). Note the structural asymmetry is real: adding an enum case *or* a payload field on iOS is a source break regardless of SPI, so the honest statement is "iOS cannot close this the same way", not "matched".
- **What to do** Either say so in `12-*.md:368` and in the iOS README, or make the two hierarchies structs with SPI inits + `@_spi` factories, which is the only shape that actually closes it.

### P3. §4 row 1 — the "break" is source-level and advisory on both platforms; the bytecode is unchanged

- **Claimed in** the `BREAKING CHANGE:` trailer.
- **Reality** `@InternalFrakApi` is `@RequiresOptIn` + `BINARY` retention (`InternalFrakApi.kt:8-12`). The constructors remain `public` JVM methods; only the BCV dump loses them. So: Kotlin merchants get a compile error, **Java merchants get nothing** — `sdk/android/README.md:114` already records that javac is never told — and reflection still reaches them. `@_spi` on iOS is the same shape: any client can write `@_spi(FrakInternal) import FrakSDK`.
- **Residual severity** Low-medium. It is the right call and the audit only asked for the dump; but "the constructors leave the frozen surface" is not "merchants can no longer build one", and the future field addition that this unlocks will still be a hard break for a Java consumer who built one.
- **What to do** One sentence in the Android README's binary-compatibility section stating the javac gap for reward models specifically (the `RestrictTo` option is already considered and rejected at `09-android-api-surface.md:742-744`).

### P4. §4 row 3 — renamed, not unified

- **Claimed in** commit body one-liners; `12-*.md:365` ("the real finding was internal").
- **Reality** `Core/FrakError.swift:11` is `backingOff(retryAfterSeconds: TimeInterval)`; Android is still `BackingOff(retryAfterMillis)` (`frak-sdk.api:313` `getRetryAfterMillis ()J`). The rename fixes iOS's disagreement with its own `server(retryAfterSeconds:)`, which is a genuine improvement, but the cross-platform unit divergence the audit filed is untouched and now *more* explicitly baked in.
- **Residual severity** Low, but it is an ABI row: free now, impossible after the first tag.
- **What to do** Decide the unit once (seconds reads better on both) and change Android's accessor while nothing is published; or record the divergence as accepted in §4 with a reason.

### P5. §2.1 iOS half — untouched by this commit, and the scheme rung can still leak

- **Claimed in** the commit subject ("pin the wallet handoff"), which does not scope itself to Android.
- **Reality** `git diff f1dc693 review/alpha-fixes -- sdk/ios/Sources/FrakSDK/AppLink/AppLauncher.swift` is empty; `DefaultFrakClient.swift:406-435` already put `openUniversalLink` ahead of the scheme before this branch (the audit's own §9 delta row records that). The scheme rung at `:430-433` still fires `UIApplication.open("frakwallet://install?...&p=<proof>")`, which iOS cannot target at a bundle id — reachable whenever universal links are disabled for the domain, or the AASA has not propagated. The comment at `:412-413` explains the rung as a recovery path and never names the hijack.
- **Residual severity** Low-medium (narrower than Android's was, since the universal link wins first).
- **What to do** Nothing code-wise is cheap here; say plainly in the iOS README/§2.1 row that the scheme fallback is a residual proof-disclosure path, so it is not re-discovered as new.

### P6. §2.1 — a `FrakEnvironment.Custom` wallet package id is not in `<queries>`

- **Reality** `FrakEnvironment.Custom`'s four-arg constructor takes an arbitrary `walletPackageId` (`FrakEnvironment.kt:47-56`), but the SDK manifest hard-codes only the two Frak ids (`AndroidManifest.xml:16-19`). On API 30+ the pinned launch to an invisible package resolves to nothing, so a QA/dev setup pointing at a custom wallet build now silently degrades to the Play Store rung (which then also builds a Play URL for that custom package id, `InstallLinks.kt:44`).
- **Residual severity** Low — dev/QA path only, and `isInstalled` was already filtered the same way.
- **What to do** Log at `debug` when a pinned open fails, so the store fallback is not silent.

### P7. §4 row 2 — still open, and this was the commit to do it in

`RewardsAPI.swift:26-31` still takes four defaulted parameters where Android takes a `RewardRequest`
(`frak-sdk.api` `RewardsApi.best`). Not claimed by this commit, but it is the ABI row on the same
read path in the same file family; it stays free only until the first tag.

## NEW defects introduced

### N1. `Frak.initialize` from an Activity ⇒ the warm-start listener is never attached

- **Severity** Medium · **Axis** correctness / silent attribution loss · **Complexity** trivial (1 line)
- **Introduced by** `74e43c4c3`
- **Evidence** `applink/DeepLinkObserver.kt:24-30` (subscribe only in `onActivityCreated`), `:32` (resume path does not subscribe), `Frak.kt:120-124` (callbacks registered during `initialize`), `Frak.kt:32` (docs say `Application.onCreate`).
- **What actually happens** `Activity.onCreate` dispatches `onActivityCreated` at the end of `super.onCreate`. A merchant calling `Frak.initialize` after `super.onCreate` in their launcher Activity registers the callbacks too late for that Activity, so it never receives an `OnNewIntentProvider` subscription; every warm-start referral on it is read from the stale launch intent, exactly as before the fix. `DeepLinkObserverTest` cannot see this — it calls `observer.onActivityCreated(activity, null)` directly (`DeepLinkObserverTest.kt:50,62,76,87`).
- **Fix sketch** `override fun onActivityResumed(activity: Activity) { subscribeToNewIntents(activity); consume(activity) }` — the `containsKey` guard at `:39` keeps it idempotent. Add a test that resumes an activity the observer never saw created.

### N2. `compileOnly(androidx.core)` with an empty `consumer-rules.pro` breaks R8 for the androidx-free merchant

- **Severity** Medium · **Axis** build/integration · **Complexity** trivial (1 line)
- **Introduced by** `74e43c4c3`
- **Evidence** `frak-sdk/build.gradle.kts:33-36` (`compileOnly(libs.androidx.core)`), `applink/DeepLinkObserver.kt:7-8,42,47,49,79` (hard references to `androidx.core.app.OnNewIntentProvider` and `androidx.core.util.Consumer`), `frak-sdk/consumer-rules.pro` (23 lines, all comment, no `-dontwarn`, and an explicit rule against adding blanket keeps).
- **What actually happens** The AAR ships bytecode referencing two classes that are, by design, absent from a merchant with no androidx. Since AGP 8, R8 **fails the release build** on missing classes ("Missing class ... referenced from ...", plus a generated `missing_rules.txt`) unless a `-dontwarn` is supplied. The code comment at `:35-36` promises "a merchant with no androidx at all keeps a working SDK"; under minification they cannot build at all. The harness cannot catch it — `example/native-android` pulls androidx.core transitively via `androidx.activity` (`frak-sdk-ui/build.gradle.kts:55`), and CI never builds the harness anyway (see N6).
- **Fix sketch** Add `-dontwarn androidx.core.app.OnNewIntentProvider` and `-dontwarn androidx.core.util.Consumer` to `frak-sdk/consumer-rules.pro` (two targeted lines, not a keep rule — the file's own rule of thumb allows this). The runtime `NoClassDefFoundError` catch at `:43` is then genuinely reachable.

### N3. `Frak.shutdown()` leaves stale `onNewIntent` listeners attached, and re-`initialize` double-tracks

- **Severity** Medium-low · **Axis** correctness / lifecycle · **Complexity** small
- **Introduced by** `74e43c4c3`
- **Evidence** `Frak.kt:134-147` (shutdown unregisters `ActivityLifecycleCallbacks` only), `applink/DeepLinkObserver.kt:77-80` (listeners removed **only** on `onActivityDestroyed`), `Frak.kt:203` (the observer's lambda reads `session` at call time, so a dead observer dispatches into a *live* session).
- **What actually happens** After `shutdown()` the old observer stays subscribed to every still-living activity. Re-`initialize` builds a second observer with its own empty `handled` map, which the same activity's `onActivityResumed` also feeds. A warm-start link then arrives twice: once through the stale `Consumer`, once through the new observer's `activity.intent` read after the merchant's `setIntent`. Two `handled` maps, so the dedupe cannot see the collision → duplicate referral-arrival tracking. Same path the audit's requested `resetForTesting` seam would exercise on every test class.
- **Fix sketch** Give `DeepLinkObserver` an `unsubscribeAll()` that walks `listeners` and calls `removeOnNewIntentListener`, and call it from `Frak.shutdown` next to `unregisterActivityLifecycleCallbacks` (`Frak.kt:143-146`).

### N4. The merchant-facing README still documents the policy this commit reverses

- **Severity** Medium · **Axis** docs, on the `!` itself · **Complexity** trivial
- **Introduced by** `74e43c4c3` (touched neither README)
- **Evidence** `sdk/android/README.md:154` — "The reward models (`BestReward`, `Campaign`, `TokenAmount`, `RewardTier`, `EstimatedReward`) keep **public** constructors, because a merchant does build one — for a `@Preview`, or a fake over `rewards.best`, which `PublicSurfaceTest` pins." Every clause of that is now false, including the citation: `PublicSurfaceTest` was rewritten by this very commit to pin the opposite (`PublicSurfaceTest.kt:1,29-33`). Also `README.md:285` and `:290` ("`PercentEncoding` … is the only type carrying the marker" / "the first and, so far, only one") — now nine constructors plus three `FrakSdkVersion` properties carry it. `09-android-api-surface.md:734-738` still files the reward models as "Open".
- **What actually happens** The single document a merchant reads about ABI policy states the reverse of the shipped `.api`, in the same branch that declares the break. `README.md:285` additionally asserts "a marker on a property never reaches the class file … so BCV cannot see one", which the dump itself refutes — `FrakSdkVersion.HEADER_NAME/HEADER_VALUE/QUERY_PARAMETER_NAME` are marked (`FrakSdkVersion.kt:14,22,27`) and absent from `frak-sdk.api:46-49`. That one is pre-existing, but this commit is what makes it load-bearing: constructor-level filtering is the same mechanism.
- **Fix sketch** Rewrite `README.md:154` (reward models now match the config tree, opt-in marker, javac gap), correct `:285`/`:290`, and close the "Open" row in `09`.

### N5. `libs.versions.toml` now lies about who uses Robolectric

- **Severity** Low · **Axis** docs/maintainability · **Complexity** trivial
- **Introduced by** `74e43c4c3`
- **Evidence** `sdk/android/gradle/libs.versions.toml:41` — "Test-only, `:frak-sdk-ui` **only**" — against `frak-sdk/build.gradle.kts:42-43`, which adds `robolectric` and `androidx-test-core` to `:frak-sdk`.
- **Fix sketch** Drop "`:frak-sdk-ui` only" from the comment.

### N6. The harness half of both commits is enforced by nothing

- **Severity** Low · **Axis** process/verification · **Complexity** small
- **Introduced by** `1cdf7aa99` (claim) and `74e43c4c3` (claim)
- **Evidence** `.github/workflows/apps.yaml` has three native-relevant jobs — `android-sdk` (`:118-181`), `ios-sdk` (`:189+`) — and **no** job that touches `example/native-android` or `example/native-ios`; `rg 'native-android' .github/workflows/apps.yaml` is empty.
- **What actually happens** `example/native-android/.editorconfig:22-24` says the rule is enabled "so an unused import fails **the build**" — no CI build exists for that tree. Likewise "`example/native-android` still compiles — which is the evidence that merchants did not need [the constructors]" is a local, unrepeatable observation, and the harness's `setIntent`/`INFO` fix — which the response doc calls "the highest-value thing in this whole audit" — is guarded by no gate at all.
- **Fix sketch** Either add an `assembleDebug` + `ktlintCheck` job for the two harnesses (they are the only integration test that exists), or downgrade the wording in the editorconfig and the response doc.

### N7. (risk, not confirmed) the re-enabled ktlint rule vs. Compose delegate imports

- **Severity** Low if ktlint's operator whitelist covers it, build-breaking if not · **Axis** build · **Complexity** trivial
- **Evidence** My scan (below) finds seven imports whose names appear nowhere else in their file: `androidx.compose.runtime.getValue`/`setValue` in `FrakSharingSheet.kt:26,30`, `SharingSheetSkeleton.kt:24`, `SharingSheetState.kt:11,13`, `MainActivity.kt:32,38`. These are `by remember { mutableStateOf(…) }` delegate operators — the canonical false-positive class that is *why* ktlint disabled the rule by default, per the commit's own reasoning. ktlint's `NoUnusedImportsRule` whitelists Kotlin operator names, so this most likely stays green; I cannot run ktlint offline to prove it.
- **Fix sketch** None if green. If red, `@file:Suppress("ktlint:standard:no-unused-imports")` is the wrong answer — turning the rule back off for the UI module is.

## Audit claims this branch proves wrong

1. **§4 row 1's line citations are wrong.** The audit cites `frak-sdk.api:298,313,345,414,435`. At both `f1dc693` and `6cd61d665` those lines are `hashCode`, `getRetryAfterMillis`, a blank line, `setLogoUrl` and `getQuantity` — not one of them is a reward constructor. The real coordinates were `471,485,503,511,522,531,581,591,601`. The substance was right and the fix confirms it; the coordinates would have sent anyone verifying it to the wrong file region.
2. **§4 row 1's framing — "A3/D7 … never reached `rewards/`. The register says this policy completed. It did not" — is wrong.** It was not an incomplete rollout; it was a recorded, deliberate exception, argued in two places: `sdk/android/README.md:154` ("keep **public** constructors, because a merchant does build one") and `09-android-api-surface.md:734-738` ("not folded in here … deserves a decision of its own rather than a drive-by. **Open**"). The right criticism was "this open decision is ABI-irreversible, take it now", which is what the team then did.
3. **§3.8's headline — "Android CI should be red right now" — is wrong**, and `1cdf7aa99` is the proof. The premise ("ktlint's `no-unused-imports` is standard and not disabled in `.editorconfig`") is literally true and materially misleading: the rule is off by ktlint's own default, so the absence of a disabling line meant nothing. Credit where due — the audit explicitly offered the correct disjunct ("or the lint step is not doing what everyone believes it is") and called it the finding that "validates or invalidates every *the suite is green* claim". It did exactly that, and the answer was the second branch. Net: half right, and the half it got wrong is the half it led with.
4. **§2.3's mechanism description is stale.** "…sees its own `HANDLED_EXTRA`, and returns" describes `f1dc693:DeepLinkObserver.kt:25-27`. By `6cd61d665` the extra was already gone, replaced by an identity-keyed `WeakHashMap` (`DeepLinkObserver.kt:88`) precisely because writing an extra into the merchant's intent was itself a defect. The conclusion (stale `activity.intent`) was correct; the named mechanism no longer existed when the audit was written.
5. **§9's iOS §2.1 row is right and the commit message obscures it.** The audit already recorded the iOS universal-link rung as landed. `74e43c4c3` touches no iOS AppLink file, yet its subject ("pin the wallet handoff") reads as cross-platform. Not an audit error — an audit claim the commit should not have appeared to re-close.

## Verified-OK

- **Store rung is unpinned, and that is right** — `DefaultFrakClient.kt:343-344` calls `launcher.open(store)` with the defaulted `packageId = null`; `FakeAppLauncher.openedPackages` asserts both halves (`DefaultFrakClientTest.kt:192-207`).
- **The defaulted parameter is declared once** — `AppLauncher.kt:17-20` carries `= null`; `AndroidAppLauncher` (`:32-35`) and `FakeAppLauncher` (`:22-25`) correctly do not repeat it (Kotlin forbids defaults in overrides). `AppLauncher` is `internal`, so none of this reaches `frak-sdk.api` — confirmed: the dump diff is nine deletions and nothing else.
- **Dedupe cannot double-track on the normal warm-start flow** — listener consumes intent `I` → `handled[I]`; merchant's `setIntent(I)` → `onResume` → `consume` → same instance → suppressed. `DeepLinkObserverTest.kt:56-68` pins it.
- **`OnNewIntentProvider` absence is contained** — `as?` is the only throwing instruction and it is inside the `try` (`DeepLinkObserver.kt:41-45`); the un-guarded cast on the destroy path (`:79`) is only reached when registration already succeeded. (Catching `LinkageError` rather than `NoClassDefFoundError` would be strictly safer against a verifier hard-fail, but ART soft-fails here.)
- **Member-level `nonPublicMarkers` filtering is already proven in this build**, so the dump edit is machine output, not a hand edit: `FrakSdkVersion.HEADER_NAME/HEADER_VALUE/QUERY_PARAMETER_NAME` are marked (`FrakSdkVersion.kt:14,22,27`) and absent from `frak-sdk.api:46-49`, while unmarked `CURRENT` is present.
- **No call site was orphaned by the ABI change** — the only constructors of reward models on the branch are `RewardsDecoder.kt` (`@file:OptIn`, `:1`), `PublicSurfaceTest.kt` (`@file:OptIn`, `:1`), `SharingSheetStateTest.kt` (`@file:OptIn`, `:1`) and `RewardModelConstructionTests.swift` (`@_spi` import, `:1`). `RewardsDecoderTest.kt` only does `is`-checks, which need no opt-in. Nothing in `example/native-android`, `example/native-ios` or `Sources/FrakSDKUI` constructs one — the "still compiles" claim is consistent with the tree.
- **iOS test-target split is legal and does what it says** — `@_spi` import is per-file, so `PublicSurfaceTests.swift:2-3`'s plain import still proves the merchant-facing half.
- **The JVM-17 test pin is not new policy** — `frak-sdk/build.gradle.kts:18-23` mirrors `frak-sdk-ui/build.gradle.kts:26-31` exactly, and CI provides temurin 17 (`apps.yaml:130-132`).
- **`bun scripts/check-comments.ts` on the branch tip: clean** — "✅ comment budget clean across 279 files (99 baselined findings left to pay down)". No new comment-budget debt from either commit, despite ~40 lines of new commentary.
- **Independent unused-import scan of `sdk/android` + `example/native-android` at tip**: zero genuine hits; the only residue is the seven Compose delegate imports of N7. The commit's "surface: two, both genuine" is consistent with the tree.
- **`.editorconfig` placement is correct** — both files are `root = true` at their Gradle-build roots, and both new lines sit inside the `[*.{kt,kts}]` section (`sdk/android/.editorconfig:8,33`; `example/native-android/.editorconfig:8,24`), so ktlint's upward `.editorconfig` resolution picks them up for every module.
- **The `!` is free** — `frak.sdk.version=0.0.1` (`sdk/android/gradle.properties:6`), no tags, no CHANGELOG for the native SDKs by design (native is outside Changesets). The `BREAKING CHANGE:` trailer is present and accurate about the nine + three.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Review-only task. Delivered the requested markdown report at /tmp/frak-round3/blockers-and-abi.md covering exactly the assigned scope (74e43c4c3 §2.1/§2.3/§4-row-1 and 1cdf7aa99 ktlint), in the required section order, ranked worst-first, with path:line citations. No repository files were read outside sdk/android, sdk/ios, example/native-*, docs/plans/native-sdk, .github/workflows and scripts/check-comments.ts; no repository file was modified."
    }
  ],
  "changedFiles": [
    "/tmp/frak-round3/blockers-and-abi.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git log -1 --format=%B 74e43c4c3 / 1cdf7aa99; git show --stat; git show <sha> -- <paths>; git diff 6cd61d665 review/alpha-fixes -- sdk/android/frak-sdk/api/frak-sdk.api",
      "result": "passed",
      "summary": "Read both commit messages in full and every hunk of both commits; confirmed the .api diff is exactly nine reward <init> deletions."
    },
    {
      "command": "git archive review/alpha-fixes <native roots> | tar -x -C /tmp/frak-round3/tree && bun scripts/check-comments.ts",
      "result": "passed",
      "summary": "comment budget clean across 279 files (99 baselined findings left) — no new comment debt from either commit."
    },
    {
      "command": "python3 /tmp/frak-round3/unused.py (heuristic unused-import scan over all .kt/.kts in sdk/android + example/native-android at branch tip)",
      "result": "passed",
      "summary": "Zero genuine unused imports remain; only 7 Compose getValue/setValue delegate imports, the known ktlint operator-whitelist class. Supports the commit's 'surface: two' claim."
    },
    {
      "command": "git show 6cd61d665:sdk/android/frak-sdk/api/frak-sdk.api | sed -n '298p;313p;345p;414p;435p' and grep -n '<init>'",
      "result": "passed",
      "summary": "Audit's §4 row 1 line citations point at unrelated lines; real constructor lines were 471/485/503/511/522/531/581/591/601."
    }
  ],
  "validationOutput": [
    "comment budget: '✅ comment budget clean across 279 files (99 baselined finding(s) left to pay down)'",
    "unused-import scan: 7 results, all androidx.compose.runtime.getValue/setValue delegate imports",
    "frak-sdk.api diff 6cd61d665..review/alpha-fixes: 0 insertions, 9 deletions, all reward <init> lines"
  ],
  "residualRisks": [
    "No JDK/Android SDK/Swift toolchain: could not run ktlint, apiCheck, Gradle or swift build. The ktlint operator-whitelist question (N7) and BCV's constructor-level nonPublicMarkers filtering are argued from evidence in-tree (FrakSdkVersion's marked properties are already filtered out of the dump) rather than executed.",
    "N2 (R8 missing-class failure for androidx-free merchants) is inferred from AGP 8+ documented behaviour; it cannot be reproduced without a merchant app that genuinely has no androidx.core.",
    "N1's exact dispatch ordering (Application.dispatchActivityCreated fires inside super.onCreate) is framework behaviour, not verifiable from this repo.",
    "iOS §2.1 and §4 row 2 conclusions rest on reading Sources/ only; no simulator run exists anywhere in this programme."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository changes. One new report file written to /tmp/frak-round3/blockers-and-abi.md, plus scratch under /tmp/frak-round3/tree (extracted branch snapshot) and /tmp/frak-round3/unused.py.",
  "reviewFindings": [
    "blocker: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/DeepLinkObserver.kt:24-32 - the OnNewIntentProvider listener is attached only from onActivityCreated, so a merchant calling Frak.initialize from an Activity reproduces the §2.3 warm-start bug in silence",
    "blocker: sdk/android/frak-sdk/consumer-rules.pro (no -dontwarn) vs frak-sdk/build.gradle.kts:33-36 - compileOnly(androidx.core) makes R8 fail the release build for exactly the androidx-free merchant the fallback claims to support",
    "major: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/Frak.kt:134-147 - shutdown() never removes the per-activity onNewIntent listeners; after re-initialize a warm-start link is tracked twice by two observers with independent dedupe maps",
    "major: sdk/android/README.md:154 (and :285, :290; docs/plans/native-sdk/09-android-api-surface.md:734-738) - the merchant-facing README still documents the reward constructors as deliberately public and cites PublicSurfaceTest as pinning it, in the branch that reverses both",
    "major: sdk/ios/Sources/FrakSDK/Rewards/Rewards.swift:24,45 - RewardTier and EstimatedReward are public enums whose cases stay merchant-constructible, so §4 row 1 closes 3 of 9 equivalents on iOS; 12-alpha-audit-response.md:368 calls this 'to match'",
    "minor: sdk/android/gradle/libs.versions.toml:41 - 'Test-only, :frak-sdk-ui only' is false now that :frak-sdk takes Robolectric",
    "minor: .github/workflows/apps.yaml - no job builds or lints either harness, so the example/native-android editorconfig claim ('fails the build') and the 'still compiles' evidence are ungated",
    "audit-error: 11-alpha-audit.md §4 row 1 line citations (:298,313,345,414,435) match no reward constructor at f1dc693 or 6cd61d665; the real lines were 471/485/503/511/522/531/581/591/601",
    "audit-error: §4 row 1 calls the reward constructors an incomplete A3/D7 rollout; they were a recorded deliberate exception (README.md:154, 09-android-api-surface.md:734-738, filed 'Open')",
    "audit-error: §3.8's 'Android CI should be red right now' is wrong — ktlint disables no-unused-imports by default, which the audit's own second disjunct correctly anticipated"
  ],
  "manualNotes": "Two things the parent may want to route elsewhere: (a) §4 row 3 was renamed on iOS but the Android/iOS millisecond-vs-second divergence is untouched, and (b) §4 row 2 (rewards.best signature divergence) is still open — both are ABI-irreversibility rows that are free only until the first tag. Also flagged for the docs reviewer: 12-alpha-audit-response.md:368's 'to match' overstates the iOS half, and docs/plans/native-sdk/06-open-findings.md:16 still spells the old .backingOff(retryAfter:) label."
}
```
