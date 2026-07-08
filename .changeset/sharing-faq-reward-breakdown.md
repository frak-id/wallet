---
"@frak-labs/core-sdk": minor
---

Expose the raw per-audience rewards on `selectBestReward` / `BestReward`. The result now carries `referrerReward`, `refereeReward`, and the unformatted `minPurchaseValue` alongside the existing formatted fields, so surfaces can render a full reward breakdown (tier rows, percentage worked-examples) instead of just the headline amount.
