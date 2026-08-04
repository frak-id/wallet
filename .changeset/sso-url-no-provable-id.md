---
"@frak-labs/core-sdk": patch
---

Fix `prepareSsoUrl()` (and `openSso()` through it) rejecting on browsers where no provable client id can be derived.

Client id derivation needs WebCrypto and `localStorage`; when either is unavailable — Safari with all cookies blocked, for instance — it rejects rather than resolving `undefined`. `prepareSsoUrl()` propagated that, so `openSso()` rejected instead of opening SSO. It now degrades like every other action: the URL is built without a client id and without a proof, SSO opens, the user logs in, and only the anonymous-to-wallet identity link is dropped.
