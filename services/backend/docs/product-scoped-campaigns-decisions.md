# Product-scoped campaigns — implementation decision log

Running log of divergences from the plan and non-trivial decisions taken during
implementation. Newest entries at the bottom of each section.

## Context / environment

- **Env fix (not a code decision):** the sandbox's `bun install` initially produced
  44 zero-byte packages (corrupted extraction). Fixed with `bun install --force`.
- **Typecheck baseline:** `bun x tsc --noEmit` reports **10 pre-existing errors**,
  all in `notifications` / `merchant` / `ExplorerOrchestrator` due to the
  `@frak-labs/core-sdk` workspace package not being built in this checkout. **None**
  are in our target files (`campaign`, `purchases`, `orchestration/reward`,
  `PurchaseInteractionCreator`). Success criterion for our work: no *new* tsc errors
  in touched files + all vitest suites green.

## Orchestration decisions

- **Parallel split into two file-disjoint tracks**, each in an isolated git
  worktree, then merged back (disjoint files ⇒ clean merge):
  - **Track A — `productScope` core** (`src/domain/campaign/**`): jsonb-only, no
    migration.
  - **Track B — SKU plumbing** (`src/domain/purchases/**`, `src/orchestration/**`,
    `src/domain/rewards/types`): TS/Drizzle schema change; DB team owns migration.
  The two tracks share no files. Track A references `purchase.items[].sku`, which is
  already declared on `PurchaseItem`, so it compiles independently of Track B.
- **Reality vs. intent (worktree collapse):** the parallel run was dispatched with
  worktree isolation, but in practice the isolation collapsed — a single worker
  executed BOTH tracks (plus a self-review + dedup) directly on the feature branch
  rather than two independent agents in separate worktrees. The end state is a
  clean, committed, file-disjoint set of changes, but the "two independent
  implementers" property did not hold. To compensate, the review phase used four
  genuinely independent fresh-context reviewers (2 code + 1 SKU + oracle), which
  is where the real independent scrutiny came from.
- **Single-writer fix phase:** post-review fixes were applied by one worker
  writing directly on the branch (sole writer, no worktree), then verified and
  committed — the documented-safe pattern for interdependent changes that must
  compile together.

## Implementation decisions

### Track A — productScope core

- **`evaluateAgainst` narrowing fix**: `campaign.rule.productScope` was
  destructured into a local `const productScope` before use inside the
  `.filter` closure in `RuleEngineService`. TS doesn't narrow a property access
  chain (`campaign.rule.productScope`) across a closure boundary the way it
  narrows a local `const`, so the plan's inline `campaign.rule.productScope`
  reference in the filter predicate didn't type-check as non-undefined. No
  behavior change, pure type-narrowing fix.
- **`FX_NORMALIZED_TIER_FIELDS` set** in `RewardCalculator.resolveTierValue`
  replaces the plan's single `!=="purchase.amount"` check with a
  `Set(["purchase.amount", "purchase.matchedAmount"]).has(...)` — same effect,
  slightly more extensible if a third FX-normalized field ever appears.
- **Validation node/depth caps**: the plan called for "a depth/size cap"
  without specifying numbers. Chose depth 5 / 50 nodes for `productScope`
  `ConditionGroup` recursion — generous for any real merchant rule, tight
  enough to stop pathological payloads. Not specified anywhere else in the
  codebase to match against, so this is a fresh call; easy to tune later.
- **`resolveRecipient`/`validateReward` signature change**: `validateReward`
  and `validateRewardAmount` now take the full `rule` (not just the `reward`)
  so they can check `rule.productScope` when validating
  `matched_items_amount` / `purchase.matchedAmount`. Minimal, in-place
  signature widening rather than a new standalone validation pass, to match
  the existing per-reward validation loop structure.
- **Test style**: `RuleEngineService` productScope tests use the *real*
  `RuleConditionEvaluator` (not the mocked `evaluate` used by the file's other
  tests) so the item-level filter/matched-set logic is exercised end-to-end,
  matching how `RewardCalculator.test.ts` already uses the real evaluator.

### Track B — SKU plumbing

- **No `PurchaseRepository.ts` changes needed**, contrary to the plan's file
  list implying repository changes: `upsertWithItems` already spreads
  `...item` (so it persists `sku` automatically once `PurchaseItemInsert`
  gained the column via the schema) and `findItemsByPurchaseId` is a bare
  `db.select()` (projects the new column automatically). Confirmed via
  typecheck + tests rather than speculatively editing an already-correct file.
- **`PurchaseInteractionCreator.items[].sku` typed as `string | null |
  undefined`** (not just `string | undefined` as the plan's phrasing implied)
  because the late-claim path feeds it `PurchaseItemSelect` rows where
  Drizzle's nullable column reads back as `string | null`, while the
  webhook-first path feeds it DTO-shaped items where an absent `sku` is
  `undefined`. Both normalize to `undefined` via `item.sku ?? undefined`
  before reaching `PurchasePayload`.

## Review outcomes

Self-review pass over the full diff (`git diff 79b8f25..HEAD`) looking for
simplification, dedup, over-complexification, performance issues, and bugs.

### Fixed

- **Deduped `isConditionGroup`**: `RuleConditionEvaluator.ts` already had an
  unexported `isConditionGroup` helper; `CampaignManagementService`'s new
  recursive `productScope` validator reimplemented the same
  `"logic" in node && "conditions" in node` check inline. Exported the
  original and imported it instead. (Left `isStartDateCondition`'s
  `!("logic" in node)` alone — it's a pre-existing, differently-shaped check
  for a different purpose, not worth touching in this pass.)
- **Deduped `roundAmount`**: `RuleEngineService.ts` added a byte-identical
  copy of `RewardCalculator.roundAmount` (1e-6 rounding) with a comment
  promising to keep both "in lockstep" — exported the original from
  `RewardCalculator` and imported it instead of maintaining two copies by
  convention.

### Considered, no change made

- **`productScope` depth (5) / node (50) caps**: arbitrary but reasonable
  defaults for a merchant-authored rule; generous for any real campaign,
  tight enough to block pathological payloads. Not derived from an existing
  codebase constant (none exists for this), so this is a fresh, documented
  judgment call rather than a bug. Left as-is.
- **`validateReward`/`validateRewardAmount` now take the full `rule`**
  (previously just the `reward`) so they can check `rule.productScope` when
  validating `matched_items_amount` / `purchase.matchedAmount`. This is the
  minimal signature change that fits the existing per-reward validation loop
  structure; a bigger restructure (e.g., a dedicated cross-field validation
  pass) would be over-engineering for two extra checks. Left as-is.
- **`scopedContext` construction in `RuleEngineService`**: re-verified the
  `matchedItems.length === 0` early return guarantees `context.purchase` is
  defined before the `context.purchase as PurchaseContext` cast further down
  — items only exist on a defined `purchase`, so the cast is safe. No bug.
- **Performance** (O(active campaigns × line items × conditions) per
  purchase interaction, as flagged in the plan): unchanged from the plan's
  own acknowledgment — fine for realistic cart/campaign sizes, no action
  taken.

After fixes: 861/861 backend tests green, typecheck clean against the
pre-existing 10-error baseline, biome clean, no behavior change from the
dedup refactor.

## Independent review round (fresh-context reviewers + oracle)

Dispatched four independent, fresh-context reviews of the committed state
above (no access to the self-review's reasoning): two code reviewers split by
area (core engine, validation/schema), one reviewer for the SKU plumbing
track, and an oracle ruling on the three trickiest open questions. Consensus
findings, ranked by severity:

### Blocker (fixed): zero fiat base could still defer forever

`calculatePercentageReward` and `resolveTierValue` only special-cased a
*missing* `matchedAmount`/tier value — short-circuiting before any pricing
call. A *zero* value (fiat base = 0, e.g. an all-excluded matched set, or a
zero-value tier bucket) still flowed unconditionally into
`pricingRepository.convertFiatToTokenAmount`. If the currency/token happened
to be genuinely unpriceable, that call returns `{converted: false}` →
`defer: true` regardless of the amount being zero — reproducing the exact
infinite-retry hazard the feature was designed to prevent. The existing test
for "zero matchedAmount never defers" only proved this by accident (it mocked
the pricing call to *succeed*, never exercising the unpriceable-currency
combination).

**Fix**: short-circuit `fiatAmount <= 0` (percentage) and `rawValue <= 0`
(tiered) to the hard-error / raw-value path *before* the pricing call, so a
zero base never depends on whether the currency happens to be priceable.
Added regression tests for both reward types pairing a zero base with a
mocked-unpriceable `convertFiatToTokenAmount`, asserting no defer **and**
that the pricing mock was never called.

### Blocker (fixed): array-operand guard was productScope-only, not global

`RuleConditionValue` was widened globally (both `productScope` and
order-level `conditions` share the same schema), but only `productScope` got
an operator/value coherence validator. Order-level `conditions` have **no**
validation at all (`validateRuleDefinition` only checks `productScope` and
`rewards`) and are reachable via the public create/update campaign API. A
malformed or hand-crafted rule could put an array value on `eq`/`neq`
(silently always-false/always-true) or `gt`/`lt`/`between` (silently
lexicographic-compares via `String()` coercion) with no error at author or
eval time.

**Oracle's ruling** (adopted as-is): fix this at the evaluator level, not by
adding a second, order-level validator. The field-allowlist asymmetry
(productScope validated, order-level not) is deliberate and stays —
RuleContext is open-ended, so it can't be allowlisted — but operator/value
*type* coherence is field-agnostic and belongs in the shared evaluation path,
where it protects every current and future caller of the schema in one place.

**Fix**: `RuleConditionEvaluator` now fails closed (returns `false`) for any
scalar/string/comparison operator (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`,
`between`, `contains`, `starts_with`, `ends_with`) that receives an array in
either `value` or `valueTo` — extracted as `hasInvalidArrayOperand`, checked
in `evaluateSingleCondition` before the operator dispatch (also incidentally
resolved a biome cognitive-complexity violation that inlining the check into
`evaluateOperator` had triggered). `in`/`not_in`/`exists`/`not_exists` are
unaffected.

### Should-fix (fixed): two productScope validation gaps

- `validateProductScopeCondition` checked `value` for array-on-scalar-operator
  but never checked `valueTo` — a `between` with a scalar `value` and an
  *array* `valueTo` slipped through validation and hit the same lexicographic
  `compareValues` bug at eval time. Now rejected explicitly (also covered by
  the global evaluator guard above, belt-and-suspenders since validation
  should catch it before publish).
- String operators (`contains`/`starts_with`/`ends_with`) had a `value !==
  null &&` exception that let `null` pass validation, producing a
  silently-dead leaf (the evaluator's string-operator helper returns `false`
  for any non-string operand). Dropped the exception; string operators now
  require an actual string, consistent with the field-allowlist's own
  rationale ("reject unknown fields so a typo can't create a campaign that
  silently never matches").

### Nice-to-have (fixed): unsafe cast removed

`RuleEngineService`'s productScope block spread `...(context.purchase as
PurchaseContext)` — safe by construction (only reached when `matchedItems`
is non-empty, which implies `purchase` was defined), but relied on a
reachability argument instead of type-level proof. Replaced with an explicit
`if (!purchase || matchedItems.length === 0) return undefined` narrowing
inside a new `applyProductScope` extraction (which also fixed the biome
complexity violation `evaluateSingleCampaign` had accumulated).

### Should-fix (fixed): PurchaseRepository had no test coverage

Review noted a directly-applicable mocked-`db` pattern already existed
(`ReferralLinkRepository.test.ts`) and was not used for `PurchaseRepository`,
leaving the sku-persistence claim ($7 of the plan) verified only by manual
trace. Added `PurchaseRepository.test.ts` following that pattern (mocking
`db` via the `@backend-infrastructure` barrel — note: not the deep
`infrastructure/persistence/postgres` path `ReferralLinkRepository` uses,
since `PurchaseRepository` imports `db` through the barrel alias instead).
Asserts `upsertWithItems` threads `sku` into the inserted item values and
`findItemsByPurchaseId`'s bare `select()` doesn't strip it.

### Coherent, doc-only (no code change): negation reward-basis semantics

Oracle verified the negation/complement semantics are internally coherent
(the same matched/complement set both gates the trigger and defines
`matched_items_amount`), but flagged one merchant-facing surprise worth
documenting rather than guarding against: a `not_in [CHEAP]` scope still pays
a **full flat/tiered-non-matched-basis** reward on a cart containing `CHEAP`
alongside any non-excluded item, because negation excludes items from the
reward *basis*, not from the cart, and a flat reward has no basis concept to
exclude from. A guard here would contradict the explicit "allow negation in
v1" decision, so this became a doc addition to §1 of the plan instead of a
code change: merchants who want the exclusion reflected in the payout should
use `matched_items_amount` (or `tierField: purchase.matchedAmount`), where the
exclusion is visible in the basis.

### Kept as-is (reviewed, no action): matchedQuantity

Both a reviewer and the oracle examined `matchedQuantity` (computed, typed,
tested, but not yet consumed by any reward path — quantity-aware rewards are
an explicit Open Question in the plan). Ruling: keep. It's computed in the
same reduce pass as `matchedAmount` (zero extra cost), already has test
coverage asserting correctness, and completes the matched-set data pair
symmetrically — dropping it now just means re-deriving the same reduce later
when a quantity-aware reward lands. This is a single already-tested scalar,
not a speculative abstraction; YAGNI targets unbuilt abstractions, not an
already-computed, already-tested field.

### Final state after this round

874/874 backend tests green (861 baseline + 13 new regression tests across
the fixes above), typecheck identical to the pre-existing 10-error baseline
(none in touched files), biome clean. Three logical commits: the defer-safety
fix, the array-operand/validation/cast fixes, and the repository test.
