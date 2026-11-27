---
"@frak-labs/core-sdk": patch
---

Return visits no longer re-derive the anonymous identity's public key before creating the wallet iframe: it is stored next to the private key and reused for that exact key.
