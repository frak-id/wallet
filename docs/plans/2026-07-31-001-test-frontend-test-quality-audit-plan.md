---
title: Frontend Test Quality Audit - Plan
type: test
date: 2026-07-31
topic: frontend-test-quality-audit
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
---

# Frontend Test Quality Audit - Plan

## Goal Capsule

- **Objective:** Determine whether the frontend suite's assertions would actually catch a regression, by mutating load-bearing code and measuring what survives undetected. The workspace suite is 5,251 assertions; 477 of its 564 files are frontend and in scope.
- **Product authority:** Product Contract requirements R1-R14 govern what the audit must produce. Planning Contract KTDs govern how. The audit mutates source under measurement and reverts each change, leaving the tree unchanged; it writes no lasting code.
- **Stop conditions:** Stop and report if the baseline suite is not green before mutation starts, or if a revert leaves the tree dirty. Both invalidate every subsequent measurement.
- **Open blockers:** None.

---

## Product Contract

### Summary

A test-quality audit that answers whether the frontend suite's green is meaningful. It enumerates the failure modes that must never break silently, uses them to select mutation sites in load-bearing code, runs the suite against each mutant, and reports every survivor as a proven blind spot.

### Problem Frame

The suite is large, green, and fast: 564 test files and 5,251 assertions run in 106 seconds across the whole workspace, of which 477 files are frontend and in this audit's scope. Nobody has assessed whether that green means anything.

Three signals suggest it may not. `packages/design-system/src/components/Button/Button.test.tsx:14-22` asserts only that two variant class names differ from each other — a test that passes regardless of what either class contains. Every app's coverage config excludes `**/component/**/*.tsx` wholesale, so the 40% threshold in `packages/test-foundation/src/vitest.shared.ts:94-99` measures a deliberately narrowed denominator. And the most safety-critical paths are the thinnest: `apps/wallet/app/module/walletMerge/` has 2 tests across 27 files with all 6 hooks, both merge strategies, and all 12 components untested, while `apps/wallet/app/routes/_wallet/_protected/tokens.send.tsx` and `apps/wallet/app/service-worker.ts` have none at all.

The cost of not knowing is already visible. Recent commits exist only to repair leaks the pre-commit gate should have caught: `e5fa1ac21` (type error in a test mock) and `c4487ad7e` (cross-package typecheck errors) are frontend enforcement leaks, while `02ca54977` and `9dc0f263d` — the latter tests that an env short-circuit had silently disabled, passing while asserting nothing — sit in backend code this audit does not cover. The disabled-test commit is the sharpest illustration of the failure mode even from outside scope: a test can be green and worthless, and today nothing distinguishes the two. Enforcement leaks and test-quality gaps are separate problems; this audit measures the second.

The gate itself is human. `AGENTS.md:16` names four commands as mandatory pre-commit, and CI runs none of them — across 7 workflows the only quality job is the listener bundle budget at `.github/workflows/apps.yaml:17-39`. Several people share that discipline, and it has measurably leaked.

### Key Decisions

- **Mutation testing over an assertion census** — a surviving mutant is proof; a reading of a test file is an opinion. (session-settled: user-directed — chosen over a file-by-file assertion census of the whole suite and over a reading-only failure-mode map: only mutation answers whether existing tests work.) Governs R4, R5, R9.
- **Failure modes select the mutation sites** — keeps the sample principled rather than opportunistic, and bounds it to code where a silent break costs money or trust. Governs R1, R2, R3.
- **Frontend only** — matches the framing of `docs/audit/frontend-audit.md`; `services/backend` is out. (session-settled: user-directed — chosen over including backend tests.) Governs R1.
- **The verdict follows the numbers** — a high survival rate makes this a document about deleting or rewriting tests, not only about adding them. Neither framing is pre-committed. Governs R9, R10.

### Requirements

**Target selection**

- R1. The audit enumerates the failure modes that must never break silently across the frontend workspaces the suite actually runs: `apps/wallet`, `apps/business`, `apps/listener`, `apps/shopify`, `packages/wallet-shared`, `packages/design-system`, `packages/app-essentials`, `packages/ui-preview`, `packages/dev-tooling`, and `sdk/core`, `sdk/react`, `sdk/components`. `packages/rpc` carries no vitest project of its own but is in scope per R11. A failure mode names an observable bad outcome (funds sent to the wrong address, a cross-origin RPC accepted, a persisted store rehydrating into a broken state), not a file.
- R2. Each failure mode maps to the code that implements it and to whichever existing tests claim to defend it, including the empty case where none do. The enumeration stays small enough that every mode reaches mutation, rather than producing a map wider than R3's site budget can cover.
- R3. Mutation sites are selected from that mapping, weighted toward money movement, trust boundaries, and irreversible operations. Trust-boundary coverage includes origin and session checks, redirect sanitization, and token lifecycle, not only RPC dispatch. Approximately 30 sites is the working target; the number follows the failure-mode map rather than being fixed in advance.

**Measurement**

- R4. Each mutation is a single semantic change to source that a correct test suite should reject — an inverted comparison, a flipped boolean, a removed guard, a changed branch target. Each mutant is measured in isolation so that no two mutations are ever live in the same tree.
- R5. Each mutant is classified as killed (at least one test fails) or survived (the suite stays green). A kill names the failing test and confirms it failed because of the mutation, not from unrelated flake.
- R6. Every mutation is reverted after measurement, and the audit verifies the tree is clean before the next mutant is applied. The audit leaves the working tree unchanged.
- R7. A mutant that survives because no test can distinguish it is classified further: equivalent when the change does not alter observable behavior, dead-in-prod when the mutated code is unreachable under production configuration, and mock-shadowed when every test that reaches the module replaces it with a mock so the real code never executes. None of the three counts toward the survival rate, since none is evidence of a weak assertion.

**Reporting**

- R8. Every survivor is reported with the mutated location, the semantic change, and the user-visible consequence had it shipped.
- R9. The audit states a survival rate and a per-failure-mode breakdown, and draws a verdict on whether the tests defending the sampled failure modes are trustworthy. The verdict covers the sampled areas only; because sites are risk-weighted rather than uniformly drawn, the audit does not generalize the rate to the suite as a whole. The rate counts only mutations in code some test claims to cover; mutations in code with no test at all are reported under R11 rather than inflating the rate, since they measure absence rather than weakness.
- R10. Where a cluster of tests demonstrably kills nothing, the audit says so and names the cluster, rather than defaulting to a recommendation to write more tests.
- R11. Structural gaps are reported separately from measured results, at both workspace and file granularity. `packages/rpc` is the foremost case: it owns no tests, and every downstream test that references `@frak-labs/frame-connector` either replaces it with `vi.mock` or imports only types and constants, so no test executes `listener.ts` or `client.ts` at all. Mutations there are still worth running to demonstrate the gap, but they classify as mock-shadowed under R7 rather than as survivors.
- R12. The audit carries a short enforcement section recording that no CI workflow runs the suite, that the `CI=true`-gated coverage thresholds and GitHub Actions reporter in `packages/test-foundation/src/vitest.shared.ts:76-99` therefore never execute, and that component files are excluded from the coverage denominator. This section records the gap; it does not specify the fix.
- R13. A control arm of mutation sites is drawn from code the audit expects to be well tested, so the survival rate has a comparison point. A control arm that survives at the same rate as the load-bearing arm indicates a method problem, and the audit says so rather than reporting the headline number alone.
- R14. Survivors on security-relevant paths — origin and session checks, redirect sanitization, token handling — are written up by consequence and location, without step-by-step exploitation detail. The audit states where the report is stored and that it maps undefended paths, so the artifact is handled accordingly.

### Acceptance Examples

- AE1. **Covers R5, R8.** **Given** the origin-equality check in `apps/listener/app/module/middleware/walletContext.ts` is inverted, **when** the frontend suite runs, **then** if it stays green the mutant is recorded as a survivor with the consequence "a cross-origin RPC request would be accepted and no test would notice."
- AE2. **Covers R5.** **Given** a merge-strategy branch in `apps/wallet/app/module/walletMerge/` is flipped, **when** the suite runs and `stepMachine.test.ts` fails, **then** the mutant is recorded as killed and that test is named as the killer.
- AE3. **Covers R7.** **Given** a mutation changes source that no test exercises in an observable way, **when** the suite stays green, **then** the audit distinguishes an equivalent mutant from a genuine survivor before counting it, so the survival rate is not inflated by changes no test could have caught.
- AE4. **Covers R10.** **Given** mutations to design-system component internals survive at a high rate, **when** the audit reports, **then** it names that cluster as low-value and considers deletion or rewrite alongside expansion, rather than recommending more of the same shape.
- AE5. **Covers R7, R11.** **Given** `packages/rpc/src/client.ts` holds the RPC origin check and every downstream test that references the module replaces it with `vi.mock`, **when** the guard is mutated and the suite stays green, **then** the mutant is classified mock-shadowed and reported as a structural gap — no test executes this code — rather than counted as a survivor.
- AE6. **Covers R7, R8.** **Given** the origin-equality branch in `packages/rpc/src/listener.ts` is mutated while `apps/listener/app/bootstrap.ts` passes `allowedOrigins: "*"`, **when** the suite stays green, **then** the mutant is classified dead-in-prod and reported as an architectural finding — the guard is unreachable under production configuration — rather than counted as a survivor.

### Success Criteria

- Every survivor in the report is reproducible: someone can apply the named change, run the suite, and watch it stay green.
- The verdict on the sampled failure modes rests on measured survival rates, not on read impressions of test files.
- The control arm's survival rate is reported alongside the load-bearing arm, so a reader can tell a weak suite from a weak method.
- The findings name which failure modes are undefended, so a follow-up CI work unit can decide what to gate on without re-investigating.

### Scope Boundaries

- Wiring CI gates — specifying which commands run on which trigger, thresholds, and runner budget. This audit informs that work and stops short of it.
- `services/backend` tests.
- E2E and Playwright. `apps/wallet/tests/README.md:10` already declares them out of CI, they default `TARGET_ENV` to the live `wallet-dev.frak.id`, and they require a running SST stack — none of which mutation testing can assess.
- The long tail of low-stakes component tests, except where a mutation cluster lands there and R10 applies.
- Writing or fixing tests. This audit measures and reports.

### Dependencies / Assumptions

- The suite is green at baseline and runs in about 106 seconds across all 564 files, verified on 2026-07-31 at `1c9eb67f4`. Every survival result is relative to that baseline.
- Mutants are measured one at a time. Concurrency, if used, requires isolated trees (worktrees or copies) so no two mutations are ever live together; planning decides whether the wall-clock saving justifies that machinery.
- `vitest run` transforms TypeScript without typechecking, so a mutation that introduces a type error still executes. Type errors are not a distinct measurement outcome.
- Coverage thresholds do not fire locally, since they are gated on `CI=true`. Mutation results are independent of that gate.
- `docs/audit/frontend-audit.md` supplies the load-bearing code map: the merge flow, the token-send path, the RPC lifecycle channel, and persisted-store migrations are already identified as risk-carrying.

### Outstanding Questions

**Deferred to Implementation**

- Whether any site in the ranked list turns out to be unmutatable in a single semantic edit, in which case the implementer substitutes the next site from the same failure mode.

### Sources / Research

- `docs/audit/frontend-audit.md` — the prior frontend audit; supplies the load-bearing code map and the P0/P1 findings that motivate several failure modes.
- `vitest.config.ts:34-49` — root projects glob; `packages/rpc` has no `vitest.config.ts` and is therefore unmatched, though downstream suites import it.
- `packages/test-foundation/src/vitest.shared.ts:76-99` — coverage thresholds and reporters, both gated on `CI=true`.
- `apps/wallet/vitest.config.ts:36-38`, `apps/business/vitest.config.ts:33-35`, `apps/listener/vitest.config.ts:58-60` — the component-exclusion rule applied identically across apps.
- `.github/workflows/apps.yaml:17-39` — the only JS/TS quality job in CI.
- `AGENTS.md:16` — the four-command gate, enforced pre-commit by humans.
- `apps/wallet/tests/README.md:10` — E2E self-declared out of CI.
- Commits `e5fa1ac21`, `c4487ad7e` (frontend) and `02ca54977`, `9dc0f263d` (backend) — recorded leaks of the pre-commit gate.
- `packages/rpc/src/client.ts:306-321` — origin equality on the RPC client; a disable-the-guard mutation left 925 tests green across two projects during planning research.
- `apps/listener/app/bootstrap.ts:174` — `allowedOrigins: "*"`, which makes `packages/rpc/src/listener.ts:203-207` unreachable in production.
- StrykerJS issue #6073 — non-deterministic mutant verdicts under `coverageAnalysis: perTest` on Vitest 4.1.x; open and unfixed as of 2026-07-31.
- `packages/core/src/sandbox/sandbox.ts:74-96` (StrykerJS) — `symlinkNodeModulesIfNeeded`, the mechanism by which Bun workspace links escape the sandbox.

---

## Planning Contract

**Product Contract preservation:** restructured, no scope change. R7 gained the `dead-in-prod` and `mock-shadowed` classifications, R11 gained file-level granularity and the mock-shadowing evidence, and AE5/AE6 were added or rewritten to cover them; R1-R6 and R8-R10, R12-R14 are unchanged in meaning. Three Outstanding Questions moved from `Deferred to Planning` to resolved, and are now recorded as KTD1, KTD3, and a Scope Boundary.

### Key Technical Decisions

- KTD1. **Hand-applied mutations, not Stryker.** Two blockers were reproduced against this repo rather than inferred. StrykerJS issue #6073 yields non-deterministic false survivors on Vitest 4.1.x — this repo pins `^4.1.10` — and the vitest runner forces `coverageAnalysis: perTest` regardless of config, so the broken path cannot be avoided. Separately, Stryker's sandbox symlinks `node_modules` back to the real repo; Bun places workspace links inside them, so a mutation to `packages/rpc` loads the pristine original and every cross-package mutant scores Survived. That is exactly the R11/AE5 case. Resolves the tooling question. Governs R4, R6.
- KTD2. **Each mutant runs only the projects whose tests could kill it.** `vitest run --project <name>` against the projects whose tests actually execute the mutated module, not the full 106s suite. Research measured 12.1s for a two-project run versus 106s for all thirteen. Membership is established by execution, not by the import graph: a test that `vi.mock`s the module does not execute it and cannot kill the mutant. Governs R4, R5.
- KTD3. **Control arm is `sanitizeReturnScheme` and `sanitizeSeededReward`.** Both are pure functions with adversarial tests — boundary values on both sides, URL-structure smuggling, a trailing-newline anchor bypass. A survivor there indicates a broken method, not a weak suite. Two modules rather than one gives an intra-arm variance signal. Resolves the control-arm question. Governs R13.
- KTD4. **Mutations are applied and reverted with `git`, and cleanliness is asserted between mutants.** `git diff --quiet` before applying the next mutation, which scopes the check to tracked source and ignores the untracked audit notes. A dirty tree at that check stops the run, because every subsequent measurement would attribute kills to the wrong change. Governs R6.
- KTD5. **Classification is five-way, not binary.** Killed, survived, equivalent, dead-in-prod, mock-shadowed. The last two exist because a green result can mean the code is unreachable in production (`packages/rpc/src/listener.ts:203-207` behind the wildcard at `:199`) or that no test executes it at all (every downstream test `vi.mock`s `@frak-labs/frame-connector`). Both are findings about the code, not about assertion strength. Governs R5, R7.
- KTD6. **A kill must be causally attributed.** The named failing test is re-run against the clean tree to confirm it passes without the mutation. A test that fails in both states is flake, not a kill. Governs R5.
- KTD7. **Every survivor is re-checked against the full suite before it is recorded.** Project-scoping can only manufacture false survivors — a killer test living outside the selected set. A mutant that survives its scoped run is re-run against `bun run test` before classification. Kills need no re-check, since a kill in a subset is a kill. This keeps the speed of KTD2 without inheriting its one failure mode. Governs R5, R8.

### Assumptions

- The ranked site list in U2 comes from the planning research map. If a site proves unmutatable in one semantic edit, the implementer substitutes the next site from the same failure mode rather than expanding the budget.
- `bun run test` dispatches to Vitest; `bun test` runs Bun's own runner and must not be used (`AGENTS.md:50`).

### Sequencing

U1 establishes the baseline and the harness. U2 fixes the site list. U3-U6 measure, and can proceed in any order once U2 is fixed. U7 reports and depends on all measurement units.

---

## Implementation Units

### U1. Baseline verification and mutation harness

- **Goal:** Establish a trustworthy baseline and a repeatable apply-measure-revert loop before any finding is recorded.
- **Requirements:** R4, R6; KTD2, KTD4.
- **Dependencies:** none.
- **Files:** `docs/audit/frontend-test-quality-audit.md` (created, working notes appended as measurement proceeds).
- **Approach:**
  1. Confirm `git diff --quiet` on a clean tree, then run `bun run test` and record the green baseline with file and test counts.
  2. For each candidate module, determine which projects' tests actually execute it — grep for `vi.mock` of the module alongside the import, since a mocked import never runs the real code (KTD2). Record the executing set, not the importing set.
  3. Establish the loop: apply one edit, run the scoped `--project` set, record the verdict, `git checkout --` the file, assert `git diff --quiet`.
- **Execution note:** Prove the loop end-to-end on one known site before scaling. `packages/rpc/src/client.ts:306-321` is the natural smoke case — planning research already observed it survive, so a run that reports it killed means the harness is wrong.
- **Test scenarios:** `Test expectation: none -- this unit builds measurement scaffolding and produces no shipped behavior.`
- **Verification:** The loop runs on one site and returns a verdict; the tree is clean afterward.

### U2. Failure-mode map and ranked site list

- **Goal:** Produce the failure-mode to code to defending-test map, and fix the ~30 mutation sites it selects.
- **Requirements:** R1, R2, R3, R13.
- **Dependencies:** U1.
- **Files:** `docs/audit/frontend-test-quality-audit.md`.
- **Approach:**
  1. Enumerate failure modes across the R1 workspaces as observable bad outcomes, and map each to its implementing guard and defending test (or its absence).
  2. Allocate the site budget by blast radius: RPC trust boundary, listener lifecycle handling, walletMerge, token send, redirect sanitization, persisted-state rehydration, plus the KTD3 control arm.
  3. Record each site with its file, the guard, the intended semantic change, and the project set whose tests could kill it.
  4. List mapped-but-unmeasured guards separately so the report can cite them without implying they were measured.
- **Test scenarios:** `Test expectation: none -- this unit produces the measurement plan, not behavior.`
- **Verification:** Every selected site names a file, a guard, a mutation, and a kill-candidate project set. Every failure mode either has sites or an explicit reason it has none.

### U3. Trust-boundary measurement

- **Goal:** Measure whether the postMessage and origin-validation guards are defended.
- **Requirements:** R4, R5, R6, R7, R8, R11, R14; AE1, AE5, AE6.
- **Dependencies:** U2.
- **Files:** `packages/rpc/src/listener.ts`, `packages/rpc/src/client.ts`, `apps/listener/app/module/middleware/walletContext.ts`, `apps/listener/app/module/handlers/lifecycleHandler.ts` (all mutated and reverted, never left modified).
- **Approach:**
  1. Mutate the `client.ts` origin equality, the `listener.ts` lifecycle and RPC shape predicates, and the pre-middleware lifecycle dispatch.
  2. Mutate `walletContext.ts` origin comparison and both bypasses; this file has the repo's strongest trust-boundary test, so it doubles as a within-area control.
  3. Mutate `lifecycleHandler.ts` payload validation, the allowed-domains equality, and the CSS-link scheme check.
  4. Classify per KTD5: the `listener.ts` origin-equality result as dead-in-prod, and any `packages/rpc` result whose only reachable tests mock the module as mock-shadowed.
- **Test scenarios:** measurement outcomes, not new tests. Each mutant records: the killing test and its causal re-check (KTD6), or a survivor with its user-visible consequence, or an equivalent/dead-in-prod classification with the reason.
- **Verification:** Every site in the trust-boundary group has a verdict; the tree is clean; no security-relevant survivor is written with exploitation steps (R14).

### U4. Money-path measurement

- **Goal:** Measure whether the wallet-merge and token-send guards are defended.
- **Requirements:** R4, R5, R6, R7, R8, R9; AE2.
- **Dependencies:** U2.
- **Files:** `apps/wallet/app/module/walletMerge/**`, `apps/wallet/app/routes/_wallet/_protected/tokens.send.tsx`, `apps/wallet/app/module/tokens/utils/validateAmount.ts`, `packages/wallet-shared/src/wallet/smartWallet/**` (all mutated and reverted).
- **Approach:**
  1. Mutate the merge consent credential check, the passkey-binding equality, the migration error-to-success conversion, and the session-type check that prevents an ecdsa session persisting as a local one.
  2. Mutate the `stepMachine` branches, which are tested — expected kills that validate the harness inside a mostly-untested module.
  3. Mutate the token-send amount boundaries and the smart-wallet chain check.
- **Test scenarios:** measurement outcomes per site, recorded as in U3.
- **Verification:** Every money-path site has a verdict; expected-kill sites in `stepMachine` and `validateAmount` do die, or the harness is suspect.

### U5. Persisted-state and sanitizer measurement

- **Goal:** Measure rehydration guards and redirect sanitization.
- **Requirements:** R4, R5, R6, R7, R8, R9.
- **Dependencies:** U2.
- **Files:** `apps/wallet/app/module/pending-actions/stores/pendingActionsStore.ts`, `apps/wallet/app/module/biometrics/stores/biometricsStore.ts`, `apps/wallet/app/module/common/utils/sanitizeRedirectUrl.ts` (all mutated and reverted).
- **Approach:**
  1. Mutate the `pendingActionsStore` migrate guard, which is tested through `persist.getOptions().migrate` — an expected kill.
  2. Mutate the `biometricsStore` rehydrate re-lock, which is untested.
  3. Mutate the `sanitizeRedirectUrl` scheme check. This file has no test at all, so per R9 the result reports under R11's structural-gap list rather than the survival rate.
- **Test scenarios:** measurement outcomes per site, recorded as in U3.
- **Verification:** Each site has a verdict, and the `sanitizeRedirectUrl` result is routed to the structural-gap list rather than the rate.

### U6. Control-arm measurement

- **Goal:** Produce the comparison rate that tells a weak suite from a weak method.
- **Requirements:** R13; KTD3.
- **Dependencies:** U2.
- **Files:** `apps/wallet/app/module/common/utils/sanitizeReturnScheme.ts`, `apps/wallet/app/module/common/utils/sanitizeSeededReward.ts` (mutated and reverted).
- **Approach:**
  1. Mutate the scheme regex anchors, the character class, and the length bound.
  2. Mutate the seeded-reward length boundary and the shape anchors.
  3. Record the arm's survival rate separately from the load-bearing arm.
- **Test scenarios:** measurement outcomes per site. A survivor here is a method-validity signal and is called out as such.
- **Verification:** The control arm's rate is recorded. A control rate at or above the load-bearing rate triggers the R13 method-problem statement instead of a headline finding.

### U7. Audit report

- **Goal:** Write the findings document.
- **Requirements:** R8, R9, R10, R11, R12, R13, R14.
- **Dependencies:** U3, U4, U5, U6.
- **Files:** `docs/audit/frontend-test-quality-audit.md`.
- **Approach:**
  1. Report each survivor with location, semantic change, and user-visible consequence, holding security-relevant entries to R14.
  2. State the survival rate over tested code only, the per-failure-mode breakdown, and the control-arm rate beside it. Scope the verdict to the sampled failure modes per R9.
  3. Name any cluster that killed nothing, per R10, without defaulting to a write-more-tests recommendation.
  4. List structural gaps separately per R11, including `packages/rpc` owning no tests and `sanitizeRedirectUrl` having none.
  5. Add the short enforcement section per R12 — no CI workflow runs the suite, the `CI=true` thresholds never execute, components are excluded from the denominator.
- **Test scenarios:** `Test expectation: none -- this unit produces a findings document.`
- **Verification:** Every requirement from R8 through R14 is visible in the report, and each survivor entry carries enough detail to be reproduced.

---

## Verification Contract

| Check | Command | Applies to |
|---|---|---|
| Baseline green before measurement | `bun run test` | U1 |
| Scoped mutant run | `bun run test -- --project <name>` (never `bun test`) | U3-U6 |
| Survivor re-check before recording | `bun run test` | U3-U6 |
| Tree clean between mutants | `git diff --quiet` | U1, U3-U6 |
| Causal kill re-check | re-run the named test on the clean tree | U3-U6 |
| Report completeness | R8-R14 each traceable to a section | U7 |

The audit changes no shipped behavior, so there is no build or release gate. The quality gate is the clean-tree assertion: a dirty tree invalidates every measurement after it.

---

## Definition of Done

- Every selected site has one of five verdicts: killed with a causally-confirmed test, survived and re-checked against the full suite, equivalent, dead-in-prod, or mock-shadowed.
- The working tree is clean and `git diff --quiet` passes; no mutation remains anywhere.
- The report states the survival rate over tested code, the per-failure-mode breakdown, the control-arm rate, and a verdict scoped to the sampled failure modes.
- Structural gaps and mapped-but-unmeasured guards are listed separately from measured results, with citations.
- Security-relevant survivors are written by consequence and location, without exploitation steps.
- No scaffolding, scratch scripts, or partial mutations from abandoned attempts remain in the tree.
