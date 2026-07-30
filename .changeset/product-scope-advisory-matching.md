---
"@frak-labs/core-sdk": minor
"@frak-labs/components": minor
---

Advisory client-side `productScope` matching and product-context-aware reward display, for merchant pages that know the product currently on display (e.g. a product page).

- New `matchesProductScope(scope, product)` in `@frak-labs/core-sdk/rewards`: an advisory (display-hint only, never eligibility-gating), fail-open evaluator for the backend's allowlisted `productScope` fields (`productId`, `name`, `sku`, `quantity`, `unitPrice`, `totalPrice`). The backend's `RuleConditionEvaluator` remains the sole authority on which purchases actually earn a reward.
- `selectDisplayCampaign` / `selectBestReward` accept an optional `product` option: when provided, a `productScope`d campaign that doesn't match the product is deprioritized below every campaign that does (ranking is otherwise unchanged, and omitting `product` reproduces the exact previous behavior).
- New `isMatchedItemsBasis(reward)` in `@frak-labs/core-sdk/rewards`: whether a reward's value is computed over the `productScope`-matched line items (`percentOf: "matched_items_amount"`, or a `purchase.matchedAmount` / `purchase.matchedQuantity` `tierField`) rather than the whole basket. Distinct from a campaign merely carrying a `productScope` — a scoped campaign can still pay a percentage of the whole basket. Reward surfaces use it to render "% of eligible products" instead of "% of basket", and to suppress the basket-based worked example, which is meaningless on a matched-items basis.
- The operator classification sets (`SCALAR_OPERATORS`, `ARRAY_OPERATORS`, `STRING_OPERATORS`, `EXISTENCE_OPERATORS`, `NEGATIVE_OPERATORS`) are now exported from `@frak-labs/core-sdk/rewards` as the single source of truth for which operand shape each `ConditionOperator` takes.
- Numeric `productScope` comparisons (`gt`/`gte`/`lt`/`lte`/`between`) now compare numerically whenever both operands are numeric, including when one is a numeric string (`"79.90"`, or a `product-price` HTML attribute). Previously these fell back to a lexicographic compare, which ranked `"9"` above `"10"`.
- `<frak-button-share>`, `<frak-banner>`, and `<frak-post-purchase>` gain optional `product-id` / `product-sku` / `product-price` attributes (and matching JSX props) that build the product context and pass it through to reward selection.
