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
  `roundAmount` (1e-6). It sums each matched line's `totalPrice` — see
  [Line money](#line-money) for what that means per provider.
- **The matched basis is clamped to `purchase.amount`.** `matchedAmount` is
  summed from line data while `purchase.amount` is the platform's order total,
  so a provider that reports lines on a different basis could otherwise pay a
  percentage of more than the customer paid. `calculatePercentageReward` and
  the `purchase.matchedAmount` tier lookup both clamp.
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
  strings, `between` requires a scalar, non-null `valueTo` ordered above
  `value` (an inverted range can never match, so it is rejected rather than
  published as a campaign that silently never pays);
- a non-empty scope: neither the top-level array nor any nested
  `ConditionGroup` may be empty. An empty node matches every item, which would
  read as scoped while covering everything — and would satisfy the
  matched-basis requirement below. Omit `productScope` to target all products;
- depth ≤ 5 / ≤ 50 nodes across nested `ConditionGroup`s;
- the negation guard above;
- matched-basis rewards (`matched_items_amount`, `purchase.matchedAmount`,
  `purchase.matchedQuantity`) require a `productScope`.

Percentage rewards additionally reject `minAmount > maxAmount`: the clamps
apply as `min(max(amount, minAmount), maxAmount)`, so an inverted pair would
pin every payout to `minAmount` and defeat the cap.

Order-level `conditions` are intentionally **not** validated this way: the
item shape is a small closed set, `RuleContext` is open-ended and pre-dates
this feature. Independently, the shared evaluator fails closed (never
matches) when a scalar/comparison operator receives an array operand —
field-agnostic protection for every caller of the schema.

## SKU plumbing

`purchase_items.sku` and `purchase_items.total_price` (both nullable) are
declared in the Drizzle schema. **This branch ships no migration**: the DB
team owns those, and the rollout is staged in
[`docs/plans/purchase-items-line-key-migration.md`](../../../docs/plans/purchase-items-line-key-migration.md).

The backend **cannot be deployed to a stage whose database has not taken the
change**. Inserts reference `total_price` and bind their conflict target to
the line constraint below, so both must exist first or every purchase webhook
fails on write.

`sku` is optional at every hop; items without it never match SKU conditions —
no error, graceful degradation.

**`sku` is part of item identity.** A line is keyed on
`(purchase_id, external_id, sku)`, because `external_id` is the *parent*
product id on every provider — two variants of one product share it, and
keying on it alone would drop all but one of them. `schema.ts` declares a
single `UNIQUE NULLS NOT DISTINCT(purchase_id, external_id, sku)` constraint
for this; `NULLS NOT DISTINCT` (Postgres 15+) is what stops a redelivery
duplicating a sku-less line, which a plain nullable unique column would allow.
Lines arriving in one delivery that share a key are **merged**, summing
`quantity` and `totalPrice`, since Postgres rejects a statement that touches
the same conflict target twice.

Each delivery reconciles the stored set to the incoming one, inside the
transaction and in this order:

1. **adopt** — a stored sku-less row is filled in when the delivery carries
   exactly one line for that product and it now has a sku, so the row keeps the
   `total_price` and `image_url` already on it. Skipped when the target key
   already exists, which would violate the constraint;
2. **reconcile** — stored lines the delivery no longer carries are deleted,
   comparing skus with `is not distinct from` (a plain `=` is `NULL` against a
   stored `NULL`, and `DELETE` only removes rows on `TRUE`). This is what keeps
   a changed sku from stranding the old row;
3. **upsert** — fill-only, so a redelivery fills gaps and never overwrites a
   stored value with `NULL`.

A delivery carrying no items at all leaves the stored lines untouched: `items`
is optional on the custom and Magento webhooks, so an empty one is absence of
information, not an empty cart. Otherwise the stored set equals the incoming
set, which is what makes the webhook-first and late-claim paths agree.

Flow: webhook DTO → `PurchaseItemInsert` → `purchase_items` row →
`PurchaseInteractionCreator` → `PurchasePayload.items[].sku` →
`InteractionContextBuilder` → `purchase.items[].sku`. Both the webhook-first
and the late-claim path (`findItemsByPurchaseId`) carry it.

Per provider:

| Provider | SKU source |
|---|---|
| Shopify | `line_items[].sku` (native) |
| WooCommerce | `line_items[].sku`, forwarded by the plugin's payload filter |
| PrestaShop | `order_detail.product_reference`, sent as `sku` when non-empty |
| Magento | `getSku()`, sent unconditionally — an item with no SKU therefore arrives as `""`, which satisfies `exists`, `neq` and `not_in` instead of being skipped. Out of scope pending a dedicated review |
| Custom | optional `sku` added to the public webhook contract |

## Line money

`purchase_items.total_price` (nullable) is the amount actually paid for a
line: **post-discount, tax-inclusive, shipping excluded**. It is what
`matchedAmount` sums, so it is the basis of every `matched_items_amount`
reward. When absent it falls back to `price * quantity`.

| Provider | `total_price` source |
|---|---|
| WooCommerce | `line_items[].total` + `total_tax` (plugin forwards both) |
| Shopify | `price × quantity` − `discount_allocations`, plus `tax_lines` only when the order is not `taxes_included` |
| PrestaShop | `order_detail.total_price_tax_incl` (plugin sends it as `totalPrice`) |
| Custom | optional `totalPrice` per item |
| Magento | not sent — falls back to `price * quantity`, which is pre-discount and tax-exclusive. Magento is out of scope pending a dedicated review |

**`unitPrice` is not comparable across providers.** It carries whatever the
provider's per-unit `price` means: tax-**exclusive** on WooCommerce
(`get_total()/quantity`, post-discount) and tax-**inclusive** on PrestaShop
(`unit_price_tax_incl`). A `unitPrice` threshold therefore selects different
items on different platforms for the same catalogue. Scope on `sku` or
`productId` when a scope has to behave identically everywhere.

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
  sharing-page product cards and reward selection. The WooCommerce and
  PrestaShop plugins populate the scope fields (`sku`, `productId`, `quantity`,
  `unitPrice`) on it; Magento emits no `products` attribute at all, so on that
  platform display-side selection runs with no product context and every scoped
  campaign ranks as matching.

## Observability

A scope that matches no line item is reported distinctly from a campaign that
never fired: `applyProductScope` returns a `scope_matched_no_item` reason,
`evaluateCampaigns` collects those campaign ids into
`EvaluationResult.scopeMatchedNoItemCampaigns`, and the evaluator logs at
debug. This separates "the scope matched nothing" from "no eligible purchase" —
the two look identical from the outside, and the usual causes are a plugin that
sends no `sku` or a casing mismatch against the merchant's catalogue.

## Open questions

1. **Per-unit fixed multipliers** (buy 3 → 3× fixed reward): not supported;
   `matchedQuantity` tiers cover stepped cases.
2. **Campaign exclusivity** ("best promo only" instead of additive): not
   expressible today; `priority` orders evaluation but doesn't short-circuit.
3. **Business app**: the campaign creation UI for `productScope` ships as the
   wizard's products step. A product/SKU autocomplete source (e.g. distinct
   SKUs from purchase history) and a "product-scoped" indicator on the campaign
   list are not built yet.
4. **SKU matching is exact and case-sensitive.** No normalisation is applied on
   either the ingest or the authoring side, so `shoe-42` never matches a
   `SHOE-42` catalogue. Deliberately left until real merchant usage shows
   whether SKUs are case-significant in the systems feeding them.
