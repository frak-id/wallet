# @frak-labs/core-sdk

## 1.1.0

### Minor Changes

- [#183](https://github.com/frak-id/wallet/pull/183) [`4d6e2ae`](https://github.com/frak-id/wallet/commit/4d6e2ae7f819eb226169f3c938e4d07607db9f50) Thanks [@KONFeature](https://github.com/KONFeature)! - ✨ feat: Add `preload` option to `FrakWalletSdkConfig` allowing consumers to specify which views inside the listener iframe should be preloaded. Defaults to `["sharing"]`.

- [#183](https://github.com/frak-id/wallet/pull/183) [`9ddf96b`](https://github.com/frak-id/wallet/commit/9ddf96b22b9c310c4c779b63c4088254e973344d) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove the unused `DebugInfoGatherer` class from `@frak-labs/core-sdk`. The class was constructed once per `createIFrameFrakClient` call and its state was actively maintained on every RPC roundtrip via middleware (`setLastRequest` / `setLastResponse` / `updateSetupStatus`), but its single output method `client.debugInfo.formatDebugInfo()` was never called anywhere — zero consumers in `apps/`, `packages/`, sister `sdk/` packages, `example/`, `services/`, or `plugins/`. The only non-definition reference was a `vi.fn()` mock in `sdk/components/tests/vitest-setup.ts` to satisfy the `FrakClient` type shape.

  **Public API change**: `DebugInfoGatherer` is no longer exported from `@frak-labs/core-sdk`. The `debugInfo` field on `FrakClient` is removed. External consumers calling `client.debugInfo.formatDebugInfo()` would need to handle errors via their own error-reporting infrastructure (e.g. wrapping `client.request(...)` calls in try/catch and reporting via the merchant's existing observability stack).

  If SDK-side observability is desired in the future, the natural path is a typed `sdk_rpc_error` event emitted via the already-initialized `client.openPanel?.track(...)` (mirroring the `recordError` / `app_error` pattern in `packages/wallet-shared`). That would be a new feature, built fresh — not a revival of this class.

  **Removed files**:

  - `sdk/core/src/clients/DebugInfo.ts`
  - `sdk/core/src/clients/DebugInfo.test.ts` (28 unit tests)

  **Modified files**:

  - `sdk/core/src/clients/index.ts` — drop the `DebugInfoGatherer` re-export
  - `sdk/core/src/clients/createIFrameFrakClient.ts` — drop the import, the `new DebugInfoGatherer(...)` instantiation, the `setLastRequest` / `setLastResponse` middleware block, the `updateSetupStatus` chain, and the `debugInfo` field on the returned client object
  - `sdk/core/src/types/client.ts` — drop the `debugInfo` field from `FrakClient`
  - `sdk/components/tests/vitest-setup.ts` — drop the `debugInfo` mock from the `window.FrakSetup.client` test fixture

  **Bundle impact** (CDN, raw / gzip):

  | Bundle                                               |            Before |             After |               Δ raw |              Δ gzip |
  | ---------------------------------------------------- | ----------------: | ----------------: | ------------------: | ------------------: |
  | `sdk/core/cdn/bundle.js` (`window.FrakSDK`)          | 41.1 KB / 13.9 KB | 39.0 KB / 13.2 KB | **−2.1 KB (−5.2%)** | **−0.6 KB (−4.5%)** |
  | `sdk/components/cdn/loader.js` (always-loaded entry) | 47.6 KB / 15.5 KB | 45.5 KB / 14.9 KB | **−2.1 KB (−4.4%)** | **−0.6 KB (−4.0%)** |

  Combined: **−4.2 KB raw / −1.2 KB gzip** across the two CDN bundles.

- [#183](https://github.com/frak-id/wallet/pull/183) [`ec55f4a`](https://github.com/frak-id/wallet/commit/ec55f4a700d8169da58e24bf0dff68c082fa6994) Thanks [@KONFeature](https://github.com/KONFeature)! - Trim the public API surface of `@frak-labs/core-sdk` by removing 11 leaked internal helpers that had no consumer outside of the SDK itself. This shrinks the always-loaded `@frak-labs/components` CDN loader (`cdn/loader.js`) and the core SDK's IIFE bundle (`window.FrakSDK`) without changing any other code — every downstream package + every `import * as` consumer cascades to a smaller surface automatically.

  **Removed exports** (no named-import consumer found in `apps/`, `packages/`, `sdk/{components,react,legacy}`, `example/`, `services/`, `plugins/`):

  - `DebugInfoGatherer` (class, internal debug helper)
  - `LocalesKey` (type), `locales` (constant array)
  - `isV1Context`, `isV2Context` (FrakContext type guards)
  - `createIframe` (low-level — `setupClient` is the public entry)
  - `getCache` (cache primitive — `withCache` is the public wrapper)
  - `getSupportedLocale` (internal locale validator)
  - `isChromiumAndroid`, `isFrakDeepLink`, `toAndroidIntentUrl` (deep-link internals — `triggerDeepLinkWithFallback` is the public entry)
  - `isIOS` (browser detection — apps that need it import from `@frak-labs/app-essentials/utils/platform`)

  **Kept in the public API**: `createIFrameFrakClient`, `setupClient`, `ssoPopupFeatures`, `ssoPopupName`, `base64urlDecode`, `base64urlEncode`, `baseIframeProps`, `clearAllCache`, `compressJsonToB64`, `DEEP_LINK_SCHEME`, `decompressJsonFromB64`, `FrakContextManager`, `findIframeInOpener`, `formatAmount`, `generateSsoUrl`, `getBackendUrl`, `getClientId`, `getCurrencyAmountKey`, `getSupportedCurrency`, `isInAppBrowser`, `mergeAttribution`, `redirectToExternalBrowser`, `sdkConfigStore`, `trackEvent`, `triggerDeepLinkWithFallback`, `withCache` — plus all types and the entire `@frak-labs/core-sdk/actions` subpath.

  **Bundle size impact** (CDN, raw / gzip):

  - `sdk/core/cdn/bundle.js`: 47.1 KB / 16.0 KB → 41.1 KB / 13.9 KB (**−13%**)
  - `sdk/components/cdn/loader.js`: 59.0 KB / 19.7 KB → 49.5 KB / 16.2 KB (**−16% / −18%**)

  Internally these helpers remain available — they're still importable from their concrete modules (`@frak-labs/core-sdk/src/utils/inAppBrowser` etc.) for any future need, they're just no longer part of the public re-export surface.

### Patch Changes

- [#183](https://github.com/frak-id/wallet/pull/183) [`b1ac0d2`](https://github.com/frak-id/wallet/commit/b1ac0d207b225cc462b290a4c68b02b06600adac) Thanks [@KONFeature](https://github.com/KONFeature)! - Remove the `computeLegacyProductId` utility from the public API. It was only consumed internally by `openSso` (popup mode), where its return value (`keccak256(toHex(domain))`) was being passed as the SSO `merchantId` — but the backend `auth/login` endpoint validates `merchantId` as a UUID and silently drops the field, so the value never had any effect. `openSso` now resolves the real merchant UUID via `sdkConfigStore.resolveMerchantId()`, matching `frak_openSso`'s redirect-mode handler in the wallet listener and the existing `trackPurchaseStatus` / `ensureIdentity` flows.

- [#183](https://github.com/frak-id/wallet/pull/183) [`ec55f4a`](https://github.com/frak-id/wallet/commit/ec55f4a700d8169da58e24bf0dff68c082fa6994) Thanks [@KONFeature](https://github.com/KONFeature)! - Replace runtime `viem` imports with in-house equivalents in the four files that pulled viem into the SDK bundle. No public API change — these are all internal implementations, the `viem` peer dependency is still used for `Address` / `Hex` type imports.

  **Why**: `viem` v2's `BaseError` machinery (six `Object.defineProperty` calls per error subclass × ~5 sub-errors) plus its keccak/checksum/encoding stack was bleeding into the SDK bundle even though the SDK only needed a handful of helpers. Combined with rolldown's lazy-init treeshaking on the IIFE format, the leaked viem code also caused runtime crashes when calling `FrakSDK.processReferral` or `FrakSDK.computeLegacyProductId` from the CDN bundle (uninitialized `var Pe, Fe; ...` referenced by surviving consumer functions).

  **Changes**:

  - `sdk/core/src/utils/address.ts` (new) — minimal, dependency-free address helpers:
    - `isAddress` (regex shape check, no EIP-55 checksum — SDK never produces checksum-cased payloads, downstream consumers treat addresses case-insensitively)
    - `areAddressesEqual` (lowercase compare)
    - `addressToBytes` / `bytesToAddress` (fixed 20-byte conversion with a precomputed hex lookup table for the encode hot path)
  - `sdk/core/src/utils/FrakContext.ts` — swap `viem` `bytesToHex` / `hexToBytes` / `isAddress` → in-house `bytesToAddress` / `addressToBytes` / `isAddress`.
  - `sdk/core/src/utils/frakContextV2Codec.ts` — same swap (kept the `Address` type-only import).
  - `sdk/core/src/actions/referral/processReferral.ts` — swap `viem` `isAddressEqual` → `areAddressesEqual`.
  - `sdk/core/src/actions/wrapper/siweAuthenticate.ts` — drop `viem/siwe` `generateSiweNonce` import, inline a 96-hex-char nonce generator using `crypto.getRandomValues` (with a `Math.random` fallback for the rare environment without WebCrypto). Matches viem's nonce shape exactly.
  - `sdk/core/src/actions/wrapper/siweAuthenticate.test.ts` — drop the `viem/siwe` mock, assert nonce shape via `expect.stringMatching(/^[0-9a-f]{96}$/)`.

  **Bundle impact** (CDN, raw / gzip), from baseline before this trim → final:

  | Bundle                                               |            Before |             After |               Δ raw |             Δ gzip |
  | ---------------------------------------------------- | ----------------: | ----------------: | ------------------: | -----------------: |
  | `sdk/core/cdn/bundle.js` (`window.FrakSDK`)          | 46.7 KB / 15.9 KB | 41.1 KB / 13.9 KB |  **−5.7 KB (−12%)** | **−2.1 KB (−13%)** |
  | `sdk/components/cdn/loader.js` (always-loaded entry) | 60.3 KB / 20.0 KB | 49.5 KB / 16.2 KB | **−10.8 KB (−18%)** | **−3.8 KB (−19%)** |

  After this change, **zero** `viem` runtime code ships in either CDN bundle (verified: 0 hits for `BaseError`, `isAddress`, `keccak`, `@noble`, etc.). The `viem` peer dep is now type-only for SDK CDN consumers.

  **Side effect — IIFE crash fix**: The `window.FrakSDK.processReferral(...)` call previously threw `TypeError: Cannot read properties of undefined (reading 'has')` due to rolldown tree-shaking viem's lazy-init closures while keeping the consumer functions. Verified post-trim: `processReferral` / `FrakContextManager.parse` / `compressJsonToB64` / `getClientId` all work correctly when invoked from the IIFE bundle.

## 1.0.2

### Patch Changes

- [#156](https://github.com/frak-id/wallet/pull/156) [`33c2534`](https://github.com/frak-id/wallet/commit/33c2534b06b781a1d0c975b8ab400e9497eeac51) Thanks [@KONFeature](https://github.com/KONFeature)! - Cut the iframe handshake duration by emitting readiness from the listener as soon as RPC handlers are wired up, instead of waiting for a polled heartbeat.

  - SDK heartbeat drops from 1000 ms to 250 ms and is now a fallback discovery ping only (kept as a safety net for SDK/listener version skew during deployments).
  - SDK now injects `<link rel="preconnect">` hints for the wallet and backend origins before appending the iframe, so cold-cache partner sites don't pay the DNS/TLS round-trip on the handshake.
  - No public API changes. `createIFrameFrakClient`, `setupClient`, `waitForConnection`, and `waitForSetup` keep the exact same contract — they just resolve sooner.

## 1.0.1

### Patch Changes

- [#147](https://github.com/frak-id/wallet/pull/147) [`6e64da9`](https://github.com/frak-id/wallet/commit/6e64da91da66c4b6e02b430005c908eecf2e42aa) Thanks [@KONFeature](https://github.com/KONFeature)! - Allow UTM/attribution defaults from SDK config and backend-driven config. Priority: per-call override > backend config > SDK config > hardcoded fallbacks. Exposes `mergeAttribution` helper and `AttributionDefaults` type (excludes per-product `utmContent`).

- [#147](https://github.com/frak-id/wallet/pull/147) [`d55d777`](https://github.com/frak-id/wallet/commit/d55d777f2713c57d8f95fb35ade13fcd7b018ed9) Thanks [@KONFeature](https://github.com/KONFeature)! - Replace the V2 `FrakContext` wire format (JSON + base64url) with a compact binary layout: a 1-byte header (4 version bits + `has_c`/`has_w` flags + reserved bits) followed by raw UUID/address bytes and a big-endian uint32 timestamp. The resulting `fCtx` URL parameter is ~65% shorter across all variants (e.g. anonymous `c`-only drops from ~154 to 50 chars; hybrid `c`+`w` drops from ~220 to 76 chars). V1 payloads (20-byte wallet address) are unchanged and still recognized via length-based disambiguation.

  `encodeFrakContextV2` now strictly validates that `m` and `c` are canonical UUIDs and that `t` fits in a uint32; invalid contexts return `undefined` from `FrakContextManager.compress`. Reserved header bits are checked on decode to keep future versions forward-compatible.

- [#147](https://github.com/frak-id/wallet/pull/147) [`799b5c9`](https://github.com/frak-id/wallet/commit/799b5c91e6cfd4453d6daf8db826c8a2e9dc2910) Thanks [@KONFeature](https://github.com/KONFeature)! - Extend `FrakContextV2` to carry an optional wallet address (`w`) and make the anonymous clientId (`c`) optional. A valid V2 context now only requires `m` (merchantId) + `t` (timestamp) plus at least one sharer identifier (`c` or `w`). When the sharer is authenticated, the wallet becomes the preferred identity signal — global, WebAuthn-bound, and durable across localStorage clears. `processReferral` self-referral detection and URL replacement (`alwaysAppendUrl`) prefer wallet match over clientId when both are available. `w` is validated with `isAddress()` on both compress and decompress to guard `isSelfReferral` against crafted URLs.

  **Privacy note:** wallet addresses now appear in `fCtx` URL payloads, outbound share events, and SDK analytics (`user_referred_started`). The `ref` UTM param is intentionally kept clientId-only and never falls back to wallet.

  **Backend observers:** the `referral` interaction V2 source_data now carries an optional `referrerWallet` field alongside `referrerClientId` / `referrerMerchantId`. Downstream indexers and analytics consumers should treat `referrerWallet` as the strongest referrer identity when present.

- [#145](https://github.com/frak-id/wallet/pull/145) [`e8786d1`](https://github.com/frak-id/wallet/commit/e8786d1ddfabd5354617d7049a65084ede5b4b3a) Thanks [@KONFeature](https://github.com/KONFeature)! - Drop console.log during build

- [#147](https://github.com/frak-id/wallet/pull/147) [`3fb1915`](https://github.com/frak-id/wallet/commit/3fb1915a0d5d4fcd92af196afb3332f5814c87dc) Thanks [@KONFeature](https://github.com/KONFeature)! - Review SDK analytics events against business KPIs. Removed events that don't map to dashboarded metrics (`wallet_button_clicked`, `share_error_debug_copied`, `modal_step_completed`, `install_code_success_modal_viewed`, `sharing_link_generated`, `user_referred_error`, `sdk_iframe_heartbeat_timeout`, `onboarding_keypass_opened`, `onboarding_step_advanced`) and trimmed bloated payloads (e.g. `debug_info` from `share_modal_error`). Consolidated redundant events into outcome-based terminal events: `banner_resolved { outcome }` (replaces `banner_clicked` + `banner_dismissed`) and `notification_opt_in_resolved { outcome }` (5 events → 1). Added coverage for gaps: `sharing_link_shared` / `sharing_link_copied` with unified `source` across all 5 entry points, auto-tracked `wallet_modal_opened` / `wallet_modal_closed`, `inapp_redirect` as an identity-merge source, and `sdk_init_failed` for CDN bootstrap failures. Full reference in `docs/openpanel-events.md`.

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
