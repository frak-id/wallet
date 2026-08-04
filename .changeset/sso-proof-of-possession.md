---
"@frak-labs/core-sdk": minor
---

SSO now carries a `frak-sso-v1` proof-of-possession for the anonymous client id.

`openSso` signs the id it puts in the SSO URL, so the wallet can verify ownership before merging that identity into the wallet a user logs into or registers. Previously the id travelled unsigned and was trusted on arrival.

The proof is always optional: clients with no key (pre-derivation ids) simply omit it and SSO works exactly as before.
