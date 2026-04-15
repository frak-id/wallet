# @frak-labs/core-sdk

## 1.0.0

### Major Changes

- [#143](https://github.com/frak-id/wallet/pull/143) [`c7bbb51`](https://github.com/frak-id/wallet/commit/c7bbb5179dd8d04d5b99f573727f15fbe36c0822) Thanks [@KONFeature](https://github.com/KONFeature)! - ### Breaking changes

  - **Removed `fetchMerchantId`, `resolveMerchantId`, and `clearMerchantIdCache`** — Merchant resolution is now handled by the new `sdkConfigStore`. Use `sdkConfigStore` and `clearAllCache` instead.
  - **Removed `HandshakeResponse` client lifecycle event** — Replaced by the new `ResolvedConfigEvent` (`"resolved-config"`), which carries richer data including `merchantId`, `domain`, `allowedDomains`, `sourceUrl`, and optional `sdkConfig`.
  - **`LocalizedI18nConfig` no longer accepts CSS URL strings** — Only inline `{ [key: string]: string }` objects are supported. URL-based i18n (`\`${string}.css\``) has been removed.
  - **`config.metadata.name` is now optional** — The `name` field in `FrakWalletSdkConfig.metadata` is no longer required; it can be resolved from backend config.
  - **IFrame client handshake refactored** — The client now resolves merchant config client-side (via `sdkConfigStore`) before sending a `resolved-config` event to the iframe, replacing the previous server-driven handshake flow.

### Minor Changes

- [#143](https://github.com/frak-id/wallet/pull/143) [`c7bbb51`](https://github.com/frak-id/wallet/commit/c7bbb5179dd8d04d5b99f573727f15fbe36c0822) Thanks [@KONFeature](https://github.com/KONFeature)! - ### New features

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

## 0.2.1

### Patch Changes

- [#137](https://github.com/frak-id/wallet/pull/137) [`42b83e7`](https://github.com/frak-id/wallet/commit/42b83e79adaabcc9b67ce88ddb95075046c379e4) Thanks [@KONFeature](https://github.com/KONFeature)! - Add support for anonymous sharing link creation

## 0.2.0

### Minor Changes

- [#133](https://github.com/frak-id/wallet/pull/133) [`a6c77fd`](https://github.com/frak-id/wallet/commit/a6c77fd2155a7a2038a13e6a766b160897aa2f98) Thanks [@srod](https://github.com/srod)! - SDK v2: Add `ensureIdentity` action, `merchantId` session persistence, `trackArrival` action, SSO param generation and redirect handling. Add `clientId` to iframe URL params and analytics events. Hide internal types and fix `QueryOptions` generic.

### Patch Changes

- [#133](https://github.com/frak-id/wallet/pull/133) [`a6c77fd`](https://github.com/frak-id/wallet/commit/a6c77fd2155a7a2038a13e6a766b160897aa2f98) Thanks [@srod](https://github.com/srod)! - Fix iPad detection for iPadOS 13+ Macintosh UA, iOS in-app browser redirect via x-safari-https scheme, Android intent URL Play Store redirect, arrival interaction clientId race condition, purchase status tracking with merchantId and anonymous user support, and Chrome Android deep link confirmation bar.

- Updated dependencies [[`a6c77fd`](https://github.com/frak-id/wallet/commit/a6c77fd2155a7a2038a13e6a766b160897aa2f98)]:
  - @frak-labs/frame-connector@0.2.0

## 0.1.1

### Patch Changes

- [#127](https://github.com/frak-id/wallet/pull/127) [`5947e2e`](https://github.com/frak-id/wallet/commit/5947e2ebfd449ebf54b2a1e9e311795419f26991) Thanks [@srod](https://github.com/srod)! - Improve tracking of the user_referred events with multiple sub events

## 0.1.0

### Patch Changes

- [#113](https://github.com/frak-id/wallet/pull/113) [`3b111c4`](https://github.com/frak-id/wallet/commit/3b111c44109e7bd23e2b7fbe4056b8c153af101d) Thanks [@KONFeature](https://github.com/KONFeature)! - Review inter frame communication (sso <> wallet | sdk <> wallet)

- [#113](https://github.com/frak-id/wallet/pull/113) [`2ff23da`](https://github.com/frak-id/wallet/commit/2ff23dad85825d0b28ea1b4ad743f37405711b01) Thanks [@KONFeature](https://github.com/KONFeature)! - Publish @frak-labs/frame-connector as a standalone package - a type-safe RPC layer for cross-window postMessage communication

- Updated dependencies [[`3b111c4`](https://github.com/frak-id/wallet/commit/3b111c44109e7bd23e2b7fbe4056b8c153af101d), [`2ff23da`](https://github.com/frak-id/wallet/commit/2ff23dad85825d0b28ea1b4ad743f37405711b01)]:
  - @frak-labs/frame-connector@0.1.0

## 0.0.19

### Patch Changes

- [#108](https://github.com/frak-id/wallet/pull/108) [`ac15f08`](https://github.com/frak-id/wallet/commit/ac15f0807d63776520f9f954148da1ac87d7bd7b) Thanks [@KONFeature](https://github.com/KONFeature)! - Round reward amount instead of ceiling them in the UI

## 0.0.18

### Patch Changes

- [#105](https://github.com/frak-id/wallet/pull/105) [`2538a52`](https://github.com/frak-id/wallet/commit/2538a52bcd2ff9b55bddd12a07c7309a28d29b7e) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix openpanel analytics

## 0.0.17

### Patch Changes

- [#103](https://github.com/frak-id/wallet/pull/103) [`333691e`](https://github.com/frak-id/wallet/commit/333691ec7b35768368731584c842d093cef61c05) Thanks [@KONFeature](https://github.com/KONFeature)! - Add analytics tracking within the SDK

## 0.0.16

### Patch Changes

- [#93](https://github.com/frak-id/wallet/pull/93) [`1772437`](https://github.com/frak-id/wallet/commit/1772437ef7aee3e920de32b721df212c0c8a085b) Thanks [@srod](https://github.com/srod)! - Handle new `redirect` lifecycle event to exit social inapp browser

## 0.0.15

### Patch Changes

- [#76](https://github.com/frak-id/wallet/pull/76) [`6afe559`](https://github.com/frak-id/wallet/commit/6afe5598b1a0be7642499c4d230bea882cd862ca) Thanks [@srod](https://github.com/srod)! - 🔧 Update import paths for CborEncoder and CborDecoder to include index.js

## 0.0.14

### Patch Changes

- [#73](https://github.com/frak-id/wallet/pull/73) [`4dc9621`](https://github.com/frak-id/wallet/commit/4dc962139594cc8aed9699d918f0cde692325709) Thanks [@srod](https://github.com/srod)! - ✨ Initialize components SDK in loader

## 0.0.13

### Patch Changes

- [#68](https://github.com/frak-id/wallet/pull/68) [`6c4b99c`](https://github.com/frak-id/wallet/commit/6c4b99caafc1a144edd8ac71e0dabe4d0a38248f) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove `www.` prefix from domain when calculating the productId

## 0.0.12

### Patch Changes

- [`0cd5358`](https://github.com/frak-id/wallet/commit/0cd53582925ba5bd0c3620a1b61bf4e377b88372) Thanks [@srod](https://github.com/srod)! - ✨ Open Wallet embedded when receiving a shared link

## 0.0.11

### Patch Changes

- [`cc0e807`](https://github.com/frak-id/wallet/commit/cc0e807add74165ac56ebd3289c1d5e90bd367b9) Thanks [@srod](https://github.com/srod)! - ✨ Add BUILD_TIMESTAMP to components for dynamic CDN loading

## 0.0.10

### Patch Changes

- [#56](https://github.com/frak-id/wallet/pull/56) [`fdfcdbf`](https://github.com/frak-id/wallet/commit/fdfcdbf0133fd71dd89b87b061988c0c8225c8c0) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove unused modal `metadata.context` properties

- [#56](https://github.com/frak-id/wallet/pull/56) [`1764657`](https://github.com/frak-id/wallet/commit/176465722aafb9e392bcb62d6b504c6521ab71f8) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `i18n` properties on both embedded and modal request metadata for per modal customizations

- [#56](https://github.com/frak-id/wallet/pull/56) [`a759718`](https://github.com/frak-id/wallet/commit/a759718b2ff4cb6be21a7b8cb535299d0517f99f) Thanks [@KONFeature](https://github.com/KONFeature)! - - Update the config object to support customized `i18n` translation (deprecate the previous `metadata.xxx` properties in favor of custom i18n)

  - Move the css properties on the FrakConfig to the new customizations object

- [#57](https://github.com/frak-id/wallet/pull/57) [`5951f94`](https://github.com/frak-id/wallet/commit/5951f94b7dd5fd7e655df00e85f1d7bab03cfaaa) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove `lz-string` compression of msg, add CBOR encoding / decoding

## 0.0.9

### Patch Changes

- [`2381c27`](https://github.com/frak-id/wallet/commit/2381c274dc6240eeb96f9fd7683315ee4f052aea) Thanks [@srod](https://github.com/srod)! - ✨ Add currency support in config

## 0.0.8

### Patch Changes

- [`aa3c9f5`](https://github.com/frak-id/wallet/commit/aa3c9f5faf690110f4c5de5700c5e825e731941c) Thanks [@srod](https://github.com/srod)! - ✨ Build all SDK with rslib
  ✨ Build components SDK as a library to be published on NPM
  ✨ Refactor component loader for CDN distribution

## 0.0.7

### Patch Changes

- [`2b0c2d3`](https://github.com/frak-id/wallet/commit/2b0c2d3f2f78a3ccf1eb8be1602fb72ab4a39aaf) Thanks [@srod](https://github.com/srod)! - 🐛 Fix double publish

## 0.0.6

### Patch Changes

- [`0a82e0c`](https://github.com/frak-id/wallet/commit/0a82e0c6ea117a36ed2459fd682af52605922733) Thanks [@srod](https://github.com/srod)! - Add new config `position` to `frak-button-wallet`

## 0.0.5

### Patch Changes

- [`fef225f`](https://github.com/frak-id/wallet/commit/fef225ff27b381f0b4f4575f99e44b9dc1400d03) Thanks [@KONFeature](https://github.com/KONFeature)! - Move `hearbeat` event to `clientLifecycle` events

- [`fef225f`](https://github.com/frak-id/wallet/commit/fef225ff27b381f0b4f4575f99e44b9dc1400d03) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `handshake` and `handshake-response` events to compute the reslving context when not available

- [`64e1a8e`](https://github.com/frak-id/wallet/commit/64e1a8eee7bde61cf1fbe1ce269bfdf66f1253f7) Thanks [@KONFeature](https://github.com/KONFeature)! - Add the option to specify a `targetInteraction` for sharing modal and the `ButtonShare` component

## 0.0.4

### Patch Changes

- [`ab40feb`](https://github.com/frak-id/wallet/commit/ab40feb34e0e720027cba6090a70bf5a7aa1c867) Thanks [@KONFeature](https://github.com/KONFeature)! - Support new `retail` product types + retail related interactions

## 0.0.2

### Patch Changes

- [`b18a684`](https://github.com/frak-id/wallet/commit/b18a6841e5faa3523f178603729b7b4f6fe8dea7) Thanks [@srod](https://github.com/srod)! - Initial publish
