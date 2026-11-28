---
"@frak-labs/core-sdk": minor
"@frak-labs/components": minor
---

Estimated rewards of a subscription campaign carry an optional `subscription` block: the rewards of each range of plan steps (`steps`, step 1 being the first payment), and what earns the steps after the first payment (`stepBy`: each paid cycle, each amount paid, or each period subscribed; absent means cycle). `selectBestReward` ranks such a campaign by its whole plan. Its `formatted` stays a bare amount or percentage, and the new `upTo` flag lets a surface word it: the web components now read "up to 30 €" / "jusqu'à 30 €" in the page language.
