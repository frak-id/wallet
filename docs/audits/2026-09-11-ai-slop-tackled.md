# AI-slop audit — quick wins tackled

**Date:** 2026-09-11 · **Base:** `375acac6c` (the audit commit) · **Branch:** `docs/ai-slop-audit`
**Input:** [`2026-09-11-ai-slop.md`](./2026-09-11-ai-slop.md) — 69 systemic patterns, 615 findings, 13 slices
**Mode:** write. 13 agents, one per slice, disjoint file ownership; then an independent read-only verifier.

## 0. TL;DR

- **375 of 615 findings and 25 of 69 patterns are closed.** 15 findings and 19 patterns are partially closed (marked **◐** in the audit, which is now the open backlog). 240 findings and 44 patterns remain untouched, on purpose.
- **905 files changed: 101 deleted, 1 added, 3 018 insertions, 27 619 deletions** — a net **−24 601 lines** with no intended behaviour change.
- **Quality gate green after the pass**: `bun run format`, `bun run lint` (including `lint:comments`, `check:i18n-types`, `check:ios-floor`, `check:safe-area`, `check:publishable`), `typecheck` across all 14 packages, and the full Vitest suite (604 files / ~5 800 tests, minus the ~90 deleted slop tests).
- **The comment baseline shrank**: `scripts/comment-budget-baseline.json` went from 101 findings across 46 files to **61 across 41** — 16 native files improved past their baseline and the gate now holds them there.
- **Verification**: an independent reviewer re-opened a 34-item sample. **33 CONFIRMED, 1 OVERSTATED, 0 FALSE**; the overstated one (WA-P4) was finished before this report. No deleted symbol has a live consumer, no published API surface moved, no sentinel files or dangling imports remain.
- **One real bug was found and fixed outside this pass** (LS-1, `apps/shopify`, commit `a2be2898c`): `test: process.env.STAGE !== "prod"` on a line only reachable when `isProd()` is true, i.e. every production charge was created as a Shopify **test** charge that is never billed and never paid out. Fixed with a regression test after the deployment chain was traced end to end; the rows it already wrote still need reconciling against Shopify.

## 1. What counted as a "quick win"

Taken:

- **Dead code** with no consumer anywhere in the repo — components, hooks, css, query-key members, props, variants, exports, whole files. Every deletion was preceded by a repo-wide `rg`.
- **Tests that cannot fail** — tautologies, self-equality, `toBeDefined()` on an import, framework re-tests (TanStack Query, Zustand, `Intl`), assertions on a mock's own markup, vacuous `if (x) { expect(...) }`, stale mocks of modules the unit does not import.
- **Comment slop** — blocks over the 5-line budget, blocks longer than the code they sit on, history narration (`used to` / `previously` / `replaces the legacy`), `// ====` / `// --- Helpers ---` banners, JSDoc echoing the signature, design-review prose, notes about what a test deliberately does not cover, and comments that were simply false.
- **Stale documentation** — drift-prone inventories (directory trees, export lists, file counts), nonexistent paths and symbols, "CSS Modules" prescriptions in a Vanilla-Extract repo.
- **Local mechanical fixes** — unreachable guards, redundant options and casts, inert lint directives, leftover `console.log`, single-file dedupe, `interface` → `type`, misspellings and name/file mismatches.

Not taken (see §6): anything needing a new shared abstraction, anything with user-visible or wire-contract impact, anything needing new i18n keys, and the four rule-vs-reality decisions in §3 of the audit.

## 2. Method

13 lanes, each with a **disjoint set of owned paths** so twelve writers could work in the same checkout without racing:

| Wave | Lanes | Why |
|---|---|---|
| 1 | WA · WB · BA · BB · BD · BR · DS · PS · SW · SN · LS · PI | Code slices, path-disjoint by construction (e.g. `apps/wallet` split by module, `services/backend` split domain vs rest). |
| 2 | DM | Owns root `AGENTS.md`, `CLAUDE.md`, `docs/**` and every agent-instruction tree — had to run *after* wave 1 so it verified against the post-cleanup tree, not the audit's description of it. |
| 3 | verifier (read-only, fresh context) | Re-opened a 34-finding sample, re-grepped every "no consumer" claim, checked public surfaces and collateral risk. |

Each lane re-verified every claim against the tree before acting (audit line numbers drift up to ±15 lines), reported per-finding `RESOLVED` / `PARTIAL` / `SKIPPED`, and ran no repo gates — the gates were run centrally afterwards so that one lane's breakage could not be mistaken for another's.

Three breakages surfaced at the central gate and were fixed before this report; all three are recorded in §7 because each one says something about the audit's own accuracy.

## 3. What was cleared, by theme

Mapping to the audit's five cross-cutting themes (§2 of the audit):

| Theme | Result |
|---|---|
| **2.1 COMMENT** — prose over budget, history, mechanism | Every **cited** block trimmed to its trap or deleted, in all 13 slices: ~160 banner lines, the `§4.8`/`(S1)`/`(audit M-2)` references to a design doc that is not in the repo, the `ROLLOUT-STEP-3` markers, 24 `/** Tests for X */` headers, the ticket labels baked into native test names. The **uncited long tail remains**, and so does the reason it will regrow: `scripts/check-comments.ts` still gates only `.kt`/`.swift`. |
| **2.2 DUPLICATION** — the same body with one literal changed | Mostly **not** taken: every member needs a new shared unit (one `EmptyStateModal`, one `ConfirmActionModal`, one date formatter, one `demoDelay`). What was taken is the single-file kind: `devProxy` in the wallet vite config, `safeInvoke` in the Tauri bridge, `toBase64` in credential-sync, a merged mock wrapper, `mb()` in backend debug. |
| **2.3 TEST** — tests that cannot fail | **Largely cleared.** ~90 test files or suites deleted or collapsed, including 21 in business `common/`, 18 in design-system, 19 in wallet, the SDK's mock-only hook suites, and ~250 lines of SDK test scaffolding. Literal-variant copies became `test.each`. Coverage numbers drop; that was the point. |
| **2.4 DOCS** — documentation of a repo that no longer exists | **Cleared.** `.cursor/rules/` (10 files) and `.opencode/agent/_archive/` (8 files) deleted outright; `CLAUDE.md` reduced from ~356 lines to a 14-line pointer; root `README.md` and `AGENTS.md` stripped of stale inventories; 20+ compasses and READMEs re-derived from the tree; every dangling doc link removed. |
| **2.5 DEAD** — exports kept alive by their own tests | **Cleared.** 101 files deleted — `Password`, `AccordionLogin`, `TokenListLite`/`TokenItemLite`, `LegalLinks`, `BiometricSettings`, `RemoveAllNotification`, `SignatureRequest`, the seven orphaned business components (and the `cmdk` dependency they stranded), `ui-preview/sharing-page` + `sharing-success`, five dead SDK barrels, `charts/lib/utils.ts`, `PairingWsEventListener`, `plugins/magento/PLAN.md`, and more. |

## 4. Per-slice ledger

Full finding IDs, so this doc and the backlog reconcile exactly.

### WA — `apps/wallet` (common, authentication, tokens, walletMerge, recovery-setup) — 2 patterns, 23 findings

`WA-P3` `WA-P4` · `WA-1` `WA-2` `WA-3` `WA-5` `WA-11` `WA-14` `WA-16` `WA-19` `WA-21` `WA-22` `WA-23` `WA-25` `WA-26` `WA-30` `WA-31` `WA-32` `WA-38` `WA-41` `WA-42` `WA-44` `WA-47` `WA-48` `WA-49`

Highlights: `Password/`, `AccordionLogin/` (with its forbidden `globalStyle`) and the `TokenListLite`/`TokenItemLite` pair deleted; `Panel` cut from 9 props to 3, taking the `panelDismissedPrefix` localStorage contract and the dead sweep in `useLogout` with it; the four "should initialize with correct default state" copies, the frozen-tuple tautologies and the 12-case `validateAmount` enumeration (now `test.each`) gone; `looserAssetSummaryQueryOpt` → `loserAssetSummaryQueryOptions`.

### WB — `apps/wallet` (remaining modules, routes, entry, configs) — 3 patterns, 33 findings

`WB-P1` `WB-P2` `WB-P3` · `WB-1` `WB-2` `WB-5` `WB-6` `WB-7` `WB-8` `WB-9` `WB-10` `WB-11` `WB-12` `WB-14` `WB-15` `WB-16` `WB-17` `WB-22` `WB-26` `WB-28` `WB-32` `WB-34` `WB-35` `WB-36` `WB-38` `WB-39` `WB-43` `WB-44` `WB-45` `WB-46` `WB-47` `WB-48` `WB-51` `WB-53` `WB-57` `WB-58`

Highlights: 8 orphaned component/css/test files plus `historyKey.interactions/.rewards`, `moneriumKey.orders.byId` and `ibanStore.clearIbans` deleted; every `ROLLOUT-STEP-3` / `ENSURE_BARE_ARM_ENABLED` marker removed (the flag no longer exists in `services/`); the install param codec reduced to a plain `{key: decode}` map; the unreachable `isLoading` skeleton behind `initialData: []` removed; 14 `// --- Helpers ---` banners; `handleNonOk` → `throwApiError`.

### BA — `apps/business` (common, forms, dashboard, auth, login, settings) — 1 pattern, 23 findings

`BA-P2` · `BA-1` `BA-2` `BA-3` `BA-4` `BA-5` `BA-6` `BA-7` `BA-8` `BA-9` `BA-10` `BA-16` `BA-18` `BA-19` `BA-20` `BA-22` `BA-23` `BA-24` `BA-26` `BA-27` `BA-28` `BA-29` `BA-30` `BA-34`

Highlights: seven orphaned components (19 files) deleted and `cmdk` dropped from `package.json` + the vite chunk regex; `useIsDemoMode` reduced from three store subscriptions + a context read to one selector, at 28 read-only call sites in the app most sensitive to re-render storms; a 449-line/16-test suite cut to 4 real tests; `Products/` → `MyMerchants/` and `useMintMyMerchant.ts` → `useRegisterMerchant.ts` (both files exported the wrong name).

### BB — `apps/business` (campaigns, merchant, members) — 13 findings

`BB-8` `BB-9` `BB-22` `BB-23` `BB-27` `BB-29` `BB-36` `BB-37` `BB-40` `BB-41` `BB-47` `BB-51` `BB-52`

Highlights: the duplicate `useUpdateCampaignRunningStatus` hook deleted; an unreachable `section="all"` render path and its component removed; `CellSelect.test.tsx` (which re-implemented `headerChecked` and tested its own re-implementation) replaced by a real `columns.test.tsx`; `getCampaignDetail` → `getCampaignConfig` across 6 sites; 17 section banners.

### BD — `services/backend/src/domain` — 25 findings

`BD-6` `BD-7` `BD-8` `BD-9` `BD-10` `BD-11` `BD-13` `BD-17` `BD-19` `BD-21` `BD-25` `BD-29` `BD-30` `BD-31` `BD-32` `BD-33` `BD-34` `BD-36` `BD-38` `BD-42` `BD-43` `BD-47` `BD-48` `BD-50` `BD-51`

Highlights: caller-less public `predictBankAddress` and `MerchantAdminRepository.findByWallet` deleted; the `"recovery"` `BindingReason` with no writer; commented-out schema columns and "planned evolution" roadmap prose; stacked `as` casts replaced by `in` narrowing; a `require("node:crypto")` re-implementation of `sha256Hex` replaced by the real util; two pass-through `buildAttestation` re-exports removed.

### BR — `services/backend/src/{api,orchestration,infrastructure,utils,jobs}` — 31 findings

`BR-3` `BR-6` `BR-11` `BR-13` `BR-15` `BR-16` `BR-17` `BR-18` `BR-20` `BR-21` `BR-25` `BR-26` `BR-27` `BR-28` `BR-29` `BR-30` `BR-32` `BR-33` `BR-35` `BR-36` `BR-37` `BR-39` `BR-40` `BR-41` `BR-42` `BR-44` `BR-45` `BR-46` `BR-47` `BR-50` `BR-53`

Highlights: all 6 `interface` declarations converted to `type`; `src/api/README.md` rewritten from prose (including a `src/common/` directory that does not exist) to a route map; both `fakeLimiter` suites that tested Elysia's plugin dedup deleted; header dumps removed from the legacy router and webhook `onError`; `WORLD_NEWS_API_KEY` and 8 unused `Static<>` aliases deleted; `catch {}` in the reward-history metadata fallback now logs.

### DS — `packages/design-system` + `packages/ui-preview` — 1 pattern, 27 findings

`DS-P5` · `DS-1` `DS-4` `DS-5` `DS-7` `DS-8` `DS-9` `DS-11` `DS-14` `DS-15` `DS-17` `DS-19` `DS-22` `DS-23` `DS-26` `DS-27` `DS-28` `DS-29` `DS-30` `DS-31` `DS-32` `DS-33` `DS-35` `DS-36` `DS-37` `DS-39` `DS-41` `DS-44`

Highlights: `ui-preview/sharing-page` + `sharing-success` deleted with `parseMarkdown`; `charts/lib/utils.ts` deleted and its six `cn(` call sites moved to `clsx` (the dependency the repo already has); `partitionChartDefNodes`, `collectChartDefsChildren`, `decimateOhlcData`, `SheetPortal`, the `Breakpoint` type and two unused icons deleted; a ~175-line token-enumeration test removed; `{...props}` moved last in four currency icons.

### PS — `packages/{wallet-shared,app-essentials,rpc,test-foundation,dev-tooling,client}` — 3 patterns, 32 findings

`PS-P1` `PS-P3` `PS-P4` · `PS-2` `PS-3` `PS-4` `PS-5` `PS-6` `PS-7` `PS-8` `PS-10` `PS-11` `PS-12` `PS-13` `PS-14` `PS-17` `PS-18` `PS-21` `PS-22` `PS-24` `PS-25` `PS-26` `PS-28` `PS-29` `PS-30` `PS-31` `PS-32` `PS-35` `PS-36` `PS-38` `PS-39` `PS-41` `PS-42` `PS-44` `PS-45`

Highlights: seven copy-pasted try/catch swallows in the Tauri bridge replaced by one `safeInvoke(cmd, label, args)`; seven unreachable inner `if (!IS_TAURI) return;` guards deleted; `auth.test.ts` cut from 22 `it`s to 1 meaningful one; `test-foundation/README.md` 887 → ~85 lines and `rpc/README.md` rewritten to the real 4-method API; the `tauri-plugin-fcm` historical stubs, `isRenderableUrl`, `usdcArbitrumAddress` and `PairingWsEventListener` deleted.

### SW — `sdk/{core,react,components,legacy}` — 6 patterns, 53 findings

`SW-P2` `SW-P3` `SW-P4` `SW-P5` `SW-P6` `SW-P7` · `SW-1`…`SW-4` `SW-6`…`SW-21` `SW-23`…`SW-26` `SW-28` `SW-30`…`SW-43` `SW-45`…`SW-55` `SW-58` `SW-59` `SW-61`

Highlights: five dead barrels, four dead react hooks and ~250 lines of test scaffolding deleted; 8 `interface UseXParams` → `type`; the README API tables and AGENTS export inventories (the things that drift) deleted; 7 control-flow `console.log`s removed; `assets/GiftIcon.tsx` → `WalletGiftIcon.tsx`; the `formatReward` shim replaced by the already-public `@frak-labs/core-sdk/rewards` import at three call sites. No public export was removed.

### SN — `sdk/android` + `sdk/ios` — 1 pattern, 18 findings

`SN-P3` · `SN-3` `SN-5` `SN-6` `SN-7` `SN-9` `SN-10` `SN-12` `SN-15` `SN-16` `SN-18` `SN-19` `SN-21` `SN-22` `SN-23` `SN-24` `SN-25` `SN-27` `SN-32`

Highlights: every opaque ticket label (`(C3)`, `(9.3)`, `(bug 1)`, `(S3)`…) removed from test names on both platforms; dead `SharingSession.walletOrigin`, `IdentityMerge.logger`, `copyInstallCode(expiresAtSeconds)` and the inert `LOAD_DEFAULT` re-sets removed; a tautological `assertFalse(url.contains("confirmed"))` made meaningful; `FrakSharingDefaults` extracted without changing a public signature (the Android ABI gate stays green). The comment baseline was re-locked at the lower number.

### LS — `apps/listener` + `apps/shopify` — 1 pattern, 23 findings

`LS-P5` · `LS-2` `LS-5` `LS-6` `LS-7` `LS-8` `LS-9` `LS-11` `LS-14` `LS-15` `LS-16` `LS-17` `LS-22` `LS-26` `LS-27` `LS-28` `LS-30` `LS-31` `LS-32` `LS-33` `LS-34` `LS-36` `LS-37` `LS-39`

Highlights: all 15 `interface` declarations converted to `type`; three `console.log`s deleted, one of which logged `session.address`; `app.debug-error.tsx`, `useListenerDataPreload` and `queryKeys/merchant.ts` deleted with their vite chunk-regex alternatives; `<p>Nope</p>` replaced by the app's existing warning banner reusing existing i18n keys; `getFrakWebookStatus` → `getFrakWebhookStatus` at 8 sites.

### PI — `plugins/**`, `infra/**`, `scripts/**`, `services/{bootstrap,credential-sync}`, workflows — 3 patterns, 37 findings

`PI-P3` `PI-P4` `PI-P7` · `PI-1` `PI-2` `PI-3` `PI-5` `PI-7` `PI-8` `PI-9` `PI-10` `PI-12` `PI-13` `PI-14` `PI-16` `PI-17` `PI-18` `PI-19` `PI-20` `PI-21` `PI-22` `PI-25` `PI-27` `PI-28` `PI-30` `PI-33` `PI-34` `PI-35` `PI-36` `PI-37` `PI-40` `PI-41` `PI-42` `PI-43` `PI-44` `PI-45` `PI-46` `PI-47` `PI-49` `PI-50`

Highlights: `plugins/magento/PLAN.md` (1 550 lines) deleted after proving both sections it was kept for are shipped; `KubernetesJob` reduced to what its single caller passes, with identical wire output; the PrestaShop sanity test that asserted `true` deleted; `plugins/wordpress/build.sh` given `set -euo pipefail` and a fail-fast version guard; 13 PrestaShop directory-index stubs cut to one line; the root `vitest.config.ts` 31-line tutorial header and `knip.ts` commented-out config removed.

### DM — root compasses, `docs/**`, agent-instruction trees — 4 patterns, 36 findings

`DM-P1` `DM-P2` `DM-P4` `DM-P6` · `DM-1`…`DM-5` `DM-7` `DM-8` `DM-10`…`DM-17` `DM-19`…`DM-27` `DM-29`…`DM-36` `DM-38`…`DM-41`

Highlights: `.cursor/rules/` (10 files) and `.opencode/agent/_archive/` (8 files) deleted — all generated persona filler, several of whose bullets ("write comprehensive documentation") directly invert the gated comment budget; `CLAUDE.md` reduced to a 14-line pointer (the file is kept because Claude Code auto-loads it); root `AGENTS.md` stamp and every drift-prone count removed; `docs/flow.md` (byte-identical to `docs/data.md`), `.changeset/README.md` and `.opencode/package-lock.json` deleted; every "CSS Modules" prescription gone from every instruction surface; three dangling doc links removed.

## 5. Partially cleared (◐)

19 patterns and 15 findings had part of their prescribed rework land. They stay in the backlog, marked **◐**, with what is left recorded there. The recurring shapes:

- **Comment patterns** (`WA-P1`, `BA-P3`, `BR-P1`…`BR-P3`, `DS-P3`, `PS-P2`, `SW-P1`, `SN-P1`/`P2`/`P4`, `LS-P1`…`LS-P4`, `DM-P3`/`P5`): every **cited** site is clean; the uncited long tail is not, and no gate stops it regrowing.
- **Test patterns** (`BB-P1`, `BA-P1`, `PS-P2`): the unfalsifiable tests are gone; migrating survivors onto the shared `queryWrapper` fixture and replacing `as any` mocks with typed partials is a refactor.
- **Individual items** where the audit's rework had two halves and only the mechanical half was safe — e.g. `BA-32` (duplicated const deleted, permanently-disabled Export button left rendering), `LS-4` (commented-out PII dumps deleted, the GDPR handlers still do nothing), `PI-38` (dead `window.console` guard deleted, the log-only try/catch kept), `SN-11` (iOS `placement` documented honestly, but it is ABI-frozen so neither wiring nor removal is quick).

## 6. Deliberately not taken

| Category | Examples | Why |
|---|---|---|
| Needs a new shared abstraction | `WA-P2` (3 `Empty*Modal`s → 1), `WB-P4`/`P5` (4 date formatters, referral modal/toast copies), `BB-P2`/`P3`/`P4` (`demoDelay`, campaign transitions, 7 Customize panels), `DS-P2` (Dialog/AlertDialog/Sheet), `BR-P4` (4 wallet-JWT resolvers), `PI-P1`/`P2` (pin-site scripts, Postgres URL builder) | Each is a design decision with a blast radius across 3–9 files. The audit itself calls these "rework", not cleanup. |
| Changes user-visible behaviour | `BA-11` (date formatting via `i18n.language`), `BA-31`/`WA-17`/`WA-35`/`BB-44` (hardcoded strings → new i18n keys), `BB-26`/`BB-30`, `SW-56`, `LS-38` | A cleanup pass must not change what a user sees. These need an owner and a test plan. |
| Changes a wire/API contract | `BR-1` (dead `'referral_arrival'` literal → changes KPI values), `BR-22` (unauthenticated `getTestToken`), `BR-49`, `PI-48`, `SW-5` (public SDK exports) | Breaking change management, not slop removal. |
| Rule-vs-reality decisions (§3 of the audit) | `class` in the backend · `as any` in tests · `globalStyle` in `design-system/charts` · gating `.ts`/`.tsx` in `scripts/check-comments.ts` | These need a ruling on the rule, not a patch on the code. **The comment gate is the highest-leverage one**: it already accepts TS at `scripts/check-comments.ts:68`, nothing invokes it that way, and theme 2.1 has now regressed twice. |
| Real bugs needing an owner | **`LS-1`** — `apps/shopify` billing, **fixed separately in `a2be2898c`**, not as part of this pass · `PI-24` — Magento writes `'client_id'` and reads `"clientId"` · `BA-12` — the recovery-code download is plausibly broken in Safari/Firefox | Fixing these is correct but it is not cleanup: each one changes behaviour that someone must sign off. **`LS-1` should be triaged now, independently of this audit.** |

## 7. Where the audit itself was wrong

The cleanup is also a test of the audit. Five claims did not survive contact with the code; the affected rows were left in the backlog rather than silently deleted.

1. **`BR-50` — `RecoveryStatusResponse` is not dead.** The audit said its only references were its declaration and the barrel. `apps/wallet/.../useBackendRecoveryStatus.ts:1` imports it. Kept; the other 5 aliases were deleted.
2. **`BA-33` — `formatDate`'s try/catch is reachable.** The audit said `Intl` returns `"Invalid Date"` instead of throwing. That is `Date.prototype.toLocaleDateString`; `Intl.DateTimeFormat.prototype.format` throws `RangeError` on a non-finite date. The catch was kept and is now the one thing the (rewritten) test covers.
3. **`WB-29` — `generate:routes` is invoked.** The audit found zero invocations; it runs from `.github/workflows/apps.yaml:252,409`. No change made. (Locally it must be run before `typecheck`, since `routeTree.gen.ts` is gitignored.)
4. **`DS-35` — the a11y rule is not off.** The audit said `onKeyDown={() => {}}` appeases a rule already disabled at `biome.json:85-87`. That entry disables `a11y/noStaticElementInteractions`; the rule that actually fires is `a11y/useKeyWithClickEvents`, and removing the no-op turned `bun run format` red. The test-only `data-testid` was removed as prescribed; the no-op handler was restored.
5. **DM counts drifted further than the audit recorded** — root `AGENTS.md` "13 modules" is 24 dirs, "14 handlers" is 17 files / 10 registered, `@ignore` is 29 not 31, and the audit's own "shopify is standalone" is false (`apps/shopify/vitest.config.ts:1` imports `@frak-labs/test-foundation/vitest.shared`). All were deleted rather than re-counted — a number in a compass is a number that will be wrong again.

Two more were caught by the gate rather than by review, and are worth recording because they are the failure mode of this kind of pass:

- **`SW-8`** simplified `replaceUrl`'s guard from `!window.location?.href || typeof window === "undefined"` to `typeof window === "undefined"`. The ordering was indeed nonsense, but the `location` check was load-bearing — a test caught it. It is now `typeof window === "undefined" || !window.location?.href`.
- **`BD-48`** deleted a pass-through `buildAttestation` re-export while `SettlementService` still imported it through that barrel; the import was repointed at `@backend-utils`.

## 8. Evidence and follow-ups

**Gate** (run centrally, after all 13 lanes and the sentinel sweep):

```
bun run format      # biome check --write . — 3299 files, clean
bun run lint        # biome lint + comments + i18n types + iOS floor + URL scheme
                    # + android manifest + publishable + safe-area + bun version — all ✅
bun run typecheck   # 14 packages, run sequentially (parallel OOMs on 5 GB), 0 errors
bun run test        # full Vitest workspace
bun run build:sdk   # required before typecheck — the SDK dist is the type source
```

**Follow-ups this pass created:**

- `bun install` is needed: `cmdk` was removed from `apps/business/package.json` but `bun.lock` still pins it.
- Two i18n keys are now unused (`campaigns.create.success.notifyTitle` / `notifyBody`) — they live in locale files outside the lane that removed their consumer.
- `HeaderSelect`'s tri-state logic lost its only test when `CellSelect.test.tsx` was deleted (the test only tested its own re-implementation, so this is a net win, but the coverage gap is real).
- `.cursor/rules/` is gone entirely. If a Cursor surface is wanted back, the right shape is one rule that points at `AGENTS.md` — deliberately not invented here.
- `scripts/comment-budget-baseline.json` was re-locked at 61/41. It can only go down from here.

**The single most valuable next step** is not in the backlog as a finding: extend `scripts/check-comments.ts` to gate `.ts`/`.tsx` with a baseline, exactly as was done for Kotlin and Swift. Theme 2.1 is 18 patterns and 118 findings, it has regrown twice, and this pass only cleared the part someone had already written down.
