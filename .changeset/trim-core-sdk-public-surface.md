---
"@frak-labs/core-sdk": minor
"@frak-labs/components": patch
---

Trim the public API surface of `@frak-labs/core-sdk` by removing 11 leaked internal helpers that had no consumer outside of the SDK itself. This shrinks the always-loaded `@frak-labs/components` CDN loader (`cdn/loader.js`) and the core SDK's IIFE bundle (`window.FrakSDK`) without changing any other code — every downstream package + every `import * as` consumer cascades to a smaller surface automatically.

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
