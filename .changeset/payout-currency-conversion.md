---
"@frak-labs/core-sdk": minor
---

A reward can now say which fiat it is really paid in. `MerchantReward` gains an optional `payoutCurrency` (the fiat the reward token is pegged to), and `@frak-labs/core-sdk/rewards` exports `getPayoutConversion(reward, { displayCurrency, payoutCurrency, locale })`, which returns the payout amount and the exchange rate when that differs from the display currency, or `undefined` when nothing is converted. `selectBestReward` exposes the same result as `conversion` and takes a `locale` option (a malformed tag falls back to each currency's own locale). `buildPercentageExample` takes an optional display currency for its min/max caps. `getSupportedLocale` is now exported next to `getSupportedCurrency`. The `formatted` reward strings are unchanged.
