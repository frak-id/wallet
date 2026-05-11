# @frak-labs/components

## 1.0.4

### Patch Changes

- [#183](https://github.com/frak-id/wallet/pull/183) [`22344f0`](https://github.com/frak-id/wallet/commit/22344f072f9931da944152221b12f6fdcf55ee1f) Thanks [@KONFeature](https://github.com/KONFeature)! - `<frak-banner>` and `<frak-post-purchase>`: add an optional `imageUrl` prop to override the gift icon displayed on the left of each component. When omitted, the built-in `GiftIcon` keeps rendering as before, so the change is fully backwards-compatible. The custom image is rendered into a fixed-size slot (40×40 for the banner, 80×80 for the post-purchase card) with `overflow: hidden` and `object-fit: contain`, so over- or undersized assets stay visually contained without breaking the surrounding layout. Exposed both as a JS property (`el.imageUrl = "..."`) and as a kebab-case HTML attribute (`<frak-banner image-url="...">` / `<frak-post-purchase image-url="...">`) so server-rendered surfaces (WordPress / Magento / Shopify Liquid) can set it without JavaScript.

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

- Updated dependencies [[`4d6e2ae`](https://github.com/frak-id/wallet/commit/4d6e2ae7f819eb226169f3c938e4d07607db9f50), [`b1ac0d2`](https://github.com/frak-id/wallet/commit/b1ac0d207b225cc462b290a4c68b02b06600adac), [`9ddf96b`](https://github.com/frak-id/wallet/commit/9ddf96b22b9c310c4c779b63c4088254e973344d), [`ec55f4a`](https://github.com/frak-id/wallet/commit/ec55f4a700d8169da58e24bf0dff68c082fa6994), [`ec55f4a`](https://github.com/frak-id/wallet/commit/ec55f4a700d8169da58e24bf0dff68c082fa6994)]:
  - @frak-labs/core-sdk@1.1.0

## 1.0.3

### Patch Changes

- [#159](https://github.com/frak-id/wallet/pull/159) [`3174fc2`](https://github.com/frak-id/wallet/commit/3174fc2544c5d959fc75976b435d591a0e5f228d) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix `<frak-post-purchase>` CTA button not rendering — pull the design-system reset CSS into the component's injected stylesheet by composing `element.button` into the `cta` style. Without it, the browser's native `<button>` rendering overrode the pill styles.

- [#159](https://github.com/frak-id/wallet/pull/159) [`9ddbee4`](https://github.com/frak-id/wallet/commit/9ddbee4a7279beb11532fb6fdaa459db7789d12c) Thanks [@KONFeature](https://github.com/KONFeature)! - `<frak-post-purchase>`: forward an optional `products` array to the full-page sharing UI so referrers see cards for the items they just bought instead of only a generic share screen. Accepts either a `SharingPageProduct[]` (set imperatively, `el.products = [...]`) or a JSON-stringified array (set as an HTML attribute by server-rendered surfaces such as the WordPress / Magento plugins). Each entry is sanitised on the SDK boundary — `title` is required, and `imageUrl` / `link` are kept only when they parse as `http(s)://` URLs — so a malformed `link` cannot crash the listener-side `new URL(...)` call and a `javascript:` URL cannot reach `imageUrl` / `link` consumers downstream.

  Internally, the share CTA now opens via `displaySharingPage` (the full-page sharing flow) instead of `modalBuilder().sharing()` (the modal flow). The full-page surface is the only one that renders product cards; this is also why the modal-flow share keeps working unchanged for `<frak-button-share>`. The `openSharingPage` helper grew an optional third `options?: { link?, products? }` argument so callers can opt in without touching the existing `(targetInteraction, placement)` signature.

- [#159](https://github.com/frak-id/wallet/pull/159) [`eccf0f1`](https://github.com/frak-id/wallet/commit/eccf0f1fd511d71c29fc81c22ccd976820b0d359) Thanks [@KONFeature](https://github.com/KONFeature)! - `<frak-button-share>`: route every share click through the full-page sharing UI (`displaySharingPage`) instead of maintaining a parallel modal-flow path. The internal `useShareModal` hook (along with the `ErrorMessage` UI it powered and the `useCopyToClipboard` helper that supported it) is removed; the `clickAction` prop's TypeScript union no longer accepts `"share-modal"`. Existing merchant configs / legacy stored values that still emit `clickAction="share-modal"` keep working — the runtime branch falls through to `openSharingPage` so the share still opens, just on the full-page surface that already supports product cards. Callers wanting the embedded-wallet modal continue to set `clickAction="embedded-wallet"`; that path is untouched.

  `openSharingPage`: `metadata` is now only emitted when `targetInteraction` is set, mirroring the conditional spread used for `link` and `products` so the helper never sends an empty `metadata: {}` payload.

  `<frak-post-purchase>`: collapse the previous `useCallback(handleShare)` + inline `onClick` arrow (which defeated memoisation) into a single memoised `handleClick` so the click-tracking + `openSharingPage` call live in one named, stable-reference callback.

## 1.0.2

### Patch Changes

- Updated dependencies [[`33c2534`](https://github.com/frak-id/wallet/commit/33c2534b06b781a1d0c975b8ab400e9497eeac51)]:
  - @frak-labs/core-sdk@1.0.2

## 1.0.1

### Patch Changes

- [#147](https://github.com/frak-id/wallet/pull/147) [`b56cb99`](https://github.com/frak-id/wallet/commit/b56cb990326841f65602b80c9402959c0293ff57) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix `<frak-banner>` rendering unstyled in in-app browser mode. The InAppBanner vanilla-extract styles (`inAppBanner_container`, `inAppBanner_cta`, `inAppBanner_closeButton`, etc.) were compiled but never aggregated into the `cssSource` string injected by `useLightDomStyles`, because `Banner.css.ts` did not reference `inAppBanner.css.ts` in its vanilla-extract dependency graph. Added a side-effect import of `@frak-labs/design-system/styles/inAppBanner` so the plugin now bundles the missing CSS into the banner's runtime-injected `<style>` tag.

- [#145](https://github.com/frak-id/wallet/pull/145) [`e8786d1`](https://github.com/frak-id/wallet/commit/e8786d1ddfabd5354617d7049a65084ede5b4b3a) Thanks [@KONFeature](https://github.com/KONFeature)! - Drop console.log during build

- [#147](https://github.com/frak-id/wallet/pull/147) [`dbd69f1`](https://github.com/frak-id/wallet/commit/dbd69f1a1f3f66763700add70ee5c26db7be6df7) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `preview` attribute to `<frak-button-share>` and `<frak-post-purchase>` (symmetric with `<frak-banner>`). When set, skips the client-ready / RPC gates and no-ops the click handler so theme/block editors (Shopify, WordPress) can render the real web components without a configured Frak client. `<frak-post-purchase>` also gains a `preview-variant` attribute (`"referrer" | "referee"`, defaults to `"referrer"`) to pick which variant is displayed.

- [#147](https://github.com/frak-id/wallet/pull/147) [`3fb1915`](https://github.com/frak-id/wallet/commit/3fb1915a0d5d4fcd92af196afb3332f5814c87dc) Thanks [@KONFeature](https://github.com/KONFeature)! - Review SDK analytics events against business KPIs. Removed events that don't map to dashboarded metrics (`wallet_button_clicked`, `share_error_debug_copied`, `modal_step_completed`, `install_code_success_modal_viewed`, `sharing_link_generated`, `user_referred_error`, `sdk_iframe_heartbeat_timeout`, `onboarding_keypass_opened`, `onboarding_step_advanced`) and trimmed bloated payloads (e.g. `debug_info` from `share_modal_error`). Consolidated redundant events into outcome-based terminal events: `banner_resolved { outcome }` (replaces `banner_clicked` + `banner_dismissed`) and `notification_opt_in_resolved { outcome }` (5 events → 1). Added coverage for gaps: `sharing_link_shared` / `sharing_link_copied` with unified `source` across all 5 entry points, auto-tracked `wallet_modal_opened` / `wallet_modal_closed`, `inapp_redirect` as an identity-merge source, and `sdk_init_failed` for CDN bootstrap failures. Full reference in `docs/openpanel-events.md`.

- Updated dependencies [[`6e64da9`](https://github.com/frak-id/wallet/commit/6e64da91da66c4b6e02b430005c908eecf2e42aa), [`d55d777`](https://github.com/frak-id/wallet/commit/d55d777f2713c57d8f95fb35ade13fcd7b018ed9), [`799b5c9`](https://github.com/frak-id/wallet/commit/799b5c91e6cfd4453d6daf8db826c8a2e9dc2910), [`e8786d1`](https://github.com/frak-id/wallet/commit/e8786d1ddfabd5354617d7049a65084ede5b4b3a), [`3fb1915`](https://github.com/frak-id/wallet/commit/3fb1915a0d5d4fcd92af196afb3332f5814c87dc)]:
  - @frak-labs/core-sdk@1.0.1

## 1.0.0

### Major Changes

- [#143](https://github.com/frak-id/wallet/pull/143) [`c7bbb51`](https://github.com/frak-id/wallet/commit/c7bbb5179dd8d04d5b99f573727f15fbe36c0822) Thanks [@KONFeature](https://github.com/KONFeature)! - ### Breaking changes

  - **Removed `Spinner` component** — The standalone Spinner component has been removed.
  - **Removed `setup` utilities** — `setupModalConfig` and `setupReferral` from `utils/setup.ts` are no longer available. Referral setup is now handled by `@frak-labs/core-sdk`'s `setupReferral` action directly.
  - **Removed CSS Modules** — `ButtonShare.module.css`, `ButtonWallet.module.css`, and `OpenInAppButton.module.css` have been replaced by CSS-in-TS styling (`sharedCss`, `styleManager`).
  - **Replaced `getCurrentReward` with `formatReward`** — The reward formatting utility has been rewritten with a new API.
  - **Refactored `initFrakSdk`** — The global `frakSetupInProgress` flag is removed; concurrent initialization is now deduplicated via `withCache`. The function is synchronous-first (returns a `Promise<void>`). Core SDK is now exposed as a merged `{ ...coreSdkIndex, ...coreSdkActions }` object on `window.FrakSetup.core`.

### Minor Changes

- [#143](https://github.com/frak-id/wallet/pull/143) [`c7bbb51`](https://github.com/frak-id/wallet/commit/c7bbb5179dd8d04d5b99f573727f15fbe36c0822) Thanks [@KONFeature](https://github.com/KONFeature)! - ### New features

  - **`Banner` component** — New web component for displaying referral reward banners and in-app browser escape prompts. Supports placement-based customization, interaction type filtering, and preview mode for theme editors.
  - **`PostPurchase` component** — New web component for post-checkout referral sharing with referrer/referee variants, purchase tracking fallback, and reward display with `{REWARD}` template placeholders.
  - **New hooks**: `useGlobalComponents` (manages global component registration), `useLightDomStyles` (injects styles into the Light DOM), `usePlacement` (resolves backend-driven placement config).
  - **Enhanced `useReward`** — Extended with richer reward data and interaction type filtering.
  - **Enhanced `useClientReady`** — Improved readiness detection with backend config awareness.
  - **New utilities**: `embeddedWallet` (embedded wallet helpers), `sharedCss` (shared CSS-in-TS styles), `sharingPage` (sharing page integration), `styleManager` (Light DOM style injection), `onDocumentReady` (DOM readiness helper).
  - **`GiftIcon` SVG component** added.

### Patch Changes

- [#143](https://github.com/frak-id/wallet/pull/143) [`c7bbb51`](https://github.com/frak-id/wallet/commit/c7bbb5179dd8d04d5b99f573727f15fbe36c0822) Thanks [@KONFeature](https://github.com/KONFeature)! - ### Internal improvements

  - Refactored `ButtonShare`, `ButtonWallet`, and `OpenInAppButton` components with updated styling and improved structure.
  - Migrated build configuration (`tsdown.config.ts`) with updated output handling.
  - Updated test setup and vitest configuration.

- Updated dependencies [[`c7bbb51`](https://github.com/frak-id/wallet/commit/c7bbb5179dd8d04d5b99f573727f15fbe36c0822), [`c7bbb51`](https://github.com/frak-id/wallet/commit/c7bbb5179dd8d04d5b99f573727f15fbe36c0822)]:
  - @frak-labs/core-sdk@1.0.0

## 0.0.26

### Patch Changes

- [#137](https://github.com/frak-id/wallet/pull/137) [`42b83e7`](https://github.com/frak-id/wallet/commit/42b83e79adaabcc9b67ce88ddb95075046c379e4) Thanks [@KONFeature](https://github.com/KONFeature)! - Add support for anonymous sharing link creation

- Updated dependencies [[`42b83e7`](https://github.com/frak-id/wallet/commit/42b83e79adaabcc9b67ce88ddb95075046c379e4)]:
  - @frak-labs/core-sdk@0.2.1

## 0.0.25

### Patch Changes

- [#130](https://github.com/frak-id/wallet/pull/130) [`e93ee6f`](https://github.com/frak-id/wallet/commit/e93ee6f30733aaf92b9572b479d9a72e9bf0b5b4) Thanks [@KONFeature](https://github.com/KONFeature)! - Make CDN imports environment-aware using build-time CDN_TAG replacement, ensuring beta releases point to `@beta` tag instead of `@latest`

- Updated dependencies [[`a6c77fd`](https://github.com/frak-id/wallet/commit/a6c77fd2155a7a2038a13e6a766b160897aa2f98), [`a6c77fd`](https://github.com/frak-id/wallet/commit/a6c77fd2155a7a2038a13e6a766b160897aa2f98), [`a6c77fd`](https://github.com/frak-id/wallet/commit/a6c77fd2155a7a2038a13e6a766b160897aa2f98)]:
  - @frak-labs/frame-connector@0.2.0
  - @frak-labs/core-sdk@0.2.0

## 0.0.24

### Patch Changes

- Updated dependencies [[`5947e2e`](https://github.com/frak-id/wallet/commit/5947e2ebfd449ebf54b2a1e9e311795419f26991)]:
  - @frak-labs/core-sdk@0.1.1

## 0.0.23

### Patch Changes

- [#113](https://github.com/frak-id/wallet/pull/113) [`3b111c4`](https://github.com/frak-id/wallet/commit/3b111c44109e7bd23e2b7fbe4056b8c153af101d) Thanks [@KONFeature](https://github.com/KONFeature)! - Review inter frame communication (sso <> wallet | sdk <> wallet)

- [#113](https://github.com/frak-id/wallet/pull/113) [`2ff23da`](https://github.com/frak-id/wallet/commit/2ff23dad85825d0b28ea1b4ad743f37405711b01) Thanks [@KONFeature](https://github.com/KONFeature)! - Publish @frak-labs/frame-connector as a standalone package - a type-safe RPC layer for cross-window postMessage communication

- Updated dependencies [[`3b111c4`](https://github.com/frak-id/wallet/commit/3b111c44109e7bd23e2b7fbe4056b8c153af101d), [`2ff23da`](https://github.com/frak-id/wallet/commit/2ff23dad85825d0b28ea1b4ad743f37405711b01)]:
  - @frak-labs/frame-connector@0.1.0
  - @frak-labs/core-sdk@0.1.0

## 0.0.22

### Patch Changes

- [#108](https://github.com/frak-id/wallet/pull/108) [`ac15f08`](https://github.com/frak-id/wallet/commit/ac15f0807d63776520f9f954148da1ac87d7bd7b) Thanks [@KONFeature](https://github.com/KONFeature)! - Round reward amount instead of ceiling them in the UI

- Updated dependencies [[`ac15f08`](https://github.com/frak-id/wallet/commit/ac15f0807d63776520f9f954148da1ac87d7bd7b)]:
  - @frak-labs/core-sdk@0.0.19

## 0.0.21

### Patch Changes

- [#105](https://github.com/frak-id/wallet/pull/105) [`2538a52`](https://github.com/frak-id/wallet/commit/2538a52bcd2ff9b55bddd12a07c7309a28d29b7e) Thanks [@KONFeature](https://github.com/KONFeature)! - Fix openpanel analytics

- Updated dependencies [[`2538a52`](https://github.com/frak-id/wallet/commit/2538a52bcd2ff9b55bddd12a07c7309a28d29b7e)]:
  - @frak-labs/core-sdk@0.0.18

## 0.0.20

### Patch Changes

- [#103](https://github.com/frak-id/wallet/pull/103) [`333691e`](https://github.com/frak-id/wallet/commit/333691ec7b35768368731584c842d093cef61c05) Thanks [@KONFeature](https://github.com/KONFeature)! - Add analytics tracking within the SDK

- Updated dependencies [[`333691e`](https://github.com/frak-id/wallet/commit/333691ec7b35768368731584c842d093cef61c05)]:
  - @frak-labs/core-sdk@0.0.17

## 0.0.19

### Patch Changes

- [#93](https://github.com/frak-id/wallet/pull/93) [`1772437`](https://github.com/frak-id/wallet/commit/1772437ef7aee3e920de32b721df212c0c8a085b) Thanks [@srod](https://github.com/srod)! - Handle new `redirect` lifecycle event to exit social inapp browser

- Updated dependencies [[`1772437`](https://github.com/frak-id/wallet/commit/1772437ef7aee3e920de32b721df212c0c8a085b)]:
  - @frak-labs/core-sdk@0.0.16

## 0.0.18

### Patch Changes

- [#76](https://github.com/frak-id/wallet/pull/76) [`6afe559`](https://github.com/frak-id/wallet/commit/6afe5598b1a0be7642499c4d230bea882cd862ca) Thanks [@srod](https://github.com/srod)! - 🔧 Update import paths for CborEncoder and CborDecoder to include index.js

- Updated dependencies [[`6afe559`](https://github.com/frak-id/wallet/commit/6afe5598b1a0be7642499c4d230bea882cd862ca)]:
  - @frak-labs/core-sdk@0.0.15

## 0.0.17

### Patch Changes

- [#73](https://github.com/frak-id/wallet/pull/73) [`4dc9621`](https://github.com/frak-id/wallet/commit/4dc962139594cc8aed9699d918f0cde692325709) Thanks [@srod](https://github.com/srod)! - ✨ Initialize components SDK in loader

- Updated dependencies [[`4dc9621`](https://github.com/frak-id/wallet/commit/4dc962139594cc8aed9699d918f0cde692325709)]:
  - @frak-labs/core-sdk@0.0.14

## 0.0.16

### Patch Changes

- [#68](https://github.com/frak-id/wallet/pull/68) [`e655722`](https://github.com/frak-id/wallet/commit/e6557223f8eaa684b99d1e07f554ae5dc66730a3) Thanks [@KONFeature](https://github.com/KONFeature)! - Side effect of core package update

- Updated dependencies [[`6c4b99c`](https://github.com/frak-id/wallet/commit/6c4b99caafc1a144edd8ac71e0dabe4d0a38248f)]:
  - @frak-labs/core-sdk@0.0.13

## 0.0.15

### Patch Changes

- [`0cd5358`](https://github.com/frak-id/wallet/commit/0cd53582925ba5bd0c3620a1b61bf4e377b88372) Thanks [@srod](https://github.com/srod)! - ✨ Open Wallet embedded when receiving a shared link

- Updated dependencies [[`0cd5358`](https://github.com/frak-id/wallet/commit/0cd53582925ba5bd0c3620a1b61bf4e377b88372)]:
  - @frak-labs/core-sdk@0.0.12

## 0.0.14

### Patch Changes

- [`cc0e807`](https://github.com/frak-id/wallet/commit/cc0e807add74165ac56ebd3289c1d5e90bd367b9) Thanks [@srod](https://github.com/srod)! - ✨ Add BUILD_TIMESTAMP to components for dynamic CDN loading

- Updated dependencies [[`cc0e807`](https://github.com/frak-id/wallet/commit/cc0e807add74165ac56ebd3289c1d5e90bd367b9)]:
  - @frak-labs/core-sdk@0.0.11

## 0.0.13

### Patch Changes

- [#57](https://github.com/frak-id/wallet/pull/57) [`ab7e97c`](https://github.com/frak-id/wallet/commit/ab7e97c31d67d92d17f41ed4ae67e940f699a533) Thanks [@KONFeature](https://github.com/KONFeature)! - Add `frakAction` query param on website to automaticly open sharing modal

- Updated dependencies [[`fdfcdbf`](https://github.com/frak-id/wallet/commit/fdfcdbf0133fd71dd89b87b061988c0c8225c8c0), [`1764657`](https://github.com/frak-id/wallet/commit/176465722aafb9e392bcb62d6b504c6521ab71f8), [`a759718`](https://github.com/frak-id/wallet/commit/a759718b2ff4cb6be21a7b8cb535299d0517f99f), [`5951f94`](https://github.com/frak-id/wallet/commit/5951f94b7dd5fd7e655df00e85f1d7bab03cfaaa)]:
  - @frak-labs/core-sdk@0.0.10

## 0.0.12

### Patch Changes

- [`2381c27`](https://github.com/frak-id/wallet/commit/2381c274dc6240eeb96f9fd7683315ee4f052aea) Thanks [@srod](https://github.com/srod)! - ✨ Add currency support in config

- Updated dependencies [[`2381c27`](https://github.com/frak-id/wallet/commit/2381c274dc6240eeb96f9fd7683315ee4f052aea)]:
  - @frak-labs/core-sdk@0.0.9

## 0.0.11

### Patch Changes

- [`aa3c9f5`](https://github.com/frak-id/wallet/commit/aa3c9f5faf690110f4c5de5700c5e825e731941c) Thanks [@srod](https://github.com/srod)! - ✨ Build all SDK with rslib
  ✨ Build components SDK as a library to be published on NPM
  ✨ Refactor component loader for CDN distribution
- Updated dependencies [[`aa3c9f5`](https://github.com/frak-id/wallet/commit/aa3c9f5faf690110f4c5de5700c5e825e731941c)]:
  - @frak-labs/core-sdk@0.0.8

## 0.0.10

### Patch Changes

- [`4cb4784`](https://github.com/frak-id/wallet/commit/4cb47841c8299b82957606793222726aed5a1db4) Thanks [@srod](https://github.com/srod)! - 🐛 Fix `modalWalletConfig` that can be undefined

## 0.0.9

### Patch Changes

- [`2b0c2d3`](https://github.com/frak-id/wallet/commit/2b0c2d3f2f78a3ccf1eb8be1602fb72ab4a39aaf) Thanks [@srod](https://github.com/srod)! - 🐛 Fix double publish

- Updated dependencies [[`2b0c2d3`](https://github.com/frak-id/wallet/commit/2b0c2d3f2f78a3ccf1eb8be1602fb72ab4a39aaf)]:
  - @frak-labs/core-sdk@0.0.7

## 0.0.8

### Patch Changes

- [`0a82e0c`](https://github.com/frak-id/wallet/commit/0a82e0c6ea117a36ed2459fd682af52605922733) Thanks [@srod](https://github.com/srod)! - Add new config `position` to `frak-button-wallet`

- Updated dependencies [[`0a82e0c`](https://github.com/frak-id/wallet/commit/0a82e0c6ea117a36ed2459fd682af52605922733)]:
  - @frak-labs/core-sdk@0.0.6

## 0.0.7

### Patch Changes

- [`64e1a8e`](https://github.com/frak-id/wallet/commit/64e1a8eee7bde61cf1fbe1ce269bfdf66f1253f7) Thanks [@KONFeature](https://github.com/KONFeature)! - Add the option to specify a `targetInteraction` for sharing modal and the `ButtonShare` component

- Updated dependencies [[`fef225f`](https://github.com/frak-id/wallet/commit/fef225ff27b381f0b4f4575f99e44b9dc1400d03), [`fef225f`](https://github.com/frak-id/wallet/commit/fef225ff27b381f0b4f4575f99e44b9dc1400d03), [`64e1a8e`](https://github.com/frak-id/wallet/commit/64e1a8eee7bde61cf1fbe1ce269bfdf66f1253f7)]:
  - @frak-labs/core-sdk@0.0.5

## 0.0.6

### Patch Changes

- [`40b1af3`](https://github.com/frak-id/wallet/commit/40b1af3e4cc5e94da4d963d46aa7c87055223342) Thanks [@KONFeature](https://github.com/KONFeature)! - Update to latest `@frak-labs/core-sdk` version

## 0.0.5

### Patch Changes

- [`6f5c9b4`](https://github.com/frak-id/wallet/commit/6f5c9b45aafb67db173e9652830c39e7bc5b72df) Thanks [@srod](https://github.com/srod)! - ♻️ Move components to sdk/components

## 0.0.4

### Patch Changes

- [`3e3e9e2`](https://github.com/frak-id/wallet/commit/3e3e9e28d76c7146f50855f623bd9c6e9a292698) Thanks [@srod](https://github.com/srod)! - Don't load full SDK and move bundle to its folder

## 0.0.3

### Patch Changes

- [`7d5ad39`](https://github.com/frak-id/wallet/commit/7d5ad3971f0f24d78bcf4a60b4059901cf870308) Thanks [@srod](https://github.com/srod)! - Don't use workspace in package.json

## 0.0.2

### Patch Changes

- [`b6f5f60`](https://github.com/frak-id/wallet/commit/b6f5f606a11512d8ebb6008d8315cef235275b11) Thanks [@srod](https://github.com/srod)! - Initial version
