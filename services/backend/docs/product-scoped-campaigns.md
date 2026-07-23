# Product-scoped campaigns — implementation plan

## Goal

Let merchants create campaigns tailored to a **specific product** (by product id, and
ideally SKU), where:

- A campaign only triggers when the purchase contains a matching line item.
- Matching reuses the existing rule vocabulary — single value (`eq`), list
  (`in`), negation (`neq` / `not_in`), substring (`contains`), etc.
- Campaigns stay **additive**: if a referee buys 3 products and two of them are
  each covered by a different product-scoped campaign, both campaigns trigger.
- Percentage rewards can pay on the **matched line items** rather than the whole
  order (`percentOf: "matched_items_amount"`).
- Line matching works on **product id** and, optionally, a dedicated **SKU**.

## TL;DR of the approach (Option B)

Add an **optional `productScope`** block to the campaign rule. It reuses the
existing `RuleCondition` / `ConditionGroup` shape, but is evaluated **per purchase
line item** with "at least one item matches" semantics. Everything is stored in
the existing `rule` `jsonb` column, so **the campaign-side change needs no DB
migration** (per `AGENTS.md`, migrations are DB-team owned). SKU matching (§7) is
the one part that adds a `purchase_items` column.

Additivity is already handled by the engine: `RuleEngineService.evaluateRules`
loads every active campaign for `(merchantId, trigger)`, evaluates each one, and
**sums the rewards of all matching campaigns**. The only missing piece is
product-level matching — which `productScope` adds.

---

## Current state (what exists today)

| Concern | Location | Notes |
|---|---|---|
| Rule storage | `src/domain/campaign/db/schema.ts` | `campaign_rules.rule` is `jsonb` (`CampaignRuleDefinition`). No migration needed to extend. |
| Rule schema/types | `src/domain/campaign/schemas/index.ts`, `types/index.ts` | `conditions` are `RuleCondition[] | ConditionGroup`; operators already include `eq/neq/in/not_in/contains/...`. |
| Condition evaluation | `src/domain/campaign/services/RuleConditionEvaluator.ts` | Walks a dot-path (`getNestedValue`) over `RuleContext` and compares **scalars**. Cannot reach into `purchase.items[]` today. |
| Rule engine (matching + additivity) | `src/domain/campaign/services/RuleEngineService.ts:45` | Loads active campaigns, evaluates each once, **sums rewards across all matches**. |
| Reward math | `src/domain/campaign/services/RewardCalculator.ts` | `percentage`/`tiered` compute against `purchase.amount` (**whole order**). |
| Purchase context (has line items) | `src/orchestration/reward/InteractionContextBuilder.ts:99` | Maps `payload.items` → `purchase.items[]` with `productId, name, quantity, unitPrice, totalPrice`. |
| Publish/create validation | `src/domain/campaign/services/CampaignManagementService.ts` (`validateRuleDefinition`) | Where new rule validation should hook in. |
| Estimation surface (SDK) | `src/domain/campaign/services/EstimatedRewardService.ts` | Surfaces `conditions` to the wallet/SDK; should also surface `productScope`. |
| API create/update body | `src/api/schemas/campaignApiSchemas.ts` | Binds `CampaignRuleDefinitionSchema`; picks up new field automatically. |

### Two gaps that block the naive "just use conditions" approach

1. **Conditions can't see line items.** `getNestedValue(context, "purchase.items")`
   returns the array; no operator matches *inside* it.
2. **Condition values can't be arrays.** `RuleConditionValue` is
   `string | number | boolean | null` (`schemas/index.ts`), so `in` / `not_in`
   are effectively unusable in the public schema today. Array support must be
   added for "match against a list of products".

### Data-pipeline reality for SKU

The purchase line pipeline only carries `productId` and `name` end-to-end:

`CustomWebhook DTO` (`domain/purchases/dto/CustomWebhook.ts`) → `PurchaseInteractionCreator`
(`orchestration/PurchaseInteractionCreator.ts`) → `PurchasePayload.items`
(`domain/rewards/types/index.ts`) → `InteractionContextBuilder.buildPurchaseContext`.

- `PurchaseItem` in `campaign/types/index.ts` declares optional `sku` and
  `category`, **but they are never populated**.
- We match on **`productId`** (canonical external product id), **`name`**, **and**
  a new **optional `sku`** field plumbed end-to-end (see §7) so merchants can match
  on SKU. `sku` stays optional at every hop — orders that don't provide it simply
  won't match SKU conditions.

---

## Design

### 1. `productScope` on the rule

New optional field on `CampaignRuleDefinition`:

```ts
productScope?: RuleConditions; // RuleCondition[] | ConditionGroup
```

Semantics (set-selection model):

- **Absent** → campaign behaves exactly as today (backward compatible).
- **Present** → `productScope` selects the **matched set** = every
  `purchase.items[]` entry that satisfies the conditions, evaluated with the item
  as the root object (so `field: "productId"`, not
  `field: "purchase.items.productId"`).
  - **Trigger**: the campaign matches iff the matched set is **non-empty**
    (existential "at least one item matches").
  - **Reward basis**: `matched_items_amount` sums over the **matched set** only
    (see §6).
- The order-level `conditions` and `productScope` **both** must pass.
- Non-purchase triggers with a `productScope` set never match (no items) —
  rejected at publish validation to avoid silent dead campaigns.

**Negation is supported in v1** and is coherent under the set-selection model.
A `not_in` / `neq` predicate selects the items that do **not** match the listed
products; those items form the matched set that both gates the trigger and (for
`matched_items_amount`) defines the reward basis. Motivating case: a merchant puts
a low-margin SKU on a deep discount and does **not** want it to earn campaign
rewards. They author `productScope: { field: "sku", operator: "not_in", value:
["SKU_CHEAP"] }`:

- Cart = `[SKU_CHEAP]` only → matched set empty → campaign does **not** trigger,
  no reward on the loss-leader.
- Cart = `[SKU_CHEAP, SKU_NORMAL]` → matched set = `[SKU_NORMAL]` → campaign
  triggers and (with `matched_items_amount`) rewards only `SKU_NORMAL`; the cheap
  SKU is excluded from the basis.

Deliberate semantic: negation excludes matching items from the reward basis but
does **not** veto the whole cart — remaining items still qualify. This is the
intended behavior for margin protection. A universal-quantifier semantic ("the
cart must contain none of X or the whole campaign is vetoed") is explicitly out of
scope for v1.

**Caveat for fixed/tiered rewards not using `matched_items_amount`:** negation
gates the *trigger* on the matched (complement) set, but a flat `FIXED` reward
(or a tiered reward keyed on something other than `purchase.matchedAmount`) pays
its full amount whenever the campaign triggers — it has no concept of a
partial/basis-scoped payout. So a `not_in [SKU_CHEAP]` scope on a cart
`[SKU_CHEAP, SKU_NORMAL]` still triggers (the complement `[SKU_NORMAL]` is
non-empty) and pays the **full** fixed reward, even though the cart contains the
excluded SKU. Negation excludes items from the reward *basis*, not from the
cart; it does not veto a cart that also contains a qualifying item. Merchants
who want the cheap SKU to visibly reduce or zero out the payout should use
`percentOf: "matched_items_amount"` (or `tierField: "purchase.matchedAmount"`),
where the exclusion is reflected in the basis, not just a flat reward that
ignores which items matched.

Merchant expressiveness (reusing existing operators, matches "like other flow rules"):

| Intent | Condition |
|---|---|
| Single product | `{ field: "productId", operator: "eq", value: "SKU_123" }` |
| One of many | `{ field: "productId", operator: "in", value: ["A", "B", "C"] }` |
| Everything except | `{ field: "productId", operator: "not_in", value: ["A"] }` |
| Not a product | `{ field: "productId", operator: "neq", value: "A" }` |
| Name/slug prefix | `{ field: "name", operator: "starts_with", value: "eco-" }` |

### 2. Allow array condition values

Widen `RuleConditionValue` in `schemas/index.ts` to also accept arrays:

```ts
const RuleConditionValue = t.Union([
    t.String(), t.Number(), t.Boolean(), t.Null(),
    t.Array(t.Union([t.String(), t.Number(), t.Boolean()])),
]);
```

This is additive/low-risk and also un-breaks `in` / `not_in` for the whole engine
(the evaluator's `evaluateArrayOperator` already expects an array value).

### 3. Item-level evaluation in `RuleConditionEvaluator`

The internal operator helpers already take `unknown`. Add a **new** public entry
point (net-new — no such method exists today) that evaluates a condition set
against **any** target object:

```ts
// evaluate conditions against an arbitrary object (item or full context)
evaluateAgainst(conditions: RuleConditions, target: unknown): boolean
```

`evaluate(conditions, context)` becomes a thin wrapper
(`evaluateAgainst(conditions, context)`); loosen the shared internals from
`context: RuleContext` to `unknown` so an item root is accepted. Product-scope
match uses `filter` (not `some`) so we retain the matched set for §6:

```ts
const items = context.purchase?.items ?? [];
const matchedItems = items.filter((item) =>
    conditionEvaluator.evaluateAgainst(productScope, item)
);
const productMatches = matchedItems.length > 0;
```

### 4. Gate in `RuleEngineService.evaluateSingleCampaign`

Add the product-scope check alongside the existing `conditionsMatch` check. If a
`productScope` is present and **no** item matches → return `matched: false`
(campaign skipped, **no budget consumed**, no caps touched), exactly like a failed
order-level condition. Additivity across campaigns is unchanged — each qualifying
campaign still contributes its rewards to the summed result.

### 5. Publish/create validation (`CampaignManagementService`)

In `validateRuleDefinition` (runs on create + publish), add:

- Field allowlist for `productScope` conditions: `productId`, `name`, `sku`,
  `quantity`, `unitPrice`, `totalPrice` — reject unknown fields so a typo can't
  create a campaign that silently never matches. **`category` is intentionally
  excluded** — it is declared on `PurchaseItem` but never populated end-to-end
  (unlike `sku`, which this plan plumbs in §7), so allowing it would create
  silently-dead campaigns. Add it only once it is plumbed.
- Operator/value coherence: `in` / `not_in` require an array value; **scalar-only
  operators must reject array values.** Two distinct failure modes to guard (and
  test) separately:
  - `eq` / `neq` use strict `===` / `!==` (`RuleConditionEvaluator.ts:90-91`), so
    an array operand is *always* unequal → `eq` silently never matches, `neq`
    silently always matches. No error, no coercion.
  - `gt` / `gte` / `lt` / `lte` / `between` (incl. `between.valueTo`) go through
    `compareValues` (`RuleConditionEvaluator.ts:33-44`), which `String()`-coerces
    the array and compares **lexicographically** — silently wrong, no error.
  String operators (`contains`/`starts_with`/`ends_with`) require string operands.
- Empty-array policy: **reject** empty `in` / `not_in` arrays (empty `not_in`
  matches everything, empty `in` matches nothing — both footguns). Quick grep
  first to confirm no rule-builder UI relies on empty-array-as-wildcard.
- Field allowlist must be an **exact-match** check (not prefix): a nested
  `field: "purchase.items.productId"` under `productScope` would resolve to
  `undefined` against an item root and never match.
- **Recurse into nested `ConditionGroup`s.** `productScope` is
  `RuleCondition[] | ConditionGroup`, and `ConditionGroupSchema` is
  self-referential/unbounded (`schemas/index.ts:60-70`). The validator must walk
  nested `ConditionGroup.conditions` to every leaf `RuleCondition`, or it silently
  skips nested nodes (matching the already-recursive `evaluateConditionGroup`).
  Add a **depth/size cap** to reject pathologically deep scopes.
- **Note the asymmetry (by design):** order-level `conditions` are *not* validated
  today — `validateRuleDefinition` (`CampaignManagementService.ts:383-399`) only
  checks `trigger` and `rewards`. This new validation is scoped to `productScope`
  only, because the item shape is a small closed set while `RuleContext` is
  open-ended. State this so the asymmetry isn't mistaken for an oversight.
- **Relax the percent-tier guard** (`CampaignManagementService.ts:462`): it
  currently hardcodes `tierField !== "purchase.amount"` → error. Extend it to also
  accept `"purchase.matchedAmount"`, or tiered `matched_items_amount` rewards are
  unpublishable. Keep it in lockstep with `RewardCalculator.resolveTierValue`
  (`RewardCalculator.ts:107`).
- Reject `matched_items_amount` (percentage) / `tierField: purchase.matchedAmount`
  (tiered) when the rule has no `productScope`.
- `productScope` is only meaningful for the `purchase` trigger → reject it on
  other triggers.

### 6. Product-scoped reward basis (`matched_items_amount`)

For a product-scoped campaign, a `percentage` reward that pays a % of the **whole
order** over-rewards (buy one qualifying item → % of the entire cart). We add an
explicit matched-items basis:

- In `RuleEngineService`, when `productScope` matches, capture the **matched
  items** and compute `purchase.matchedAmount` (Σ `totalPrice` of matched items)
  and `purchase.matchedQuantity`, then add them to the `RuleContext.purchase`
  passed to the `RewardCalculator`. (The scope predicate already runs via
  `evaluateAgainst` per item — reuse its result via a `filter` instead of `some`.)
- Add `percentOf: "matched_items_amount"` to `PercentageRewardDefinitionSchema`
  (currently only `"purchase_amount"`). In `calculatePercentageReward`, pick the
  fiat base from `percentOf`: `purchase.amount` vs `purchase.matchedAmount`.
- Add a matching `tierField: "purchase.matchedAmount"` path so tiered rewards can
  use the matched basis too (`getFieldValue` already resolves dot-paths, and
  `resolveTierValue` handles the fiat→token conversion — extend its
  `"purchase.amount"` special-case to also accept `"purchase.matchedAmount"`).
- Guardrails: `matched_items_amount` requires a `productScope` on the same rule
  (rejected at validation). Budget / `maxRewardsPerUser` / caps semantics are
  unchanged — still **one evaluation per campaign**, not per line (avoids Option
  C's per-line complexity).
- `matchedAmount` is fiat in the order currency, like `purchase.amount`, so the
  existing FX + token-pricing path (incl. `deferForUnpriceableReward`) applies.
  **Caveat**: `matchedAmount` is summed independently from line `totalPrice`
  values (themselves `unitPrice*quantity`), so float rounding means it may not
  equal `purchase.amount` even when every line matches — apply `roundAmount`
  (1e-6) consistently.
- **Zero/undefined `matchedAmount` must skip/error, never defer.** A legitimately
  zero matched subtotal (e.g. a matched line with `totalPrice: 0`) currently
  yields `calculatePercentageReward` → `"Calculated amount is zero or negative"`
  (an error), which is correct — it must **not** route through
  `deferForUnpriceableReward` (`RuleEngineService.ts:266`) or the interaction gets
  stuck retrying forever. Define precedence: a *missing* `matchedAmount` (context
  bug) is an error; a *zero* `matchedAmount` is an error/skip; only genuine FX/
  token-price gaps defer.

### 7. `sku` plumbing (end-to-end) — in scope

`sku` is plumbed end-to-end in this iteration. Unlike `productScope` (a pure
`jsonb` change), `sku` touches the **relational** `purchase_items` table
(`domain/purchases/db/schema.ts`), whose fixed column set today
(`externalId, price, name, title, imageUrl, quantity`) has no `sku`. The
**late-claim path** rebuilds interaction items from this table
(`PurchaseLinkingOrchestrator.ts:184` → `purchaseRepository.findItemsByPurchaseId`),
so any `sku` not persisted is **silently dropped** for purchases claimed after the
webhook (a common path). Therefore SKU needs a `purchase_items.sku` column.

> **Migration split of responsibility:** we add the nullable `sku` column to the
> **TypeScript (Drizzle) schema** in `domain/purchases/db/schema.ts` as part of
> this PR; the **DB team owns and runs the actual migration** (per `AGENTS.md`).
> Coordinate so the migration lands with (or before) this change. `sku` is
> nullable everywhere, so code deployed ahead of the migration reads `sku` as
> `null`/`undefined` and simply doesn't match SKU conditions — no runtime break.

Hops to plumb `sku?` end-to-end (all optional/nullable):

1. **Schema (this PR) + migration (DB team)**: add nullable `sku` column to
   `purchase_items` in the Drizzle schema (`domain/purchases/db/schema.ts`); DB
   team runs the migration.
2. **Repository**: `upsertWithItems` already spreads `...item`, so the insert
   carries `sku` once the type has it; `findItemsByPurchaseId` is a bare
   `select()` so it projects the new column automatically
   (`domain/purchases/repositories/PurchaseRepository.ts`).
3. **Webhook producers → `PurchaseItemInsert`**: every DTO→Insert mapping must
   carry `sku`. Per-provider SKU availability differs (see table below).
   `TakeAdsIngestionOrchestrator` and the cart-attribute path pass `items: []`
   (no-op). Note: `PurchaseInteractionCreator.create()` receives
   `PurchaseItemInsert[]` (not raw DTOs) from `PurchaseWebhookOrchestrator.ts:140/191`
   and the late-claim path.
4. **`PurchaseInteractionCreator`** (`orchestration/PurchaseInteractionCreator.ts`):
   its `items` **param type** (currently `{ externalId, name, quantity, price }`,
   no `sku`) **and** its inner `payload.items.map(...)` (which builds
   `PurchasePayload.items` without `sku`) both must carry `sku?`. This is the
   boundary the late-claim path flows through, so missing either half silently
   truncates SKU even after the migration lands.
5. **Payload + context**: add `sku?` to `PurchasePayload.items`
   (`domain/rewards/types/index.ts`), and map it in
   `InteractionContextBuilder.buildPurchaseContext`
   (`orchestration/reward/InteractionContextBuilder.ts:96-106`) →
   `purchase.items[].sku` (the `PurchaseItem` type already declares it).

#### Per-provider SKU availability

| Provider | SKU in raw payload? | Captured today? | Action |
|---|---|---|---|
| **Shopify** | ✅ `line_items[].sku` | ❌ dropped | Add `sku?` to `line_items` in `dto/ShopifyWebhook.ts:14` and map `item.sku` in `shopifyWebhook.ts:118`. |
| **WooCommerce** | ✅ `line_items[].sku` (Woo REST) | ❌ dropped | Add `sku?` to `line_items` in `dto/WooCommerceWebhook.ts:13` and map it in `wooCommerceWebhook.ts:58`. |
| **Magento** | ✅ but overloaded | ⚠️ flows as `name` | `dto/MagentoWebhook.ts:17` treats `name` **as** the SKU (`// SKU`) and `title` as the product label. Map Magento's `name` into the new `sku` field; keep `title` as the display name and preserve the existing `name`-based flow for back-compat so no current slug/label logic breaks. |
| **Custom** | ❌ not in contract | ❌ | `CustomWebhookDto.items` (`dto/CustomWebhook.ts`) has `productId, name, title` only. Adding `sku?` extends the **public** merchant webhook contract (SDK/docs impact). |

Takeaway: SKU is genuinely available upstream for Shopify/WooCommerce (we just
don't parse it) and already carried as `name` for Magento — the only real work is
persistence (`purchase_items` needs the column) plus the ingestion mapping. Custom
is the one provider needing a public-contract change (SDK/docs impact).

`sku` stays optional at every hop; orders without it never match SKU conditions
(no error) — so the feature degrades gracefully if a provider omits SKU or the
migration lands slightly after the code.

### 8. Surface `productScope` to the SDK (estimation)

Add `productScope` to `EstimatedRewardItemSchema` **and mirror it in the manual
`EstimatedRewardItem` type override** (`schemas/index.ts` defines it as
`Omit<Static<...>, "conditions"> & { conditions: RuleConditions }` because the
recursive `ConditionGroup` breaks `Static<>` inference — `productScope` reuses
that recursive shape and needs the same treatment). Populate it in
`EstimatedRewardService.buildCampaignRewardItem` (next to `conditions`) so the
wallet/members space can show "applies to product X". The estimate has no cart
context, so `matched_items_amount` percentage rewards are surfaced with their
`percentOf` value as-is (the wallet renders "X% of matching items");
`PercentageEstimatedRewardSchema.percentOf` is already `t.String()`, so no schema
change there. Downstream Eden Treaty types in `packages/client` regenerate
automatically.

---

## Files to touch

| File | Change |
|---|---|
| `src/domain/campaign/schemas/index.ts` | Widen `RuleConditionValue` (arrays); add `productScope` to `CampaignRuleDefinitionSchema` + manual `CampaignRuleDefinition` type; add `"matched_items_amount"` to `PercentageRewardDefinitionSchema.percentOf`; add `productScope` to `EstimatedRewardItemSchema`. |
| `src/domain/campaign/types/index.ts` | `CampaignRuleDefinition.productScope?: RuleConditions`; add `matchedAmount?` / `matchedQuantity?` to `PurchaseContext`. |
| `src/domain/campaign/services/RuleConditionEvaluator.ts` | Add `evaluateAgainst(conditions, target)`; keep `evaluate` as wrapper. |
| `src/domain/campaign/services/RuleEngineService.ts` | Product-scope gate in `evaluateSingleCampaign` (skip campaign, no budget, when no item matches); compute `matchedAmount`/`matchedQuantity` from matched items and inject into the purchase context. |
| `src/domain/campaign/services/RewardCalculator.ts` | Honor `percentOf: "matched_items_amount"` in `calculatePercentageReward`; accept `tierField: "purchase.matchedAmount"` in `resolveTierValue`. |
| `src/domain/campaign/services/CampaignManagementService.ts` | Validate `productScope` (field allowlist, operator/value coherence, purchase-trigger only); reject `matched_items_amount` without a `productScope`. |
| `src/domain/campaign/services/EstimatedRewardService.ts` | Populate `productScope` in the estimated item. |
| `src/domain/campaign/index.ts` | Export any new types if referenced across layers. |

**SKU plumbing (needs a `purchase_items.sku` column — schema change in this PR, migration run by the DB team, see §7):**

| File | Change |
|---|---|
| `src/domain/purchases/db/schema.ts` | Add nullable `sku` column to `purchase_items` in the Drizzle schema (DB team runs the migration). |
| `src/domain/purchases/repositories/PurchaseRepository.ts` | `upsertWithItems` persists `sku` via the existing `...item` spread; `findItemsByPurchaseId` projects it via bare `select()`. |
| `src/domain/purchases/dto/CustomWebhook.ts` + `magentoWebhook.ts` / `shopifyWebhook.ts` / `wooCommerceWebhook.ts` mappings | Add `sku?` to Shopify/Woo DTOs and map DTO SKU → `PurchaseItemInsert.sku`; map Magento's `name`(=SKU) → `sku`; extend the Custom webhook contract with `sku?`. |
| `src/orchestration/PurchaseInteractionCreator.ts` | Add `sku?` to the `items` **param type** *and* map it in the inner `payload.items.map(...)` → `PurchasePayload.items[].sku` (both required; missing either truncates SKU on the late-claim path). |
| `src/domain/rewards/types/index.ts` | Add optional `sku` to `PurchasePayload.items`. |
| `src/orchestration/reward/InteractionContextBuilder.ts` | Map `sku` into `purchase.items[].sku`. |

No changes required to `campaignApiSchemas.ts` (it binds `CampaignRuleDefinitionSchema`
by reference) or the reward-application path in `BatchRewardOrchestrator`. The
campaign-side changes need **no migration** (`rule` is `jsonb`); the SKU plumbing
does.

## Tests

- `RuleConditionEvaluator.test.ts` — item-level matching for
  `eq/neq/in/not_in/contains/starts_with`; a **nested `ConditionGroup`**
  `productScope` (e.g. `{ logic: "any", conditions: [...] }`) matching an item;
  **negation** (`not_in`) selecting the complement set (cart of only-excluded
  items → empty matched set).
- `RuleEngineService.test.ts` — (a) `productScope` matches → rewards; (b) no matching
  item → campaign skipped, budget untouched; (c) no purchase context → skipped;
  (d) **additivity**: two product-scoped campaigns each match a different item in the
  same order → both contribute rewards; (e) `matchedAmount`/`matchedQuantity` equal
  the sum over matched items only (not the whole cart); (f) **negation margin case**:
  `not_in [CHEAP]` on a `[CHEAP, NORMAL]` cart triggers and rewards only `NORMAL`,
  while a `[CHEAP]`-only cart does not trigger.
- `RewardCalculator.test.ts` — `percentOf: "matched_items_amount"` pays on the
  matched subtotal, not the order total; min/max caps still apply post-conversion;
  `tierField: "purchase.matchedAmount"` tiers resolve against the matched basis;
  **float rounding**: an all-items-matched cart whose Σ line `totalPrice` ≠
  `purchase.amount` by FP epsilon is reconciled via `roundAmount` (1e-6); a
  **zero** `matchedAmount` returns an error (not `defer`), and a **missing**
  `matchedAmount` is an error, never `deferForUnpriceableReward`.
- `CampaignManagementService.test.ts` — reject unknown `productScope` field (incl.
  `category` until plumbed), reject `in` with scalar value, **reject array value on
  scalar-only operators** covering both failure modes (`eq` never-matches vs
  `gt`/`between` lexicographic coercion), reject empty `in`/`not_in`, reject a
  **nested-group** scope with a bad leaf field (proves the validator recurses),
  reject an over-deep scope (depth cap), reject `productScope` on non-purchase
  trigger, reject `matched_items_amount` without a `productScope`, **accept
  `tierField: purchase.matchedAmount` for percent tiers (relaxed guard)**, and
  confirm `applyStartDate` preserves an existing `productScope`.
- `EstimatedRewardService.test.ts` — `productScope` round-trips into the estimated
  item (`buildCampaignRewardItem`), and a `matched_items_amount` percentage reward
  surfaces its `percentOf` as-is (no cart context at estimate time).
- SKU plumbing — a webhook payload carrying `sku` surfaces it in
  `purchase.items[].sku` **through both the webhook-first and late-claim
  (`findItemsByPurchaseId`) paths**, a `sku`-based `productScope` matches, and
  Magento's `name`(=SKU) surfaces as `sku` without breaking existing `name` usage.

## Rollout / compatibility

- `productScope` + `matched_items_amount` are optional `jsonb` extensions ⇒ **no
  migration**; existing rows read back with `productScope === undefined` and
  behave exactly as today.
- Widening `RuleConditionValue` is backward compatible (superset).
- **SKU touches the relational `purchase_items` table** and needs the `sku`
  column (schema change in this PR, migration run by the DB team — see §7). It is
  in scope for this iteration, not deferred. Because `sku` is nullable at every
  hop, the code is safe to deploy independently of migration timing: pre-migration
  it reads `null` and SKU conditions simply don't match.
- **Performance**: product-scope adds an O(active campaigns × line items ×
  conditions) pass per purchase interaction (vs O(campaigns × conditions) today).
  Fine for typical cart/campaign sizes; revisit only if a merchant has both very
  large carts and many active campaigns.
- **Post-publish immutability**: `productScope` lives inside `rule`, and
  `update()` rejects any `rule` change on non-draft campaigns (`RULE_LOCKED`,
  `CampaignManagementService.ts:157`). So merchants can't retarget products on a
  live campaign — they must clone/recreate, consistent with `conditions`. Only
  `applyStartDate` may touch a published rule; it spreads `...rule` so it
  preserves `productScope` (add a test to lock this in).

## Decisions folded in

- **Reward basis**: both `purchase_amount` (whole order, default/back-compat) and
  `matched_items_amount` (matched subtotal) are supported for percentage/tiered
  rewards.
- **SKU**: plumbed end-to-end as an optional line field, matchable via
  `productScope`; schema change ships in this PR, DB team runs the migration.
- **Negation in v1**: `not_in` / `neq` are supported under the set-selection model
  (§1) — the matched set is the complement, which both gates the trigger and
  scopes `matched_items_amount`. Primary use case: excluding low-margin SKUs from
  earning rewards.
- **`category`**: excluded from the v1 field allowlist (declared but not plumbed).

## Open questions

1. **Quantity awareness** — should a **fixed** reward scale with matched quantity
   (buy 3 → 3×)? Currently no; `matched_items_amount` already makes *percentage*
   rewards quantity-aware via line subtotals. Per-unit fixed multipliers would be
   a separate change.
2. **Multiple matched lines vs per-line caps** — confirm one reward per campaign
   per interaction (summing matched lines) is the desired behavior vs one reward
   per matched line. Plan assumes the former (keeps budget/caps simple).
