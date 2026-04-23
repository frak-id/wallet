---
"@frak-labs/core-sdk": patch
---

Extend `FrakContextV2` to carry an optional wallet address (`w`) and make the anonymous clientId (`c`) optional. A valid V2 context now only requires `m` (merchantId) + `t` (timestamp) plus at least one sharer identifier (`c` or `w`). When the sharer is authenticated, the wallet becomes the preferred identity signal — global, WebAuthn-bound, and durable across localStorage clears. `processReferral` self-referral detection and URL replacement (`alwaysAppendUrl`) prefer wallet match over clientId when both are available. `w` is validated with `isAddress()` on both compress and decompress to guard `isSelfReferral` against crafted URLs.

**Privacy note:** wallet addresses now appear in `fCtx` URL payloads, outbound share events, and SDK analytics (`user_referred_started`). The `ref` UTM param is intentionally kept clientId-only and never falls back to wallet.

**Backend observers:** the `referral` interaction V2 source_data now carries an optional `referrerWallet` field alongside `referrerClientId` / `referrerMerchantId`. Downstream indexers and analytics consumers should treat `referrerWallet` as the strongest referrer identity when present.
