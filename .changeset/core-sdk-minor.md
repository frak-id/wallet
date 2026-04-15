---
"@frak-labs/core-sdk": minor
---

### New features

- **New actions**: `displaySharingPage`, `getMergeToken`, `getUserReferralStatus`, and `setupReferral` (with `REFERRAL_SUCCESS_EVENT` constant).
- **New RPC methods**:
  - `frak_displaySharingPage` — Display a sharing page with product info and sharing buttons. Resolves on first user action (share/copy).
  - `frak_getUserReferralStatus` — Get the current user's referral status on this merchant. Returns `null` when identity cannot be resolved.
  - `frak_getMergeToken` — Get a merge token for the current anonymous identity, used by in-app browser redirect flows to preserve identity across WebView → system browser transitions.
- **Updated RPC methods**:
  - `frak_displayModal` — Now accepts an optional `placement` parameter.
  - `frak_displayEmbeddedWallet` — Now accepts an optional `placement` parameter.
  - `frak_prepareSso` / `frak_openSso` — `name` parameter is now optional.
  - `frak_sendInteraction` — `sharing` interaction type now accepts `sharingTimestamp` (epoch seconds for backend correlation) and `purchaseId` (merchant order ID linking sharing to a purchase).
- **New types**: `DisplaySharingPageParamsType`, `DisplaySharingPageResultType`, `SharingPageProduct`, `UserReferralStatusType`, `MerchantConfigResponse`, `ResolvedPlacement`, `ResolvedSdkConfig`, `SdkResolvedConfig`.
- **Caching system**: New `withCache` utility with LRU map for inflight deduplication and SWR-style caching. Exposed via `withCache`, `getCache`, and `clearAllCache`.
- **In-app browser utilities**: `isInAppBrowser`, `isIOS`, and `redirectToExternalBrowser` for detecting and escaping in-app browsers.
- **`sdkConfigStore`**: Centralized store for resolving and caching merchant/SDK configuration with cache-scoping by domain and language.
- **`waitForBackendConfig` option**: New config flag to control whether components wait for backend config before rendering.
- **New DOM event model**: `setupReferral` dispatches a `"frak:referral-success"` event on `window` when a valid referral context is found in the URL and successfully tracked. Components (e.g. `<frak-banner>`) listen for this to display referral success state.
- **Iframe lifecycle events**:
  - New `"resolved-config"` client→iframe event carries the full resolved context (`merchantId`, `domain`, `allowedDomains`, `sourceUrl`, `sdkConfig`) to the iframe.
  - `"redirect"` event now supports `openInNewTab` flag for opening URLs in a new tab via `window.open(_blank)` with user activation delegation (Safari popup support).
