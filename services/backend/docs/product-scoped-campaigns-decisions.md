# Product-scoped campaigns — design decisions

Non-obvious decisions taken during implementation, kept as reference for
future changes. See `product-scoped-campaigns.md` for the feature design.

## Validation

- **`productScope` field allowlist, order-level `conditions` unvalidated —
  deliberate asymmetry.** The item shape is a small closed set plumbed
  end-to-end, so `productScope` gets an exact-match allowlist. `RuleContext`
  is open-ended and pre-dates this feature, so order-level `conditions`
  cannot be allowlisted the same way.
- **Depth 5 / 50 nodes cap** on `productScope` `ConditionGroup` recursion:
  fresh judgment call (no existing codebase constant to match), generous for
  real merchant rules, tight enough to stop pathological payloads.
- **Operator/value type coherence lives in the evaluator, not a second
  order-level validator.** `RuleConditionValue` accepts arrays globally, so a
  malformed rule can hand a comparison operator an array. The evaluator fails
  closed (never matches) for `eq/neq/gt/gte/lt/lte/between` with an array
  operand — field-agnostic, protects every caller of the schema in one place.
  String operators already fail closed on non-string operands.
- **`validateReward`/`validateRewardAmount` take the full `rule`** (not just
  the reward) so they can check `rule.productScope` when validating
  `matched_items_amount` / `purchase.matchedAmount` / `purchase.matchedQuantity`.
  Minimal signature widening; a dedicated cross-field validation pass would be
  over-engineering for these checks.

## Reward calculation

- **Zero fiat base must never `defer`.** A zero/negative base (e.g. an
  all-excluded matched set) is short-circuited to a hard error (percentage)
  or raw-value passthrough (tiered) *before* any pricing call. Otherwise an
  unpriceable currency/token would turn a legitimate zero into
  `defer: true` and the interaction would retry forever waiting for an FX
  rate unrelated to the actual problem. Regression tests pair a zero base
  with a mocked-unpriceable conversion and assert the pricing call is never
  made.
- **Missing `matchedAmount` on a `matched_items_amount` reward is a hard
  error** (wiring bug: the engine never ran the productScope gate), never a
  defer.
- **Negation semantics (doc-only, no guard):** a `not_in [CHEAP]` scope still
  pays a full flat reward on a cart containing `CHEAP` plus any non-excluded
  item — negation excludes items from the reward *basis*, not from the cart,
  and flat rewards have no basis. Merchants who want the exclusion reflected
  in the payout should use `matched_items_amount` or
  `tierField: purchase.matchedAmount`.
- **`matchedQuantity` is computed but not yet consumed** by any reward path
  (quantity-aware rewards are an open question in the plan). Kept: it comes
  from the same reduce pass as `matchedAmount` (zero extra cost), is tested,
  and completes the matched-set data pair.

## SKU plumbing

- **`PurchaseInteractionCreator.items[].sku` is `string | null | undefined`**:
  the late-claim path feeds it `PurchaseItemSelect` rows (Drizzle nullable →
  `string | null`), the webhook-first path feeds DTO items (absent →
  `undefined`). Both normalize via `item.sku ?? undefined` before reaching
  `PurchasePayload`.
- **No `PurchaseRepository` logic changes needed**: `upsertWithItems` spreads
  `...item` (persists `sku` automatically once the column exists on
  `PurchaseItemInsert`) and `findItemsByPurchaseId` is a bare `select()`
  (projects the new column automatically). Covered by
  `PurchaseRepository.test.ts`.
- **Migration ownership**: the nullable `sku` column is declared in the
  Drizzle schema here; the DB team owns and runs the actual migration, which
  must land before this deploys (inserts reference the column).
