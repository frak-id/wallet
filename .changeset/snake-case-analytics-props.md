---
"@frak-labs/core-sdk": patch
---

Normalise OpenPanel analytics property keys to snake_case so they match the per-event convention (`merchant_id`, `flow_id`, `has_reward`) already used elsewhere in the codebase and by the backend filters. Renamed: `merchantId` → `merchant_id`, `sdkVersion` → `sdk_version`, `userAnonymousClientId` → `user_anonymous_client_id`, `referrerClientId` → `referrer_client_id`, `referrerWallet` → `referrer_wallet`, `walletStatus` → `wallet_status`. Fixes the backend's `properties.merchant_id` filter silently missing every SDK-emitted event (banner_impression, post_purchase_impression, share_button_clicked, sdk_initialized, sdk_iframe_connected, sdk_iframe_handshake_failed, user_referred_started).
