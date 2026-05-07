// Generic, framework-agnostic utilities. Stateful concerns (config store,
// client identifiers) live in `src/config/`; URL/binary codecs for the
// referral context live in `src/context/`; SSO URL listener belongs to the
// iframe client lifecycle in `src/clients/`. Keep this surface narrow.
export { Deferred } from "@frak-labs/frame-connector";

// Analytics
export { trackEvent } from "./analytics";
// Browser / deep linking
export {
    type DeepLinkFallbackOptions,
    isChromiumAndroid,
    isFrakDeepLink,
    toAndroidIntentUrl,
    triggerDeepLinkWithFallback,
} from "./browser/deepLinkWithFallback";
export {
    isInAppBrowser,
    isIOS,
    isMobile,
    redirectToExternalBrowser,
} from "./browser/inAppBrowser";
// Cache
export { clearAllCache, getCache, withCache } from "./cache";
// Compression / encoding
export { base64urlDecode, base64urlEncode } from "./compression/b64";
export { compressJsonToB64 } from "./compression/compress";
export { decompressJsonFromB64 } from "./compression/decompress";

// Formatting / i18n
export { formatAmount } from "./format/formatAmount";
export { getCurrencyAmountKey } from "./format/getCurrencyAmountKey";
export { getSupportedCurrency } from "./format/getSupportedCurrency";
export { getSupportedLocale } from "./format/getSupportedLocale";

// Iframe DOM helpers
export {
    baseIframeProps,
    createIframe,
    findIframeInOpener,
} from "./iframe/iframeHelper";

// SSO URL builder
export {
    type AppSpecificSsoMetadata,
    type CompressedSsoData,
    type FullSsoParams,
    generateSsoUrl,
} from "./sso/sso";
