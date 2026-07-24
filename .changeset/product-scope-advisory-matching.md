---
"@frak-labs/core-sdk": minor
"@frak-labs/components": minor
---

Advisory client-side `productScope` matching and product-context-aware reward display, for merchant pages that know the product currently on display (e.g. a product page).

- New `matchesProductScope(scope, product)` in `@frak-labs/core-sdk/rewards`: an advisory (display-hint only, never eligibility-gating), fail-open evaluator for the backend's allowlisted `productScope` fields (`productId`, `name`, `sku`, `quantity`, `unitPrice`, `totalPrice`). The backend's `RuleConditionEvaluator` remains the sole authority on which purchases actually earn a reward.
- `selectDisplayCampaign` / `selectBestReward` accept an optional `product` option: when provided, a `productScope`d campaign that doesn't match the product is deprioritized below every campaign that does (ranking is otherwise unchanged, and omitting `product` reproduces the exact previous behavior).
- `buildPercentageExample` accepts an optional real product price so a scoped `matched_items_amount` percentage reward's worked example uses the actual product price instead of a fictional reference basket.
- `<frak-button-share>`, `<frak-banner>`, and `<frak-post-purchase>` gain optional `product-id` / `product-sku` / `product-price` attributes (and matching JSX props) that build the product context and pass it through to reward selection.
