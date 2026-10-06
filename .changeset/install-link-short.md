---
"@frak-labs/core-sdk": patch
---

`getInstallUrl` returns a shorter link: the `/i` path, 22-character ids instead of 36-character UUIDs, and no `a=` when a proof is attached, since the wallet reads the anonymous id from the proof. A typical credentialed link drops from about 295 to 236 characters, which makes for a sparser QR code. Treat the returned URL as opaque.

`@frak-labs/core-sdk/identity` also exports the codec behind those ids: `compactUuid` turns a UUID into its 22-character form, and `expandCompactUuid` turns it back.
