# Harness blind-spot sweep — `example/native-android` and `example/native-ios`

**Task:** the sweep `6cd61d665` asked for in its own closing paragraph — *"Worth checking the rest of both harness manifests for others."*
**Refs:** `review/alpha-fixes` = `origin/fix/native-sdk-alpha-audit`, tip `6cd61d665`. All file reads are `git show review/alpha-fixes:<path>`; the worktree checkout is a different branch and was not read for source.
**Constraints honoured:** no JDK / Android SDK / Swift toolchain, no device. Nothing below was executed. Every claim is source-read and cited `path:line`. Where a claim needs a device to settle, it says so and gives the one-command falsification test.
**Audit under remediation:** `docs/plans/native-sdk/11-alpha-audit.md` (§2 P0, §3 P1, §4 ABI, §9 delta, §10 branch review) + `docs/plans/native-sdk/audit-2026-08-13/**`. Team response: `docs/plans/native-sdk/12-alpha-audit-response.md`.

---

## 0. What the two diffs prove, and what only the runs assert

Both commits are dominated by prose about physical device runs that cannot be reproduced here. Separating them is a precondition for the rest of this document, because several of my findings are about the gap.

### `55e3f93f0` — proved by the diff

The diff is **6 lines across `example/native-android/app/build.gradle.kts:29-37`** plus three doc edits. What it proves, and only this:

- `release` is now `isMinifyEnabled = true` + `isShrinkResources = true` (`app/build.gradle.kts:29-30`), referencing `proguard-android-optimize.txt` + the local `proguard-rules.pro` (`:31-34`).
- `release` is debug-signed (`:37`), so `installRelease` needs no keystore.
- Therefore `./gradlew :app:assembleRelease` **is now reproducible from a clean checkout**, which is the narrowed form of §3.1 the audit retained in §10.1. That part genuinely lands.

### `55e3f93f0` — asserted only by the run

- "254 SDK classes reach R8, 23 are shaken out" — unverifiable here; also directly contradicts the 46% figure the same repo carried until this commit (`sdk/AGENTS.md`, rewritten by this commit). One of the two numbers is measured against a different app; the commit says so, which is the right disclosure.
- "no `missing_rules.txt`", "no `ClassNotFoundException`/`VerifyError` in 16.5k lines of logcat", "`SharingViewModel::class.java` survived, R8 renamed the class to `g01`".
- "the sharing sheet has now run on a device, in its hardest configuration".
- **"driven through … a share"** — see §5.1: on Android the SDK reports `Shared` when the chooser merely *opened* (audit §5, `android-sharing-sheet` F4), so "a share" is the one item in that list the harness structurally cannot substantiate.

### `6cd61d665` — proved by the diff

**7 lines in `example/native-ios/Sources/FrakExampleiOSApp/Info.plist:27-37`**: two landscape orientations added to `UISupportedInterfaceOrientations`, plus a comment. That is the whole code change. It proves the app *may* now rotate. It does not prove anything rotated.

### `6cd61d665` — asserted only by the run

- The entire iPhone 15 session: share, swipe-dismiss, cover-without-closing, copy, install handoff, two consecutive opens, backgrounding, landscape.
- "`.onDisappear` does not misfire" — the falsification target of `96024ee38`. This is the single most valuable claim in either commit and it is 100% run-asserted.
- "`SharingWebViewPool` reuses its renderer — exactly one `WebContent` process (pid 1121)".
- "the case passes" for landscape.

> **A gap worth naming up front:** on iOS the run is asserted to have been driven while the SDK's diagnostics were provably invisible. See §5.4 — `FrakLogger` routes to `os.Logger` with `.private` redaction and neither harness sets a `logSink`, while both `run.sh` log-streaming paths claim to stream `print()` output that does not exist in `sdk/ios/Sources` (zero matches for `print(`). So "clean" on iOS means "no crash and no jetsam kill", which is what the commit says — but it cannot mean "no SDK error was logged", because no SDK log line could have reached the operator.

---

## 1. Android harness — every declaration that narrows what can be exercised

Files read end to end: `example/native-android/app/src/main/AndroidManifest.xml` (the only manifest in the app; `:frak-sdk`'s and `:frak-sdk-ui`'s are merged in), `app/build.gradle.kts`, `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties`, `app/proguard-rules.pro`, `scripts/run.sh`, `package.json`, `README.md`, and both Kotlin files under `app/src/` (`MainActivity.kt`, `ui/FrakTokens.kt` — there is no `src/test`, no `src/androidTest`).

| # | Declaration | Site | What it makes untestable | Audit finding in the blind spot | Cost to remove |
|---|---|---|---|---|---|
| A1 | `android:launchMode="singleTask"` **+ `onNewIntent` never calls `setIntent`** | manifest:18; `MainActivity.kt:237-240` | Warm-start deep-link dispatch. Worse than untestable: it reproduces the defect and prints green — §5.1 | **§2.3 (P0)** — named by the audit | Trivial (one line) but see §5.1: the log must change too |
| A2 | `android:theme="@android:style/Theme.DeviceDefault.Light.NoActionBar"` — a **non-DayNight, explicitly Light** theme; Compose scheme is `lightColorScheme` only (`ui/FrakTokens.kt:77`) | manifest:13 | System dark mode in the *sheet*. For `targetSdk ≥ 33`, WebView resolves `prefers-color-scheme` from the host theme's `android:isLightTheme`, which `…Light` pins to true. So the hosted wallet page can never render dark in this app, in either build type | **`android-sharing-sheet` F15** ("chrome pinned light, page free to go dark") is *structurally unreachable* — the harness can never produce the mismatch | Trivial: `Theme.DeviceDefault.DayNight.NoActionBar` + `darkColorScheme`. Verify with one device toggle |
| A3 | `android:allowBackup="false"` | manifest:10 | Backup / restore / device-transfer. `:frak-sdk`'s own manifest comment (`frak-sdk/src/main/AndroidManifest.xml:31-41`) makes a **deliberate design claim** — that the consent decision in `id.frak.sdk.xml` *must* survive a device transfer while the queue is excluded via `noBackupFilesDir` and the Keystore key regenerates. That entire claim has zero coverage anywhere; the only `allowBackup` in the tree is this one (`register-challenge.md:233` confirms) and it is `false` | `security-privacy` F10/F12 (consent durability); the SDK manifest's own stated contract | Trivial (delete the attribute — `true` is the platform default and what a real merchant has) |
| A4 | No `android:localeConfig`, no per-app language support | manifest (absent) | Per-app language override. A tester cannot flip only this app to German; they must change the whole device locale | **§3.4** (every non-`en`/`fr` device gets a French sheet) — testable only by re-languaging the device, which nobody does casually | Small: `res/xml/locales_config.xml` + one manifest attribute |
| A5 | `https` intent-filter with **no `android:autoVerify`** (documented, and correct for a placeholder domain) | manifest:24-38 | Verified App Links delivery — the path a real merchant's share links actually take. The https deep link can only arrive via a disambiguation chooser or `adb am start`, never as a verified App Link | §2.3's cold-start half is only ever tested through `adb`; App Links verification itself is untested | Medium (needs a real domain + `assetlinks.json`), or Small using a dev domain already under Frak control |
| A6 | `testInstrumentationRunner` declared with **no `androidTest` source set and no `androidTestImplementation`** | `app/build.gradle.kts:21`; tree has only `app/src/main/**` | Everything. There is not one automated test in the harness, so nothing can *fail*; a case that stops running is invisible by construction. This is the root cause of the whole defect class the two commits describe | All of them, indirectly | Medium for a real suite; **Trivial** for the 80% fix — a written run checklist (§7 item 2) |
| A7 | `scripts/run.sh` has **no `release` path**: `do_build` → `assembleDebug` (`:79`), `do_run` → `installDebug` (`:89`); `package.json` exposes only `start`/`build`/`logs`/`lint`/`format` | `scripts/run.sh:74-112`; `package.json:5-11`; `README.md:24-26` | **The minified variant `55e3f93f0` just committed.** The documented command still runs debug. The R8 run was done by hand, and the next person following the README gets an unminified build with no signal that they did | **§3.1** — the finding this commit closes is re-opened at the tooling layer one directory away. This is the exemplar defect class, committed by the commit that generalises it | **Trivial** (one `case` arm + one `package.json` script) |
| A8 | `release` is minified but **not debuggable** (no `isDebuggable = true`) | `app/build.gradle.kts:28-38` | WebView inspection and page-console forwarding in exactly the build the audit asked to be run: `SharingWebView.kt:190-191` gates `setWebContentsDebuggingEnabled` and `:222` gates `SharingConsoleClient` on the **host app's** `FLAG_DEBUGGABLE` | **§2.4** (loaded-but-blank) is *least* diagnosable in the R8 build — the one failure mode that is silent by design has its only two diagnostic channels switched off | **Trivial** — and it follows the commit's own stated logic ("It is the harness, not a shippable artifact") |
| A9 | `adb logcat -s Frak` — tag-filtered to `Frak` only | `scripts/run.sh:111,119`; `README.md:26` | Everything not tagged `Frak`: `:frak-sdk-ui` logs under tag **`FrakSharing`** (`SharingHost.kt:569`, `SharingHostStyle.kt:58`, `SharingWebView.kt:239`), and `AndroidRuntime`, `chromium`, `StrictMode` are all filtered out. The commit's "no fatal in 16.5k lines of logcat" therefore required a command the harness does not document | `security-privacy` **F13** (the SDK logs outside the merchant's logger) is invisible through the harness's own log path; so is `SharingHost.kt:165`'s "a second FrakSharing attached while a sheet is live" | **Trivial**: `adb logcat -s Frak FrakSharing AndroidRuntime:E chromium:E` |
| A10 | Harness builds the sheet with **`FrakSharing.Builder(...).build(this)`** — the Activity overload | `MainActivity.kt:171`; `README.md:12` states this explicitly | The **entire `@Composable build()` entry point** (`FrakSharing.kt:86-101`): its empty `onDispose` (`:96`), the `rememberUpdatedState` callback-stability path (`:89-90`), `findComponentActivity()`'s `ContextWrapper` walk and its `error(...)` branch (`:124-133`), and the automatic `warm()` on composition-enter (`:99`) | **§3.6 (P1)** — and this *refines* the audit. §3.6 says "unreachable in the harness, which is single-screen with no `NavHost`". It is worse: a `NavHost` alone would not reach it. **The harness never calls that build site at all.** A public API entry point has zero call sites in the only app that drives the SDK | Small (a second screen using `build()`); see §7 |
| A11 | Single-screen: two tabs behind `if (activeTab == 0)` inside one Activity, no `NavHost` | `MainActivity.kt:496-514` | Compose Navigation destination changes while a sheet is live | **§3.6**, second half | Small (add `androidx.navigation.compose` + two destinations) |
| A12 | `signingConfig = debug` on `release`, no `applicationIdSuffix` on `debug` | `app/build.gradle.kts:37` | Debug and release cannot coexist on one device (same `applicationId`), so an A/B of the two builds needs an uninstall. Minor, and the shared debug key is what makes `installRelease` work at all | — | Trivial (`debug { applicationIdSuffix = ".debug" }`) if ever wanted |
| A13 | `gradle.properties` does not state `android.enableR8.fullMode` | `gradle.properties:1-4` | Nothing today (AGP 8+ defaults it to `true`), but the audit's ask was explicitly "minify **+ full mode**" and the config does not record which mode was measured | §3.1's fix sketch | Trivial (one line, documents the measurement) |
| A14 | `proguard-rules.pro:3` still reads *"Referenced by `app/build.gradle.kts` even though `isMinifyEnabled = false`"* | `app/proguard-rules.pro:3` | Nothing functional — but it is a false statement introduced by `55e3f93f0`, in the file R8 reads, and the next reader will believe it | — | Trivial |
| A15 | No `android:configChanges` and no `android:screenOrientation` | manifest:15-18 (absent) | **Nothing — this is correctly *not* narrowed.** Rotation genuinely recreates the Activity, so `SharingHost`'s `isChangingConfigurations` re-attach path (`SharingHost.kt:446-462`) is reachable. But no rotation appears in `55e3f93f0`'s run list, and iOS only just gained the ability. So: reachable, never run | `android-sharing-sheet` F6 (buffered-result replay across recreation) is *reachable*; F14 (a live session reporting to the other `FrakSharing`'s callback) needs **two** build sites and is not | Zero — just rotate the phone |
| A16 | `resizeableActivity`, `taskAffinity`, `hardwareAccelerated`, `largeHeap`, `requestLegacyExternalStorage`, `<queries>`, `INTERNET` | all absent / inherited | **Checked and clean.** Defaults are the merchant-representative ones: multi-window allowed (`targetSdk 24+`), hardware acceleration on (the WebView needs it), default heap, default task affinity. `<queries>` and `INTERNET` are merged from `frak-sdk/src/main/AndroidManifest.xml:16-22`, which correctly declares **both** wallet package ids (`id.frak.wallet` *and* `id.frak.wallet.dev`) — so the `env = Development` wallet probe is genuinely visible, matching iOS's two-scheme declaration. No finding | — | — |
| A17 | `android:supportsRtl="true"` is declared | manifest:12 | Correctly *not* narrowed at the manifest level — but the sheet's content is a WebView, so RTL is page-side and the harness has no RTL locale affordance (see A4). §5's "Nothing is stated about Dynamic Type, RTL" stands | audit §5 Themes → Accessibility | Small, folded into A4 |
| A18 | `minSdk = 24` / `compileSdk = 36` / `targetSdk = 36`; `run.sh` selects an AVD by **name only** (`ANDROID_AVD`), never an API level | `app/build.gradle.kts:12-17`; `scripts/run.sh:52-56` | The declared consumer floor. `sdk/android/README.md:22` promises `minSdk 24`; the harness has no path to an API-24 device, and the one physical run was API 36. Everything API-24-specific — `Base64Url.kt:5`'s explicit `java.util.Base64`-needs-26 workaround, `SharingSheetDialog.kt:54-60`'s "the only lever for 24..34" deprecated window flags — has never executed | Not an existing audit row; **new**. The floor is a public promise with zero evidence | Small (create an API 24 AVD; `ANDROID_AVD` already exists) |

---

## 2. iOS harness — every declaration that narrows what can be exercised

Files read end to end: `project.yml`, `Package.swift`, `Sources/FrakExampleiOSApp/Info.plist`, `PrivacyInfo.xcprivacy`, `scripts/run.sh`, `package.json`, `README.md`, and every Swift file under `Sources/` (`FrakExampleApp.swift`, `UI/FrakTokens.swift`, `UI/StoreInvitePreview.swift`). **There is no entitlements file in the tree** and `project.yml` declares no `entitlements:` key.

| # | Declaration | Site | What it makes untestable | Audit finding in the blind spot | Cost to remove |
|---|---|---|---|---|---|
| I1 | **No Associated Domains entitlement, no `applinks:` anywhere, no entitlements file at all** | `project.yml:20-56` (absent); no `*.entitlements` in `git ls-tree` | Universal-link delivery — i.e. the *only* delivery mechanism for the `https` share links this SDK generates. `.onOpenURL` (`FrakExampleApp.swift:228-230`) receives custom schemes; it does **not** receive universal links, and `onContinueUserActivity(NSUserActivityTypeBrowsingWeb)` is nowhere in the harness | **§2.6 (P0, bundled into §2.5)** and **`merchant-dx` F7**, which explicitly asks for "a universal-link path to the iOS harness so it is exercised". Also blocks any real test of §2.1's iOS mitigation shape | Medium (needs a domain serving `apple-app-site-association` + the entitlement + a provisioning-profile capability). **This is the single most expensive item in this document, and the one with the most findings behind it** |
| I2 | `handleSimulateDeepLink` fabricates an `https://example-merchant.com/product?fCtx=…` URL and calls `handleInboundURL` **directly**, bypassing `.onOpenURL` | `FrakExampleApp.swift:313-319` → `:295` | The delivery path itself. The one URL shape the app can never receive is the one the "simulator" button uses; the shape it *can* receive (`merchantapp://`, `Info.plist:50-62`) is only exercised via `xcrun simctl openurl` from `README.md:108`. Cold-start-with-URL vs warm-delivery is likewise never distinguished | §2.3's iOS twin; `merchant-dx` F7 | Trivial to *label* honestly; Medium to actually fix (= I1) |
| I3 | **No `UIApplicationSceneManifest`**, hence `UIApplicationSupportsMultipleScenes` is absent/false; `LSRequiresIPhoneOS` true | `Info.plist:23-24`; no scene manifest key | Multi-scene / iPad Split View / Stage Manager. Every SDK site that does `connectedScenes … .first { $0.activationState == .foregroundActive }` — `NativeShare.swift:76-79`, `StoreInvite.swift:33-37`, `StoreProductPageInvite.swift:71` — has exactly one candidate here and is never asked to choose. `SharingWebView.swift:160` is worse: `.first` with **no** `foregroundActive` filter, and a single-scene app can never expose it | Not an existing audit row; **new**. Related to `ios-sharing-sheet` F6/N3 (presenting onto "a window nothing owns") | Small–Medium (add a scene manifest with `UIApplicationSupportsMultipleScenes` and run on an iPad) |
| I4 | Deployment target `iOS 15.0`, but `run.sh` selects a simulator by **device name only** (`IOS_SIMULATOR`, default `iPhone 17`, `:86-93`) and the device path targets an iPhone 15 (which cannot run iOS 15) | `project.yml:10-11`; `Package.swift:12-14`; `scripts/run.sh:86-93,187-224` | The declared floor. Both `if #available` fallbacks in the sheet — `SheetBackground` (`FrakSharingSheet.swift:213-223`, iOS 16.4) and `SharingSheetChrome`'s `GeometryReader` branch (`:230-240`, iOS 16.0) — are unreachable in **every** run path the harness offers. There is no way to pick a *runtime version* at all | **`ios-sharing-sheet` F5** ("iOS 15 is the declared floor and its layout branch is visibly wrong … there is no iOS-15 branch in any test or harness") is structurally unreachable, and F5 is the one the audit says nobody has ever looked at | Small **if** an iOS 15 runtime is installable under the current Xcode; otherwise the honest fix is to raise the floor to iOS 16 and delete the branches (which `12-…-response.md:82` already lists as the product decision) |
| I5 | `-configuration Debug` on **both** the simulator and device paths; no release/archive command | `scripts/run.sh:124,207` | The iOS analogue of §3.1: whole-module `-O`, dead-code stripping, and a real Release archive have never run against the SDK. Android just closed its half; iOS's half is not even filed | **New** — the symmetric twin of §3.1, absent from the audit | Trivial (`-configuration Release` arm in `run.sh`) |
| I6 | `swift-tools-version: 5.9` in the harness package, while `sdk/ios/Package.swift` is `6.0` with `.swiftLanguageMode(.v6)` on every target | `example/native-ios/Package.swift:1` vs `sdk/ios/Package.swift:1-8` | Merchant-representativeness of the compile check. Swift 6 language mode is applied only because `run.sh:113` passes `-Xswiftc -swift-version -Xswiftc 6` by hand; the README's own copy-pasteable command (`README.md:99-101`) omits it and says so at `:103`. A merchant resolving `FrakSDK` gets tools-version 6.0 semantics that this harness does not model | Adjacent to `AGENTS.md`'s "used to be tools-version 5.9 with `-swift-version 6` passed only from `scripts/run.sh`, which CI called and a merchant never did" — the harness still has the shape that was just fixed in the SDK | Trivial |
| I7 | `UISupportedInterfaceOrientations` — **portrait + both landscapes, no `PortraitUpsideDown`**; no `UISupportedInterfaceOrientations~ipad` | `Info.plist:32-37` (as amended by `6cd61d665`) | Upside-down portrait (iPhone-irrelevant) and iPad's four-way orientation set. Minor residue; the commit closed the load-bearing gap | — | Trivial |
| I8 | No `UIUserInterfaceStyle` | `Info.plist` (absent) | **Correctly not narrowed** — the app follows system dark mode. Worth recording as an explicit **asymmetry with Android A2**: dark mode is testable on iOS and structurally impossible on Android, so a dark-mode result from one platform says nothing about the other | `android-sharing-sheet` F15 | — |
| I9 | No `NSAppTransportSecurity` | `Info.plist` (absent) | **Correctly not narrowed** — ATS is at its default. Consequence, shared with Android's `targetSdk 36` cleartext default: `FrakEnvironment.Custom` over plain http (the loopback shape §3.8 wants for tests) cannot be driven from either harness on a device | §3.8's fix sketch is host-test-only | Trivial if ever needed (a debug-only ATS exception / `usesCleartextTraffic`) |
| I10 | `LSApplicationQueriesSchemes` = `frakwallet`, `frakwallet-dev` | `Info.plist:44-48` | **Complete and correct.** Matches `frak-sdk`'s Android `<queries>` (both variants) and the SDK's only `canOpenURL` site (`AppLauncher.swift:23`). No finding | — | — |
| I11 | `PrivacyInfo.xcprivacy` comment claims *"it has no SDK behind it: nothing is persisted or sent anywhere"* | `PrivacyInfo.xcprivacy:3-7` | Nothing functional, but the statement is **false on this branch** — the harness drives the live SDK against the dev backend, and the SDK ships its own manifest declaring a Linked DeviceID (see `FrakLogger.swift:56-60`'s redaction rationale). The harness's own declaration is empty and stale | `security-privacy` F4 (ATT / App Store rejection risk) — the harness models the *wrong* privacy posture, so it cannot surface a submission problem | Trivial (delete the stale clause; decide whether the app-level manifest must now declare anything) |
| I12 | One target, no UI-test target, no `swift-testing`/XCUITest target in `project.yml` | `project.yml:20-32` | Same as Android A6: nothing automated, nothing can go red. This is also why `03-sharing-and-install.md:250`'s claimed "simulator XCUITest pass" was flagged as fictitious by `ios-sharing-sheet.md:216` | All, indirectly | Medium |
| I13 | Sheet is attached at the `WindowGroup` root, one instance for every entry point; no `NavigationStack` anywhere | `FrakExampleApp.swift:232-237` | The iOS analogue of A10/A11: a sheet presented from a view that then disappears. Also `ios-sharing-sheet` **F12** (`.onChange` ordering against `pendingRequest`) — `ios-sharing-sheet.md:239` notes the harness sets `request` and `isPresented` **in the same turn** (`FrakExampleApp.swift:244-248`), which is exactly the case the undefined ordering depends on, so the harness only ever exercises the lucky branch | `ios-sharing-sheet` F12; §3.6's iOS twin | Small |
| I14 | `heightFraction` is never passed; the harness uses `.frakSharingSheet(isPresented:request:configuration:onResult:)` only | `FrakExampleApp.swift:232-237` | The height knob on both platforms. Android **throws** and iOS **clamps** for the same input (§4 row 8), and Android's `heightFraction(1.0f)` has no status-bar/cutout inset (`android-sharing-sheet` F11) | **§4 row 8**, `android-sharing-sheet` **F11** — both unreachable in both harnesses | Trivial (a segmented control, like `InstallRouteCard`) |
| I15 | `README.md:12` documents the modifier as `.frakSharingSheet(isPresented:request:onResult:)` | `example/native-ios/README.md:12` | Doc drift only — the code passes `configuration:` (`FrakExampleApp.swift:235`). Notable because §9.3 recorded that `frakSharingSheet(heightFraction:)` was **removed with no deprecated overload**; the harness README still describes a signature that no longer exists | §9.3 parity gap | Trivial |

---

## 3. Findings CURRENTLY UNREACHABLE in both harnesses

"Unreachable" = no amount of manual device testing with the apps **as committed on `review/alpha-fixes`** would ever surface it. The audit names two (§3.6 and §2.3). Here is the full list I can substantiate, ordered by the audit's own severity.

| Finding | Why it is unreachable | Cheapest thing that makes it reachable |
|---|---|---|
| **§2.3** — warm-start deep links (P0) | Reachable *mechanically* (the harness is `singleTask`) but **anti-reachable in practice**: `MainActivity.kt:243-245` prints `LogType.SUCCESS` for the failure. A tester who performs the test correctly is told it passed. Still present verbatim on this branch — see §5.1 | Change the log line before anything else (§7 item 1) |
| **§3.6** — Compose build site orphans a live sheet (P1) | Two independent barriers: no `NavHost` (`MainActivity.kt:496-514`) **and** the `@Composable build()` overload has no call site at all (A10). The audit only names the first | A second screen that uses `Builder.build()` — not just a `NavHost` |
| **§2.6 / `merchant-dx` F7** — Associated Domains, AASA, universal links, `onContinueUserActivity` | No entitlement, no `applinks:`, no `onContinueUserActivity` (I1, I2). The one URL shape the SDK generates cannot be delivered to the app | Associated Domains entitlement + AASA (Medium) |
| **`ios-sharing-sheet` F5** — the iOS 15 layout branch is visibly wrong | Declared floor 15.0; no runtime-version selector in `run.sh`; iPhone 15 hardware cannot run iOS 15 (I4) | An iOS 15 simulator runtime + a destination override, or raise the floor and delete the branch |
| **`android-sharing-sheet` F15** — chrome pinned light, page free to go dark | Host theme pins `isLightTheme=true`, so WebView `prefers-color-scheme` is permanently light (A2) | `DayNight` theme (Trivial) |
| **§3.10 / `ios-sharing-sheet` F4** — UIKit/ObjC merchants cannot use `FrakSDKUI` | Harness is pure SwiftUI (`FrakExampleApp.swift:115-116`); nothing constructs the sheet from a `UIViewController` | A UIKit host screen (Small) — or accept the audit's ask that it merely be *stated* |
| **§4 row 5 + Android `*Async` surface** — `purchaseAsync`, `trackAsync`, `anonymousIdAsync`, `isTrackingEnabledAsync`, `resetAnonymousIdAsync`, `setTrackingEnabledAsync` (`frak-sdk.api:31,39,41,43,83`) | **Zero Java sources in `example/native-android`.** The entire `CompletableFuture` Java-interop surface — frozen in the ratified ABI dump — has no call site anywhere outside the SDK's own tests | One Java file in the harness (Small). Also settles `merchant-dx` F19 (`Frak.shutdown` not `@JvmStatic`) |
| **§4 row 8 / `android-sharing-sheet` F11** — `heightFraction` throws vs clamps; no cutout inset at 1.0 | Never called in either harness (I14, verified: zero matches for `heightFraction` under `example/`) | A height control (Trivial) |
| **`security-privacy` F6** — nothing clears web-view wallet-origin data on consent withdrawal or id reset | `setTrackingEnabled`, `resetAnonymousId` and `trackingEnabled(false)` have **zero** call sites under `example/` (verified by grep). The harness only *reads* `isTrackingEnabled()` (`MainActivity.kt:402`) | Two buttons in the debug card (Trivial) |
| **`security-privacy` F9** — the SDK phones home on every launch even with tracking disabled | Same: `trackingEnabled = false` is never configured at init | One config toggle (Trivial) |
| **`android-sharing-sheet` F2** — two unguarded `Frak.client` reads crash the merchant's process after `Frak.shutdown()` | `Frak.shutdown` has zero call sites under `example/` | One button (Trivial) |
| **`android-sharing-sheet` F14** — after rotation a live session reports to the *other* `FrakSharing`'s callback | Needs two `FrakSharing` instances in one Activity; the harness builds exactly one (`MainActivity.kt:171`) | A second build site (folds into A10) |
| **§3.4** — every non-`en`/`fr` device gets a French sheet | Not strictly unreachable, but needs a full device-language change; no `localeConfig` (A4), so no per-app override | `localeConfig` (Small) |
| **`merchant-dx` F9 / audit §5** — "did my event arrive?" is unanswerable; `Success` returned for undeliverable events | No queue-depth accessor exists in the SDK, and the harness prints green on enqueue (§5.2). No airplane-mode affordance either, so **§3.2c** (Android never re-drives the outbox) cannot be observed even if reproduced | Needs an SDK accessor first; harness-side, a "tracked N, delivered ?" panel is meaningless without it |
| **`ios-sharing-sheet` F12** — `.onChange` ordering vs `pendingRequest` | The harness only ever produces the lucky ordering (I13) | A deferred/second-turn `isPresented` flip (Trivial) |
| **`android-sharing-sheet` F3** — Compose + material3 imposed on every merchant | The harness *is* a Compose app; a View/XML-only merchant hosting the sheet is unrepresented | A non-Compose Activity (Small) |
| **§2.4** — loaded-but-blank sheet | Reachable only by inducing a page-side failure, and (A8) in the R8 build the two diagnostic channels that would show it are switched off | `isDebuggable = true` on `release` (Trivial); inducing the failure needs a wallet-side lever |
| **`build-release-ci` F6** — nothing consumes the *published* artifact | Both harnesses use composite/path dependencies by design (`settings.gradle.kts:25-30`, `project.yml:16-18`) — which is correct for a harness and is precisely what masks publishing failures. Audit §7 item 14 already says this | Out of harness scope: a throwaway consumer against a published artifact |
| **A18 (new)** — the declared `minSdk 24` / `iOS 15` floors | No API-level or runtime-version selector in either `run.sh` (A18, I4) | An API 24 AVD (Small) |
| **I3 (new)** — multi-scene / iPad window selection in `connectedScenes … .first` | Single-scene app by omission (no `UIApplicationSceneManifest`) | Scene manifest + an iPad (Small–Medium) |

---

## 4. The other shape: harness code that reports success for a failure path

The audit quotes one instance (§2.3). It is **still present, unchanged, on this branch**, and I found five more of the same shape plus two in the tooling.

### 5.1 `MainActivity.onNewIntent` — still green for the failure case ✗ NOT FIXED

```kotlin
// example/native-android/app/src/main/kotlin/id/frak/example/android/MainActivity.kt:237-245
override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    intent.dataString?.let { url -> logInboundIntent(url) }   // still no setIntent(intent)
}
/** Automatic mode already dispatched `handleReferral`; calling it again would double-track. */
private fun logInboundIntent(url: String) {
    addLog("Inbound link reached the activity (SDK auto-handles it): $url", LogType.SUCCESS)
}
```

Byte-identical to the audit's quote. `12-alpha-audit-response.md:45` calls fixing this *"the highest-value thing in this whole audit"*; two commits later, and one of them explicitly about harness blind spots, it is untouched. The KDoc at `:242` is a false assertion in a source file.

It is compounded at the documentation layer, which the audit did not note:

- `example/native-android/README.md:15` advertises *"inbound deep links via Android intent filters (**cold and warm start**)"* as an exercised capability.
- `README.md:50-53` gives the `adb am start` command and states *"the SDK's own `ActivityLifecycleCallbacks` picks up the intent and calls `appLink.handleReferral` itself; the app only logs that the intent arrived."* Run that command against an already-running app and the second clause is false.

### 5.2 "Order tracked successfully" — both platforms, contradicted by the SDK's own KDoc

- `MainActivity.kt:333` — `is FrakResult.Success -> addLog("Order $orderId tracked successfully.", LogType.SUCCESS)`
- `FrakExampleApp.swift:333-334` — `case .success: addLog("Order \(orderId) tracked successfully.", type: .success)`

`TrackingApi.kt:19` says: *"Records a purchase; **same enqueue-then-send contract** as `track`"*, and `:12`: *"succeeds once durable, **not once delivered**"*. So the harness prints green for a row that has only been written to `frak-events.jsonl`. This is `merchant-dx` **F9** verbatim, and it is exactly why §2.5 item 3 ("skip the allow-listing step and every call fails `MerchantResolutionFailed` — while `tracking.purchase` still returns `Success`") could never be caught here. The word "successfully" is doing work the SDK does not do.

### 5.3 "Reward link shared" on Android — green when the chooser merely *opened*

`MainActivity.kt:300` maps `SharingResult.Shared` to `LogType.SUCCESS`. Per audit §5 / `android-sharing-sheet` F4, Android's `NativeShare.share()` returns `startActivity(...).isSuccess`, so `Shared` fires on chooser *open* in a user-controllable loop. iOS is the stricter side (`78c96b8` requires a non-nil `activityType`), so **the same green line means two different things on the two platforms**, and `55e3f93f0`'s run list — "driven through … a share" — inherits the ambiguity. This is the one item in that list I would not accept as proven.

### 5.4 iOS: "Referral context recognized **and tracked**"

`FrakExampleApp.swift:300-306` prints `.success` with the word "tracked" on the basis of `handleReferral`'s `Bool` alone. Same enqueue-vs-deliver conflation as 5.2.

### 5.5 iOS: `StoreInvite.presentOverlay()` reports a presentation it cannot observe

```swift
// example/native-ios/Sources/FrakExampleiOSApp/UI/StoreInvitePreview.swift:35-44
SKOverlay(configuration: configuration).present(in: scene)
if let covering = scene.keyWindow?.rootViewController?.presentedViewController {
    return "presented over the scene, with \(type(of: covering)) on top"
}
return "presented over the scene — if you see nothing, the id is not an app"
```

`SKOverlay.present(in:)` is fire-and-forget with no delegate. The harness reproduces **`ios-sharing-sheet` F6 verbatim** — the finding is that the *SDK* "reports success it cannot observe", and the harness written to investigate it does the same thing. Partially mitigated by the hedge in the second string and the honest comment at `:38-39`, which is why I rank this below 5.1–5.3.

### 5.6 Tooling: both `run.sh` files claim to stream SDK logs that do not exist

- `example/native-ios/scripts/run.sh:134` — *"`--console-pty` streams the SDK's `print()` output; it does not reach the unified log system, so `log show` would find nothing."*
- `example/native-ios/scripts/run.sh:219` — *"`--console` streams the app's stdout, where the SDK's `print()` output goes."*

**There is no `print(` anywhere in `sdk/ios/Sources`** (verified: zero matches). `FrakLogger.swift:1,19` routes to `os.Logger(subsystem: "id.frak.sdk", category: "Frak")`, and `:56-60` logs the message as **`.private`**, i.e. redacted to `<private>` in any log stream without a device profile installed. The comments have it exactly backwards: `--console` finds nothing and `log show`/`log stream` is the only channel — redacted.

Neither harness sets `FrakConfig.logSink` (`FrakConfig.swift:83,93`; `FrakConfig.kt:113,157`) — verified: zero matches for `logSink` under `example/`. So on iOS the entire SDK diagnostic stream was invisible during the run described by `6cd61d665`, including the `LSApplicationQueriesSchemes` diagnostic that §9.3 already flagged as "routed into `FrakLogLevel.none`". On Android the stream exists but A9 filters half of it out.

### 5.7 Tooling: `README.md`/`package.json` still point at the debug variant

See A7. `55e3f93f0` committed the minify config and left every documented entry point running `assembleDebug`/`installDebug`. The commit's own thesis — "a run whose config is not committed does not fix that" — applies unchanged to a config no committed command reaches.

### 5.8 Nothing in either harness asserts

`LogType.ERROR` / `.error` is emitted only from `catch` blocks and `FrakResult.Failure`. There is no expected-vs-actual check anywhere in `MainActivity.kt` or `FrakExampleApp.swift`. A silent regression — an `onResult` that never fires, a sheet that stays on screen, a dropped callback — produces **no** line at all, and an absent line is exactly what nobody notices. This is the generalisation of the whole defect class.

---

## 5. Challenges to the two commits' own claims

Called for by the brief ("the audit already made one error of its own — keep looking for more and say so plainly"). Two are against the *response*, one against the audit, one against the harness docs.

### C1 — "The harness never enables predictive back" is very likely **wrong**, and it is the exemplar the whole sweep is built on

`55e3f93f0` and `12-alpha-audit-response.md:139-141` say: *"The harness never sets `android:enableOnBackInvokedCallback="true"`, so predictive back is off in the one app used to validate back-dismissal of the sheet."* `6cd61d665` then uses that as the reference case for the entire defect class.

But `example/native-android/app/build.gradle.kts:17` is **`targetSdk = 36`**, and the run was on Android 16. Since Android 15 (API 35), predictive back is **enabled by default** for apps targeting SDK 35 or higher; `android:enableOnBackInvokedCallback` is only needed to *opt out* (`="false"`) at that target level. If that is right, predictive back was **on** during the R8 run, the caveat is unnecessary, and the exemplar of "the test app quietly excluded a case" did not exclude it.

What *does* survive, and is the more interesting version of the same point: `SharingSheetDialog.kt:34-38` registers an `OnBackPressedCallback` that implements **only** `handleOnBackPressed()` — no `handleOnBackStarted/Progressed/Cancelled`. Under predictive back the sheet therefore renders **no** gesture-progress preview; the user swipes, sees nothing, and the sheet vanishes at commit. That is a real UX defect, it is *not* filed anywhere in the audit, and it was live on the device during the run.

- **Confidence:** high on the default-on behaviour, medium on how it manifests. I have no device and cannot execute.
- **Falsification, 2 minutes, no code change:** on the RMX3511, back-swipe from the edge with the sheet up. A visible shrink-and-peel preview ⇒ predictive back was on ⇒ the caveat is wrong. No preview at all ⇒ either the caveat is right, or C1's second half is (the callback has no progress handlers) — and `adb shell dumpsys window | grep -i backAnimation` distinguishes them.
- Either way, the recommendation is unchanged and cheap: set the flag **explicitly** (`android:enableOnBackInvokedCallback="true"`) so the harness records its intent instead of inheriting a target-level default, and add the three progress callbacks in the SDK.

### C2 — `55e3f93f0` left two documents asserting the opposite of what it just ran

The commit updated `AGENTS.md` and `sdk/AGENTS.md`, but not:

- `sdk/android/README.md:208` — still states *"The sharing sheet, the install handoff and inbound deep links have not run on a device"* and *"`isMinifyEnabled = false` there"*. Both were false the moment this commit landed.
- `sdk/ios/README.mirror.md:5` — *"**Pre-release.** This package has not had a device or simulator pass."* False after `6cd61d665`.

This is precisely the failure mode `11-alpha-audit.md` §6 accuses `06-open-findings.md` of (a register that undersells is as expensive as one that oversells), reproduced by the commits fixing it. Trivial to correct, and it is the merchant-facing README in both cases.

### C3 — the audit's §3.6 framing is incomplete

`11-alpha-audit.md:200` and `12-alpha-audit-response.md:50` both say §3.6 is "unreachable in the harness, which is single-screen with no `NavHost`" and prescribe "a two-destination harness screen". Adding a `NavHost` **would not reach it**: the harness calls `Builder.build(activity)` (`MainActivity.kt:171`, and `example/native-android/README.md:12` says so explicitly), while the empty `onDispose` lives in the *other*, `@Composable`, overload (`FrakSharing.kt:86-101`). The prescription needs both halves or it produces a green run that proves nothing — the same shape as everything else in this document.

### C4 — `PrivacyInfo.xcprivacy`'s premise is stale

`example/native-ios/Sources/FrakExampleiOSApp/PrivacyInfo.xcprivacy:3-7` still says *"it has no SDK behind it, so nothing is persisted or sent anywhere"*. Untrue since the harness was wired to the real SDK. Whether the app-level manifest must now declare anything is a real question (`security-privacy` F4 is about App Store rejection risk), and this file currently answers it by assuming a state that no longer exists.

---

## 6. Prioritised harness changes — cheapest first, by findings unblocked

Ordered by (findings made reachable) ÷ (cost). Items 1–8 are, together, well under a day and unblock more open findings than any SDK change on this branch.

| # | Change | Cost | Unblocks |
|---|---|---|---|
| **1** | **`MainActivity.onNewIntent`: call `setIntent(intent)` and make the harness *assert*** — log `ERROR` when the SDK did not dispatch (e.g. compare against a manual `handleReferral` result), never `SUCCESS` for an unverified dispatch. Fix `README.md:15,53` to stop advertising warm start | ~15 min | **§2.3 (P0)** stops being anti-reachable. The response doc already calls this the highest-value item in the audit |
| **2** | **Delete the word "successfully" from the two purchase log lines** (`MainActivity.kt:333`, `FrakExampleApp.swift:334`) → "queued for delivery (enqueue-then-send)". Same for `FrakExampleApp.swift:302` | ~10 min | `merchant-dx` **F9**, §2.5 item 3, and the credibility of every future run log |
| **3** | **`example/native-android/scripts/run.sh`: add a `release` arm** (`assembleRelease`/`installRelease`) + `package.json` script + README line; add **`isDebuggable = true`** to the `release` build type | ~20 min | Makes `55e3f93f0`'s own fix reachable from the documented command (A7); restores WebView inspector + page console in the minified build, which is where **§2.4** hides (A8) |
| **4** | **`adb logcat -s Frak FrakSharing AndroidRuntime:E chromium:E`** in `run.sh:111,119` and the README | ~5 min | `security-privacy` **F13**; makes `SharingHost.kt:165` and `SharingHostStyle.kt:41,54` visible; makes the "no fatal in logcat" claim reproducible |
| **5** | **Add a `FrakLogSink` to both harnesses** that appends to the on-screen log, and correct the two false `print()` comments in `example/native-ios/scripts/run.sh:134,219` | ~30 min | **The largest single observability win.** iOS SDK diagnostics go from invisible to on-screen; exercises a public API (`FrakLogSink`) with zero call sites; makes §2.5 item 2 ("silence by default") and §9.3's swallowed `LSApplicationQueriesSchemes` diagnostic demonstrable |
| **6** | **Android manifest: `Theme.DeviceDefault.DayNight.NoActionBar` + a `darkColorScheme`; delete `android:allowBackup="false"`; add `android:enableOnBackInvokedCallback="true"` explicitly; add `localeConfig`** | ~45 min | `android-sharing-sheet` **F15** (currently structurally unreachable); the SDK manifest's own backup/consent-durability contract (`security-privacy` F10/F12); C1; **§3.4** |
| **7** | **Debug-card buttons for the unexercised public API**: `setTrackingEnabled(false/true)`, `resetAnonymousId()`, `Frak.shutdown()`, `sharing.buildLink()`, a `heightFraction` picker, `tracking.track(Interaction.custom(...))` | ~1 h | `security-privacy` **F6**, **F9**; `android-sharing-sheet` **F2**; **§4 row 8**; `android-sharing-sheet` **F11**; and it closes `public-api-ergonomics.md:289`'s explicitly-unverified assumption that every public entry point has a harness call site (it does not — verified) |
| **8** | **Second Android screen built with the `@Composable Builder.build()` overload, behind a two-destination `NavHost`** | ~2 h | **§3.6 (P1)** — both halves (C3). Also `android-sharing-sheet` **F14** if the second screen keeps its own `FrakSharing` |
| **9** | **A written run checklist committed next to each harness** — one line per case with a tick box (cold deep link, warm deep link, rotation, dark mode, landscape, predictive back, offline purchase then foreground, minified build, install handoff, consent withdrawal, API-24 device, iOS-floor runtime) | ~1 h | Nothing directly; **everything indirectly.** This is the only item that addresses the root cause named by `6cd61d665` — that nothing made it visible a case had never run. A6/I12 mean there is no test list at all today |
| **10** | **One Java source file in `example/native-android`** calling `purchaseAsync`/`anonymousIdAsync`/`Frak.shutdown` | ~30 min | The entire `CompletableFuture` interop surface, frozen in `frak-sdk.api` with zero external call sites; `merchant-dx` **F19** |
| **11** | **iOS: `-configuration Release` arm in `run.sh`** | ~15 min | §3.1's unfiled iOS twin (I5) |
| **12** | **iOS: `UIApplicationSceneManifest` with `UIApplicationSupportsMultipleScenes`, and one iPad run** | ~1 h + device | I3 — every `connectedScenes … .first` site in `FrakSDKUI` |
| **13** | **Android: an API-24 AVD in the docs; iOS: a runtime-version override (`IOS_RUNTIME`/full `-destination`) in `run.sh`** | ~1 h | A18, I4 — the declared consumer floors on both platforms; `ios-sharing-sheet` **F5** if an iOS 15 runtime is installable |
| **14** | **iOS: Associated Domains entitlement + AASA + `onContinueUserActivity`, and stop faking https delivery in `handleSimulateDeepLink`** | ~half a day + domain/profile work | **§2.6 (P0)**, `merchant-dx` **F7**, §2.3's iOS twin. Highest value of the expensive items; deliberately last because it is the only one that needs infrastructure outside the repo |
| **15** | **Doc corrections** (C2, C4, I15, A14): `sdk/android/README.md:208`, `sdk/ios/README.mirror.md:5`, `PrivacyInfo.xcprivacy:3-7`, `example/native-ios/README.md:12`, `app/proguard-rules.pro:3` | ~20 min | No findings, but all five are statements that are false on this branch, three of them merchant-facing |

**If only three things are done:** items 1, 3 and 5. Item 1 converts the audit's clearest "harness manufacturing confidence" instance; item 3 makes the fix `55e3f93f0` just landed actually reachable from the documented command; item 5 is the difference between a device run that can see the SDK and one that cannot.

---

## 7. What I could not check, and residual uncertainty

- **Nothing was executed.** No JDK, Android SDK, Swift toolchain, emulator, simulator or device. Every claim above is source-read at `review/alpha-fixes`.
- **C1 (predictive back)** rests on platform behaviour I cannot verify in this repo: that `targetSdk ≥ 35` makes predictive back default-on. Falsification test given inline; it costs two minutes on the device that already ran.
- **A2 (WebView `prefers-color-scheme` follows `android:isLightTheme` at `targetSdk ≥ 33`)** is the same shape — mechanism reasoned from platform behaviour, not measured. The *conclusion* (the harness's dark mode story is untested and the theme is pinned light in two places) holds regardless of the mechanism.
- **`git ls-tree -r review/alpha-fixes example/native-android example/native-ios`** returned 28 files total; I read all configuration and all sources. There is no second manifest, no flavour-specific `src/`, no `androidTest`, no UI-test target.
- Git history here is complete (unlike the shallow clone that produced the audit's `checkDexSizeBudget` error), so "X has no call site" claims above were made with repository-wide `git grep` against the branch, not inference — each is stated with the grep target so it can be re-run.
- I did **not** audit the SDK sources for their own defects; SDK citations appear only where they establish what a harness declaration does or does not exercise.

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Delivered exactly the requested harness blind-spot sweep as a single read-only report at /tmp/frak-device/harness-blind-spots.md. All five numbered sub-tasks are covered in dedicated sections (§1 Android enumeration 18 items, §2 iOS enumeration 15 items, §3 unreachable-findings cross-check, §4 success-for-a-failure-path sweep, §6 prioritised cheapest-first list). No source files were modified; scope was not widened beyond the two harnesses, their manifests/configs/sources, and the SDK lines needed to establish what each declaration does or does not exercise."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Every finding carries a path:line citation resolvable with `git show review/alpha-fixes:<path>`. Diff-proven vs run-asserted claims are separated in §0. Four explicit challenges to the commits/response/audit are raised in §5 with confidence levels and falsification tests. Negative results are stated too (A16, I10 checked and clean). Verification commands and their exact grep targets are listed in commandsRun so an independent reviewer can re-run them."
    }
  ],
  "changedFiles": [
    "/tmp/frak-device/harness-blind-spots.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git log -1 --format=%B 55e3f93f0 && git log -1 --format=%B 6cd61d665",
      "result": "passed",
      "summary": "Read both full commit messages; extracted the run-asserted claim lists used in section 0."
    },
    {
      "command": "git show 55e3f93f0 --stat && git show 6cd61d665 --stat",
      "result": "passed",
      "summary": "55e3f93f0 = 4 files, +54/-9 (6 lines of build.gradle.kts, 3 doc files). 6cd61d665 = 2 files, +44/-4 (7 lines of Info.plist, 1 doc file)."
    },
    {
      "command": "git ls-tree -r --name-only review/alpha-fixes example/native-android example/native-ios",
      "result": "passed",
      "summary": "28 files total. Confirms one manifest, no src/test, no src/androidTest, no iOS entitlements file, no UI-test target."
    },
    {
      "command": "git show review/alpha-fixes:<path> for AndroidManifest.xml, app/build.gradle.kts, build.gradle.kts, settings.gradle.kts, gradle.properties, proguard-rules.pro, MainActivity.kt, ui/FrakTokens.kt, scripts/run.sh, package.json, README.md (android) and project.yml, Package.swift, Info.plist, PrivacyInfo.xcprivacy, FrakExampleApp.swift, UI/StoreInvitePreview.swift, scripts/run.sh, package.json, README.md (ios)",
      "result": "passed",
      "summary": "Both harnesses read end to end from the branch, not from the worktree checkout."
    },
    {
      "command": "git grep -n 'shutdown|setTrackingEnabled|resetAnonymousId|trackingEnabled|buildLink|heightFraction|\\.track\\(|Interaction\\.' review/alpha-fixes -- example/",
      "result": "passed",
      "summary": "Zero matches. Establishes that consent withdrawal, id reset, shutdown, buildLink, heightFraction and custom interactions have no harness call site (basis for section 3 rows and item 7)."
    },
    {
      "command": "git grep -n 'logSink|FrakLogSink|print(' review/alpha-fixes -- example/ ; git grep -n '^\\s*print(' review/alpha-fixes -- sdk/ios/Sources",
      "result": "passed",
      "summary": "No logSink in either harness; zero print( in sdk/ios/Sources. Basis for finding 5.6 (both run.sh log comments are false)."
    },
    {
      "command": "git grep -n 'const val TAG' review/alpha-fixes -- sdk/android/frak-sdk-ui ; git grep -n 'TAG' review/alpha-fixes -- .../FrakLogger.kt",
      "result": "passed",
      "summary": "frak-sdk-ui logs under tag 'FrakSharing'; frak-sdk under 'Frak'. Basis for A9 (adb logcat -s Frak filters out the sheet's own warnings)."
    },
    {
      "command": "git grep -n 'setWebContentsDebuggingEnabled|FLAG_DEBUGGABLE|SharingConsoleClient' review/alpha-fixes -- sdk/android",
      "result": "passed",
      "summary": "SharingWebView.kt:190-191,222 gate both diagnostics on the host app's FLAG_DEBUGGABLE. Basis for A8."
    },
    {
      "command": "git grep -n 'connectedScenes|keyWindow|if #available' review/alpha-fixes -- sdk/ios",
      "result": "passed",
      "summary": "Four connectedScenes sites (one without a foregroundActive filter) and the two iOS-15/16.4 fallback branches. Basis for I3 and I4."
    },
    {
      "command": "git show review/alpha-fixes:sdk/android/frak-sdk-ui/.../FrakSharing.kt and SharingSheetDialog.kt",
      "result": "passed",
      "summary": "Confirms two build() overloads (the empty onDispose is in the @Composable one the harness never calls) and that the back callback implements only handleOnBackPressed. Basis for A10, C3, C1."
    }
  ],
  "validationOutput": [
    "Android sweep: 18 enumerated declarations (A1-A18), of which 4 are recorded as correctly NOT narrowing (A15, A16, A17 partial) and 14 narrow something.",
    "iOS sweep: 15 enumerated declarations (I1-I15), of which 3 are recorded as correctly NOT narrowing (I8, I9, I10).",
    "Currently-unreachable list: 20 rows. The audit named 2 (S3.6, S2.6/F7 partially); 18 more identified, including 5 previously unfiled (Java/CompletableFuture interop, multi-scene, minSdk/iOS floors, iOS Release configuration, no-assertion harness).",
    "Success-for-a-failure-path sweep: 8 instances (5.1-5.8). S2.3's instance is confirmed present verbatim on this branch at MainActivity.kt:237-245 and is compounded by README.md:15 and :50-53.",
    "Four challenges raised: C1 predictive-back claim in both the commit message and 12-alpha-audit-response.md:139-141 is very likely wrong for targetSdk 36 (falsification test supplied); C2 two merchant-facing READMEs now assert the opposite of what was just run; C3 the audit's S3.6 prescription is incomplete; C4 PrivacyInfo.xcprivacy premise is stale.",
    "Prioritised list: 15 items, cheapest first. Items 1-8 total well under a day and unblock more open findings than any SDK change on the branch."
  ],
  "residualRisks": [
    "C1 (predictive back default-on at targetSdk >= 35) and A2 (WebView prefers-color-scheme follows android:isLightTheme at targetSdk >= 33) are reasoned from Android platform behaviour, not measured here. Both are flagged inline with confidence levels and a 2-minute on-device falsification test. A2's conclusion (dark mode untested, theme pinned light in two places) holds regardless of mechanism.",
    "Every device-run claim in both commit messages remains unverifiable in this environment. Section 0 separates them explicitly; the report never treats a run assertion as established.",
    "Cost estimates in section 6 are engineering judgement from reading the code, not from building anything.",
    "The iOS run's 'clean' verdict is weaker than it reads: per 5.6 no SDK log line could have reached the operator during it. This is an inference from FrakLogger's os.Logger + .private routing plus the absence of a logSink, not from the run's artefacts, which I do not have."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repository files changed. One new artifact written outside the repo: /tmp/frak-device/harness-blind-spots.md (~340 lines) containing the harness blind-spot sweep, the unreachable-findings cross-check, the success-for-a-failure-path sweep, four challenges to the commits' own claims, and a 15-item prioritised remediation list.",
  "reviewFindings": [
    "blocker: example/native-android/app/src/main/kotlin/id/frak/example/android/MainActivity.kt:237-245 - the audit's S2.3 exemplar (onNewIntent logs LogType.SUCCESS for a link the SDK never dispatched, no setIntent) is unchanged on this branch, two commits after the response doc called fixing it 'the highest-value thing in this whole audit'.",
    "blocker: example/native-android/scripts/run.sh:79,89 + package.json:5-11 - 55e3f93f0 committed isMinifyEnabled=true but every documented command still runs assembleDebug/installDebug. The finding it closes is reintroduced one directory away: no committed command reaches the minified variant.",
    "high: example/native-ios/scripts/run.sh:134,219 - both log-streaming comments claim to stream the SDK's print() output; sdk/ios/Sources contains zero print( and FrakLogger routes to os.Logger with .private redaction. Neither harness sets a logSink, so no SDK diagnostic could reach the operator during the iOS device run.",
    "high: docs/plans/native-sdk/12-alpha-audit-response.md:139-141 and 55e3f93f0's message - the 'harness never enables predictive back' claim is very likely wrong at targetSdk 36 (predictive back is default-on from API 35). The real, unfiled defect is that SharingSheetDialog.kt:34-38 registers no back-progress callbacks, so the sheet shows no predictive preview.",
    "high: example/native-android/app/src/main/AndroidManifest.xml:13 - Theme.DeviceDefault.Light pins android:isLightTheme=true, so the sheet's WebView can never render dark. android-sharing-sheet F15 is structurally unreachable, not merely untested.",
    "high: example/native-ios - no Associated Domains entitlement anywhere, and handleSimulateDeepLink (FrakExampleApp.swift:313-319) fabricates an https URL the app can never receive. S2.6 and merchant-dx F7 are unreachable while the harness prints a pass for them.",
    "medium: FrakSharing.kt:86-101 vs MainActivity.kt:171 - the @Composable build() overload (where S3.6's empty onDispose lives) has zero call sites in either harness. The audit's 'add a NavHost' prescription alone would not reach it.",
    "medium: MainActivity.kt:333 / FrakExampleApp.swift:334 - both print 'tracked successfully' for a purchase that TrackingApi.kt:12,19 documents as succeeding on enqueue, not delivery. Same defect class as S2.3; it is why S2.5 item 3 could never be caught here.",
    "medium: example/native-android/app/src/main/AndroidManifest.xml:10 - allowBackup=false makes the SDK manifest's own stated contract (frak-sdk/src/main/AndroidManifest.xml:31-41: a consent withdrawal must survive a device transfer) untestable; it is the only allowBackup in the tree.",
    "low: sdk/android/README.md:208 and sdk/ios/README.mirror.md:5 still assert the sharing sheet/install handoff/deep links have not run on a device and that iOS has had no device pass - both false as of these two commits. Also app/proguard-rules.pro:3 still says isMinifyEnabled=false."
  ],
  "manualNotes": "Two things the parent may want to route onward. (1) C1 is the highest-value item to settle because 6cd61d665 builds the entire 'harness quietly excluded a case' thesis on it; if predictive back was on during the run, the exemplar is wrong even though the defect class is real - and the sweep found seven other instances, so the thesis survives regardless. A two-minute back-swipe on the RMX3511 settles it. (2) The single cheapest change with the widest reach is a FrakLogSink in both harnesses (item 5): it converts iOS from zero SDK observability to on-screen, exercises a public API that currently has no call site anywhere, and makes S2.5's 'silence by default' and S9.3's swallowed LSApplicationQueriesSchemes diagnostic demonstrable rather than argued. Also note for the record: I re-verified two audit claims against complete history rather than inheriting them - the harness IS still singleTask-with-a-green-log (audit right), and the SDK's Android <queries> DOES declare both wallet package ids including id.frak.wallet.dev, so the env=Development wallet probe is genuinely visible (no finding there, contrary to what the iOS Info.plist's two-scheme comment might lead a reader to assume about Android)."
}
```
