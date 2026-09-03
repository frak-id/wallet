# Product-scoped campaigns - Audit

**Date:** 2026-08-15 · **Branch:** `dev` · **HEAD:** `a9e4dc543` · **Range audited:** `8c75c119c^..a9e4dc543` (feature work concentrated in `b3e8c68e5`, `2097e36b4`, `3ca997d46`, `6dbb5d542`, `d35e17be3`, `d445db03a`, `413c3cffb`, `c21582feb`, `15480d761`, `c47780084`, `908f68f0c`, `c889c477b`)

## Status — resolved 2026-09-04

**Every P0 and P1 finding is closed except PSC-7, which the owner deliberately deferred.** The work landed on `chore/audit-findings`: of the 16 P0/P1 findings, 15 are fixed and PSC-7 is deferred; one new finding (PSC-29) was found and fixed during the work, and three of this document's own claims were corrected as wrong (see [Corrections to this audit](#corrections-to-this-audit)). The closed findings and their prose are deleted from this file; what closed them and why is in [Resolution 2026-09-04](#resolution-2026-09-04). What remains below is open: PSC-7 by owner decision, the other twelve because they are P2 and wait on the display/product work.

**The backend on this branch must not be deployed to a stage whose database has not taken the `purchase_items` change.** See [Not shipped here: the migration](#not-shipped-here-the-migration).

## Verdict

**No merchant currently uses this feature.** That single fact set every priority in this report, and it still sets the ones that are left: nothing here is paying out, over-promising or losing money in production, so nothing that remains is urgent on production-impact grounds.

The reward engine was well built; the failures were at the two ends, and both ends are now closed. Authoring works: the wizard sends the scope it shows (PSC-1), and the publish validator no longer accepts an empty, null-bounded or inverted one (PSC-12, PSC-13, PSC-14). Payout is on the money the customer actually paid, clamped to the order total (PSC-2), computed over a line set that no longer loses variants (PSC-3, PSC-20). The plugins finally send the `sku` the scopes match on (PSC-6). The two evaluators agree from a shared corpus (PSC-16, PSC-17), which is what caught PSC-29 — an absent field satisfying `gt`/`gte` against any threshold, fail-open in a fail-closed evaluator and the most serious defect in the batch, found only because the corpus existed.

What is left is one deferred decision and twelve P2 items. **PSC-7** — whether SKU matching case-folds — is deferred deliberately: it is a convention, not a bug, and picking one before a real merchant has used the feature would be guessing. The rest is display-shaped: the wallet, the listener and the business app's *rendering* surfaces. The product team has not yet built the product-metadata and multi-campaign-display experience, and the single line reading "on selected products!" is the **deliberate current state**, not an oversight. Findings like PSC-4 keep their technical description intact so they are directly actionable when that work is picked up.

Two things carry forward that are not findings. The schema change PSC-2 and PSC-3 depend on is a DB-team request, not shipped here. And the new residual risks the work itself created — a per-platform `unitPrice` tax convention, coercion drift between display and ingest, row locks on redelivery — are recorded at the end for the next auditor rather than filed as findings against work that just closed.

The core evaluator, the negation guard and the fail-open display contract were genuinely good work before this batch, and still are.

## Owner decisions applied

*Recorded 2026-08-15. These are product-owner judgement calls that shaped the Priority column below. They are written down so a future reader can tell a deliberate decision from an oversight.*

1. **No merchant uses this feature today.** Priorities are set for a pre-adoption feature. Nothing is in production paying out, so severity and urgency deliberately diverge throughout this document.
2. **Creation, backend money-correctness and the SDK/plugin surfaces were scheduled ahead of everything else** — PSC-1 as P0, PSC-2/PSC-3 and the SDK and plugin defects as P1 that must land before the first merchant enables the feature. All of it is now closed; the decision is recorded because it is what made the ordering, not because anything is still pending under it.
3. **PSC-7 is deferred, not dropped.** SKU case-folding is a convention rather than a defect, and the owner's call is that choosing one before a real merchant has used the feature is guessing — some legacy catalogues treat SKU case as significant.
4. **Non-SDK, non-plugin display surfaces (wallet, listener, business app display) are P2-when-picked-up enhancements.** The full product-metadata / multi-campaign-display experience is unbuilt by product choice; the single "on selected products!" line is the intended current state. Display-shortfall findings are reframed as tracked product gaps, with the technical detail preserved.
5. **Magento is folded into one item (PSC-18).** The plugin is used by nobody, kept only in case, was developed blind and has never been tested. It needs a full dedicated review before any merchant uses it, not piecemeal fixes now.

Severity is technical and unchanged. Priority is the schedule. A finding can be High and P2 at the same time — that is the point of the two columns.

## Findings at a glance

| ID | Severity | Priority | Area | One-line finding | Status (2026-09-04) |
|---|---|---|---|---|---|
| PSC-4 | High | P2-when-picked-up | Listener / display | *Known product gap.* With no product context every scoped campaign "matches", so the headline advertises a reward the cart cannot earn | **Open.** P2, unchanged. Blast radius reduced: shipped plugins now send `sku` (PSC-6) |
| PSC-7 | Medium | P1-next | Ingest | SKU matching is byte-exact and case-sensitive with no normalisation, validation or merchant feedback | **Deferred by owner.** No merchant has used the feature yet; normalisation waits for real usage and feedback, since some legacy systems may treat SKU case as significant |
| PSC-10 | Medium | P2-when-picked-up | Business wizard | Tiered rewards on a matched-items basis still label their ranges "Basket Range" | **Open.** P2, unchanged |
| PSC-11 | Medium | P2-when-picked-up | Business wizard | `AdvancedScopeNotice` drops group `logic` and operand values, inverting the meaning of a `none` scope | **Open.** P2, unchanged |
| PSC-18 | Medium | P2-when-picked-up | Magento (folded) | **Folded item.** Magento is unused, untested and developed blind — needs a full dedicated review before any merchant uses it | **Open.** P2, untouched by design. Magento remains the one provider off the PSC-2 line-total convention |
| PSC-19 | Medium | P2-when-picked-up | Tests | Backend `formatted=1` tests re-implement the handler instead of invoking it | **Open.** P2 / Low |
| PSC-21 | Medium | P2-when-picked-up | Schema | `campaign_rules.rule` is bare `jsonb`; every scope invariant lives only in the service layer | **Open.** P2 / Low |
| PSC-22 | Low | P2-when-picked-up | Migrations | `drizzle/v2` baseline lacks `purchase_items.sku` (latent, nothing routes to `_v2`) | **Open.** P2. Deliberately untouched — `services/bootstrap/drizzle` is DB-team territory |
| PSC-23 | Low | P2-when-picked-up | Tests | `CampaignInfoSection` duplicates `RewardBreakdown` basis logic with no test at all | **Open.** P2 |
| PSC-24 | Low | P2-when-picked-up | SDK | `matchedProducts: undefined` conflates "no context" with "scope matched none" | **Open.** P2 |
| PSC-25 | Low | P2-when-picked-up | Fixtures | Golden corpus is a change-detector; `GoldenFixtures.REWARDS`/`.rewards` referenced by nobody | **Open.** P2. The new scope-match corpus is hand-written and load-bearing on both sides, so it does not repeat this failure |
| PSC-26 | Low | P2-when-picked-up | Display | *Known product gap.* Tier ranges for `purchase.matchedQuantity` render as currency | **Open.** P2 |
| PSC-28 | Low | P2-when-picked-up | Docs | Plan docs describe a business app and XSS sinks that no longer exist | **Open.** P2. `services/backend/docs/product-scoped-campaigns.md` was brought in step as part of this work; the plan docs were not |

**Priority legend** — `P0-now` fix immediately · `P1-next` fix in the next pass · `P2-when-picked-up` real but not scheduled, revisit when the feature is picked up · `Accepted-risk` consciously accepted, not to be fixed. No finding in this report is `Accepted-risk`.

## High findings

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

## Medium findings

**PSC-7 (P1-next · deferred by owner) - Exact, case-sensitive SKU matching with no feedback.** `RuleConditionEvaluator.evaluateOperator` uses `===` and `Array.includes`; no `toLowerCase`/`trim` exists on the ingest side (`customWebhook.ts`, `wooCommerceWebhook.ts`, `magentoWebhook.ts`, `shopifyWebhook.ts` all pass `item.sku` verbatim). A merchant typing `shoe-42` against a `SHOE-42` catalog publishes a campaign that can never match, with no warning and no validation against observed purchase history. The negative case is worse: a mis-cased **exclusion** leaves the item *in* the matched set, and since negation forces a matched-items basis, the reward is paid on the loss-leader the exclusion existed to protect. Pick a convention (case-fold at ingest and publish, or keep exact and add explicit copy plus a pre-publish SKU check) and enforce it on both sides.

**PSC-10 (P2-when-picked-up · known product gap) - "Basket Range" label on a matched-items basis.** *Business-app authoring/display copy, so it moves with the display work rather than blocking go-live. The mis-labelling is real and the description below stands; it is scheduled with the wizard's display pass.* `RewardCampaign/utils.ts` sets `tierField = "purchase.matchedAmount"` when `rewardBasis === "matchedItems"`, but `RewardCampaign/index.tsx:861` unconditionally renders `campaigns.create.reward.tiered.basketRange` ("Basket Range ({{glyph}})"); no `_matched` variant exists in either locale. A merchant authoring "0-50 € → 5 %" believes those are order-value bands; on a 200 € order with 30 € of scoped product, tier 1 applies. Directly wrong money, in exactly the configuration the negation guard forces. Add a `tiered.matchedRange` key (en+fr), switch on `rewardBasis`, mirror in `ValidationCampaign`.

**PSC-11 (P2-when-picked-up · known product gap) - `AdvancedScopeNotice` inverts a `none` scope.** *Business-app display surface. Real and user-visible, deferred with the rest of the display work; the fix is to reuse the already-correct `ProductScopeChip`.* It discards the wrapper's `logic` and never renders the operand:

```tsx
{"field" in condition ? `${condition.field} ${condition.operator}` : condition.logic}
```

`{ logic: "none", conditions: [{ sku eq "CHEAP" }] }` renders as the chip **`sku eq`** — read as "only SKU CHEAP" when it means "everything except CHEAP", with no clue which SKU. The existing test asserts this output, enshrining it. `ConfigTab.tsx`'s `ProductScopeNodes`/`ProductScopeChip` already does this correctly (group polarity, translated field, `between`'s `valueTo`); the wizard rolls a second, worse humaniser. Reuse the correct one.

**PSC-18 (folded) - Magento: unused, untested, developed blind — needs a full dedicated review, not piecemeal fixes.** *Priority: P2-when-picked-up.*

**Owner decision (2026-08-15):** the Magento plugin is **used by no merchant**, is kept only in case one asks, was **developed blind** against no live Magento instance, and has **never been tested** against one. It therefore gets **one** finding rather than a scattered list, and the correct action is a full dedicated review before any merchant is allowed to enable it — not fixing individual defects now, which would create the false impression the plugin has been validated.

**This item absorbs every Magento-specific finding in this audit.** The concrete defects found, retained here so the eventual review has a starting checklist rather than a blank page:

- **Empty-SKU divergence (the original PSC-18).** `plugins/magento/Model/WebhookSender.php:100` always emits `"sku" => (string) $item->getSku()`, while WooCommerce (`class-frak-wc-webhook-registrar.php:483`) and PrestaShop (`FrakOrderResolver.php:116`) omit the key when empty. These are **not** equivalent downstream: `""` satisfies `exists`, `neq "CHEAP"` and `not_in ["CHEAP"]`, so a Magento item with no SKU joins the matched set of any negated scope while a WooCommerce item does not. This contradicts the documented "items without it never match SKU conditions" (see the doc-drift table).
- **Tax-basis divergence (from PSC-2).** Magento's `$item->getPrice()` is tax-**exclusive** where PrestaShop's `unit_price_tax_incl` is tax-**inclusive**, so the same campaign pays materially differently per platform. Settling one tax convention across the plugins is part of PSC-2's fix; the Magento side of that convention lands in this review.
- **No display `products` attribute at all (from PSC-6).** Magento emits no `products` array, so live product context is not merely SKU-less but entirely absent on this platform. PSC-6's two-line fix covers WooCommerce and PrestaShop only.
- **`getSku()` semantics on configurable products are unverified.** Whether `getSku()` on a configurable parent returns the parent or the child SKU decides whether variant scoping — the canonical use case for this feature — works on Magento at all. This was not measurable without a live instance and remains an open question, not a known-good behaviour.

**Why one item and not four** Fixing these individually would leave the plugin looking audited while its fundamental risk — that nothing in it has ever run against real Magento — is untouched. The review must be end-to-end and instance-backed.

**Superseded IDs** No other PSC ID is retired by this fold. PSC-2 and PSC-6 kept their own IDs and scope and are now closed for WooCommerce, PrestaShop and Shopify; their Magento portions were never in scope and land here instead. Existing IDs stay stable so external references remain valid.

**PSC-19 (P2-when-picked-up) - Backend `formatted=1` tests re-implement the handler.** In `services/backend/src/api/user/merchant/index.test.ts`, the mapping cases call `selectBestReward(...)` directly and rebuild `{ rewards, ...(best && { best }) }` in the test — a copy of the handler. `userMerchantApi.handle` is never invoked in that describe. If the handler stopped passing `products: decodeProductsQueryParam(products)` into `selectBestReward`, all cases still pass; the comment claiming to prove "`products` actually reached `selectBestReward`" proves it reached it *in the test*. The `?products=` → decode → select wiring is the untested part. Drive the assertions through the real handler.

**PSC-21 (P2-when-picked-up) - The schema encodes none of the scope invariants.** `campaign_rules.rule` is bare `jsonb` with a TypeScript-only `$type<>`; the field allowlist, depth/node caps, operator/value typing and the negation⇒matched-basis rule live exclusively in `CampaignManagementService`. Anything writing outside that service can plant a rule the evaluator will run. Separately, the plan's "cheap fix while in here" was not done: `CampaignRuleRepository.ts:221` still reads `"name" | "priority" | "rule" | "budgetConfig" | "expiresAt"` with no `"metadata"`, and `CampaignManagementService.ts:337` still launders the resulting error through `as Parameters<typeof this.campaignRuleRepository.update>[1]` — a typed cousin of the banned `as any`, sitting on the write path for money-shaped JSON. Adding `"metadata"` to the `Pick<>` and deleting the cast is a one-line, no-behaviour-change fix.

## Low findings

**PSC-22 (P2-when-picked-up) - `drizzle/v2` is a stale baseline, not a missing column.** The finding was written as "`purchase_items` has no `sku`"; re-read on 2026-09-04 it is structural. `drizzle/v2/0000_lonely_stryfe.sql` is the only file in the folder and creates **17** tables against **32** in the `dev` snapshot — the gap is whole tables (`install_codes`, `referral_codes`, and everything since), not one column. `migrate-pg.ts:19` and `drizzle.config.ts:9` still route any schema ending `_v2` there and `services/bootstrap/AGENTS.md` still advertises it, but nothing deploys to it: `infra/gcp/secrets.ts` sets `public` and `infra/gcp/dev.ts` sets `local`. Regenerating is not worth it for a target with no consumer — delete the folder and the two routing branches, and strike the mention from `AGENTS.md`. That closes this by removal. Untouched by the 2026-09-04 batch on purpose: `services/bootstrap/drizzle` is DB-team territory.

**PSC-23 (P2-when-picked-up) - `CampaignInfoSection` has no test.** It duplicates `RewardBreakdown`'s matched-basis branches independently, down to identical comments, but `RewardBreakdown.test.tsx` covers all four cases and `CampaignInfoSection` covers none — despite being the surface the plan calls the primary product-scope render target. Extract the basis→(copy key, example) decision into one helper, or port the four cases.

**PSC-24 (P2-when-picked-up) - `matchedProducts: undefined` is overloaded.** `matchedProductsFor` returns `undefined` for both "no product context" and "scoped winner, nothing matched", collapsing the state the feature exists to communicate. The wire comment documents only the first case. Return `[]` for the second. Note nothing renders `matchedProducts` today — it is shipped API surface awaiting the display phase.

**PSC-25 (P2-when-picked-up) - The golden corpus is a change-detector.** Every expectation in `golden-rewards.json` is produced by calling the implementation under test, and the TS suites replay the same functions against those outputs. The cross-implementation value was meant to come from the natives, but `GoldenFixtures.REWARDS` (Kotlin) and `GoldenFixtures.rewards` (Swift) have **zero** references — confirmed by grep across `sdk/android` and `sdk/ios`, and stated outright in `next.md`. Additionally no CI job regenerates and diffs the corpus, so an expectation change is silent. The same two dead constants are the native audit's NSD-16; close them together. Note the scope-match corpus added for PSC-16 does **not** repeat this failure — it is hand-written and asserted from both suites. (One auditor claimed 69 entries against the docs' 67; the actual count is **67** — the docs are correct and that finding is withdrawn.)

**PSC-26 (P2-when-picked-up · known product gap) - Quantity tiers render as currency.** *Display surface, unreachable from the wizard today.* `RewardBreakdown.tsx` and `CampaignInfoSection.tsx` both call `formatAmount(tier.minValue)` regardless of `tierField`, so a `purchase.matchedQuantity` tier of "2-5 items" renders "2-5 €". Both renderers also print a raw `min` beside a formatted `max` (`10–100 €`), independent of the currency-vs-quantity conflation. Unreachable from the wizard, reachable via the API. Branch the range renderer on `tierField`, and format both bounds.

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
| `matchesProductScope.test.ts` (operator parity) | SDK↔backend operator parity | Now does (PSC-17). An outcome table where the fail-open default is the wrong answer, over a derived operator list, so a new operator fails the completeness test |
| `api/user/merchant/index.test.ts` (`formatted=1`) | `?products=` reaches `selectBestReward` | Nothing about wiring (PSC-19). Re-implements the handler in the test |
| `golden-rewards.json` consumers | Cross-implementation conformance | Change detection only (PSC-25). Expectations generated by the code under test; native constants unreferenced. The separate scope-match corpus added for PSC-16 is hand-written and does carry cross-implementation weight |
| `CampaignManagementService.test.ts` (negation) | Publish guard is sound | Genuinely does. Six cases incl. nested negated leaf, `logic:"none"`, and a negative control |
| `RewardBreakdown.test.tsx` | Basis copy is correct | Does for `RewardBreakdown`; three of its cases are functionally identical, and one is named for scope state the component cannot see. `CampaignInfoSection` is untested (PSC-23) |
| `ProductsCampaign.test.tsx` | The products step works | Sub-components only, which is why PSC-1 survived. The persist path is now covered where it matters: the new `useSaveCampaign` tests assert the payload handed to `updateCampaign`, not the local store |
| `httpsUrl.test.ts` | Write-path URL validation | Genuinely does, through the real Elysia validator. Model for the rest |

The structural gap this audit found: **coverage was strong at the pure-function layer and absent at every boundary**. Every confirmed high/critical finding lived at one — form→payload (PSC-1), item→DB (PSC-3), plugin→SDK (PSC-6), component→listener (PSC-5), calculator→order total (PSC-2) — and no test crossed any of them. The 2026-09-04 batch closed the findings and added boundary tests at four of the five; the plugin→SDK hop is still asserted only on the PHP side, since no test installs a plugin against a store.

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
| `product-scoped-campaigns.md` §SKU plumbing | "items without a SKU never match SKU conditions — graceful degradation" | True for WooCommerce and PrestaShop, which now omit an empty `sku`. Still false for Magento, whose `(string) $item->getSku()` sends `""` — which satisfies `exists`, `neq` and `not_in` (PSC-18) | **half true** |
| `product-scoped-campaigns.md` | "`matchedAmount` is fiat in the order currency, like `purchase.amount`" | Now true and documented: one post-discount, tax-inclusive line basis, clamped to `purchase.amount` | **fixed** |
| `product-scoped-campaigns.md` | "the same array drives both the sharing-page cards and reward selection" | Now true for WooCommerce and PrestaShop, and the doc names Magento as the exception | **fixed** |
| `matchesProductScope.ts` (in-code) | `compare` "mirrors the backend's `compareValues`" | Both sides align on `!= null`, asserted from a shared corpus in both suites | **fixed** |
| `ProductsCampaign/index.tsx` | "`MAX_VALUES = 50` mirrors the backend's `PRODUCT_SCOPE_MAX_NODES`" | That constant counts *nodes*; 50 values is 1 node. The backend caps array length nowhere | **false** |
| `frakContext.ts` (in-code) | `update` "returns null on failure" | Now true: all three `new URL` sites go through a guard that returns null | **fixed** |
| `native-sdk/contract.md:146`, `next.md:82` | "67 entries across 6 kinds" | Verified 67 — accurate | **true** |

## Recommended next actions

*Everything that was P0 or P1 is closed. What follows is the remaining work, in the order it makes sense to take it — none of it is scheduled, and none of it blocks a merchant enabling the feature.*

### Blocking a deploy, not a finding

1. **Take the `purchase_items` migration through local → dev → QA → prod.** The reference DDL, the safety argument and the lock-window note are in `docs/plans/purchase-items-line-key-migration.md`. The backend on this branch writes `total_price` and uses the new constraint as its `ON CONFLICT` arbiter, so it cannot ship ahead of the schema. Owned by the DB team. Also decide the unrelated pending prod drift the generation surfaced (`install_codes` columns and check constraint, a `purchase_claims` index).

### Waiting on a merchant

2. **Decide the SKU normalisation convention** — case-fold at ingest and publish, or keep exact matching and add explicit copy plus a pre-publish SKU check. Closes PSC-7. Deferred on purpose until a real catalogue is in play. **M**

### P2-when-picked-up — schedule with the display/product work

3. **Display surfaces, as one body of work when product picks the feature up.** Prefer unscoped campaigns when product context is absent or qualify the headline (PSC-4); add a `tiered.matchedRange` label and switch on `rewardBasis` (PSC-10); reuse `ProductScopeChip` in `AdvancedScopeNotice` (PSC-11); branch the tier-range renderer on `tierField` and format both bounds (PSC-26); return `[]` rather than `undefined` for "scoped winner, nothing matched" (PSC-24). **M-L**
   *These are tracked product gaps, not defects. The single "on selected products!" line is the intended state until this work is scheduled.*
4. **Magento: full dedicated instance-backed review** before any merchant is allowed to enable it. Closes PSC-18 and its absorbed items. It is the one provider still off the PSC-2 line-total convention and the one still sending `""` for an absent SKU. **M-L** — *not piecemeal fixes; see PSC-18.*
5. **Housekeeping**: add `"metadata"` to the repository `Pick<>` and delete the cast (PSC-21); delete `drizzle/v2` and its two routing branches (PSC-22); wire or delete the native golden loaders, together with the native audit's NSD-16 (PSC-25); test `CampaignInfoSection` (PSC-23); drive the `formatted=1` tests through the real handler (PSC-19); bring the three plan docs in step with the tree (PSC-28). **S each**


## Resolution 2026-09-04

Branch `chore/audit-findings`. Every P0/P1 finding is closed except PSC-7 (owner-deferred). Work ran as six parallel lanes, then two review rounds and three fix rounds; each review round found defects in the previous round's fixes, including two money defects introduced by the fix for PSC-3.

**Verification.** biome, `bun run lint` (comment budget, i18n, iOS floor), per-package typecheck, backend 1267/1267, sdk/core + sdk/components + wallet-shared + apps/business 2887/2887. Behaviour changes were mutation-checked — the fix was reverted and the new test confirmed red — not merely observed green.

### Corrections to this audit

Three claims in this document were wrong, and the code follows the evidence rather than the text. The findings themselves are deleted above, so each correction restates what was claimed.

- **PSC-2's diagnosis holds only for Shopify.** WooCommerce's REST serializer computes `line_items[].price` as `get_total() / quantity`, which is already **post-discount**; the real gap there is **tax** (line ex-tax against an order total inc-tax), which *under*states rather than overpays. PrestaShop already sent `unit_price_tax_incl`. Only Shopify's `price` is genuinely pre-discount, so "systematic overpay on every discounted order" was true for one of three providers. The fix — one tax-inclusive, post-discount basis — is right for all three regardless. This wrong diagnosis had already propagated into two merchant-facing plugin changelogs before it was caught.
- **PSC-14's prescription is wrong.** It asks for `valueTo > value`. The evaluator's `between` is inclusive on both ends, so `between 50 and 50` means "exactly 50" and is satisfiable; rejecting it at publish is the same defect with the sign flipped, and it fails loudly at the merchant with a message that is untrue. The rule is `valueTo >= value`. Found by mutation-testing an untested boundary.
- **PSC-5's trigger is misattributed.** The WordPress shortcode's `sharing_url => ''` default is not a trigger: `build_html_attrs()` skips empty values, so no attribute is emitted and the fallback works. The real source is `merchantDomain` arriving as a bare host from the backend. The SDK guard was still needed; the plugin blame was not.

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

- **Adoption status is owner-supplied, not measured.** "No merchant currently uses this feature" comes from the product owner and was never verified against production data. Every priority in this document depended on it. It mattered most while PSC-2 and PSC-3 were open — a live merchant would have made them P0 the same day — and it now matters for the reverse reason: if orders were already paying on the old basis, the fix changes payout amounts for them, and the migration needs a backfill decision rather than a clean cutover.
- **Not executed, then or since:** no live Postgres. The PSC-3 truncation, the new line constraint, the reconciliation SQL and PSC-22's `v2` failure are all reasoned from schema and rendered SQL, never observed against a database — the DB team's `local` migration step is the first real execution. No query was run against production `purchase_items` to see whether duplicate-`product_id` truncation already occurred in real data, which decides whether a backfill is needed alongside the migration; that is still the single highest-value next measurement.
- **Platform API semantics taken from documentation, not captured payloads:** whether Shopify `line_items[].price` is pre-discount for the merchants actually live (PSC-2), the tax treatment of WooCommerce REST `line_items[].price`, whether PrestaShop `product_reference` carries the *combination* reference (which decides whether variant scoping works on PS at all), and whether Magento `getSku()` on a configurable parent returns parent or child. Each materially affects PSC-2/PSC-3/PSC-18.
- **Not run at audit time:** React/DOM suites, wrongly blamed on a broken local install — the real cause was `NODE_ENV=production`, under which React resolves its production build and omits `act`. They run fine, and the 2026-09-04 batch executed them, but PSC-10 and PSC-11 still rest on reading the components and their locale files.
- **`localeCompare` across ICU builds** (browser SDK vs Bun backend) was not measured — a theoretical `gt/lt/between` divergence on `name` that no shipped authoring surface currently produces.
- **Not examined:** the native Android/iOS reward decoders beyond confirming they consume `matchedProducts` and do not load the rewards corpus; the post-publish edit surface (`useUpdateCampaignConfig`'s payload construction, specifically whether it round-trips full cached `metadata`); campaign list/detail read paths outside `ConfigTab`; the `EstimatedRewardService` estimate path beyond the min/max truthiness bug noted under PSC-9.
- **Dark corner for the next auditor:** every confirmed high-severity defect sits at a boundary between two layers, and no test in this feature crosses a boundary. Assume any *other* untested boundary in this scope is also wrong until measured.
