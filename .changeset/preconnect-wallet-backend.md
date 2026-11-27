---
"@frak-labs/core-sdk": patch
---

`createIframe` preconnects the wallet and backend before deriving the client id, and the wallet hint no longer carries `crossorigin`, which put it in a socket pool the iframe navigation never uses.
