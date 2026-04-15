---
"@frak-labs/core-sdk": major
---

### Breaking changes

- **Removed `fetchMerchantId`, `resolveMerchantId`, and `clearMerchantIdCache`** — Merchant resolution is now handled by the new `sdkConfigStore`. Use `sdkConfigStore` and `clearAllCache` instead.
- **Removed `HandshakeResponse` client lifecycle event** — Replaced by the new `ResolvedConfigEvent` (`"resolved-config"`), which carries richer data including `merchantId`, `domain`, `allowedDomains`, `sourceUrl`, and optional `sdkConfig`.
- **`LocalizedI18nConfig` no longer accepts CSS URL strings** — Only inline `{ [key: string]: string }` objects are supported. URL-based i18n (`\`${string}.css\``) has been removed.
- **`config.metadata.name` is now optional** — The `name` field in `FrakWalletSdkConfig.metadata` is no longer required; it can be resolved from backend config.
- **IFrame client handshake refactored** — The client now resolves merchant config client-side (via `sdkConfigStore`) before sending a `resolved-config` event to the iframe, replacing the previous server-driven handshake flow.
