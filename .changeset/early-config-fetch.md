---
"@frak-labs/core-sdk": patch
---

`setupClient` starts the merchant config fetch before the wallet iframe loads, so a cold or stale-cache start no longer waits for the iframe `load` event.
