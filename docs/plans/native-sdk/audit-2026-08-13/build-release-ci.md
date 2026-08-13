# Build / Release / Distribution / CI — audit

Worktree: `/home/dev/wallet-audit` @ `c0a0cec` (read-only). No JDK/Android SDK/Swift toolchain — everything below is read-verified, nothing executed.

## Summary

The *plumbing* is genuinely further along than the register admits: Maven Central coordinates, a Portal bundle task with a real completeness gate (`checkCentralBundle`), a signed publication with a Central-valid POM, an ABI gate wired by hand around AGP 9's BCV hole, a version-drift gate on both platforms, path-filtered CI on both SDKs, and two tag-driven release workflows. That is more than most first alphas have.

What is not alpha-ready is *verification of the shipped shape*. Three holes stand out, and they are all "the first person to run this is a merchant":

1. **No minified build exists anywhere in this repo.** Both `consumer-rules.pro` files are empty and assert in prose that nothing is reflective — which is false (`ViewModelProvider(activity)[SharingViewModel::class.java]`), and the one harness that could prove it sets `isMinifyEnabled = false`. My Moulinex ships R8 full mode.
2. **The iOS release workflow pushes an immutable tag to the public mirror without compiling a single line.** It runs on `ubuntu-latest`; the only build happens in a `verify` job *after* the irreversible push.
3. **The register asserts a CI gate that does not exist.** `checkDexSizeBudget` / `frak.sdk.dexBudgetKb` appear in five documents, including a claim it "was run and was red at 321 KB", and exist nowhere in the tree.

Single worst thing: **#1** — it is the only item here that ends as a crash in a merchant's production build rather than as a red CI run.

Versioning is self-consistent but meaningless: `0.0.1` in four places, gated in both directions, zero tags, and the mirror README already tells merchants to pin `0.1.0-alpha.1`.

## Findings

### F1. Nothing in this repo has ever run R8, and both consumer-rules files claim (wrongly) that nothing is reflective

- **Severity**: high
- **Axis**: correctness / build-release
- **Complexity to fix**: small (<1d)
- **Evidence**:
  - `sdk/android/frak-sdk/consumer-rules.pro:11-13` — *"Empty on purpose: nothing here is reached by reflection or JNI, and no type is named only from a string, so R8 can trace every entry point from the public API."*
  - `sdk/android/frak-sdk-ui/consumer-rules.pro:6-9` — *"Still empty, and expected to stay that way. No `@JavascriptInterface` keep: … nothing in the sheet is reached reflectively."*
  - `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingHost.kt:461` — `val retained = ViewModelProvider(activity)[SharingViewModel::class.java]`, against `internal class SharingViewModel : ViewModel()` (`SharingHost.kt:35`). `ViewModelProvider`'s default factory instantiates by `getDeclaredConstructor().newInstance()` — that *is* reflection, and it is on the only entry path into the sharing sheet.
  - `example/native-android/app/build.gradle.kts:27-33` — the release build type of the one harness: `isMinifyEnabled = false`. So R8 has never processed the AAR, in CI or by hand.
  - `androidx.lifecycle` is not in the catalog at all (`sdk/android/gradle/libs.versions.toml:27` — *"androidx.lifecycle is deliberately not declared: it arrives as an api dep of activity"*), so the rule that would save this (`-keepclassmembers class * extends androidx.lifecycle.ViewModel { <init>(); }`, shipped by `lifecycle-viewmodel`) is inherited from an unpinned transitive.
- **What actually happens**: a merchant's minified release build either works by luck (because a transitive dependency happens to ship the keep rule) or throws `RuntimeException: Cannot create an instance of class id.frak.sdk.ui.SharingViewModel` the first time a user taps Share — in production only, never in their debug build, and never in ours.
- **Fix sketch**: add `-keepclassmembers,allowobfuscation class id.frak.sdk.ui.SharingViewModel { <init>(); }` to `frak-sdk-ui/consumer-rules.pro`, delete the "nothing is reflective" prose from both files, and flip `isMinifyEnabled = true` in `example/native-android` so a minified consumer build exists in CI.
- **Register status**: NEW (the register never mentions R8 or consumer rules after `05-build-and-release.md:69` lists "consumer ProGuard/R8 verification" as *needed*; nothing tracks that it is still unmet).

### F2. The iOS release workflow publishes an immutable tag without building or testing anything

- **Severity**: high
- **Axis**: build-release
- **Complexity to fix**: small (<1d)
- **Evidence**: `.github/workflows/release-ios-sdk.yml:44` — `runs-on: ubuntu-latest`. The `publish` job's steps are checkout → resolve version → grep `FrakSDKVersion.current` (`:68-75`) → `mirror-stage` (`:78`) → ssh key → `git push --force "$MIRROR" main` + `git push "$MIRROR" "$VERSION"` (`:116-117`). No `swift build`, no `swift format lint`, no tests — none of which can run on Linux. The only compile is the `verify` job (`:124-153`), which is `needs: publish` + `if: needs.publish.outputs.pushed == 'true'`, i.e. strictly *after* the tag is public. And the workflow itself enforces that tags are never reused (`:112-114`, *"$VERSION is already tagged on the mirror; bump instead of retagging"*), consistent with `docs/plans/native-sdk/05-build-and-release.md:37` ("Binary URLs are immutable — never re-upload or retag").
- **What actually happens**: someone tags `ios-v0.1.0-alpha.1` from a branch where CI never ran (the `changes` filter in `apps.yaml:47-52` only fires on `sdk/ios/**` — a change to `sdk/core` fixtures, or a tag on a commit whose PR only touched `apps/**`, skips the iOS job entirely). The mirror gets a broken snapshot, `verify` goes red, and the version is burnt: it cannot be retagged by policy or by the workflow's own guard.
- **Fix sketch**: split the macOS lint/build/test into a job that `publish` `needs:`, or make `publish` itself `macos-26` and run `scripts/run.sh lint && build && test` before `mirror-stage`. Cheaper alternative: push the branch, run `verify` against the commit, and only push the *tag* afterwards.
- **Register status**: NEW. `06-open-findings.md:24` (B3/1.1) says the iOS path was "proven to resolve and build from a scratch consumer" — true of the payload, silent about the ordering.

### F3. `checkDexSizeBudget` does not exist; four documents describe it as wired, and one reports a measured result from it

- **Severity**: high
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h) to correct the docs; medium to actually build the gate
- **Evidence**: the task name and the property appear only in prose:
  - `docs/plans/native-sdk/02-sdk-design.md:26-27` — *"256 KB of dex per platform, enforced on Android (`frak.sdk.dexBudgetKb` / `checkDexSizeBudget`, wired into `check`)"*
  - `docs/plans/native-sdk/06-open-findings.md:26` (1.2b, marked **Closed**) — *"That makes Android Lint, the dex size budget and the version-drift check part of CI for the first time"*
  - `docs/plans/native-sdk/06-open-findings.md:165` — *"`check` (ktlint, `assembleRelease`, JVM tests, `apiCheck`, Android Lint, dex budget, version drift) green"*
  - `docs/plans/native-sdk/09-android-api-surface.md:712-716` — *"**Run, and it was red.** `:frak-sdk` measured **321 KB against the 256 KB budget**… The budget is now 384 KB… the 150 → 256 → 384 history is in `sdk/android/gradle.properties`"*
  - `sdk/AGENTS.md:66,78` and `AGENTS.md:59` repeat it.
  - Ground truth: `sdk/android/gradle.properties` (20 lines, read in full) contains `frak.sdk.version`, `android.useAndroidX`, `android.nonTransitiveRClass`, `kotlin.code.style` and five `android.defaults.buildfeatures.*` — no budget property, no history comment. `grep -rn "checkDexSizeBudget\|dexBudget"` across the repo returns **only** the six doc hits above. `frak-publish.gradle.kts` registers exactly three tasks (`javadocStub`/`javadocJar`, `checkSdkVersionMatchesArtifact`, `apiBuild`/`apiCheck`/`apiDump`) and `check` gains exactly two dependencies (`:259`, `:298`).
- **What actually happens**: the artifact-size guard that `02-sdk-design.md` makes an architectural constraint, and that `07-sharing-sheet-audit.md:632` / `06:125` invoke when reasoning about Compose and `androidx-webkit` entering `:frak-sdk-ui`, does not run. Nobody knows the shipped dex size. Worse for the audit: `09:712` reports a *measurement from an execution that cannot have happened in this tree*, which devalues every other "verified this pass" claim in the register.
- **Fix sketch**: delete the claim from all five documents, or land a `checkDexSizeBudget` that runs `d8` over the release `classes.jar` plus its runtime classpath and compares against a property.
- **Register status**: CONTRADICTS `1.2b` in `06-open-findings.md:26` and CONTRADICTS `09-android-api-surface.md:712`.

### F4. `FrakSDKUI`'s privacy manifest declares zero required-reason APIs while shipping `DispatchTime`/`mach_absolute_time` on the sheet's hot path

- **Severity**: medium (high if App Store static analysis flags it — the rejection lands on the merchant)
- **Axis**: build-release / merchant-setup
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/ios/Sources/FrakSDKUI/PrivacyInfo.xcprivacy:54-56` — *"Empty: FrakSDKUI touches none of the five required-reason categories."* `<key>NSPrivacyAccessedAPITypes</key><array/>`
  - `sdk/ios/Sources/FrakSDKUI/SharingTrace.swift:11,16,28` — `private let startedAt = DispatchTime.now()` … `let now = DispatchTime.now()`, differenced through `.uptimeNanoseconds` (`:23`). `DispatchTime.uptimeNanoseconds` is `mach_absolute_time()`, which is on Apple's *System boot time APIs* required-reason list.
  - Not dead code and not behind the UIKit gate: `SharingPresentation.swift:85,166`, `SharingWebViewPool.swift:35,52,117,124`, `SharingSheetModel.swift:55,98` all construct it.
  - The core manifest's own comment concedes the stakes: `Sources/FrakSDK/PrivacyInfo.xcprivacy:4-7` — *"That rejection lands on the merchant's upload, not ours: shipping this file wrong or absent breaks every integrator's release."*
- **What actually happens**: a merchant uploads to App Store Connect and gets `ITMS-91053: Missing API declaration` naming `mach_absolute_time` with no idea which SDK caused it — the exact failure mode the core manifest's header warns about, on the target that declares nothing.
- **Fix sketch**: either add `NSPrivacyAccessedAPICategorySystemBootTime` with reason `35F9.1` to `Sources/FrakSDKUI/PrivacyInfo.xcprivacy`, or replace `DispatchTime` with `Date()`/`ContinuousClock` deltas in `SharingTrace` and keep the array empty.
- **Register status**: NEW. `06-open-findings.md:131` lists "iOS privacy manifests on both targets (1.4)" as closed.

### F5. Versioning is internally consistent at `0.0.1`, zero tags exist, and the merchant-facing mirror README already advertises `0.1.0-alpha.1`

- **Severity**: medium
- **Axis**: merchant-setup / docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `sdk/android/gradle.properties:6` `frak.sdk.version=0.0.1`; `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/FrakSdkVersion.kt:10` `CURRENT: String = "0.0.1"`; `sdk/android/package.json:3` `"version": "0.0.1"`.
  - `sdk/ios/Sources/FrakSDK/FrakSDKVersion.swift:3` `current: String = "0.0.1"`; `sdk/ios/package.json:3` `"version": "0.0.1"`.
  - `git tag` on this worktree returns nothing; `sdk/AGENTS.md:60` — *"`main` seeded, no tags yet"*.
  - `sdk/ios/README.mirror.md:17` — the copy-paste install block a merchant reads on the public mirror: `.package(url: "https://github.com/frak-id/frak-ios-sdk.git", exact: "0.1.0-alpha.1")`.
  - The gates themselves are real and do work: `frak-publish.gradle.kts:225-259` (regex `CURRENT:\s*String\s*=\s*"([^"]+)"` matches `FrakSdkVersion.kt:10`, wired into `check`), `sdk/ios/scripts/run.sh:67-87` (dies on either side being unextractable, not just on mismatch — correct), plus tag-vs-source checks at `release-android-sdk.yml:73-78` and `release-ios-sdk.yml:68-75`.
- **What actually happens**: the mirror is live (`05-build-and-release.md:26`) with a README telling merchants to pin a tag that does not exist — `swift package resolve` fails with "the package … does not contain a version 0.1.0-alpha.1". Separately, `0.0.1` is the wrong first coordinate for an alpha: `05:33` documents that `from:` against an alpha-only tag set fails outright, so publishing `0.0.1` as a *release* version silently opts every merchant into `from:`-style resolution of future alphas.
- **Fix sketch**: pick `0.1.0-alpha.1` now, bump all five files in one commit, and make the mirror README's version the thing the release workflow writes rather than a hand-edited literal.
- **Register status**: partially confirms `06-open-findings.md:24` ("`frak.sdk.version`/`FrakSDKVersion.current` are both still `0.0.1`"); the mirror-README mismatch is NEW.

### F6. Nothing ever consumes the published Android artifact — the harness masks exactly the failures publishing introduces

- **Severity**: medium
- **Axis**: build-release / tests
- **Complexity to fix**: small (<1d)
- **Evidence**: `example/native-android/settings.gradle.kts:25-30` uses `includeBuild("../../sdk/android")` with an explicit `dependencySubstitution`, so `implementation("id.frak.sdk:core:0.0.1")` (`example/native-android/app/build.gradle.kts:66-67`) never resolves a POM. iOS has the counterpart job — `release-ios-sdk.yml:124-153` builds a scratch consumer against the real URL, with the rationale spelled out at `:120-122` (*"the only thing that ever exercises the merchant spelling"*) — and Android has **no equivalent** in either `apps.yaml` or `release-android-sdk.yml`.
- **What actually happens**: a composite build resolves project dependencies, so it cannot exercise the published POM/GMM, the `strictly` constraint (`frak-sdk-ui/build.gradle.kts:38-46`), the project→publication coordinate mapping (`frak-sdk` → `core`), or the fact that `androidx.compose.runtime` is `implementation`-scoped while `build(Composer, I)` is public API (`frak-sdk-ui/api/frak-sdk-ui.api:11`). The first real consumption is a merchant's build. A merchant who ends up with `ui:0.1.0` and `core:0.2.0` on the graph gets a hard `strictly` resolution failure, not a downgrade — intended, but never rehearsed.
- **Fix sketch**: add a job that runs `publishToMavenLocal` and then builds a throwaway Gradle app resolving `id.frak.sdk:core`/`:ui` from `mavenLocal()` — the Android twin of the iOS `verify` job.
- **Register status**: NEW (`06:62` D2b covers "the harness has not exercised the sheet", not "the harness cannot exercise the artifact").

### F7. The comment-budget linter — the only gate for Kotlin/Swift comments — runs in no CI workflow

- **Severity**: medium
- **Axis**: tests / docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `AGENTS.md:64` — *"Comments are on a budget, and it is now enforced (`bun run lint:comments`) … `scripts/check-comments.ts` runs inside `bun run lint`, and the rules below are what it checks on every `.kt`/`.swift` file … add one and the build goes red."* But `package.json` defines `"lint": "biome lint . && bun run lint:comments"`, and `grep -rn "bun run lint\|lint:comments" .github/workflows/` returns **nothing**. `apps.yaml:73-74` runs only `bunx biome ci sdk/`, and `biome.json` excludes `sdk/android` and `sdk/ios` (`apps.yaml:70-72` says so itself). The native jobs run `lint` = ktlint (`apps.yaml:152-153`) and `swift format lint` (`:196-197`) — formatters, not the comment budget.
- **What actually happens**: "the build goes red" is false for the one rule the repo says keeps regressing; `scripts/comment-budget-baseline.json` can only be enforced by whoever remembers to run it locally. Given the plan documents themselves record two prior regressions of exactly this rule, an unenforced gate is a matter of time.
- **Fix sketch**: add `bun run lint:comments` (with `bun install --frozen-lockfile`) as a step in `apps.yaml`'s `sdk-lint-test` job, or as its own job gated on the `android`/`ios` filters.
- **Register status**: NEW.

### F8. The Gradle distribution is not checksum-pinned in the pipeline that holds the GPG key and the Portal token

- **Severity**: medium
- **Axis**: security / build-release
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/gradle/wrapper/gradle-wrapper.properties` has `distributionUrl=…gradle-9.5.0-bin.zip` and `validateDistributionUrl=true` but **no `distributionSha256Sum`** (whole 9-line file read). `release-android-sdk.yml:86-91` then runs `./gradlew checkCentralBundle` with `ORG_GRADLE_PROJECT_signingInMemoryKey` in the environment, and `:100-106` uploads with `CENTRAL_PORTAL_USERNAME`/`PASSWORD`. `validateDistributionUrl` only checks that the URL is reachable and well-formed; it verifies no bytes.
- **What actually happens**: the process that decrypts the org's release signing key executes a ~150 MB zip downloaded at job time with no integrity check. That is the standard supply-chain hole for a publishing pipeline, and it is one line to close.
- **Fix sketch**: add `distributionSha256Sum=<sha of gradle-9.5.0-bin.zip>` to `gradle-wrapper.properties`; optionally enable `validate-wrappers` on `gradle/actions/setup-gradle@v5`.
- **Register status**: NEW.

### F9. No documented consumer toolchain floors for Android, and no merchant-facing install snippet at all

- **Severity**: medium
- **Axis**: merchant-setup / docs
- **Complexity to fix**: small (<1d)
- **Evidence**: iOS states its floor prominently (`README.mirror.md:34-36` — *"Requires iOS 15+ and Xcode 16+"*, matching `Package.swift:1` `swift-tools-version: 6.0` and `.swiftLanguageMode(.v6)` at `:36,46`). Android states none:
  - `frak-publish.gradle.kts:66-75` sets `jvmTarget = JVM_17` and `apiVersion`/`languageVersion = KOTLIN_2_2`, compiled by Kotlin `2.4.10` (`libs.versions.toml:6`). The `languageVersion = 2.2` pin is exactly what keeps the emitted Kotlin metadata readable by older compilers, i.e. it *is* the consumer floor — and it is documented nowhere merchant-facing.
  - `sdk/android/README.md:36-42` is the only place coordinates appear, in a contributor-facing module table. There is no `dependencies { implementation("id.frak.sdk:core:…") }` snippet, no `mavenCentral()` note, no minimum AGP/Gradle/Kotlin, no Compose note.
  - `:frak-sdk-ui` drags `compose-ui` + `compose-foundation` + `compose-material3` (`frak-sdk-ui/build.gradle.kts:48-51`) onto every consumer's runtime classpath, `androidx.activity` as `api` (`:55`), and `androidx.webkit` (`:62`). `sdk/AGENTS.md:67` acknowledges the `@Composable build()`/`implementation` asymmetry; nothing tells a merchant.
- **What actually happens**: a merchant on Kotlin 2.0/2.1 adds the dependency and gets *"class file … was compiled with an incompatible version of Kotlin"* with no documented answer; a View-based app discovers it just inherited Material3. With F3 (no dex budget) there is also no number to quote them.
- **Fix sketch**: add an "Install" section to `sdk/android/README.md` (coordinates, `mavenCentral()`, minSdk 24 / JDK 17 / Kotlin 2.2+ / AGP floor, and what `:ui` pulls in), and publish it wherever merchants actually read.
- **Register status**: NEW.

### F10. The Central upload step reports a validation timeout as success

- **Severity**: low
- **Axis**: build-release
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `release-android-sdk.yml:111-127` — `for _ in $(seq 1 60); do sleep 10; … case "$state" in VALIDATED|PUBLISHED) break ;; FAILED) … exit 1 ;; esac; done`. If the deployment is still `PENDING`/`VALIDATING` after 600 s the loop simply ends; the summary block at `:129-138` prints the last `$state` and the step exits 0.
- **What actually happens**: a slow Portal validation shows a green release run whose summary says `PENDING`, and (with `publishing_type: AUTOMATIC`) the artifact may go live minutes later with nobody watching, or fail with nobody notified.
- **Fix sketch**: after the loop, `case "$state" in VALIDATED|PUBLISHED) ;; *) echo "::error::timed out in $state" && exit 1 ;; esac`.
- **Register status**: NEW.

### F11. `:frak-sdk-ui` hard-pins its test JVM to 17 with no toolchain resolver, so a contributor on JDK 21 gets an unresolvable build

- **Severity**: low
- **Axis**: UX/DX
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/android/frak-sdk-ui/build.gradle.kts:26-31` — `javaLauncher.set(javaToolchains.launcherFor { languageVersion.set(JavaLanguageVersion.of(17)) })`. `sdk/android/settings.gradle.kts` (24 lines, read in full) declares no `toolchainManagement` and no `foojay-resolver-convention` plugin, so auto-provisioning is off. `:frak-sdk` has no equivalent pin — the constraint is asymmetric.
- **What actually happens**: a developer whose only JDK is 21 (which AGP 9 otherwise accepts to run Gradle) gets `No matching toolchains found for requested specification: {languageVersion=17} … Auto detection: … Auto download: false` from `:frak-sdk-ui:test` only, with no pointer to the Robolectric reason at `:26`.
- **Fix sketch**: add `plugins { id("org.gradle.toolchains.foojay-resolver-convention") version "…" }` to `settings.gradle.kts`, or document the JDK-17 requirement in `scripts/run.sh`'s `die` path.
- **Register status**: NEW.

### F12. `AGENTS.md` and `sdk/AGENTS.md` still say publishing is broken by Dokka; the code fixed that

- **Severity**: low
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: `sdk/AGENTS.md:63` — *"Publishing is **broken, not merely absent**: `publishToMavenLocal` fails in AGP's bundled Dokka, which cannot parse Kotlin 2.4 class files (A6 …)"*, echoed at `AGENTS.md:59`. But `frak-publish.gradle.kts:55-59` no longer calls `withJavadocJar()` (*"No withJavadocJar(): AGP's javadoc task cannot build this project"*) and ships `javadocStub`/`javadocJar` instead (`:102-135`), and `06-open-findings.md:14` marks A6 **Closed** with a corrected diagnosis (relocated ASM vs `PermittedSubclasses`, not "Kotlin 2.4 class files"). `sdk/android/README.md:198` even reports a real Portal probe of `0.0.1` returning `VALIDATED`.
- **What actually happens**: the two files an agent or new engineer reads first say the release path is broken for a reason that is both fixed and misdiagnosed.
- **Fix sketch**: update both AGENTS files to "publish path wired, nothing published yet".
- **Register status**: CONTRADICTS `AGENTS.md:59` / `sdk/AGENTS.md:63` (confirms `06` A6 is the accurate one).

### F13. Android's `package.json` version is decorative and ungated; the README points at a `version` that does not exist

- **Severity**: low
- **Axis**: build-release / docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**: iOS gates `package.json` against source (`sdk/ios/scripts/run.sh:79-84`, run on `build`/`test`/`mirror-stage`). Android's `checkSdkVersionMatchesArtifact` (`frak-publish.gradle.kts:225-257`) compares only `FrakSdkVersion.CURRENT` against `frak.sdk.version`; nothing reads `sdk/android/package.json:3`, and the release workflow's tag check (`release-android-sdk.yml:73-78`) reads `gradle.properties` only. Separately `sdk/android/README.md:182` — *"Keep it in step with `version` in each `build.gradle.kts`"* — names a property that exists in neither module's build file (it is `frak.sdk.version` in `gradle.properties`).
- **What actually happens**: `sdk/android/package.json` drifts silently forever. Harmless today because it is `private` and Changeset-ignored (`.changeset/config.json` `ignore` includes `@frak-labs-sdk/native-android`), but it is a version string in a repo whose release story is "four version strings must agree".
- **Fix sketch**: either add it to `checkSdkVersionMatchesArtifact` or delete the `version` field; fix the README sentence.
- **Register status**: NEW (the KDoc half of this is closed — `FrakSdkVersion.kt:8` now correctly names `gradle.properties`, so `06:69`'s "points at a `version` in `build.gradle.kts`" is stale for the source but still true of the README).

### F14. Small stale assertions inside shipped build files

- **Severity**: nit
- **Axis**: docs-accuracy
- **Complexity to fix**: trivial (<1h)
- **Evidence**:
  - `frak-sdk/consumer-rules.pro:12` — *"The one serialization surface, FrakError's `readResolve` on its `object` arms"*: `FrakError` has no `object` arms left; all nine are `public class` (`core/FrakError.kt:35,43,51,63,81,92,100,108,116`).
  - `frak-sdk-ui/build.gradle.kts:10-12` sets `resourcePrefix = "frak_"`, but `find sdk/android -type d -name res` returns nothing and there is no `R.string`/`R.drawable` reference in either module — the prefix currently guards zero resources (harmless, but `06:133` files it as a landed fix).
  - `sdk/android/README.md:31` and `scripts/run.sh:120-122` both claim ktlint "only covers subprojects, not the root Gradle scripts" — but the root applies the plugin to itself (`build.gradle.kts:6`, `alias(libs.plugins.ktlint)` with no `apply false`), so `./gradlew ktlintCheck` does lint the root scripts.
  - `sdk/android/README.md:258` — *"Generating the real GPG key and wiring the Portal repository — neither has started"* — directly contradicts `:200` (*"The signing key exists"*) in the same file.
- **What actually happens**: nothing at runtime; these are the sentences the next person will act on.
- **Fix sketch**: one editing pass over the four spots.
- **Register status**: NEW.

## Verified-OK

- **POM completeness for Central**: `frak-publish.gradle.kts:149-182` sets `name`/`description` (per-module, from `frak-sdk/gradle.properties:3-4` and `frak-sdk-ui/gradle.properties:3-4`), `url`, Apache-2.0 licence, `developers`, and all three `scm` fields. `artifactId` is remapped `frak-sdk`→`core`, `frak-sdk-ui`→`ui` (`:26-31`) under group `id.frak.sdk` (`:21`) — consistent with Sonatype's downward-only authorization.
- **Signing + bundle completeness**: `signing` uses in-memory PGP from `ORG_GRADLE_PROJECT_signingInMemoryKey` (`:199-221`), and the opt-in hazard it creates is genuinely backstopped — `build.gradle.kts:69-105` (`checkCentralBundle`) fails if any staged artifact lacks `.asc`/`.md5`/`.sha1`, and `scripts/run.sh:95-101` deliberately runs *that*, not `centralBundle`. The workflow maps the case-sensitive env vars correctly (`release-android-sdk.yml:87-89`).
- **Javadoc stub**: `:102-135` produces a real `-javadoc` jar with an explanatory README rather than an empty jar; `withSourcesJar()` is on (`:57`). Symmetric across both modules.
- **ABI gate**: `apiBuild`/`apiCheck`/`apiDump` (`:264-298`) are wired from BCV's own task types against the release compile tasks, `check` depends on `apiCheck` (`:298`), both dumps are committed (`frak-sdk/api/frak-sdk.api` 758 lines, `frak-sdk-ui/api/frak-sdk-ui.api` 73 lines), `nonPublicMarkers` and the Compose singleton exclusion are configured at the root (`build.gradle.kts:14-23`), and `apiDump`/`apiCheck` are correctly kept in separate invocations (`FrakApiDumpTask.kt:11-13`).
- **Version drift gates**: both work as written and both fail loudly on an unextractable side, not just a mismatch (`frak-publish.gradle.kts:242-253`, `sdk/ios/scripts/run.sh:72-84`). The Android regex matches `FrakSdkVersion.kt:10`; the iOS grep matches `FrakSDKVersion.swift:3`.
- **Manifest / permissions**: `frak-sdk/src/main/AndroidManifest.xml` requests only `INTERNET`, declares two `<queries>` package entries and no `QUERY_ALL_PACKAGES`, no `<application>`, no exported component. `frak-sdk-ui`'s manifest is empty. Namespaces are distinct (`id.frak.sdk`, `id.frak.sdk.ui`), `nonTransitiveRClass=true`.
- **Repository hygiene**: `settings.gradle.kts:13` `FAIL_ON_PROJECT_REPOS`; `google()`+`mavenCentral()` only; `gradle-wrapper.jar` committed; `gradlew`, both `run.sh` files mode `100755`.
- **iOS core privacy manifest**: `Sources/FrakSDK/PrivacyInfo.xcprivacy` declares `NSPrivacyAccessedAPICategoryUserDefaults` with `CA92.1`, which matches reality — `UserDefaultsStore` (`Config/KeyValueStore.swift:19-31`) for config and consent, identity moved to `FileKeyValueStore` (an ordinary file). No file-timestamp read (`setAttributes` at `FileKeyValueStore.swift:130` and `EventQueue.swift:436` set `.protectionKey`, not dates), no disk-space API, no active-keyboard API, and `UIPasteboard` (`NativeShare.swift:55,67`) is correctly *not* a required-reason category. Collected-data types (UserID / PurchaseHistory / ProductInteraction) match the code paths.
- **`Package.swift`**: tools-version 6.0 with `.swiftLanguageMode(.v6)` on all four targets, two `.library` products, both privacy manifests as `.copy` resources (correct — must land unmodified at the bundle root), zero dependencies, iOS 15 / macOS 12 floors justified in-file (`:4`).
- **Mirror staging**: `run.sh:204-226` refuses an existing output directory, copies `Sources`/`Package.swift`/`LICENSE`/`README.mirror.md`, deliberately omits `Tests/` (the golden corpus walks to the monorepo root), and hard-fails if either `PrivacyInfo.xcprivacy` is missing from the staged payload — a good gate.
- **CI shape**: `apps.yaml` gates macOS on `dorny/paths-filter` (`:33-52`), pins JDK 17 (`:128-132`), sets `ANDROID_HOME` via `android-actions/setup-android@v4`, makes Gradle cache read-only off `dev`/`main` (`:147`), and runs every native step through the same `run.sh` a developer runs. Neither native job needs `bun install`, and none is required. `release.yml`/`beta-release.yml` are branch-triggered and cannot collide with `android-v*`/`ios-v*` tags.
- **React Native / Flutter / Capacitor**: nothing shipped, and correctly so — `grep -rln "react-native|flutter|capacitor"` over `sdk/`, `example/` and `docs/plans/native-sdk/` returns nothing but `05-build-and-release.md:54` planning RN "later and additive" with a mandatory Expo config plugin. No half-built wrapper to clean up.

## Could not verify

- Whether the build actually succeeds under AGP 9.1.1. One specific risk I could not resolve by reading: `sdk/android/gradle.properties:16-20` sets `android.defaults.buildfeatures.{buildconfig,aidl,renderscript,resvalues,shaders}`, several of which were deprecated with "removal in AGP 9.0". If AGP 9.1 hard-errors on a removed option, every Gradle invocation in this repo fails. Worth 5 minutes on a machine with a JDK before the release tag.
- Whether `androidx.lifecycle-viewmodel` (transitive via `androidx.activity:1.13.0`) still ships the `-keepclassmembers … extends ViewModel { <init>(); }` consumer rule that F1 currently depends on. Unpinned in `libs.versions.toml`, so this can change under an activity bump.
- The claimed Portal probe (`sdk/android/README.md:198`, `06:24`: `0.0.1` → `VALIDATED`, then dropped) and the GPG key's presence on keyservers (`05:47`) — both are external state.
- Whether SwiftPM really tolerates a dependency manifest whose `.testTarget` paths are absent (`Package.swift:48-59` vs a mirror payload without `Tests/`). The behaviour is plausible (non-root test targets are dropped from the graph) and `run.sh:196-200` claims it was verified against a scratch package, but it is the single point of failure for every merchant resolve and only the `verify` job proves it — after the tag is public (F2).
- Actual dex/AAR sizes for either artifact — there is no gate and no recorded measurement in the tree (F3).
- Whether `gradle/actions/setup-gradle@v5` validates the wrapper by default (relevant to F8).

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "14 ranked findings with severity, axis, fix complexity and path:line evidence written to /tmp/frak-audit/build-release-ci.md, plus Verified-OK and Could-not-verify sections."
    }
  ],
  "changedFiles": [],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "grep -rn \"checkDexSizeBudget|dexBudget\" .",
      "result": "passed",
      "summary": "Only 6 hits, all in docs/*.md and AGENTS.md; no Gradle task, no gradle.properties entry — F3."
    },
    {
      "command": "grep -rn \"Class.forName|::class.java|JavascriptInterface|reflect\" sdk/android/**/src/main",
      "result": "passed",
      "summary": "One reflective site: SharingHost.kt:461 ViewModelProvider[SharingViewModel::class.java], against two empty consumer-rules.pro files — F1."
    },
    {
      "command": "grep -rn \"UserDefaults|UIPasteboard|DispatchTime|FileManager|resourceValues\" sdk/ios/Sources",
      "result": "passed",
      "summary": "Core privacy manifest matches code; FrakSDKUI uses DispatchTime.uptimeNanoseconds while declaring zero required-reason APIs — F4."
    },
    {
      "command": "grep -rn \"bun run lint|lint:comments\" .github/workflows/",
      "result": "passed",
      "summary": "No hits — the comment-budget gate AGENTS.md calls enforced runs in no workflow — F7."
    },
    {
      "command": "git tag; git ls-files -s sdk/android/gradlew sdk/*/scripts/run.sh",
      "result": "passed",
      "summary": "No tags exist; wrapper and both run.sh are mode 755."
    }
  ],
  "validationOutput": [
    "Read in full: sdk/android/{build,settings}.gradle.kts, gradle.properties, libs.versions.toml, gradle-wrapper.properties, buildSrc/**, both module build files + gradle.properties + consumer-rules.pro + AndroidManifest.xml, scripts/run.sh, package.json.",
    "Read in full: sdk/ios/Package.swift, both PrivacyInfo.xcprivacy, scripts/run.sh, package.json, README.mirror.md install block.",
    "Read in full: .github/workflows/apps.yaml, release-android-sdk.yml, release-ios-sdk.yml; trigger blocks of release.yml and beta-release.yml.",
    "Read in full: docs/plans/native-sdk/05-build-and-release.md and 06-open-findings.md; the ABI/dex sections of 09-android-api-surface.md.",
    "Cross-checked: example/native-android/settings.gradle.kts + app/build.gradle.kts (isMinifyEnabled=false), example/native-ios/Package.swift, .changeset/config.json, root package.json scripts."
  ],
  "residualRisks": [
    "Cannot compile: AGP 9.1.1 may hard-error on the removed android.defaults.buildfeatures.* options in sdk/android/gradle.properties:16-20, which would break every Gradle invocation. Unverifiable without a JDK.",
    "F1's severity depends on whether the transitive androidx.lifecycle-viewmodel still ships its ViewModel <init>() keep rule; androidx.lifecycle is deliberately undeclared in the version catalog, so this can regress under an androidx.activity bump.",
    "The Portal VALIDATED probe, the GPG keyserver state and the live mirror repo contents are external and were taken on the docs' word.",
    "SwiftPM's tolerance of a dependency manifest with absent .testTarget paths is the single point of failure for every merchant resolve and is only proven post-tag by the verify job."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repo files modified (read-only audit). One artifact written: /tmp/frak-audit/build-release-ci.md",
  "reviewFindings": [
    "high: sdk/android/frak-sdk-ui/consumer-rules.pro:6-9 + SharingHost.kt:461 - both consumer-rules files are empty and assert nothing is reflective, but the sheet is entered via ViewModelProvider reflection; example/native-android/app/build.gradle.kts:29 sets isMinifyEnabled=false, so R8 has never run on this SDK anywhere.",
    "high: .github/workflows/release-ios-sdk.yml:44,116-117 - publishes an immutable mirror tag from ubuntu-latest with no swift build, lint or test; the only compile is the verify job, which runs after the irreversible push.",
    "high: docs/plans/native-sdk/09-android-api-surface.md:712 + 06-open-findings.md:26,165 - checkDexSizeBudget / frak.sdk.dexBudgetKb do not exist in the tree, yet the register reports a measured 321 KB result and lists the gate as part of a green CI check.",
    "medium: sdk/ios/Sources/FrakSDKUI/PrivacyInfo.xcprivacy:54-56 vs SharingTrace.swift:11,23 - NSPrivacyAccessedAPITypes is empty while the module uses DispatchTime.uptimeNanoseconds (mach_absolute_time), an ITMS-91053 risk landing on the merchant's upload.",
    "medium: sdk/ios/README.mirror.md:17 - merchant-facing install block pins exact 0.1.0-alpha.1 while every version string in the repo is 0.0.1 and no tags exist.",
    "medium: example/native-android/settings.gradle.kts:25-30 - Android has no counterpart to release-ios-sdk.yml's verify job, so the published POM/GMM/strictly constraint is first exercised by a merchant.",
    "medium: package.json:lint vs .github/workflows/* - bun run lint:comments, the only Kotlin/Swift comment gate, runs in no CI workflow despite AGENTS.md:64 calling it enforced.",
    "medium: sdk/android/gradle/wrapper/gradle-wrapper.properties - no distributionSha256Sum in the pipeline that decrypts the GPG signing key (release-android-sdk.yml:86-91).",
    "medium: sdk/android/README.md:36-42 - no merchant install snippet and no documented Kotlin 2.2 / JDK 17 / AGP consumer floors, unlike iOS's README.mirror.md:34-36.",
    "low: .github/workflows/release-android-sdk.yml:111-127 - a Portal validation timeout exits 0 and is reported as a successful release.",
    "low: sdk/android/frak-sdk-ui/build.gradle.kts:26-31 - JDK 17 test toolchain pin with no foojay resolver in settings.gradle.kts.",
    "low: sdk/AGENTS.md:63 and AGENTS.md:59 - still claim publishing is broken by AGP's Dokka; frak-publish.gradle.kts:55-59,102-135 fixed that and 06-open-findings.md:14 marks A6 closed.",
    "low: sdk/android/package.json:3 - version ungated by any check, unlike the iOS twin; sdk/android/README.md:182 points at a `version` in build.gradle.kts that does not exist.",
    "nit: frak-sdk/consumer-rules.pro:12 names FrakError `object` arms that no longer exist; frak-sdk-ui resourcePrefix guards zero resources; README.md:31 and scripts/run.sh:120-122 wrongly claim ktlint skips the root scripts; README.md:200 vs :258 contradict each other on the GPG key."
  ],
  "manualNotes": "Two register claims are provably false against this tree and should be treated as contaminating adjacent 'verified this pass' statements: the dex budget (F3) and the AGENTS.md Dokka/publishing status (F12). Conversely, several register entries I expected to be stale are accurate — the A6 javadoc-stub fix, the ABI gate wiring, and both version-drift gates are real and correctly implemented. Ranking for 'must fix before an artifact goes on Central / a SwiftPM tag': F1 and F2 are hard blockers; F4 and F5 must land in the same commit as the version bump; F3, F6, F7 are the credibility/coverage debt to clear immediately after."
}
```
