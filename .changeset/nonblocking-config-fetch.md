---
"@frak-labs/core-sdk": patch
---

`setupClient` no longer waits for the merchant config fetch when a cached config was already sent to the wallet iframe. The fresh config is still applied and sent when it arrives.
