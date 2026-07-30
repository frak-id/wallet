# Product-scoped campaigns

Campaigns can be scoped to specific products: they only trigger when the
purchase contains a matching line item, and percentage/tiered rewards can pay
on the matched items instead of the whole order.

## Model

An optional `productScope` on `CampaignRuleDefinition` reuses the existing
`RuleCondition` / `ConditionGroup` shape, evaluated **per purchase line item**
with the item as the root object (`field: "productId"`, not
`field: "purchase.items.productId"`).

Semantics (set-selection):

- **Absent** → campaign behaves exactly as before.
- **Present** → the scope selects the **matched set**: every
  `purchase.items[]` entry satisfying the conditions.
  - **Trigger**: the campaign matches iff the matched set is non-empty.
  - **Basis**: `matchedAmount` (Σ `totalPrice`) and `matchedQuantity`
    (Σ `quantity`) are computed over the matched set and injected into the
    purchase context for matched-basis rewards.
- Order-level `conditions` and `productScope` both must pass (AND). They
  answer different questions: `conditions` gates the order/user/moment,
  `productScope` gates cart contents and defines the reward basis.
- Campaigns stay **additive**: each active campaign is evaluated
  independently; two product-scoped campaigns matching different items in the
  same order both pay.
- `productScope` is only valid on the `purchase` trigger.

Matchable fields (exact-match allowlist): `productId`, `name`, `sku`,
`quantity`, `unitPrice`, `totalPrice`. `category` is declared on
`PurchaseItem` but not plumbed, so it is excluded until it is.

| Intent | Condition |
|---|---|
| Single product | `{ field: "productId", operator: "eq", value: "prod-123" }` |
| One of many (variants) | `{ field: "sku", operator: "in", value: ["A-S", "A-M"] }` |
| Name/slug prefix | `{ field: "name", operator: "starts_with", value: "eco-" }` |
| Exclude low-margin SKUs | `{ field: "sku", operator: "not_in", value: ["CHEAP"] }` — matched-basis rewards only, see below |

## Reward basis

- `percentOf: "matched_items_amount"` (percentage) and
  `tierField: "purchase.matchedAmount"` / `"purchase.matchedQuantity"`
  (tiered) compute over the matched set. All three require a `productScope`
  on the rule (publish-time validation).
- `matchedAmount` is fiat in the order currency, like `purchase.amount`; the
  existing FX/token-pricing path applies. Values are normalized with
  `roundAmount` (1e-6).
- **Zero/missing basis never defers.** A zero fiat base (e.g. an
  all-excluded matched set) or a missing `matchedAmount` (wiring bug) is a
  hard error, short-circuited **before** any pricing call — otherwise an
  unpriceable currency/token would turn a legitimate zero into
  `deferForUnpriceableReward` and the interaction would retry forever.
- Fixed rewards have no basis: a scoped campaign with a fixed reward pays its
  full amount whenever the scope gate passes ("25€ if the cart contains
  product A"). Quantity does not scale the payout; use
  `tierField: "purchase.matchedQuantity"` for quantity-aware rewards.
- One evaluation per campaign per interaction (matched lines are summed, not
  rewarded per-line). Budget, caps, and immutability semantics are unchanged;
  `productScope` lives inside `rule` and is locked after publish like the
  rest of the ruleset (`applyStartDate` preserves it).

## Negation

Negation (`neq`, `not_in`, `not_exists`, `logic: "none"`) keeps the
set-selection meaning: the matched set is the **complement**, which gates the
trigger and defines the matched basis. Motivating case, margin protection with
`{ sku not_in ["CHEAP"] }` + `percentOf: "matched_items_amount"`:

- Cart `[CHEAP]` only → matched set empty → no trigger, no reward on the
  loss-leader.
- Cart `[CHEAP, NORMAL]` → matched set `[NORMAL]` → triggers, pays on
  `NORMAL` only; the cheap SKU is excluded from the basis.

**Negative predicates require a matched-items basis on every reward
(publish-time guard).** The complement of an exclusion list is non-empty for
almost any realistic cart, so the trigger gate is near-vacuous — a flat fixed
reward (or a tiered reward on a non-matched `tierField`) would pay in full on
essentially every cart, including ones dominated by the excluded SKU
(`[CHEAP 100€, NORMAL 1€]`). That is a footgun, not an intent, so validation
rejects it. To gate a flat reward on product presence, express the scope
positively (`eq`, `in`, `contains`).

Detection is conservative: any `logic: "none"` group counts as negative, even
a net-positive double negation (rewrite it positively). A whole-cart veto
("don't trigger at all if the cart contains X") was considered and rejected —
it creates a referral cliff (a 1€ excluded accessory would zero a 50€ referral
reward) and has no coherent meaning over nested `any`/`none` groups. If ever
needed, it ships as an explicit separate field, not by overloading negation.

## Validation (publish/create)

`validateRuleDefinition` enforces, for `productScope`:

- purchase trigger only; exact-match field allowlist (a typo'd or nested
  field would silently never match);
- operator/value coherence: `in`/`not_in` require a non-empty array,
  scalar/comparison operators reject arrays, string operators require
  strings, `between` requires a scalar `valueTo`;
- depth ≤ 5 / ≤ 50 nodes across nested `ConditionGroup`s;
- the negation guard above;
- matched-basis rewards (`matched_items_amount`, `purchase.matchedAmount`,
  `purchase.matchedQuantity`) require a `productScope`.

Order-level `conditions` are intentionally **not** validated this way: the
item shape is a small closed set, `RuleContext` is open-ended and pre-dates
this feature. Independently, the shared evaluator fails closed (never
matches) when a scalar/comparison operator receives an array operand —
field-agnostic protection for every caller of the schema.

## SKU plumbing

`purchase_items.sku` (nullable) is declared in the Drizzle schema; the DB
team owns the migration, which must land **before** this deploys (inserts
reference the column). `sku` is optional at every hop; items without it never
match SKU conditions — no error, graceful degradation.

Flow: webhook DTO → `PurchaseItemInsert` → `purchase_items` row →
`PurchaseInteractionCreator` → `PurchasePayload.items[].sku` →
`InteractionContextBuilder` → `purchase.items[].sku`. Both the webhook-first
and the late-claim path (`findItemsByPurchaseId`) carry it.

Per provider:

| Provider | SKU source |
|---|---|
| Shopify | `line_items[].sku` (native) |
| WooCommerce | `line_items[].sku` — plugin now forwards it (was stripped) |
| PrestaShop | `order_detail.product_reference`, sent as `sku` when non-empty |
| Magento | plugin now sends explicit `sku` (from `getSku()`); `name` carries the product name. Older plugin versions sent the SKU as `name` with no `sku` field — those simply don't match SKU conditions until upgraded (Magento is not in production use). |
| Custom | optional `sku` added to the public webhook contract |

## SDK / wallet surfaces

- `EstimatedRewardItemSchema` carries `productScope`; the SDK's published
  `MerchantReward` mirrors it, kept in lockstep by a **compile-time parity
  assertion** (`schemas/merchantRewardParity.ts`) that fails the build on
  either side drifting.
- Display distinguishes two independent flags:
  - **gate** (`campaign.productScope != null`) → "On selected products only"
    notes, `_product` copy variants;
  - **basis** (`isMatchedItemsBasis(reward)`: `percentOf ===
    "matched_items_amount"` or matched `tierField`) → "% of eligible
    products" instead of "% of basket", and the basket-based worked example
    is suppressed. A gated campaign can still pay `percentOf:
    "purchase_amount"` — its copy stays "% of basket".
- `matchesProductScope(scope, product)` in `sdk/core/src/rewards` is an
  **advisory, fail-open** client-side matcher (display hints only; the
  backend evaluator is the authority at reward time). It evaluates one
  `ProductDetails` — the SDK type mirroring the `PRODUCT_SCOPE_FIELDS`
  allowlist above.
- `selectDisplayCampaign` / `selectBestReward` take `products:
  ProductDetails[]` and apply **any-match**: a scoped campaign matching none
  of them is deprioritized below every campaign matching at least one, which
  mirrors the evaluator (a purchase earns when any line item matches).
  Omitting `products` reproduces unscoped ranking. The winner's matching
  subset comes back as `matchedProducts`, so a surface can name the product
  behind the reward.
- `<frak-banner>` / `<frak-button-share>` / `<frak-post-purchase>` accept a
  single `products` attribute (JSON-stringified for server-rendered
  surfaces, whose HTML attributes always arrive as strings). Since
  `SharingPageProduct extends ProductDetails`, the same array drives both the
  sharing-page product cards and reward selection.

## Open questions

1. **Per-unit fixed multipliers** (buy 3 → 3× fixed reward): not supported;
   `matchedQuantity` tiers cover stepped cases.
2. **Campaign exclusivity** ("best promo only" instead of additive): not
   expressible today; `priority` orders evaluation but doesn't short-circuit.
3. **Business app**: campaign creation UI for `productScope`, a product/SKU
   autocomplete source (e.g. distinct SKUs from purchase history), and a
   "product-scoped" indicator on the campaign list are not built yet.
