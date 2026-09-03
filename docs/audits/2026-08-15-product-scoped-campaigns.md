# Product-scoped campaigns - Audit

**Date:** 2026-08-15 · **Branch:** `dev` · **HEAD:** `a9e4dc543` · **Range audited:** `8c75c119c^..a9e4dc543` (feature work concentrated in `b3e8c68e5`, `2097e36b4`, `3ca997d46`, `6dbb5d542`, `d35e17be3`, `d445db03a`, `413c3cffb`, `c21582feb`, `15480d761`, `c47780084`, `908f68f0c`, `c889c477b`)

## Status — resolved 2026-09-04

**Every P0 and P1 finding is closed except PSC-7, which the owner deliberately deferred.** The work landed on `chore/audit-findings`: 24 P0/P1 items fixed, one new finding (PSC-29) found and fixed during the work, three of this document's own claims corrected as wrong (see [Corrections to this audit](#corrections-to-this-audit)). P2 items are untouched and remain open. Per-finding state is the Status column below; the reasoning is in [Resolution 2026-09-04](#resolution-2026-09-04).

## Verdict

**No merchant currently uses this feature.** That single fact sets every priority below: nothing here is paying out, over-promising or losing money in production today, so no finding is a P0 emergency on production-impact grounds. What *is* urgent is the one defect that blocks the feature from being configurable at all.

The reward engine is well built. The failure is at the two ends. The business wizard **never sends the authored `productScope` to the server** at the products step (PSC-1, reproduced empirically) — a merchant authors a scope, the UI confirms a clean save, and the server never sees it. That concerns campaign *creation*, so it is fixed directly and immediately regardless of adoption: it is the gate in front of every other finding, because until it closes nobody can author a correct scoped campaign to exercise the rest.

Behind it sit two money-correctness defects on the backend: `matched_items_amount` pays on **pre-discount** line totals with no clamp against what the customer actually paid (PSC-2), and variant line items sharing a `product_id` are **silently dropped** by a unique index, so the matched basis is computed on a truncated cart and the same order pays differently depending on which claim path raced first (PSC-3). Neither is losing money today because nothing is live. **Both MUST be closed before the first merchant enables the feature** — they are P1-next, not P2, and they are the hard gate on go-live.

On the integration surfaces that a merchant actually consumes — the JS/TS SDK, the native Android and iOS SDKs, and the Shopify/WooCommerce/PrestaShop plugins — two real correctness defects remain: no shipped plugin sends `sku` in the display `products` payload (PSC-6), making live product context inert, and the `<frak-post-purchase>` share CTA crashes the listener tree on a malformed base URL (PSC-5). These keep real priority.

Everything else that is display-shaped — the wallet, the listener and the business app's *rendering* surfaces — is an **enhancement, not a defect**. The product team has not yet built the product-metadata and multi-campaign-display experience. The current single line reading "on selected products!" is the **deliberate current state**, not an oversight. Findings like PSC-4 are recorded as known product gaps with their technical description intact so they are actionable when the work is picked up, not as bugs to fix now.

The core evaluator, the negation guard and the fail-open display contract are genuinely good work.

## Owner decisions applied

*Recorded 2026-08-15. These are product-owner judgement calls that shaped the Priority column below. They are written down so a future reader can tell a deliberate decision from an oversight.*

1. **No merchant uses this feature today.** Priorities are set for a pre-adoption feature. Nothing is in production paying out, so severity and urgency deliberately diverge throughout this document.
2. **PSC-1 stays Critical and is P0-now.** It concerns campaign creation, so it is tackled directly and is not deferred behind adoption.
3. **Backend money-correctness (PSC-2, PSC-3) keeps its severity but is P1-next.** Explicitly: these **must** be closed before the first merchant enables the feature.
4. **SDK surfaces (JS/TS, Android, iOS) and plugin surfaces (Shopify, WordPress, PrestaShop) keep real priority** — P1-next for correctness defects there, notably the missing `sku` in the display payload.
5. **Non-SDK, non-plugin display surfaces (wallet, listener, business app display) are P2-when-picked-up enhancements.** The full product-metadata / multi-campaign-display experience is unbuilt by product choice; the single "on selected products!" line is the intended current state. Display-shortfall findings are reframed as tracked product gaps, with the technical detail preserved.
6. **Magento is folded into one item (PSC-18).** The plugin is used by nobody, kept only in case, was developed blind and has never been tested. It needs a full dedicated review before any merchant uses it, not piecemeal fixes now.

Severity is technical and unchanged. Priority is the schedule. A finding can be High and P2 at the same time — that is the point of the two columns.

## Findings at a glance

| ID | Severity | Priority | Area | One-line finding | Status (2026-09-04) |
|---|---|---|---|---|---|
| PSC-1 | Critical | P0-now | Business wizard | Authored `productScope` is stripped from the PUT body at the products step and never reaches the server | **Fixed.** `rule` is sent on every draft save; backend accepts an empty `rewards` on a draft PUT, still rejects it on publish |
| PSC-2 | High | P1-next | Payout basis | `matched_items_amount` pays on undiscounted line totals, unclamped against `purchase.amount` | **Fixed** — *diagnosis partly wrong, see corrections.* Per-line `total_price` (post-discount, tax-inclusive) carried end to end, plus a `Math.min(matchedAmount, purchase.amount)` backstop |
| PSC-3 | High | P1-next | Persistence | Variant line items sharing a `product_id` are discarded by `onConflictDoNothing`; the two claim paths then disagree | **Fixed.** Item identity now includes `sku` (`UNIQUE NULLS NOT DISTINCT`); duplicates merge rather than drop; both claim paths consume the same merged set. Migration is a DB-team request, not shipped here |
| PSC-4 | High | P2-when-picked-up | Listener / display | *Known product gap.* With no product context every scoped campaign "matches", so the headline advertises a reward the cart cannot earn | **Open.** P2, unchanged. Blast radius reduced: shipped plugins now send `sku` (PSC-6) |
| PSC-5 | High | P1-next | SDK components | `<frak-post-purchase>` share CTA throws `TypeError: Invalid URL` and unmounts the listener tree | **Fixed.** All three `new URL` sites in `FrakContextManager` guarded; `merchantDomain` normalised to a scheme-qualified URL. *Trigger misattributed, see corrections* |
| PSC-6 | High | P1-next | Plugins | WooCommerce/PrestaShop send no `sku` in the display `products` array, making live product context inert | **Fixed.** Both plugins emit `sku`/`productId`/`quantity`/`unitPrice`, omitted when empty. Magento still absent (PSC-18) |
| PSC-7 | Medium | P1-next | Ingest | SKU matching is byte-exact and case-sensitive with no normalisation, validation or merchant feedback | **Deferred by owner.** No merchant has used the feature yet; normalisation waits for real usage and feedback, since some legacy systems may treat SKU case as significant |
| PSC-8 | Medium | P1-next | Ingest | Webhook bodies are cast, not validated; a numeric `sku` matches differently on the two claim paths | **Fixed.** One coercion site (`dto/lineItem.ts`) for all four webhooks; `sku` and `quantity` agree on both paths; empty/whitespace sku normalises to `null`, never `""` |
| PSC-9 | Medium | P1-next | Reward calc | `minAmount` is applied after `maxAmount`, silently defeating the cap; ordering never validated | **Fixed.** Clamp is min-then-max; `minAmount > maxAmount` and `maxAmount <= 0` rejected at publish; `EstimatedRewardService` honours a `0` cap |
| PSC-10 | Medium | P2-when-picked-up | Business wizard | Tiered rewards on a matched-items basis still label their ranges "Basket Range" | **Open.** P2, unchanged |
| PSC-11 | Medium | P2-when-picked-up | Business wizard | `AdvancedScopeNotice` drops group `logic` and operand values, inverting the meaning of a `none` scope | **Open.** P2, unchanged |
| PSC-12 | Medium | P1-next | Validation | Empty `productScope: []` publishes, matches everything, and satisfies the matched-basis requirement | **Fixed.** Empty root and empty groups rejected recursively at any depth |
| PSC-13 | Medium | P1-next | Validation | `between` with `valueTo: null` passes publish and means two different things per side | **Fixed.** Null bound rejected at publish; the backend's `localeCompare("null")` degradation killed at source |
| PSC-14 | Medium | P1-next | Validation | Inverted `between` range (100..10) is accepted end to end and can never match | **Fixed** — *prescription wrong, see corrections.* Rule is `valueTo >= value`, enforced in the wizard and at publish |
| PSC-15 | Medium | P1-next | Observability | A scope that matches nothing is indistinguishable from a campaign that never fired | **Fixed.** Distinct reason on `EvaluationResult` plus a `log.debug`. The collector field has no production reader yet |
| PSC-16 | Medium | P1-next | Parity | Two hand-copied evaluators, no shared corpus; `exists`/`not_exists` already diverge on `null` | **Fixed.** Both sides on `!= null`; shared 23-entry corpus asserted from both suites, with deliberate fail-open/fail-closed divergences pinned as data |
| PSC-17 | Medium | P1-next | Tests | The one SDK↔backend operator parity test asserts only `not.toThrow()` and cannot fail | **Fixed.** Replaced by an outcome table where the fail-open default is the wrong answer; operator list derived, so a new operator fails the completeness test |
| PSC-18 | Medium | P2-when-picked-up | Magento (folded) | **Folded item.** Magento is unused, untested and developed blind — needs a full dedicated review before any merchant uses it | **Open.** P2, untouched by design. Magento remains the one provider off the PSC-2 line-total convention |
| PSC-19 | Medium | P2-when-picked-up | Tests | Backend `formatted=1` tests re-implement the handler instead of invoking it | **Open.** P2 / Low |
| PSC-20 | Medium | P1-next | Persistence | A missing SKU is never backfilled on webhook redelivery | **Fixed.** Fill-only upsert plus a guarded adopt of stored sku-less rows; reconciliation removes stale lines a redelivery no longer carries |
| PSC-21 | Medium | P2-when-picked-up | Schema | `campaign_rules.rule` is bare `jsonb`; every scope invariant lives only in the service layer | **Open.** P2 / Low |
| PSC-22 | Low | P2-when-picked-up | Migrations | `drizzle/v2` baseline lacks `purchase_items.sku` (latent, nothing routes to `_v2`) | **Open.** P2. Deliberately untouched — `services/bootstrap/drizzle` is DB-team territory |
| PSC-23 | Low | P2-when-picked-up | Tests | `CampaignInfoSection` duplicates `RewardBreakdown` basis logic with no test at all | **Open.** P2 |
| PSC-24 | Low | P2-when-picked-up | SDK | `matchedProducts: undefined` conflates "no context" with "scope matched none" | **Open.** P2 |
| PSC-25 | Low | P2-when-picked-up | Fixtures | Golden corpus is a change-detector; `GoldenFixtures.REWARDS`/`.rewards` referenced by nobody | **Open.** P2. The new scope-match corpus is hand-written and load-bearing on both sides, so it does not repeat this failure |
| PSC-26 | Low | P2-when-picked-up | Display | *Known product gap.* Tier ranges for `purchase.matchedQuantity` render as currency | **Open.** P2 |
| PSC-27 | Low | P1-next | Components | `sanitizeSharingProducts` silently discards scope context for entries without a `title` | **Fixed.** Title-less entries survive for scope, only titled ones render, and selection defaults to the first renderable entry |
| PSC-28 | Low | P2-when-picked-up | Docs | Plan docs describe a business app and XSS sinks that no longer exist | **Open.** P2. `services/backend/docs/product-scoped-campaigns.md` was brought in step as part of this work; the plan docs were not |
| PSC-29 | High | P0-now | Reward calc | **New, found during the work.** An absent field satisfied `gt`/`gte` against any threshold — fail-open in a fail-closed evaluator, on live order-level `conditions` | **Fixed.** `compareValues` treats a null/absent operand as non-evaluable at source |

**Priority legend** — `P0-now` fix immediately · `P1-next` fix in the next pass · `P2-when-picked-up` real but not scheduled, revisit when the feature is picked up · `Accepted-risk` consciously accepted, not to be fixed. No finding in this report is `Accepted-risk`.

## Critical and high findings

### PSC-1 (Critical · P0-now) - Product scope authored in the wizard is never sent to the server

> **Priority: P0-now.** This is the one finding in this report that is not deferred behind adoption. It concerns campaign *creation*: until it closes, no merchant can author a scoped campaign that actually reaches the server, which also means none of the downstream findings can be exercised or verified end to end. Fix directly.

**Where** `apps/business/src/module/campaigns/hook/useSaveCampaign.ts` (`includeRule`); `apps/business/src/module/campaigns/component/Creation/wizardSteps.ts` (`WIZARD_STEPS`); `apps/business/src/stores/campaignStore.ts` (`initialDraft`, `buildApiPayload`). Introduced with the wizard in `15480d761` / `c47780084`.

**What** `productScope` lives inside `draft.rule`. The products step is index 4; the reward step, the only thing that populates `rule.rewards`, is index 5. `useSaveCampaign` strips `rule` from the PUT body whenever `rewards.length === 0`:

```ts
const { rule, ...rest } = payload;
const includeRule = rule.rewards.length > 0;
const updated = await updateCampaign({
    campaignId: draft.id,
    ...rest,
    ...(includeRule ? { rule } : {}),
});
campaignStore.getState().setDraft(draft);
```

The local `setDraft` still commits, so the UI shows a clean save. **Reproduced**: driving the real `productsFormToDraft` → `buildApiPayload` with a `sku in ["SHOE-42"]` scope on a draft with an `id` yields

```
{ rewardsLength: 0,
  productScope: [ { field: "sku", operator: "in", value: ["SHOE-42"] } ],
  includeRule: false,
  scopeReachesServer: false }
```

The scope is built correctly and then discarded at the network boundary.

**Why it matters** The persisted draft and the server diverge with no signal. Save on the products step, resume in another browser or after a `localStorage` clear, and `useCampaignDraftSync` rehydrates a campaign with no `productScope` — the wizard shows "All products". If the merchant publishes from there, the campaign pays on **every** purchase, the exact inverse of what was authored. The same hole swallows `BudgetCampaign`'s start date, the referral-only toggle and the min-purchase condition — anything riding in `rule` before the reward step.

**Fix** Send `rule` whenever `draft.id` exists and the campaign is a draft, and let the backend tolerate an empty `rewards` array on a draft PUT (it already does on POST). Add a `useSaveCampaign` test asserting the products-step payload carries `rule.productScope`. **Effort: S** (one condition + a backend validation relax + one test).

### PSC-2 (High · P1-next) - `matched_items_amount` pays on undiscounted line totals

> **Priority: P1-next — go-live gate.** Nothing is in production paying out, so this is not losing money today. It **must** be closed before the first merchant enables the feature.

**Where** `services/backend/src/orchestration/PurchaseInteractionCreator.ts` (`create`); `services/backend/src/domain/campaign/services/RuleEngineService.ts` (`applyProductScope`); `services/backend/src/domain/campaign/services/RewardCalculator.ts` (`calculatePercentageReward`). From `b3e8c68e5`.

**What** `purchase.amount` is the platform order total (`total_price` / `total`), post-discount and inclusive of tax and shipping. `matchedAmount` is recomputed independently from line data:

```ts
// PurchaseInteractionCreator.create
amount: Number(params.totalPrice),
items: params.items.map((item) => ({
    unitPrice: Number(item.price),
    totalPrice: Number(item.price) * item.quantity,
```
```ts
// RuleEngineService.applyProductScope
matchedAmount: roundAmount(
    matchedItems.reduce((sum, item) => sum + item.totalPrice, 0)
),
```
```ts
// RewardCalculator.calculatePercentageReward
fiatBase = context.purchase.matchedAmount;   // no clamp against purchase.amount
```

On Shopify `line_items[].price` is documented as the price **before** discounts. Nothing reconciles the two bases.

**Why it matters** Systematic overpay on every discounted order for every matched-items campaign. A 100 € item with a 30 % coupon: the customer pays 70 €, a "10 % of eligible products" campaign pays 10 € instead of 7 € — 43 % over budget. In a heavily discounted order `matchedAmount` can exceed `purchase.amount` outright. Silent: no error, no log, the number looks plausible. Compounding it, the base is tax-inclusive on PrestaShop (`unit_price_tax_incl`) and tax-exclusive on Magento (`$item->getPrice()`), so the same campaign pays materially differently per platform.

**Fix** Carry the platform's per-line discounted total through `PurchaseItem` (Shopify `discount_allocations`, Woo `line_items.total`) and sum that. Stopgap: `fiatBase = Math.min(matchedAmount, purchase.amount)`. Add a `RewardCalculator` test with `matchedAmount > amount`, and settle one tax convention. **Effort: M**.

### PSC-3 (High · P1-next) - Duplicate `product_id` line items are silently dropped

> **Priority: P1-next — go-live gate.** Same reasoning as PSC-2: no production impact yet, **must** be closed before the first merchant enables the feature. Note this one needs a migration, so it has the longest lead time of the go-live gates — start it first.

**Where** `services/backend/src/domain/purchases/db/schema.ts` (`purchase_items_external_id_idx`); `services/backend/src/domain/purchases/repositories/PurchaseRepository.ts` (`upsertWithItems`); `externalId` mapping in `wooCommerceWebhook.ts:58` and `shopifyWebhook.ts:119`.

**What** The unique index is on `(external_id, purchase_id)`, and `externalId` is the **parent** `product_id` on every provider:

```ts
uniqueIndex("purchase_items_external_id_idx").on(
    table.externalId,
    table.purchaseId
),
```
```ts
externalId: item.product_id.toString(),   // woo + shopify
```
```ts
await trx.insert(purchaseItemsTable).values(...).onConflictDoNothing();
```

The canonical documented example for this feature is variant scoping (`sku in ["A-S","A-M"]`). A cart with A-S and A-M is two line items sharing one `product_id`; the second hits the index and is discarded. Only one SKU ever reaches `purchase_items`.

**Why it matters** `matchedAmount` and `matchedQuantity` are computed over a truncated item set, so `matched_items_amount` and `tierField: purchase.matchedQuantity` under-pay. In the negated case the publish guard *forces* (`not_in` + matched basis), dropping the excluded duplicate flips the basis the other way. Worse, the paths disagree: the webhook-first path passes the full in-memory `purchaseItems` to `PurchaseInteractionCreator.create` (`PurchaseWebhookOrchestrator.ts:140,191`), while the late-claim path re-reads the truncated rows via `findItemsByPurchaseId` (`PurchaseLinkingOrchestrator.ts:234`). **The same order pays a different amount depending on which raced first.**

**Fix** Key item uniqueness on something line-scoped — Woo and Shopify both send a line id, PrestaShop has `id_order_detail` — or make the conflict target `(purchase_id, external_id, sku)`. Needs a migration and a backfill decision. Until then, log when `items.length` exceeds inserted rows. **Effort: M**.

### PSC-4 (High · P2-when-picked-up) - No product context makes every scoped campaign win the headline

> **Priority: P2-when-picked-up — known product gap, tracked, not a defect to fix now.** This is a display-surface shortfall on the listener and wallet. The product team has not yet built the product-metadata and multi-campaign-display experience; the single "on selected products!" line (`sdk.sharingPage.card.tagline2_product`) is the **deliberate** current state. The technical description below is kept intact and unedited so it is directly actionable when that work is picked up. Severity stays High because the technical over-promise is real — it is the *schedule*, not the analysis, that changes.

**Where** `sdk/core/src/rewards/select.ts` (`matchesProduct`); consumed without `products` by `apps/listener/app/ui/ListenerUiProvider.tsx:152` and by `apps/wallet/.../InstallView.tsx`.

**What**

```ts
function matchesProduct(campaign, products) {
    if (!products || products.length === 0) return true;
    if (!campaign.productScope) return true;
    return products.some((p) => matchesProductScope(campaign.productScope, p));
}
```

With no products supplied every campaign matches, so ranking is pure `getRewardRank`. A merchant with campaign A = 50 € scoped to `sku in ["SHOE-42"]` and campaign B = 5 € unscoped has every listener modal and install page interpolate **50 €**. The sharing page, which does pass products (`useSharingPageController.ts`), correctly says 5 € on a shirt page. Two Frak surfaces on the same page disagree and the backend pays the smaller one.

**Why it matters** User-visible over-promise on the primary CTA, with an unbounded ratio. `BestReward.isProductScoped` is computed (`select.ts:224`) and is read by `RewardCard.tsx` and `Steps.tsx` on the sharing page — but **not** by `ListenerUiProvider`, which is exactly where the unqualified number is interpolated.

**Fix** In `selectDisplayCampaign`, when `options.products === undefined`, prefer unscoped campaigns at equal-or-lower value, or expose a `productContextUnknown` flag. Interim: have `ListenerUiProvider` append the scope qualifier rather than interpolating a bare figure. **Effort: S-M**.

### PSC-5 (High · P1-next) - `<frak-post-purchase>` share CTA crashes the listener

> **Priority: P1-next.** `<frak-post-purchase>` ships in `sdk/components`, an SDK surface a merchant integrates directly, so this keeps real priority. The crash is triggered by a shipped plugin default (`plugins/wordpress/.../class-frak-shortcodes.php:71`), not a hand-rolled misconfiguration.

**Where** `sdk/components/src/components/PostPurchase/PostPurchase.tsx:245,350`; `apps/listener/app/module/hooks/useOnGetMerchantInformation.ts:35`; `sdk/core/src/context/frakContext.ts:177`.

**What** `merchantDomain` is derived as a **bare host**, with no scheme:

```ts
const domain = new URL(context.sourceUrl).host.replace("www.", "");
```

and is used directly as the share base URL:

```ts
const resolvedSharingUrl = sharingUrl ?? context?.merchantDomain;
// ... link: resolvedSharingUrl
```

which reaches `FrakContextManager.update`'s unguarded constructor:

```ts
const urlObj = new URL(url);
```

`new URL("shop.example.com")` throws `TypeError: Invalid URL` (verified). It throws inside a render-phase `useMemo`, and there is **no ErrorBoundary anywhere in `apps/listener`** (grep for `ErrorBoundary|componentDidCatch` returns nothing), so the whole listener tree unmounts, not just the overlay.

**Why it matters** Reachable in shipped configuration: `plugins/wordpress/includes/class-frak-shortcodes.php:71` defaults `sharing_url => ''`, and the off-order widgets render with no product `link` either. The primary post-purchase share CTA blanks the Frak iframe on click, silently for the merchant. `buildSharingLink.test.ts` only ever passes `https://example.com/product`, so no test covers it.

**Fix** Wrap `FrakContextManager.update`'s `new URL` in try/catch returning `null` — its doc comment already promises "returns null on failure", which is currently false — and normalise to `https://${merchantDomain}` in `PostPurchase`. Add a malformed-`baseUrl` case to `buildSharingLink.test.ts`. **Effort: S**.

### PSC-6 (High · P1-next) - Plugins send no `sku`, so live product context is inert

> **Priority: P1-next.** Plugin surface, two lines per plugin. This is the missing link that makes the feature work end to end for a real merchant, so it keeps real priority. Scope the fix to **WooCommerce and PrestaShop only** — the Magento half is folded into PSC-18.

**Where** `plugins/wordpress/includes/class-frak-woocommerce.php` (`extract_order_products`); `plugins/prestashop/classes/FrakOrderResolver.php` (`extractProducts`); consumed by `PostPurchase.tsx` → `sanitizeSharingProducts` → `selectDisplayCampaign(products)`.

**What** Both plugins emit only `title`, `imageUrl`, `link` in the display `products` array, despite having the SKU at hand (`$item->get_product()->get_sku()`, `$row['product_reference']`). Magento emits no `products` attribute at all. `matchesProductScope` fails open on an absent field, so every scoped campaign "matches" every product and the ranking in `matchesProduct` degenerates to PSC-4.

**Why it matters** `services/backend/docs/product-scoped-campaigns.md` claims "the same array drives both the sharing-page product cards and reward selection". That is true only for hand-rolled integrators. For every shipped plugin, the live-product-context work in `413c3cffb`/`c21582feb` has **no effect**: the post-purchase card and sharing page will advertise a 50 € campaign scoped to a product that is not in the order. This is the missing link that makes the whole feature work end to end.

**Fix** Add `sku` (ideally also `productId`, `unitPrice`, `quantity`) to both plugins' product extraction. Two lines per plugin. **Effort: S**.

## Medium findings

**PSC-7 (P1-next) - Exact, case-sensitive SKU matching with no feedback.** `RuleConditionEvaluator.evaluateOperator` uses `===` and `Array.includes`; no `toLowerCase`/`trim` exists on the ingest side (`customWebhook.ts`, `wooCommerceWebhook.ts`, `magentoWebhook.ts`, `shopifyWebhook.ts` all pass `item.sku` verbatim). A merchant typing `shoe-42` against a `SHOE-42` catalog publishes a campaign that can never match, with no warning and no validation against observed purchase history. The negative case is worse: a mis-cased **exclusion** leaves the item *in* the matched set, and since negation forces a matched-items basis, the reward is paid on the loss-leader the exclusion existed to protect. Pick a convention (case-fold at ingest and publish, or keep exact and add explicit copy plus a pre-publish SKU check) and enforce it on both sides.

**PSC-8 (P1-next) - Webhook bodies are cast, not validated.** `const webhookData = JSON.parse(body) as CustomWebhookDto` — `CustomWebhook.ts` is a type, not a TypeBox schema, and only `body: t.String()` is validated. A numeric `"sku": 12345` survives. The webhook-first path keeps the number (`sku eq "12345"` false), while the late-claim path re-reads a `varchar` column and gets a string (true). Eligibility becomes a function of which path won. Give the routes a real `items[]` schema or coerce with `String(item.sku)` at the mapping site.

**PSC-9 (P1-next) - `minAmount` applied after `maxAmount`.** In `RewardCalculator.calculatePercentageReward` the clamps run in the wrong order (both correctly guarded with `!== undefined`, contra one auditor's `&&` claim):

```ts
if (reward.maxAmount !== undefined && amount > reward.maxAmount) amount = reward.maxAmount;
if (reward.minAmount !== undefined && amount < reward.minAmount) amount = reward.minAmount;
```

`minAmount: 100, maxAmount: 5` pays 100 on every match. `validateRewardAmount` never rejects `minAmount > maxAmount`. Only reachable via the API (the wizard does not author min/max), but publish validation is the only guard and it has a hole. Use `Math.min(Math.max(a, min), max)` and reject inverted bounds.

**PSC-10 (P2-when-picked-up · known product gap) - "Basket Range" label on a matched-items basis.** *Business-app authoring/display copy, so it moves with the display work rather than blocking go-live. The mis-labelling is real and the description below stands; it is scheduled with the wizard's display pass.* `RewardCampaign/utils.ts` sets `tierField = "purchase.matchedAmount"` when `rewardBasis === "matchedItems"`, but `RewardCampaign/index.tsx:861` unconditionally renders `campaigns.create.reward.tiered.basketRange` ("Basket Range ({{glyph}})"); no `_matched` variant exists in either locale. A merchant authoring "0-50 € → 5 %" believes those are order-value bands; on a 200 € order with 30 € of scoped product, tier 1 applies. Directly wrong money, in exactly the configuration the negation guard forces. Add a `tiered.matchedRange` key (en+fr), switch on `rewardBasis`, mirror in `ValidationCampaign`.

**PSC-11 (P2-when-picked-up · known product gap) - `AdvancedScopeNotice` inverts a `none` scope.** *Business-app display surface. Real and user-visible, deferred with the rest of the display work; the fix is to reuse the already-correct `ProductScopeChip`.* It discards the wrapper's `logic` and never renders the operand:

```tsx
{"field" in condition ? `${condition.field} ${condition.operator}` : condition.logic}
```

`{ logic: "none", conditions: [{ sku eq "CHEAP" }] }` renders as the chip **`sku eq`** — read as "only SKU CHEAP" when it means "everything except CHEAP", with no clue which SKU. The existing test asserts this output, enshrining it. `ConfigTab.tsx`'s `ProductScopeNodes`/`ProductScopeChip` already does this correctly (group polarity, translated field, `between`'s `valueTo`); the wizard rolls a second, worse humaniser. Reuse the correct one.

**PSC-12 (P1-next) - Empty `productScope: []` publishes and means "everything".** `validateRuleDefinition` gates on `if (rule.productScope)`, and `[]` is truthy; `validateProductScope` loops zero nodes and returns `null`. **Verified**: `matchesProductScope([], { sku: "ANY" })` returns `true`. So an empty scope matches every item, satisfies the `matched_items_amount` "requires a productScope" gate, and flips `isProductScoped: true` so the wallet renders "On selected products only" on a campaign covering everything. The validator already rejects an empty array for `in`/`not_in`; apply the same reasoning one level up.

**PSC-13 (P1-next) - `between` with `valueTo: null`.** `null` is legal per `RuleConditionValue` and slips past the `=== undefined` validator. The backend then falls into `compareValues(fieldValue, null)`, degrading to `String(x).localeCompare("null")` — for numeric fields that reduces `between` to "≥ lower bound". The SDK returns `undefined` and fails open. An authoring mistake becomes a silently different gate per side, and it publishes clean. Check `=== null` in both the validator and the `between` guard.

**PSC-14 (P1-next) - Inverted `between` range accepted.** `unitPrice between 100 and 10` passes `productsFormToCondition`, passes `validateProductScopeCondition` (which only checks `valueTo` present and non-array), and is unsatisfiable at evaluation. The merchant funds a budget, publishes, and nothing ever pays, with no signal. `utils.test.ts` covers a missing upper bound but not an inverted one. Add `valueTo > value` to both the form gate and the backend validator.

**PSC-15 (P1-next) - A scope matching nothing is invisible.** *Cheapest support win in the report, and it becomes valuable the moment the first merchant pilots the feature — it is how support will distinguish "scope matched nothing" from "no eligible purchases".* `applyProductScope` returns `undefined` when `matchedItems.length === 0`, which `evaluateSingleCampaign` turns into a plain non-match — no log, no `skippedCampaigns` entry, no `errors` entry, indistinguishable from "order-level conditions didn't match". Neighbouring paths (caps, budget) all `log.debug`/`log.warn`. This is the single most likely production failure mode of the feature — a merchant scopes on `sku` while their plugin sends none (PSC-6), or the casing differs (PSC-7) — and support cannot tell it apart from "no eligible purchases". Add a debug log and a distinct reason on `EvaluationResult`.

**PSC-16 (P1-next) - Two hand-copied evaluators with a known divergence.** *SDK correctness, so it keeps real priority.* `matchesProductScope.ts` and `RuleConditionEvaluator.ts` duplicate `asNumber`/`compare`; only the classification sets in `operators.ts` are shared. **Verified divergence**: SDK `exists` is `fieldValue !== undefined`, backend is `!== undefined && !== null`, so `matchesProductScope([{field:"sku",operator:"exists"}], {sku: null})` returns `true` where the backend returns `false`. `not_exists` mirrors it — and `not_exists` is in `NEGATIVE_OPERATORS`, so it participates in the publish-time negation guard. Reachable because `matchesProductScope` is a public export callable with unsanitised input. The file's comment claims it "mirrors the backend"; that is now false. Align on `!= null` and extend the golden corpus with a scope-match kind asserted from both suites.

**PSC-17 (P1-next) - The parity test cannot fail.** In `matchesProductScope.test.ts`, the case that claims to guard operator parity asserts only:

```ts
// Asserts every operator has a `case` in `evaluateCondition`
// rather than falling through to the fail-open default, not the boolean outcome.
expect(() => matchesProductScope(scope, product)).not.toThrow();
```

`matchesProductScope` is total — every guard falls through to `return undefined` → `result ?? true` — so it cannot throw for any input. Delete every operator branch and this test stays green; the comment asserts precisely the property the assertion cannot observe. Replace with an outcome table per operator.

**PSC-18 (folded) - Magento: unused, untested, developed blind — needs a full dedicated review, not piecemeal fixes.** *Priority: P2-when-picked-up.*

**Owner decision (2026-08-15):** the Magento plugin is **used by no merchant**, is kept only in case one asks, was **developed blind** against no live Magento instance, and has **never been tested** against one. It therefore gets **one** finding rather than a scattered list, and the correct action is a full dedicated review before any merchant is allowed to enable it — not fixing individual defects now, which would create the false impression the plugin has been validated.

**This item absorbs every Magento-specific finding in this audit.** The concrete defects found, retained here so the eventual review has a starting checklist rather than a blank page:

- **Empty-SKU divergence (the original PSC-18).** `plugins/magento/Model/WebhookSender.php:100` always emits `"sku" => (string) $item->getSku()`, while WooCommerce (`class-frak-wc-webhook-registrar.php:483`) and PrestaShop (`FrakOrderResolver.php:116`) omit the key when empty. These are **not** equivalent downstream: `""` satisfies `exists`, `neq "CHEAP"` and `not_in ["CHEAP"]`, so a Magento item with no SKU joins the matched set of any negated scope while a WooCommerce item does not. This contradicts the documented "items without it never match SKU conditions" (see the doc-drift table).
- **Tax-basis divergence (from PSC-2).** Magento's `$item->getPrice()` is tax-**exclusive** where PrestaShop's `unit_price_tax_incl` is tax-**inclusive**, so the same campaign pays materially differently per platform. Settling one tax convention across the plugins is part of PSC-2's fix; the Magento side of that convention lands in this review.
- **No display `products` attribute at all (from PSC-6).** Magento emits no `products` array, so live product context is not merely SKU-less but entirely absent on this platform. PSC-6's two-line fix covers WooCommerce and PrestaShop only.
- **`getSku()` semantics on configurable products are unverified.** Whether `getSku()` on a configurable parent returns the parent or the child SKU decides whether variant scoping — the canonical use case for this feature — works on Magento at all. This was not measurable without a live instance and remains an open question, not a known-good behaviour.

**Why one item and not four** Fixing these individually would leave the plugin looking audited while its fundamental risk — that nothing in it has ever run against real Magento — is untouched. The review must be end-to-end and instance-backed.

**Superseded IDs** No other PSC ID is retired by this fold; PSC-2 and PSC-6 retain their own IDs and scope, and cross-reference here for their Magento portion. Existing IDs stay stable so external references remain valid.

**PSC-19 (P2-when-picked-up) - Backend `formatted=1` tests re-implement the handler.** In `services/backend/src/api/user/merchant/index.test.ts`, the mapping cases call `selectBestReward(...)` directly and rebuild `{ rewards, ...(best && { best }) }` in the test — a copy of the handler. `userMerchantApi.handle` is never invoked in that describe. If the handler stopped passing `products: decodeProductsQueryParam(products)` into `selectBestReward`, all cases still pass; the comment claiming to prove "`products` actually reached `selectBestReward`" proves it reached it *in the test*. The `?products=` → decode → select wiring is the untested part. Drive the assertions through the real handler.

**PSC-20 (P1-next) - Missing SKU never backfilled.** *Pairs with PSC-3's migration — do them together.* The purchase row uses `onConflictDoUpdate` but items use `onConflictDoNothing`, so item rows freeze at first write. An order recorded before a plugin upgrade (Woo previously stripped `sku`) keeps `sku = NULL` forever despite every later redelivery carrying it. The documented "graceful degradation" holds only for the first delivery. Use a fill-only `onConflictDoUpdate` with `coalesce(excluded.sku, purchase_items.sku)`.

**PSC-21 (P2-when-picked-up) - The schema encodes none of the scope invariants.** `campaign_rules.rule` is bare `jsonb` with a TypeScript-only `$type<>`; the field allowlist, depth/node caps, operator/value typing and the negation⇒matched-basis rule live exclusively in `CampaignManagementService`. Anything writing outside that service can plant a rule the evaluator will run. Separately, the plan's "cheap fix while in here" was not done: `CampaignRuleRepository.ts:221` still reads `"name" | "priority" | "rule" | "budgetConfig" | "expiresAt"` with no `"metadata"`, and `CampaignManagementService.ts:337` still launders the resulting error through `as Parameters<typeof this.campaignRuleRepository.update>[1]` — a typed cousin of the banned `as any`, sitting on the write path for money-shaped JSON. Adding `"metadata"` to the `Pick<>` and deleting the cast is a one-line, no-behaviour-change fix.

## Low findings

**PSC-22 (P2-when-picked-up) - `drizzle/v2` baseline lacks `sku`.** `services/bootstrap/drizzle/v2/0000_lonely_stryfe.sql:148-158` creates `purchase_items` with no `sku` column, and it is the only file in that folder, while `dev/0041`, `prod/0020` and `local/0037` all add it. `migrate-pg.ts:19` routes any schema ending `_v2` there. Latent only: `infra/gcp/secrets.ts` sets `public` and `infra/gcp/dev.ts` sets `local`, so nothing routes to `_v2` today. Regenerate or delete the folder.

**PSC-23 (P2-when-picked-up) - `CampaignInfoSection` has no test.** It duplicates `RewardBreakdown`'s matched-basis branches independently, down to identical comments, but `RewardBreakdown.test.tsx` covers all four cases and `CampaignInfoSection` covers none — despite being the surface the plan calls the primary product-scope render target. Extract the basis→(copy key, example) decision into one helper, or port the four cases.

**PSC-24 (P2-when-picked-up) - `matchedProducts: undefined` is overloaded.** `matchedProductsFor` returns `undefined` for both "no product context" and "scoped winner, nothing matched", collapsing the state the feature exists to communicate. The wire comment documents only the first case. Return `[]` for the second. Note nothing renders `matchedProducts` today — it is shipped API surface awaiting the display phase.

**PSC-25 (P2-when-picked-up) - The golden corpus is a change-detector.** Every expectation in `golden-rewards.json` is produced by calling the implementation under test, and the TS suites replay the same functions against those outputs. The cross-implementation value was meant to come from the natives, but `GoldenFixtures.REWARDS` (Kotlin) and `GoldenFixtures.rewards` (Swift) have **zero** references — confirmed by grep across `sdk/android` and `sdk/ios`, and stated outright in `next.md`. Additionally no CI job regenerates and diffs the corpus, so an expectation change is silent. (One auditor claimed 69 entries against the docs' 67; the actual count is **67** — the docs are correct and that finding is withdrawn.)

**PSC-26 (P2-when-picked-up · known product gap) - Quantity tiers render as currency.** *Display surface, unreachable from the wizard today.* `RewardBreakdown.tsx` and `CampaignInfoSection.tsx` both call `formatAmount(tier.minValue)` regardless of `tierField`, so a `purchase.matchedQuantity` tier of "2-5 items" renders "2-5 €". Unreachable from the wizard, reachable via the API. Branch the range renderer on `tierField`.

**PSC-27 (P1-next) - `sanitizeSharingProducts` drops title-less entries.** *Inconsistent public SDK API across three components in one package, so it keeps real priority despite Low severity.* `normalizeSharingProduct` returns `null` when `title === ""`, so `<frak-button-share products='[{"sku":"SHOE-42"}]'>` silently loses its product context, while the byte-identical attribute on `<frak-banner>` (which uses `sanitizeProductDetailsList`) works. Inconsistent public API across three components in one package. Keep title-less entries for scope purposes, or warn.

**PSC-28 (P2-when-picked-up) - Plan docs describe a tree that no longer exists.** See the drift table below.

## What is solid

- **The fail-open contract is real, deliberate and tested.** `matchesProductScope` never removes a campaign — `matchesProduct` only re-ranks — so no advisory bug can hide a reward the backend would pay. The tests name each fail-open branch and pin the *deliberate* divergences from the backend's fail-closed posture rather than papering over them.
- **The negation guard is the right guard in the right place.** `NEGATIVE_OPERATORS` in `sdk/core/src/rewards/operators.ts` is imported by the backend's `productScopeHasNegation` (`CampaignManagementService.ts:53`) *and* the business app's `isNegativeProductScope` (`campaignStore.ts:327`), so three copies of the rule cannot drift on the operator set, and `logic: "none"` is conservatively counted as negative on all three.
- **Numeric-vs-lexicographic comparison is correct and identical on both sides.** `asNumber` + numeric subtraction, with the "9 vs 10" trap covered by tests in both `matchesProductScope.test.ts` and `RuleConditionEvaluator.test.ts`.
- **Basis vs gate is properly distinguished.** `isMatchedItemsBasis` (not `isProductScoped`) drives copy in both render surfaces, and both correctly *suppress* the whole-basket worked example for a matched-items reward rather than printing a misleading number.
- **Publish-time validation is genuinely defensive** where it exists: exact field allowlist, depth/node caps, operator↔operand type checks, `matched_items_amount` ⇒ `productScope` required, `productScope` ⇒ purchase trigger only, plus TOCTOU-guarded status transitions.
- **`decodeProductsQueryParam`** caps length and entry count in the handler rather than the schema, so an oversized `products` costs the context and not the whole `rewards` response, and degrades to no-context instead of 422.
- **`merchantRewardParity.ts`** is a compile-time-only guard on the `EstimatedRewardItem`↔`MerchantReward` wire contract, making scope drift a build failure.
- **First-writer-wins attribution in `PurchaseRepository`** (`coalesce(...)` in SQL, CAS in `updateIdentityGroup`) is correctly reasoned, with comments that earn their budget by explaining the attack rather than the mechanism.
- **The wizard preserves scopes it cannot represent** — `isAdvancedScope` makes `productsFormToDraft` return the draft untouched rather than flattening a `none` group into its own opposite, with `getProductScopeCondition` refusing to unwrap a group and a test pinning exactly that hazard. The instinct is right even though the *rendering* of those scopes is wrong (PSC-11).

## Test and coverage assessment

| Suite | Appears to prove | Actually proves |
|---|---|---|
| `matchesProductScope.test.ts` (fail-open block) | Advisory matcher is safe | Genuinely does. Separates fail-open from correct fail-closed, pins deliberate divergences, proves a non-evaluable leaf does not rescue a false sibling |
| `matchesProductScope.test.ts` (operator parity) | SDK↔backend operator parity | Nothing (PSC-17). `not.toThrow()` on a total function |
| `api/user/merchant/index.test.ts` (`formatted=1`) | `?products=` reaches `selectBestReward` | Nothing about wiring (PSC-19). Re-implements the handler in the test |
| `golden-rewards.json` consumers | Cross-implementation conformance | Change detection only (PSC-25). Expectations generated by the code under test; native constants unreferenced |
| `CampaignManagementService.test.ts` (negation) | Publish guard is sound | Genuinely does. Six cases incl. nested negated leaf, `logic:"none"`, and a negative control |
| `RewardBreakdown.test.tsx` | Basis copy is correct | Does for `RewardBreakdown`; three of its cases are functionally identical, and one is named for scope state the component cannot see. `CampaignInfoSection` is untested (PSC-23) |
| `ProductsCampaign.test.tsx` | The products step works | Sub-components only. The page — `isAdvanced` branch, `saveCampaign.isError` banner, `onSubmit` → persist — is untested, which is why PSC-1 survived |
| `httpsUrl.test.ts` | Write-path URL validation | Genuinely does, through the real Elysia validator. Model for the rest |

The structural gap: **coverage is strong at the pure-function layer and absent at every boundary**. Every confirmed high/critical finding in this audit lives at a boundary — form→payload (PSC-1), item→DB (PSC-3), plugin→SDK (PSC-6), component→listener (PSC-5), calculator→order total (PSC-2). No test crosses one.

*Environment note (corrected 2026-09-04):* React/DOM suites here failed with `React.act is not a function`, originally recorded as a broken local install. It is not — that error appears when `NODE_ENV=production`, because React then resolves its production build, which omits `act`. With `NODE_ENV` unset or `test` every DOM suite runs. Pure-logic suites were always fine — `sdk/core/src/rewards` passes 167/167 — and targeted Vitest runs reproduced PSC-1, PSC-12 and PSC-16 empirically.

## Doc drift

| Doc | Claim | Reality | Verdict |
|---|---|---|---|
| `campaign-product-display-business-app.md:44` | "`productScope` itself has **no** creation UI yet" | `Creation/ProductsCampaign/` shipped in `15480d761`, plus a `products` wizard step | **false** |
| `campaign-product-display-business-app.md` | "Two authoring modes, driven by the scope shape" (enumerable/non-enumerable) | What shipped is editable-vs-advanced (`isEditableCondition`/`isAdvancedScope`) — a different axis | **false** |
| `campaign-product-display-business-app.md` §Testing | Seven `productDisplay` test cases | `productDisplay` appears in zero source files; no corresponding test exists | **stale** |
| `campaign-product-display.md` §5 | "`ExternalLink` binds `href` raw with no scheme check" | `isAllowedHref` + `ALLOWED_PROTOCOLS`; non-allowed renders inert `<span>`, tested | **false** (`737d0c558`) |
| `campaign-product-display.md` §1 | "`merchantMetadata.homepageLink` is a bare `t.String()` … a live XSS sink" | The **write** schema `SdkConfigSchema:252` uses `HttpsUrlSchema()`. (`:223` is the read/response `ResolvedSdkConfigSchema` — not the sink) | **false** |
| `campaign-product-display.md` §1 | "`heroImageUrl`/`logoUrl` use this insufficient pattern" | Both already `HttpsUrlSchema()` | **false** |
| `campaign-product-display.md` | "`selectFormattedReward` takes no `products` parameter" | It does, threaded through `useSharingPageController` | **false** |
| `campaign-product-display.md` | "add `metadata` to the `Pick<>`; the cast is still there" | Both still true (PSC-21) | **true** |
| `campaign-product-display.md` | "`matchedProducts` consumed by zero UI surfaces" | Still true | **true** |
| `product-scoped-campaigns.md` open Q3 | "creation UI, SKU autocomplete, list indicator not built" | Creation UI **is** built; the other two are still open | **half stale** |
| `product-scoped-campaigns.md` §SKU plumbing | "items without a SKU never match SKU conditions — graceful degradation" | Magento's `""` satisfies `exists`/`neq`/`not_in` (PSC-18) | **false** |
| `product-scoped-campaigns.md` | "`matchedAmount` is fiat in the order currency, like `purchase.amount`" | Different bases: pre- vs post-discount, and mixed tax treatment (PSC-2) | **false** |
| `product-scoped-campaigns.md` | "the same array drives both the sharing-page cards and reward selection" | True only for hand-rolled integrators; no shipped plugin sends `sku` (PSC-6) | **misleading** |
| `matchesProductScope.ts` (in-code) | `compare` "mirrors the backend's `compareValues`" | Diverges on `exists`/`not_exists` null handling and `between`+`null` (PSC-16) | **false** |
| `ProductsCampaign/index.tsx` | "`MAX_VALUES = 50` mirrors the backend's `PRODUCT_SCOPE_MAX_NODES`" | That constant counts *nodes*; 50 values is 1 node. The backend caps array length nowhere | **false** |
| `frakContext.ts` (in-code) | `update` "returns null on failure" | Throws on a malformed URL (PSC-5) | **false** |
| `native-sdk/contract.md:146`, `next.md:82` | "67 entries across 6 kinds" | Verified 67 — accurate | **true** |

## Recommended next actions

*Ordered by the priorities in the table above, not by severity. No merchant uses this feature today, so the ordering optimises for "correct and configurable before the first merchant" rather than "stop the bleeding".*

### P0-now — do immediately

1. **Send `rule` on the products-step save** and relax the backend's draft-PUT reward check. Add a `useSaveCampaign` test asserting the products-step payload carries `rule.productScope`. Closes PSC-1. **S**
   *This is the gate in front of everything else: until it lands, a correct scoped campaign cannot be authored, so none of the fixes below can be verified end to end.*

### P1-next — must land before the first merchant enables the feature

2. **Clamp or correct the matched-items payout base**, then settle one tax convention across the plugins. Closes PSC-2. **M** — *go-live gate.*
3. **Re-key `purchase_items` uniqueness on a line-scoped id**, and make both claim paths read the same item set. Closes PSC-3, PSC-20. **M** — *go-live gate; needs a migration, so start it first — longest lead time.*
4. **Add `sku` to the WooCommerce and PrestaShop `products` payloads.** Closes PSC-6, materially reduces PSC-4's blast radius when the display work is picked up. **S** — *two lines per plugin; Magento is out of scope, see PSC-18.*
5. **Guard `FrakContextManager.update`'s `new URL`** and normalise `merchantDomain` to a scheme-qualified URL. Closes PSC-5. **S**
6. **Close the publish-validation holes** as one batch: empty scope, `valueTo: null`, inverted `between`, `minAmount > maxAmount`, per-field value typing. Closes PSC-9, PSC-12, PSC-13, PSC-14. **S-M**
7. **Align `exists`/`not_exists` on `!= null`** and add a shared scope-match corpus asserted from both evaluators; replace the tautological parity test with an outcome table. Closes PSC-16, PSC-17. **M**
8. **Add a debug log when a scope matches no line item.** Closes PSC-15 — cheapest support win in the list, and the diagnostic support will need during the first pilot. **S**
9. **Validate webhook `items[]` with a real schema.** Closes PSC-8. **S-M** — *the Magento empty-SKU half moves to PSC-18.*
10. **Decide the SKU normalisation convention** (case-fold vs exact + pre-publish check) and enforce it end to end. Closes PSC-7. **M**
11. **Keep title-less entries in `sanitizeSharingProducts`**, or warn. Closes PSC-27. **S**

### P2-when-picked-up — schedule with the display/product work

12. **Display surfaces, as one body of work when product picks the feature up.** Prefer unscoped campaigns when product context is absent or qualify the headline (PSC-4); add a `tiered.matchedRange` locale key and switch on `rewardBasis` (PSC-10); reuse `ProductScopeChip` in `AdvancedScopeNotice` (PSC-11); branch the tier range renderer on `tierField` (PSC-26); return `[]` rather than `undefined` for "scoped winner, nothing matched" (PSC-24). **M** in aggregate.
    *These are tracked product gaps, not defects. The current single "on selected products!" line is the intended state until this work is scheduled.*
13. **Magento: full dedicated instance-backed review** before any merchant is allowed to enable it. Closes PSC-18 and its absorbed items. **M-L** — *not piecemeal fixes; see PSC-18 for the starting checklist.*
14. **Housekeeping**: add `"metadata"` to the repository `Pick<>` and delete the cast (PSC-21); wire or delete the native golden loaders and add a fixture-diff CI step (PSC-25); drive the `formatted=1` tests through the handler (PSC-19); test `CampaignInfoSection` (PSC-23); regenerate or delete `drizzle/v2` (PSC-22); correct the plan docs per the drift table (PSC-28). **M**

## Re-verification 2026-09-04

Against `dev` @ `5f7c52f33`. `git log db3b7b2b7..HEAD` over `apps/business/src/module/campaigns`, `services/backend/src/domain/{campaigns,rewards}`, `sdk/core/src/rewards` and the three plugins' product payloads is empty for anything that touches a finding. Seven repros were re-run as temporary vitest files and removed. The 2026-08-15 ordering above still holds; the additions below slot into existing items rather than adding new ones.

**PSC-1 stands, unchanged to the byte.** `useSaveCampaign.ts` still omits `rule` from the products-step PUT, and the backend still rejects an empty `rewards` array on PUT while only checking `if (rule.productScope)` for truthiness. Fix as written in item 1; add the products-step payload case to `useSaveCampaign.test.ts` so it cannot regress silently.

**Widened.**
- **PSC-8** — `quantity` has the same string/number split across the two claim paths as `sku`. Same normaliser, same commit.
- **PSC-9** — `EstimatedRewardService` uses truthiness on the cap, so a `0` `maxAmount` is dropped rather than honoured. Whether an inverted pair is High is arguable (every match is uncapped) and was left Medium only because the wizard cannot author it.
- **PSC-12** — `{logic: "none", conditions: []}` publishes and matches everything one level down from the empty top-level scope; the validator in item 6 must recurse over groups, not check the root array.
- **PSC-26** — tier ranges render raw `min` beside formatted `max` (`10–100 €`) on both the wallet and the business renderer, in addition to the currency-vs-quantity conflation already recorded.
- **PSC-27** — since `ee02d5bdb` every share CTA routes `products` to the sharing page, so a title-less entry now loses its scope on sharing-page ranking as well as on the modal. Still a one-liner.

**Re-graded.** PSC-17 and PSC-19 are test-quality gaps with no runtime path and are Low; PSC-21 is a one-line `Pick<>` change and is Low. All three ride along with the P1 validator commit rather than being scheduled. PSC-16 is unchanged, but note the reachability: `sanitizeProducts` drops `null` attributes, so the `exists` divergence is reachable only through direct `matchesProductScope` calls.

**PSC-22 is now structural, not latent.** `drizzle/v2/0000_lonely_stryfe.sql` creates 17 tables; the `dev` snapshot has 32. The gap is no longer one column but whole tables (`install_codes`, `referral_codes`, and everything since). `migrate-pg.ts` and `drizzle.config.ts` still route any `*_v2` schema name to that folder and `services/bootstrap/AGENTS.md` still advertises it. Regenerating is not worth it for a target nothing deploys to; delete the folder and the two routing branches, and strike the mention from `AGENTS.md`. That closes PSC-22 by removal.

**Delegate corrections.** The re-verification brief placed `CampaignInfoSection` in `apps/business`; it is `apps/wallet/app/module/explorer/component/ExplorerDetail/CampaignInfoSection.tsx`, as the audit says. PSC-25's dead `GoldenFixtures` constants are the same two the native audit records as NSD-16; close them together.

**Still not executed.** No live Postgres, so PSC-3's `onConflictDoNothing` truncation and the `_v2` failure remain reasoned from schema; no plugin was installed against a store.

## Resolution 2026-09-04

Branch `chore/audit-findings`. Every P0/P1 finding is closed except PSC-7 (owner-deferred). Work ran as six parallel lanes, then two review rounds and three fix rounds; each review round found defects in the previous round's fixes, including two money defects introduced by the fix for PSC-3.

**Verification.** biome, `bun run lint` (comment budget, i18n, iOS floor), per-package typecheck, backend 1267/1267, sdk/core + sdk/components + wallet-shared + apps/business 2887/2887. Behaviour changes were mutation-checked — the fix was reverted and the new test confirmed red — not merely observed green.

### Corrections to this audit

Three claims in this document are wrong, and the code now follows the evidence rather than the text.

- **PSC-2's diagnosis holds only for Shopify.** WooCommerce's REST serializer computes `line_items[].price` as `get_total() / quantity`, which is already **post-discount**; the real gap there is **tax** (line ex-tax against an order total inc-tax), which *under*states rather than overpays. PrestaShop already sent `unit_price_tax_incl`. Only Shopify's `price` is genuinely pre-discount, so "systematic overpay on every discounted order" was true for one of three providers. The fix — one tax-inclusive, post-discount basis — is right for all three regardless. This wrong diagnosis had already propagated into two merchant-facing plugin changelogs before it was caught.
- **PSC-14's prescription is wrong.** It asks for `valueTo > value`. The evaluator's `between` is inclusive on both ends, so `between 50 and 50` means "exactly 50" and is satisfiable; rejecting it at publish is the same defect with the sign flipped, and it fails loudly at the merchant with a message that is untrue. The rule is `valueTo >= value`. Found by mutation-testing an untested boundary.
- **PSC-5's trigger is misattributed.** The WordPress shortcode's `sharing_url => ''` default is not a trigger: `build_html_attrs()` skips empty values, so no attribute is emitted and the fallback works. The real source is `merchantDomain` arriving as a bare host from the backend. The SDK guard was still needed; the plugin blame was not.

Also corrected: the *Environment note* under Test and coverage assessment blames a broken local `node_modules` for `React.act is not a function`. It is not broken — that error appears when `NODE_ENV=production`, because React resolves its production build, which omits `act`. Every DOM suite runs green with `NODE_ENV` unset or `test`. The false belief cost two agents a wrong report each.

### Not shipped here: the migration

PSC-2 and PSC-3 need a `purchase_items` change (nullable `total_price`, and item identity re-keyed to `UNIQUE NULLS NOT DISTINCT(purchase_id, external_id, sku)`). The `schema.ts` declaration ships on this branch; **the migrations do not**. `services/bootstrap/AGENTS.md` states migrations are human-generated and DB-team-owned, and this work initially violated that by running `drizzle-kit generate` for all three stages. Those artefacts were removed. The request, with the reference DDL, the safety argument, the lock-window note and the staged local → dev → QA → prod rollout, is `docs/plans/purchase-items-line-key-migration.md`.

**The backend must not be deployed to a stage whose database has not taken that change** — the code writes `total_price` and uses the constraint as its `ON CONFLICT` arbiter.

Generating against `prod` also surfaced unrelated pending drift (`install_codes` columns and check constraint, a `purchase_claims` index). That predates this work and needs its own decision.

### New residual risks, for the next auditor

- **`unitPrice` means different things per platform.** The backend evaluates a `unitPrice` scope against the webhook's per-item `price`: tax-**exclusive** on WooCommerce, tax-**inclusive** on PrestaShop. Display now matches payout *within* each platform, but `unitPrice lt 100` is not portable *across* them. The PSC-2 convention settled line totals, not unit prices.
- **Numeric coercion differs between display and ingest.** `sanitizeProducts` uses `Number.parseFloat` (so `"79.90 €"` → `79.9`); the backend's `toPurchaseItem` uses `Number` (→ absent). Only reachable for hand-rolled integrations that send formatted strings; both shipped plugins send numerics.
- **Reconciliation trusts a non-empty delivery.** The stored item set equals the incoming set only when a delivery carries at least one item; an empty `items` is treated as absence of information, because it is optional on the custom and Magento DTOs and reconciling against it would wipe an order's lines.
- **`scopeMatchedNoItemCampaigns` has no production reader.** PSC-15's diagnostic value is carried by its `log.debug`; the collector field is currently test-only, mirroring the pre-existing `skippedCampaigns`.
- **Row locks on redelivery.** The reconciliation `DELETE` and the adopt `UPDATE` take row locks on `purchase_items` for the purchase, so a redelivery racing a late claim now serialises where it previously did not.
- **Nothing here ran against a live Postgres or a live store.** The DDL, the reconciliation SQL and every PHP change are reviewed by eye and by rendered-SQL assertions only. The DB team's `local` step is the first real execution.
- **`@frak-labs/core-sdk` bump level is a judgement call.** `SharingPageProduct.title` moving required → optional is a consumer-visible type break on a published 1.x; the changeset says `minor` on the grounds that the type is overwhelmingly an input and the runtime is strictly more permissive. Strict semver would say `major`. Revisit before release.

## Audit coverage

- **Adoption status is owner-supplied, not measured.** "No merchant currently uses this feature" comes from the product owner and was not verified against production data. Every priority in this document depends on it. If any merchant *has* enabled a product-scoped campaign, PSC-2 and PSC-3 become live money defects and jump to P0 immediately — that is the single assumption most worth re-checking before acting on this ordering.
- **Not executed:** no live Postgres, so PSC-3's `onConflictDoNothing` truncation and PSC-22's `v2` failure are reasoned from schema + code, not observed against a database. No query was run against production `purchase_items` to see whether duplicate-`product_id` truncation is already occurring in real data — that is the single highest-value next measurement.
- **Platform API semantics taken from documentation, not captured payloads:** whether Shopify `line_items[].price` is pre-discount for the merchants actually live (PSC-2), the tax treatment of WooCommerce REST `line_items[].price`, whether PrestaShop `product_reference` carries the *combination* reference (which decides whether variant scoping works on PS at all), and whether Magento `getSku()` on a configurable parent returns parent or child. Each materially affects PSC-2/PSC-3/PSC-18.
- **Not run:** React/DOM suites (broken local install). Reproductions were done with targeted Vitest runs on pure-logic paths; `apps/business` DOM tests were not executed, so PSC-10/PSC-11 rest on reading the components and their locale files.
- **`localeCompare` across ICU builds** (browser SDK vs Bun backend) was not measured — a theoretical `gt/lt/between` divergence on `name` that no shipped authoring surface currently produces.
- **Not examined:** the native Android/iOS reward decoders beyond confirming they consume `matchedProducts` and do not load the rewards corpus; the post-publish edit surface (`useUpdateCampaignConfig`'s payload construction, specifically whether it round-trips full cached `metadata`); campaign list/detail read paths outside `ConfigTab`; the `EstimatedRewardService` estimate path beyond the min/max truthiness bug noted under PSC-9.
- **Dark corner for the next auditor:** every confirmed high-severity defect sits at a boundary between two layers, and no test in this feature crosses a boundary. Assume any *other* untested boundary in this scope is also wrong until measured.
