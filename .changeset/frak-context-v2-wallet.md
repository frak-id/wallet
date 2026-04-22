---
"@frak-labs/core-sdk": patch
---

Extend `FrakContextV2` to carry an optional wallet address (`w`) and make the anonymous clientId (`c`) optional. A valid V2 context now only requires `m` (merchantId) + `t` (timestamp) plus at least one sharer identifier (`c` or `w`). When the sharer is authenticated, the wallet becomes the preferred identity signal — global, WebAuthn-bound, and durable across localStorage clears. `processReferral` self-referral detection prefers wallet match over clientId when both are available.
