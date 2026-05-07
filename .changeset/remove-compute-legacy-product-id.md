---
"@frak-labs/core-sdk": patch
---

Remove the `computeLegacyProductId` utility from the public API. It was only consumed internally by `openSso` (popup mode), where its return value (`keccak256(toHex(domain))`) was being passed as the SSO `merchantId` — but the backend `auth/login` endpoint validates `merchantId` as a UUID and silently drops the field, so the value never had any effect. `openSso` now resolves the real merchant UUID via `sdkConfigStore.resolveMerchantId()`, matching `frak_openSso`'s redirect-mode handler in the wallet listener and the existing `trackPurchaseStatus` / `ensureIdentity` flows.
