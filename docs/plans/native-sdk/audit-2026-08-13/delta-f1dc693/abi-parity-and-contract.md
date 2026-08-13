# Delta review — ABI, cross-platform parity, native↔web contract

Scope: `git diff c0a0cec origin/dev` (12 commits, HEAD `f1dc693`). Read-only, no toolchain; every claim below is
from source. Prior audit read first: `docs/plans/native-sdk/11-alpha-audit.md` §4 and
`docs/plans/native-sdk/audit-2026-08-13/parity-and-web-contract.md` (F1–F13), plus `register-challenge.md:232` (A2)
and `06-open-findings.md:66` (9.15).

---

## Verdict on the delta

Worse for an alpha, on my three axes, and worse in a way that is cheap to see and cheap to fix.

The delta's *engineering* is good — the fragment contract is symmetric key-for-key, the wire strings and the
`significance` ladder are byte-identical across Kotlin and Swift, the ABI dump edit is minimal and machine-shaped,
and the new params all have decoders. But it does three things that an alpha should not be doing:

1. **It performed exactly the consumer break §4 item 6 warned about**, on `SharingResult`, hours after the audit that
   listed that hierarchy as the *safe* one — and Frak's own harness needed a source edit to compile (`eccb8c2`,
   `example/native-android/.../MainActivity.kt:303`). The Kind discriminator did not prevent it; it was never able to.
2. **It widened the parity gap rather than narrowing it.** iOS gained four public symbols and one replaced modifier
   signature (`FrakSharingConfiguration`, `FrakInstallPresentation`, `detectInstall`, `FrakSharingDefaults.install`)
   with no Android twin and no decision recorded. Android gained one arm iOS already had. Register 9.15's list is
   longer than it was.
3. **It grew the ungated `/install` contract from 6 keys to 10 with no version signal** — the surface §2.4 named as
   the only ungated thing a frozen binary depends on. `/sharing` at least carries `sdkVersion`; `/install` carries
   nothing, on either platform.

Plus one live bug the delta shipped: the new "Open the wallet" CTA still points at the App Store
(`InstallView.tsx:487`), masked only by the iOS sheet intercepting the tap.

---

## Prior findings CLOSED by these commits

| Prior id | Status | Proof |
|---|---|---|
| `parity-and-web-contract.md` F9, "The asymmetry: Swift `SharingPageURL.build` has no `confirmed:` parameter" | **Not closed** — see below. Listed here only to say the delta touched `SharingPageURL.swift` (+46) and did not fix it: `SharingPageURL.swift:35-46` still has no `confirmed:`. | `sdk/ios/Sources/FrakSDKUI/SharingPageURL.swift:35` |
| `11-alpha-audit.md` §3.9, second half: "`SharingPresenter.teardown()` abandons a live session — no `dispose`" | **Closed** | `48d7e2c`; `sdk/ios/Sources/FrakSDKUI/SharingPresentation.swift:269` `presentation?.dispose()` now runs ahead of `reclaimWebView()`, with the reason inline. |
| `parity-and-web-contract.md` F13 / register-adjacent: "iOS App Store link ignores the environment" | **Documented, not fixed** | `docs/plans/native-sdk/03-sharing-and-install.md` (new section "Dev configs: the probe is right, the listing is wrong, and that is documented not fixed", with a per-platform table). The constant is unchanged at `sdk/ios/Sources/FrakSDK/AppLink/InstallLinks.swift:3`. Downgrading it from "undocumented" to "documented" is a real, if small, close. |
| Implicit: "iOS `openFrakApp` has no universal-link rung, so a wallet whose scheme is undeclared can never be handed off" | **Closed on iOS** | `b68f989`; `sdk/ios/Sources/FrakSDK/DefaultFrakClient.swift:388-393` tries `openUniversalLink` first, and the fragment carrier `#p=` *is* read by the wallet router (`apps/wallet/app/utils/deepLink.ts:122-130,167`), so the proof survives that hop. This is a genuine improvement — and a new Android gap (N6). |

**Positive, verified:** the `walletOpened` wire string and the `significance` ladder really are identical on both
platforms — `SharingResult.kt:22` `WALLET_OPENED("walletOpened")` vs `SharingResult.swift:23` `case walletOpened`
(String raw value), and `0/1/2/3/4` in the same order at `SharingResult.kt:69-73` vs `SharingResult.swift:44-48`.
Kind member *order* also matches (shared, copied, installStarted, walletOpened, dismissed, failed). Answer to
question 1(d) on consistency: **yes, consistent**. Whether the ordering is *right* is N4.

---

## Prior findings NOT closed, or made worse

- **§2.5/2.6 (merchant cannot integrate; `LSApplicationQueriesSchemes` undocumented) — made materially worse.**
  `11-alpha-audit.md:127` said the merchant-facing README never names the plist key or the scheme strings. It still
  does not: `sdk/ios/README.mirror.md:95` says only *"the same `LSApplicationQueriesSchemes` entry
  `isFrakAppInstalled()` already needs"* — no key, no `frakwallet`/`frakwallet-dev` strings, no plist snippet, no
  Associated Domains. `grep -rn "frakwallet" sdk/ios/README*.md` → no hits. This delta made that omission
  load-bearing for a **default-on** feature (`FrakSharingDefaults.detectInstall = true`,
  `sdk/ios/Sources/FrakSDKUI/SharingSheetLogic.swift:250`): a merchant who follows the README gets `probe=undeclared`
  on every install, one `logger.error` per process, and detection that never fires.
- **§4 item 6 (versioned public hierarchies with no unknown arm) — demonstrated, not fixed.** See N1. `FrakContext`,
  `FrakEnvironment`, `RewardTier` still have no discriminator (`register-challenge.md:232`).
- **§4 item 2 / register 9.15 (call-site shape diverges) — widened.** See N2.
- **`parity-and-web-contract.md` F9 asymmetry (Swift `build` has no `confirmed:`) — untouched** despite the file
  being edited (+46). `SharingPageURL.swift:35`.
- **§2.4 (the native↔web contract is ungated) — the delta doubled down.** See N3 and N5.
- **F1/F2 (`golden-sharing-links.json`, the highest-leverage un-built artifact) — untouched.** The delta added a
  *new* three-key contract (`installed`/`dt`/`via`) with, again, no shared corpus: the wire values live once in
  `SharingPageURL.swift:117-121` + `:127-133` and once in `apps/wallet/app/module/install/params/table.ts:40-43`,
  hand-mirrored, asserted separately in `SharingPageURLTests.swift` and `fragment.test.ts`.

---

## NEW findings

### N1. `SharingResult` grew a sixth arm on a public sealed hierarchy — a source *and* binary break, on the type the register had just certified safe

- **Severity**: high
- **Axis**: ABI
- **Complexity to fix**: structural (the decision), trivial (the mitigation)
- **Introduced by**: `eccb8c2`
- **Evidence**:
  - The hierarchy's own KDoc states the hazard: `sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingResult.kt:11-12` — *"A `when` over [Kind] with an `else` survives a new arm; **a `when` over the hierarchy does not**."*
  - The new arm: `SharingResult.kt:50-52` `public object WalletOpened : SharingResult`.
  - **Frak's own first-party consumer had to be edited to keep compiling**: `example/native-android/app/src/main/kotlin/id/frak/example/android/MainActivity.kt:303` `+ SharingResult.WalletOpened -> addLog(...)`, added in the same commit, into a `when` that already had `SharingResult.Dismissed ->` / `is SharingResult.Failed ->`.
  - Prior audit: `11-alpha-audit.md:235` — *"A2 fixed this for `FrakError`/`SharingResult`/`Interaction` and stopped."*
- **(a) Is this the break §4 item 6 / A2 predicted?** Yes, and more precisely than either got credit for. A2's
  mitigation (`register-challenge.md:232`) is **opt-in on the consumer**: it works only for a merchant who chose to
  `when (result.kind)` with an `else`. Every merchant who wrote the natural `when (result)` — which is what the SDK's
  own harness wrote, and what the sample code in every README teaches — breaks. Concretely:
  - **`when` used as a statement** (the harness's shape): a `SharingResult.WalletOpened` delivered to a binary
    compiled against 5 arms matches no branch and **silently does nothing** — the merchant's success handler never
    runs, with no crash and no log.
  - **`when` used as an expression**: `NoWhenBranchMatchedException` at runtime, in the merchant's result callback.
  - Source-wise it is a hard compile break on rebuild.
  The audit called `SharingResult` one of the *fixed* hierarchies. It was never fixed; it was documented.
- **(b) What this says about the other hierarchies.** `SharingResult` went 5 → 6 arms in the same working day as the
  audit that certified it. That is the growth rate of the *most* scrutinised hierarchy in the SDK, the one with a
  discriminator, a wire contract, a cross-platform twin and an ABI gate pointed at it. `FrakError` (9 members),
  `FrakContext`, `Interaction` and `RewardTier` are all younger, all still growing (the backend adds reward fields,
  interaction types and error kinds on a JS release cadence), and `FrakContext`/`FrakEnvironment`/`RewardTier` have
  **no discriminator at all** (`register-challenge.md:232`: *"`FrakEnvironment`/`RewardTier` are indeed still bare
  hierarchies"*). The empirical answer is: assume every one of them gains an arm inside the first alpha cycle, and
  that at least one of them is `FrakError` (which merchants `when` on far more often than `SharingResult`).
- **(c) Dump correctness — verified clean.** `sdk/android/frak-sdk-ui/api/frak-sdk-ui.api:61` (`WALLET_OPENED` field,
  in the dump's alphabetical position between `SHARED` and the accessors) and `:75-79` (the `WalletOpened` class
  block, alphabetically after `Shared`, at end of file). Member set is byte-identical in shape to the peer object
  `Dismissed` (`:36-40`): `$stable I`, `INSTANCE`, `getKind ()`. No stray `synthetic <init>`, no `frak-sdk.api`
  churn, one blank-line separator, trailing newline. It is what `apiDump` produces. **One thing the dump cannot
  see, and that is the real gap:** the source inserted `WALLET_OPENED` at `SharingResult.kt:22`, *between*
  `INSTALL_STARTED` and `DISMISSED`, so `DISMISSED.ordinal` went 3→4 and `FAILED.ordinal` 4→5. The dump sorts fields
  alphabetically, so **an enum reordering is invisible to the ABI gate** — `Kind.entries` order and any consumer
  persisting `ordinal()` (a `Bundle`, a Room column, a `writeInt(kind.ordinal)` in a `Parcelable`) changes with a
  green gate. Here it is harmless because nothing persists it, but the gate does not know that and will not tell you
  next time.
- **What actually happens**: a merchant on `id.frak.sdk:ui:0.1.0` who wrote `when (result) { … }` and upgrades gets a
  compile error at best, a silently-dead success handler at worst. The commit that did it has a **one-line message
  with no body** (`git log -1 --format=%B eccb8c2`) — no compat note, no changelog entry, no `@since`.
- **Fix sketch**: decide the rule *before* `0.1.0`, not after. Either (i) make the hierarchies non-exhaustive for
  consumers by shipping an explicit `Unknown`/`@FutureArm` arm on each of `SharingResult`, `FrakError`,
  `FrakContext`, `Interaction`, `RewardTier` and documenting `when(kind)` as the only supported shape, or (ii)
  collapse `SharingResult` to `Kind` + payload accessors and drop the sealed hierarchy from the public surface. Also
  append new enum members at the **end** and add an ordinal-stability assertion to `SharingResultTest` — the ABI gate
  cannot cover it.

### N2. iOS gained four public knobs and a replaced modifier signature with no Android twin and no recorded decision — register 9.15's list is longer than it was

- **Severity**: high
- **Axis**: parity
- **Complexity to fix**: medium (port or write the divergence down)
- **Introduced by**: `0e74a65`, `e79484a`, `2537681`, `b68f989`, `48d7e2c`
- **Evidence** — every new/changed public symbol in the delta, with its twin:

| Symbol | iOS | Android | Verdict |
|---|---|---|---|
| `SharingResult.walletOpened` / `WalletOpened` | `SharingResult.swift:13` | `SharingResult.kt:50` | **matched**, wire string `walletOpened` identical (`:23` vs `:22`), significance `4` identical (`:48` vs `:73`) |
| `SharingResult.Kind.walletOpened` | `SharingResult.swift:23` | dump `frak-sdk-ui.api:61` | **matched** |
| `FrakSharingConfiguration` | `FrakSharingConfiguration.swift:4` (public struct, `Sendable, Hashable`) | **none** — Android's knob is still `FrakSharing.Builder.heightFraction(F)` (`frak-sdk-ui.api:13`) | **asymmetry, new** |
| `FrakInstallPresentation` (+ `.Overlay`, `.Overlay.Position`) | `FrakSharingConfiguration.swift:30,44,47` | **none** | **asymmetry, new** (arguably justified — no `SKOverlay` on Android — but nothing says so in a header a merchant reads) |
| `FrakSharingDefaults.install`, `.detectInstall` | `SharingSheetLogic.swift:247,250` | dump has only `getHEIGHT_FRACTION ()F` (`frak-sdk-ui.api:24`) | **asymmetry, new** |
| `View.frakSharingSheet(… configuration:)` replacing `heightFraction:` | `FrakSharingSheet.swift:19` | Android unchanged | **call-site shape now diverges** — exactly register 9.15's class of defect |
| `AppLinkAPI.walletSchemeStatus()` / `ProbeStatus` | `AppLinkAPI.swift:24-27`, `QueriedSchemes.swift:9` (`@_spi(FrakInternal) public`) | **none** | acceptable (`@_spi`, iOS-only concept), but it is `public` in the binary |
| `QueriedSchemes` (`cap`, `declares`, `status`, `isAtCap`, `declaredInMainBundle`) | `QueriedSchemes.swift:14-42` (`@_spi public`) | **none** | acceptable, same caveat |
| `AppLauncher.openUniversalLink` → iOS `openFrakApp` universal-link rung | `AppLauncher.swift:31-35`, `DefaultFrakClient.swift:388-393` | Android `openFrakApp` is scheme→store only (`DefaultFrakClient.kt:322-334`) | **behavioural asymmetry, new** — see N6 |
| `detectInstall` / `InstallProbe` / `InstallSurface` / `installPageProbed` / `installDetectedFragment` | `SharingSheetModel.swift:107,142`, `InstallProbe.swift`, `SharingPageURL.swift:114-133` | **none** — `grep -rn "probe\|detectInstall\|InstallSurface" sdk/android/*/src/main` → **zero hits** | **asymmetry, new** — see N3 |

- **What actually happens**: a merchant shipping both platforms writes `configuration: FrakSharingConfiguration(heightFraction: 0.9, install: .overlay(…))`
  on iOS and `FrakSharing.Builder(cb).heightFraction(0.9f)` on Android, and has no way to express the install surface
  or opt out of detection on Android because neither concept exists there. `06-open-findings.md:66` already tracks
  `RewardsApi.best`, the ten resolved-config constructors, both `FrakContext` constructors and the six
  Builder-vs-`init` input types. This delta adds **five more rows** and, unlike 9.15's existing rows, none of them is
  written down anywhere as a decision — `README.mirror.md:73-96` presents `FrakSharingConfiguration` as if it were
  the cross-platform sheet API, and `SharingSheetLogic.swift:241-242` is the only place that says *"`install` is
  iOS-only"*.
- **Answer to "did this delta widen or narrow 9.15's list"**: **widened**, by five rows, on the surface that freezes
  first. The only narrowing is `SharingResult`, which now matches — at the cost of N1.
- **Fix sketch**: before `0.1.0`, either (i) give Android a `FrakSharingConfiguration` with `heightFraction` and a
  no-op-documented `detectInstall`, so the call-site shape matches and Android can grow into it, or (ii) put a
  "platform-specific surface" table in **both** READMEs listing every symbol that exists on one side only, and add it
  to `09-android-api-surface.md` as a gated list. Silence is the failure mode here.

### N3. `/install` is now an iOS-shaped page: Android sends none of the four new keys, and the page cannot tell an Android binary from a broken iOS one

- **Severity**: high
- **Axis**: parity / correctness
- **Complexity to fix**: medium
- **Introduced by**: `b68f989`, `3a8da9b`, `48d7e2c`
- **Evidence** — full symbol-by-symbol diff of the `/install` contract after the delta:

| Key | Carrier | Sent by iOS | Sent by Android | Read by wallet |
|---|---|---|---|---|
| `embed=native`, `m`, `a`, `returnScheme`, `sid` | query | `InstallLinks.swift:66-71` | `InstallLinks.kt:60-65` | `install/params.ts:34-41` (`parseInstallSearch`) |
| `p` | fragment | `InstallLinks.swift:73` | `InstallLinks.kt:66` | `params.ts:52` (`parseInstallProofFragment`) **and** `params/table.ts:38` (second parser) |
| `sid` | **fragment (new)** | `SharingPageURL.swift:117-119` | **no** | `params/table.ts:39` decodes it — **and nothing ever reads it** (`grep "activation?.sid"` → 0 hits) |
| `probe` = `ok\|undeclared\|disabled` | **fragment (new)** | `SharingPageURL.swift:120` + `:139-145` | **no** | `params/table.ts:40`, `InstallView.tsx:277-284` |
| `installed=1` | **fragment (new)** | `SharingPageURL.swift:131` | **no** | `params/table.ts:41`, `InstallView.tsx:248` |
| `dt` (ms) | **fragment (new)** | `SharingPageURL.swift:132` | **no** | `params/table.ts:42`, `InstallView.tsx:292` |
| `via` = `overlay\|product` | **fragment (new)** | `SharingPageURL.swift:133` + `InstallSurface:161-164` | **no** | `params/table.ts:43`, `InstallView.tsx:293` |

  Value sets match exactly where both sides exist: `ProbeStatus.rawValue` `"ok"/"undeclared"/"disabled"`
  (`SharingPageURL.swift:139-145`) vs `oneOf("ok", "disabled", "undeclared")` (`table.ts:40`); `InstallSurface`
  `"overlay"/"product"` (`:162-163`) vs `oneOf("overlay", "product")` (`table.ts:43`); `installed=1` literal vs
  `oneOf("1")` (`table.ts:41`). `install_probe_unavailable`'s TS reason type `"disabled" | "undeclared"`
  (`packages/wallet-shared/src/common/analytics/events/install.ts:26`) is the correct narrowing of `probe` minus
  `"ok"`. **The key-for-key contract is clean.** The problem is who speaks it.
- **What actually happens**:
  - **Android binary → install page**: hash is `#p=<proof>` only. `parseInstallFragment` returns `{p}`,
    `installed` is `undefined`, `installed === "1"` is false, so the page renders the pre-delta "Don't lose your
    reward / Download" state. **Correct by luck** — because `installed` is opt-in-truthy rather than a tri-state.
    But `install_probe_unavailable` never fires either (`InstallView.tsx:279` `if (!probe …) return`), so the funnel
    shows **zero** Android rows for a metric that is 100 % iOS by construction. Any dashboard comparing
    `install_detected` across platforms reads Android as "nobody ever installs", which is the exact
    data-comparability failure `11-alpha-audit.md` §5 already flagged for share counts.
  - **iOS binary → install page, but the merchant's `detectInstall: false`**: `probedInstallURL(…, probe: .disabled)`
    (`SharingSheetModel.swift:460`) → the page fires `install_probe_unavailable(reason: "disabled")` for **every
    install page view** of that merchant. A deliberate opt-out is now an event stream indistinguishable in volume
    from a misconfiguration.
  - **The page cannot tell the two apart.** `probe` present ⇒ iOS; absent ⇒ Android *or* an older iOS binary *or* a
    web-originated `/install` (`buildInstallUrl.ts`). Absence-of-a-key is now the de facto platform discriminator,
    and it is unversioned, undocumented and untested. See N5.
- **`sid` is the one key nobody reads.** `03-sharing-and-install.md` (new section, "Scope on `sid`") states as a
  requirement: *"The web view is pooled; a stale `installed=1` must not land on a rebound session."* The **native**
  half is implemented (`SharingSheetModel.swift:481` `guard showingInstallPage, self.sessionId == sessionId`;
  `InstallProbe.swift:97` `guard self.sessionId == sessionId`). The **page** half is not: `InstallView.tsx:248` reads
  `activation?.installed` with no comparison against the query `sid` it already receives (`InstallView.tsx:214`).
  The doc describes a two-sided guard; one side is a decoder with no consumer.
- **Fix sketch**: (1) have `InstallCodeView` require `activation.sid === sid` before honouring `installed`, closing
  the documented guard; (2) send `probe=unsupported` (or simply `sdkVersion`) from Android's `InstallLinks.installPage`
  so absence stops meaning three things; (3) put the four new keys and their value sets in a fixture consumed by both
  `SharingPageURLTests.swift` and `fragment.test.ts`, the `golden-context.json` pattern F2 asks for.

### N4. `walletOpened` is now the top of the significance ladder, so it masks a real share

- **Severity**: medium
- **Axis**: correctness (analytics)
- **Complexity to fix**: small
- **Introduced by**: `eccb8c2` (Android), `b68f989` (iOS)
- **Evidence**:
  - `SharingResult.kt:69-73` and `SharingResult.swift:44-48`: `failed 0 < dismissed 1 < shared/copied 2 < installStarted 3 < walletOpened 4`.
  - `SharingOutcome.kt:30-41` — `record` keeps the max; `finish(result)` records then reports `best ?: result`. So a
    `record`ed `WalletOpened` **outranks a later `finish(Shared)`**.
  - The `record`-not-`finish` path exists on both platforms: Android `SharingSheetState.kt:441-444`
    (`openExternally` → `outcome.record(SharingResult.WalletOpened)`, sheet stays open — its own test asserts this,
    `SharingSheetStateTest.kt` *"the sheet stays open, so nothing is reported yet"*); iOS
    `SharingSheetModel.swift:361` `report(.walletOpened)` with no `close()`, accumulated by
    `FrakSharingSheet.swift:88-90` `if result.significance > (best?.significance ?? -1)`.
- **What actually happens**: user taps the page's own store link, the wallet is already installed, the SDK deep-links
  into it and records `WalletOpened`; the user comes back, actually shares, and `finish(Shared)` reports
  **`.walletOpened`**. The merchant's `onResult` never sees the share — the single highest-value business event in
  the sheet — for any session that also opened the wallet. The tracked `sharing` interaction still fires, so rewards
  are unaffected; the merchant's own funnel is not. `installStarted` (3) already outranked `shared` (2) before this
  delta, so the *class* of defect is pre-existing; this delta raises the ceiling and puts a much more reachable event
  (any tap on the store link, any number of times) above the share.
- **Is the ordering right?** Cross-platform: **yes, consistent** — same integers, same order, both files. Semantically:
  **no.** `walletOpened` means "we launched another app"; `shared` means "the referral link left the device". Ranking
  a hand-off above a conversion inverts the business value. `installStarted` above `shared` has the same problem and
  is the older half of it.
- **Fix sketch**: either (i) demote `walletOpened`/`installStarted` below `shared`/`copied` (2 → 4, 3 → 2/3), or
  better (ii) stop collapsing a session to one arm — the callback already has a `Kind`, so deliver the set. Option
  (ii) is the one `SharingOutcome`'s own doc comment ("a session can produce several results") is arguing for.

### N5. The contract grew by four keys; no versioning or negotiation was added, and `/install` does not even carry `sdkVersion`

- **Severity**: medium
- **Axis**: ABI / merchant-setup
- **Complexity to fix**: small
- **Introduced by**: `b68f989`, `3a8da9b`
- **Evidence**:
  - `/sharing` carries a version: `SharingPageURL.swift:59` / `SharingPageUrl.kt` emit `sdkVersion`, decoded at
    `apps/wallet/app/module/sharing/params/table.ts:76`. It is **telemetry only** — the sole consumer is
    `packages/wallet-shared/src/sharing/hooks/useSharingPageController.ts:153` `sdk_version: sdkVersion` inside a
    `trackEvent`. No branch, no gate, no minimum.
  - `/install` carries **no version at all**: `grep -n "sdkVersion" sdk/ios/Sources/FrakSDK/AppLink/InstallLinks.swift
    sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/applink/InstallLinks.kt` → no hits, before and after the delta.
  - Nothing in the delta adds a `v=`, a capability list, or a minimum-page-version check.
  - `apps/wallet/app/module/install/params/table.ts:2-7` *declares* an `InstallParamTransport` axis — and it is dead:
    `fragment.ts:23` iterates `Object.keys(INSTALL_PARAMS)` unconditionally, and nothing else in the repo reads
    `.transport` (`grep -rn "transport" apps/wallet/app/module/install` → declaration sites only). The sharing twin
    genuinely uses it (`sharing/params/table.ts:105,118`). So the install table carries the *shape* of a gate with
    none of the behaviour, and every key is marked `"both"` including `installed`/`dt`/`via`, which the query parser
    (`params.ts:31-43`) does not read — i.e. the table documents a query transport that does not exist.
- **What actually happens**: a merchant's frozen 0.1.0 iOS binary sends `#…&installed=1&dt=…&via=overlay` forever.
  When the page later renames `via` to `surface`, or adds `installed=2` for "installed but not linked", the frozen
  binary has no way to say what it speaks and the page has no way to ask. The delta made the contract 66 % bigger
  (6 → 10 keys) in the one direction that cannot be rolled back.
- **Fix sketch**: emit `sdkVersion` on `/install` from both `InstallLinks` (one line each, mirrors `/sharing`) and add
  a `v=1` to the activation fragment; make the page treat an unknown `v` as "render the pre-detection state". Then
  either wire `transport` into `parseInstallFragment` or delete the field.

### N6. Android's `openFrakApp` has no universal-link rung, so the two platforms now recover from a hijacked/undeclared scheme differently

- **Severity**: medium
- **Axis**: parity / security-adjacent
- **Complexity to fix**: small
- **Introduced by**: `b68f989`
- **Evidence**:
  - iOS, after the delta: `DefaultFrakClient.swift:383-400` — universal link (`open(_:options:[.universalLinksOnly: true])`,
    `AppLauncher.swift:33`) → custom scheme → store.
  - Android, unchanged: `sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:322-334` — custom
    scheme `frakwallet://install?…&p=<proof>` → store. No `https://wallet.frak.id/install` App Link rung.
  - The wallet router accepts the fragment carrier on either platform (`apps/wallet/app/utils/deepLink.ts:141-147`
    documents both `?p=` and `#p=` explicitly), so the Android rung is *possible*, not blocked by the web side.
- **What actually happens**: this is the same P0 the prior audit filed as 2.1 (`11-alpha-audit.md:53-63`) — Android
  hands a 30-day bearer proof to whatever app claims `frakwallet://`, and reports `OpenedApp` so the hijack is
  invisible. iOS just gained the rung that structurally avoids it (a universal link resolves to the notarised bundle
  or fails). The delta therefore **fixed the shape of 2.1 on the platform that never had the bug and left it on the
  platform that does.**
- **Fix sketch**: add a verified-App-Link rung to Android's `openFrakApp` ahead of the scheme, and `setPackage(...)`
  on the scheme intent as 2.1 already asks. Both are a handful of lines and would close 2.1 and this row together.

### N7. The "Open the wallet" CTA still points at the App Store

- **Severity**: medium
- **Axis**: UX/DX
- **Complexity to fix**: trivial
- **Introduced by**: `3a8da9b`
- **Evidence**:
  - `apps/wallet/app/module/install/component/InstallView.tsx:486-511` — `<ExternalLink href={downloadUrl} …>` where
    `downloadUrl` is `APP_STORE_URL` on non-Android (`:323-324`), and the label flips to
    `t("installCode.openWallet")` at `:509`.
  - The `onClick` handler `:490-494` fires `install_open_wallet_clicked` and `return`s — **it never calls
    `e.preventDefault()`**.
  - `packages/wallet-shared/src/common/component/ExternalLink/index.tsx:36-43` — `onClick?.(e); if (e.defaultPrevented) return;` then falls through to the anchor's default `target="_blank"` navigation.
  - No test asserts the `href`: the new suite checks the label and the event only
    (`InstallView.test.tsx`, *"tapping the installed-state CTA fires install_open_wallet_clicked"*).
- **What actually happens**: the user is told "Frak is installed — Open Frak & claim €X" and the anchor navigates to
  `https://apps.apple.com/app/frak-wallet/id6759159306`. Inside the iOS sheet this is masked, because
  `SharingSheetModel.swift:353-366` intercepts any `apps.apple.com/…/id<digits>` link
  (`SharingSheetLogic.swift:127-134`) and does the `isFrakAppInstalled()` → `openFrakApp()` handoff. So it works —
  **by interception, not by intent**. Outside the sheet (`/install` opened in Safari after a universal link, the
  Tauri route, any future non-iOS host) the CTA sends an installed user to the store listing for the app they have.
  And if `isFrakAppInstalled()` answers false for any reason at that moment — which is exactly what the whole
  `LSApplicationQueriesSchemes`/`ProbeStatus` machinery exists to model — `storeInvite.present()`
  (`SharingSheetModel.swift:365`) raises the wallet's store page *on top of a page that just said it is installed*.
- **Fix sketch**: when `installed`, either point `href` at the wallet deep link / universal link, or
  `e.preventDefault()` in the handler and let the host bridge own it. Add an `href` assertion to the new test.

### N8. Two independent parsers of the same `/install` fragment, and a `params.ts` / `params/` name collision

- **Severity**: low
- **Axis**: correctness (drift risk)
- **Complexity to fix**: trivial
- **Introduced by**: `3a8da9b`
- **Evidence**:
  - `apps/wallet/app/module/install/params.ts:47-56` `parseInstallProofFragment` (try/caught `URLSearchParams`, returns
    `p` only) — still the sole source of `proof` at `InstallView.tsx:80-83`.
  - `apps/wallet/app/module/install/params/fragment.ts:16-31` `parseInstallFragment` (no try/catch, table-driven,
    also returns `p`) — used only for the activation.
  - The two live at `install/params.ts` and `install/params/`, side by side; `InstallView.tsx:33-38` imports from
    both `"@/module/install/params"` and `"@/module/install/params/fragment"` in adjacent lines.
  - `InstallView.tsx:80-83` `useMemo(() => resolveInstallProof(window.location.hash, p), [p])` — the proof is read
    **once at mount** and never recomputed on `hashchange`, while the activation is. Safe today only because
    `installDetectedFragment` re-emits `p` unchanged (`SharingPageURL.swift:129`), which is precisely why that
    re-emit is load-bearing and why it is stated only in a Swift comment.
- **What actually happens**: nothing yet. But two decoders of one wire format, in two files one `/` apart, with
  different error handling and different refresh semantics, is how F2's eight divergences got there in the first
  place.
- **Fix sketch**: delete `parseInstallProofFragment`, have `resolveInstallProof` call
  `parseInstallFragment(hash)?.p`, and either merge `params.ts` into `params/search.ts` (the sharing module's layout)
  or rename the directory.

### N9. `probe=undeclared` conflates a merchant misconfiguration with an internal race

- **Severity**: low
- **Axis**: correctness / docs-accuracy
- **Complexity to fix**: trivial
- **Introduced by**: `b68f989`, `48d7e2c`
- **Evidence**: `SharingSheetModel.swift:465` `probe: started ? .ok : .undeclared`. `InstallProbe.start` returns
  false for **two** reasons (`InstallProbe.swift:56`): `walletSchemeStatus() != .ok` (the merchant forgot the plist
  entry) **and** `generation != self.generation` (a second `start` landed inside the `await` — the very race
  `48d7e2c` added the generation token for). The second is reported to the merchant's analytics as
  `install_probe_unavailable(reason: "undeclared")`.
- **What actually happens**: an SDK-internal rebind race shows up in the merchant's funnel as "you forgot your
  Info.plist", and vice versa — the one signal
  `docs/plans/native-sdk/03-sharing-and-install.md` says exists so *"a dead probe is not a negative result"* cannot
  distinguish the two causes it was built to distinguish.
- **Fix sketch**: have `start` return the `ProbeStatus` it decided on (or an enum with a `.raced` case) instead of a
  `Bool`, and map `.raced` to `probe=ok` with no poll, or to a distinct reason.

### N10. `via` reports the *configured* surface, not the one that drew

- **Severity**: nit
- **Axis**: correctness (analytics)
- **Complexity to fix**: trivial
- **Introduced by**: `b68f989`
- **Evidence**: `SharingSheetModel.swift:485` `let surface: InstallSurface = storeInvite is StoreOverlayInvite ? .overlay : .product`.
  `StoreOverlayInvite.present()` can answer `false` (Mac Catalyst, or no foreground scene —
  `StoreOverlayInvite.swift:24-33`), and `StoreProductPageInvite` can fail to load; the type is chosen at
  construction (`StoreInvite.swift:25-32`) and never reflects that.
- **What actually happens**: `install_detected{surface:"overlay"}` is emitted for a session where the overlay never
  drew. Also `InstallView.tsx:293` defaults an absent `via` to `"product"`, so any future non-iOS sender is silently
  bucketed as a product-page install.
- **Fix sketch**: have `StoreInvite.present()` return the surface it actually raised, and store it.

---

## Commit-message claims that do not survive the diff

1. **`48d7e2c`** — *"The parameter now has no default between the modifier and the model, making a dropped hop a
   compile error."*
   True for `detectInstall` (`SharingSheetModel.swift:107` `detectInstall: Bool,` — no default;
   `SharingPresentation.swift:80,201` both require it). **False for its sibling in the same commit's blast radius**:
   `SharingSheetModel.swift:105` `install: FrakInstallPresentation = FrakSharingDefaults.install` — the *other* new
   configuration value still has a default on exactly the hop the commit says it is protecting. A future refactor
   that drops `install:` from the `SharingPresentation.make` call silently reverts every merchant to
   `.storeProductPage`, which is the identical failure the commit was written to prevent.

2. **`0e74a65`** — *"frakSharingSheet's heightFraction parameter is replaced by `configuration:` rather than
   deprecated — nothing is published yet."*
   The premise is right and the conclusion is only half-applied. `FrakSharingSheet.swift:19` did the replacement on
   iOS; nothing was done on Android, where the same argument ("nothing is published yet") applies with equal force
   and where the API is now a different shape (`frak-sdk-ui.api:13` `heightFraction (F)…Builder`). The commit treats
   "nothing is published" as a licence to break iOS's signature while leaving the cross-platform signature divergent —
   the one window in which fixing it is free.

3. **`eccb8c2`** — the claim is the *absence* of one. `git log -1 --format=%B eccb8c2` is a single subject line,
   `feat(sdk/android): add walletOpened to SharingResult`, with no body. It edits a committed ABI dump
   (`frak-sdk-ui.api:61,75-79`), adds an arm to a public sealed hierarchy whose own KDoc says that breaks a
   consumer `when` (`SharingResult.kt:11-12`), reorders an enum's ordinals, and had to patch Frak's own harness to
   keep it compiling (`MainActivity.kt:303`). The repo's stated convention (`AGENTS.md`, "Commit style") and the ABI
   gate's whole purpose ("change a public signature and it goes red until you rerun `apiDump` **and review the
   diff**") both assume that review is written down somewhere. It is not.

4. **`3a8da9b`** — likewise a bare subject, `feat(wallet): surface the installed state on the install page`, for the
   commit that (a) introduces four new wire keys on the frozen-binary contract, (b) adds three analytics events, and
   (c) ships N7. The prior audit's §2.4 named this exact surface as the ungated one.

5. **`b68f989`** — *"Polls canOpenURL while a store surface is up, gated on `detectInstall` and on the merchant's own
   `LSApplicationQueriesSchemes`."*
   The gating is real and correct (`InstallProbe.swift:56` `guard await walletSchemeStatus() == .ok`;
   `SharingSheetModel.swift:142` `detectInstall ? InstallProbe() : nil`). But the same commit **falsified a comment
   it left in place** and did not update: `SharingSheetModel.swift:286-288` still says of `.installStarted` —
   *"this is the highest significance a session can reach, so nothing can outrank it later"* — nine lines above
   `report(.walletOpened)` at `:295`, which outranks it (4 > 3). The comment predates the delta
   (`git show c0a0cec:…SharingSheetModel.swift:270-271`) and the delta invalidated it.

6. **`sdk/ios/README.md`** (in `b68f989`) — moves *"the install-code + pasteboard + `SKStoreProductViewController`
   handoff"* out of the "Not implemented" list. The code is there
   (`StoreProductPageInvite.swift`, `NativeShare.swift:62-66`), so the claim survives — but the same README hunk
   raises the test count from 257 to 491 while `grep -c "@Test" sdk/ios/Tests/**/*.swift` counts 498 declarations
   (one of them parameterised). The number is a hand-maintained approximation presented as a measurement; it will
   drift silently. Low stakes, but it is the kind of number a merchant reads as a guarantee.

---

## Could not verify (no toolchain, no device)

- Whether `WKWebView.load(URLRequest)` with a URL differing only in fragment (`SharingWebView.swift:197`) produces a
  same-document navigation that fires `hashchange`, or a full reload. The entire `installed=1` path depends on it
  (`useInstallActivation` at `fragment.ts:44-52` listens for `hashchange` only) and the prior audit already listed
  this as unverifiable for `/sharing`. This delta makes it load-bearing for a second flow.
- Whether `apiDump` was actually re-run for `eccb8c2` or the dump hand-edited. The result is byte-consistent with
  generated output (alphabetical placement, member set matching the `Dismissed` peer, no synthetic drift), so I
  record it as **correct**, not as **proven generated**.
- Whether `applinks:wallet.frak.id` (`apps/wallet/src-tauri/gen/apple/app_iOS/app_iOS.entitlements:11`) has a live
  AASA on the dev origin. If not, iOS's new universal-link rung is a no-op on `.development` and every dev handoff
  falls to the scheme rung — same behaviour as today, one extra round trip.

---

```acceptance-report
{
  "criteriaSatisfied": [
    {
      "id": "criterion-1",
      "status": "satisfied",
      "evidence": "Read-only review of `git diff c0a0cec origin/dev`, scoped exactly to the assigned area (ABI change, cross-platform parity, native<->web contract, versioning, wallet-shared events/i18n). All five numbered sub-questions in the brief are answered explicitly: 1(a)-(d) in N1 and the Verified-OK block; 2 in N2's per-symbol table; 3 in N3's per-key table; 4 in N5; 5 in the i18n/events check (both en and fr present, interpolation verified, no native dependency on a string). No repo files created or modified; the only file written is the mandated /tmp/frak-delta/abi-parity-and-contract.md."
    },
    {
      "id": "criterion-2",
      "status": "satisfied",
      "evidence": "Every finding carries path:line citations with quoted source, and each names the introducing sha. Cross-checks that an independent reviewer can re-run are listed in commandsRun. Negative results are cited as such (e.g. `grep -rn \"probe|detectInstall\" sdk/android/*/src/main` -> zero hits; `grep -rn \"frakwallet\" sdk/ios/README*.md` -> zero hits; `grep -rn \"transport\" apps/wallet/app/module/install` -> declaration sites only). Three items I could not settle without a toolchain are separated into a 'Could not verify' section rather than asserted."
    }
  ],
  "changedFiles": [
    "/tmp/frak-delta/abi-parity-and-contract.md"
  ],
  "testsAddedOrUpdated": [],
  "commandsRun": [
    {
      "command": "git diff --stat c0a0cec origin/dev",
      "result": "passed",
      "summary": "50 files, +1998/-131; confirms the delta's shape and that only frak-sdk-ui.api changed among the two committed ABI dumps"
    },
    {
      "command": "git show eccb8c2",
      "result": "passed",
      "summary": "ABI dump +7 lines (WALLET_OPENED field at :61, WalletOpened class block at :75-79); harness MainActivity.kt needed a new when-branch to compile"
    },
    {
      "command": "git log -1 --format=%B eccb8c2 / 3a8da9b",
      "result": "passed",
      "summary": "both bodies empty - subject line only, on an ABI-affecting commit and on the commit that grows the /install wire contract"
    },
    {
      "command": "grep -rn \"probe|detectInstall|InstallSurface\" sdk/android/frak-sdk-ui/src/main sdk/android/frak-sdk/src/main",
      "result": "passed",
      "summary": "zero hits - Android sends none of the four new fragment keys (evidence for N3)"
    },
    {
      "command": "grep -n \"sdkVersion\" sdk/{ios/Sources/FrakSDK/AppLink/InstallLinks.swift,android/.../applink/InstallLinks.kt}",
      "result": "passed",
      "summary": "zero hits on both - /install carries no version signal at all (evidence for N5)"
    },
    {
      "command": "grep -rn \"transport|INSTALL_PARAMS\" apps/ packages/ --include=*.ts --include=*.tsx",
      "result": "passed",
      "summary": "install/params/table.ts's `transport` field has no reader; sharing/params/table.ts:105,118 does use its twin (evidence for N5)"
    },
    {
      "command": "grep -rn \"frakwallet|LSApplicationQueriesSchemes\" sdk/ios/README.md sdk/ios/README.mirror.md",
      "result": "passed",
      "summary": "one prose mention at README.mirror.md:95, no key name, no scheme strings, no plist snippet - P0 2.5/2.6 still open and now load-bearing"
    },
    {
      "command": "cat packages/wallet-shared/src/common/component/ExternalLink/index.tsx",
      "result": "passed",
      "summary": "onClick without preventDefault falls through to the anchor's default navigation - confirms N7"
    },
    {
      "command": "git show c0a0cec:sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift | grep -n 'Reported at the tap' -A6",
      "result": "passed",
      "summary": "the 'highest significance a session can reach' comment predates the delta at :269-272 and was falsified by b68f989 without being updated"
    },
    {
      "command": "git status --porcelain",
      "result": "passed",
      "summary": "empty - worktree untouched, nothing staged"
    }
  ],
  "validationOutput": [
    "10 findings ranked worst-first: N1 (high, ABI - sealed-hierarchy consumer break, first-party harness had to be patched), N2 (high, parity - 5 new iOS-only public symbols, register 9.15 widened), N3 (high, parity/correctness - Android sends none of the 4 new /install keys, documented sid guard half-implemented), N4 (medium - walletOpened masks a real share via SharingOutcome.record), N5 (medium - contract grew 6->10 keys with no version, dead `transport` axis), N6 (medium - iOS gained a universal-link rung, Android P0 2.1 untouched), N7 (medium - 'Open the wallet' href is still APP_STORE_URL), N8 (low - two fragment parsers + params.ts/params/ collision), N9 (low - probe=undeclared conflates two causes), N10 (nit - `via` reports configured not drawn surface).",
    "6 commit-message claims that do not survive the diff, including two commits with no body at all on ABI/wire-contract changes.",
    "Confirmed-good (stated, not just assumed): walletOpened wire string identical both platforms; significance ladder 0/1/2/3/4 identical; Kind member order identical; ABI dump diff minimal, alphabetically placed, member set matching the Dismissed peer, no frak-sdk.api churn; all 4 new fragment value sets match between Swift rawValues and table.ts oneOf(); i18n keys present in BOTH en and fr with matching {{estimatedReward}} interpolation supplied by the InstallView `t` wrapper at InstallView.tsx:230-232; nothing native reads a translation string."
  ],
  "residualRisks": [
    "WKWebView same-document fragment navigation (SharingWebView.swift:197) firing `hashchange` is unverifiable without a simulator, and the whole installed=1 path depends on it.",
    "Whether eccb8c2's frak-sdk-ui.api edit came from `apiDump` or from hand-editing cannot be proven by reading; I graded the diff correct on shape, not proven generated.",
    "Whether a live AASA exists on the dev wallet origin - if not, iOS's new universal-link rung is a no-op under .development.",
    "I did not audit the iOS store-surface internals (StoreProductPageInvite window layering, InstallProbe lifecycle beyond the parity/contract surface) - that is the ios-sharing-sheet reviewer's area.",
    "N4's severity assumes merchants build funnels on `onResult`; if they build on the tracked `sharing` interaction instead, it is a nit."
  ],
  "noStagedFiles": true,
  "diffSummary": "No repo changes. One artifact written: /tmp/frak-delta/abi-parity-and-contract.md (review report). `git status --porcelain` is empty.",
  "reviewFindings": [
    "high: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingResult.kt:50 - new sealed arm breaks exhaustive consumer `when` (silent no-op for a statement, NoWhenBranchMatchedException for an expression); proven by the harness edit at example/native-android/.../MainActivity.kt:303. Enum ordinal shift at SharingResult.kt:22 is invisible to the ABI gate because the dump sorts fields alphabetically.",
    "high: sdk/ios/Sources/FrakSDKUI/FrakSharingConfiguration.swift:4 + SharingSheetLogic.swift:247,250 + FrakSharingSheet.swift:19 - five new iOS-only public symbols and a replaced modifier signature with no Android twin and no recorded decision; register 9.15's divergence list is five rows longer.",
    "high: apps/wallet/app/module/install/params/table.ts:40-43 vs sdk/android/.../InstallLinks.kt:60-66 - Android sends none of probe/installed/dt/via, so absence-of-key is now the platform discriminator; and the sid guard 03-sharing-and-install.md requires is implemented natively but never checked by the page (InstallView.tsx:248).",
    "medium: sdk/android/frak-sdk-ui/src/main/kotlin/id/frak/sdk/ui/SharingResult.kt:73 + SharingOutcome.kt:30-41 - a recorded walletOpened outranks a later finish(Shared), so the merchant's callback loses the share.",
    "medium: sdk/ios/Sources/FrakSDK/AppLink/InstallLinks.swift + apps/wallet/.../install/params/table.ts - four new wire keys, zero version negotiation, and /install carries no sdkVersion on either platform.",
    "medium: sdk/android/frak-sdk/src/main/kotlin/id/frak/sdk/core/DefaultFrakClient.kt:322-334 - iOS gained a universal-link rung (DefaultFrakClient.swift:388-393), Android's scheme-first path and P0 2.1 are untouched.",
    "medium: apps/wallet/app/module/install/component/InstallView.tsx:487,509 - 'Open Frak & claim X' navigates to APP_STORE_URL; the onClick returns without preventDefault and ExternalLink falls through. Masked only by the iOS sheet intercepting apps.apple.com links.",
    "low: apps/wallet/app/module/install/params.ts:47 vs params/fragment.ts:16 - two parsers of one fragment, in a params.ts / params/ name collision.",
    "low: sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:465 - probe=undeclared conflates a missing plist entry with the internal start() generation race.",
    "nit: sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:485 - `via` reports the configured store surface, not the one that actually drew.",
    "docs: sdk/ios/Sources/FrakSDKUI/SharingSheetModel.swift:286-288 - 'this is the highest significance a session can reach' was falsified nine lines above the new report(.walletOpened) at :295 and left in place."
  ],
  "manualNotes": "Three things the parent should carry forward. (1) N1 is the only finding in my area that is genuinely irreversible after `id.frak.sdk:ui:0.1.0` publishes - the sealed-hierarchy policy has to be decided before the artifact exists, and the delta is empirical evidence that the Kind discriminator alone does not hold. (2) N7 is a real user-visible bug but it is cheap and it overlaps the wallet-web-surface reviewer's area; if they filed it too, dedupe on theirs. (3) I deliberately did not re-litigate F1/F2 (`golden-sharing-links.json`) since the delta does not touch that code, but the new installed/dt/via keys are a second instance of the same hand-mirrored-literals pattern and should be folded into that fixture when it is built rather than getting a corpus of their own."
}
```
