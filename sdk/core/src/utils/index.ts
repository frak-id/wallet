// Generic, framework-agnostic utilities. Keep this surface narrow.
export { trackEvent } from "./analytics";
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
export { clearAllCache, withCache } from "./cache";
export { base64urlDecode, base64urlEncode } from "./compression/b64";
export { compressJsonToB64 } from "./compression/compress";
export { decompressJsonFromB64 } from "./compression/decompress";
export { formatAmount } from "./format/formatAmount";
export {
    formatAmountParts,
    percentAmountParts,
    type RewardAmountParts,
} from "./format/formatAmountParts";
export { getCurrencyAmountKey } from "./format/getCurrencyAmountKey";
export { getSupportedCurrency } from "./format/getSupportedCurrency";
export { getSupportedLocale } from "./format/getSupportedLocale";
export { detectPageLanguage } from "./i18n/detectPageLanguage";
export {
    baseIframeProps,
    buildListenerUrl,
    createIframe,
    findIframeInOpener,
} from "./iframe/iframeHelper";
export {
    coerceProductCandidates,
    decodeProductsParam,
    normalizeProductDetails,
    normalizeSharingProduct,
    sanitizeProductDetailsList,
    sanitizeSharingProducts,
} from "./product/sanitizeProducts";
export {
    type AppSpecificSsoMetadata,
    type CompressedSsoData,
    type FullSsoParams,
    generateSsoUrl,
} from "./sso/sso";
export {
    deleteQueryParamCaseInsensitive,
    getQueryParamCaseInsensitive,
} from "./url/queryParams";
