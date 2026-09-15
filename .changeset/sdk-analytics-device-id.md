---
"@frak-labs/core-sdk": patch
---

Key OpenPanel on the SDK's anonymous id, and stop auto-tracking partner pages.

SDK events now carry `__deviceId` set to the persistent anonymous client id, overriding OpenPanel's own device derivation (project + IP + user agent, rotated daily). The listener, the SSO popup and the standalone `/sharing` + `/install` pages resolve the same id, so a funnel can span the partner page, the iframe and the wallet instead of depending on an IP and user agent staying identical for under a day. As a side effect the wallet origin no longer collapses every merchant's visitors into one anonymous profile.

`trackScreenViews` and `trackOutgoingLinks` are now off. Both collected the merchant's own traffic rather than referral signal: `sdk_initialized` already fires once per page load, and `banner_impression` / `post_purchase_impression` are the correct denominators for CTA funnels. `trackAttributes` stays off — `data-track` would let partner markup choose event names and ship arbitrary `data-*` values.

Note that SDK events no longer carry a populated `__path`: the web SDK only sets it from a screen view. Merchant attribution is unaffected (`merchant_id` and `domain` are global properties), and component events still carry `placement`.
