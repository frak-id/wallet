---
"@frak-labs/core-sdk": patch
---

A second `setupClient` call now detaches the client bound to the `#frak-wallet` iframe it replaces, at once. Before, that client kept its listeners and its proof refresh timer until its next refresh, and its in-flight requests stayed pending until then.
