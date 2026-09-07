// Clients

export { ssoPopupFeatures, ssoPopupName } from "./actions/openSso";
export { createIFrameFrakClient, setupClient } from "./clients";
// Config (reactive merchant config + identity)
export {
    getBackendUrl,
    getClientId,
    getClientIdAsync,
    getEnvironment,
    type ResolvedEnvironment,
    sdkConfigStore,
    setEnvironment,
} from "./config";
// Constants
export { DEEP_LINK_SCHEME } from "./constants";
export type { InteractionTypeKey } from "./constants/interactionTypes";
// Context (FrakContext URL codec + attribution merge)
export {
    areAddressesEqual,
    FrakContextManager,
    type MergeAttributionInput,
    mergeAttribution,
} from "./context";
// Types
export type {
    AttributionDefaults,
    AttributionParams,
    ClientLifecycleEvent,
    CompressedData,
    ConditionGroup,
    ConditionOperator,
    Currency,
    DisplayModalParamsType,
    // RPC Sharing page
    DisplaySharingPageParamsType,
    DisplaySharingPageResultType,
    EstimatedReward,
    FinalActionType,
    FinalModalStepType,
    // Client
    FrakClient,
    // Utils
    FrakContext,
    FrakContextV1,
    FrakContextV2,
    FrakEnvironment,
    FrakLifecycleEvent,
    // Config
    FrakWalletSdkConfig,
    GetMerchantInformationReturnType,
    HashProtectedData,
    I18nConfig,
    IFrameLifecycleEvent,
    IFrameRpcSchema,
    // Transport
    IFrameTransport,
    // Compression
    KeyProvider,
    Language,
    ListenerPreloadOption,
    LocalizedI18nConfig,
    LoginModalStepType,
    MerchantConfigResponse,
    MerchantReward,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
    // RPC Modal types
    ModalStepMetadata,
    // RPC Modal generics
    ModalStepTypes,
    OpenSsoArgsType,
    OpenSsoParamsType,
    OpenSsoReturnType,
    OpenSsoUrlParamsType,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
    ProductDetails,
    ResolvedPlacement,
    ResolvedSdkConfig,
    RewardTier,
    RuleCondition,
    RuleConditions,
    RuleField,
    SdkResolvedConfig,
    // RPC Interaction
    SendInteractionParamsType,
    SendTransactionModalStepType,
    SendTransactionReturnType,
    SendTransactionTxType,
    SharingPageProduct,
    SiweAuthenticateModalStepType,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
    SsoMetadata,
    TokenAmountType,
    // Tracking
    TrackArrivalParams,
    TrackArrivalResult,
    // Rpc
    UserReferralStatusType,
    UtmParams,
    WalletStatusReturnType,
} from "./types";

// Utils
export {
    type AppSpecificSsoMetadata,
    base64urlDecode,
    base64urlEncode,
    baseIframeProps,
    buildListenerUrl,
    type CompressedSsoData,
    clearAllCache,
    coerceProductCandidates,
    compressJsonToB64,
    type DeepLinkFallbackOptions,
    decodeProductsParam,
    decompressJsonFromB64,
    deleteQueryParamCaseInsensitive,
    detectPageLanguage,
    type FullSsoParams,
    findIframeInOpener,
    formatAmount,
    formatAmountParts,
    generateSsoUrl,
    getCurrencyAmountKey,
    getQueryParamCaseInsensitive,
    getSupportedCurrency,
    isInAppBrowser,
    isIOS,
    isMobile,
    normalizeProductDetails,
    normalizeSharingProduct,
    redirectToExternalBrowser,
    sanitizeProductDetailsList,
    sanitizeSharingProducts,
    trackEvent,
    triggerDeepLinkWithFallback,
    withCache,
} from "./utils";
export type {
    SdkEventMap,
    SdkHandshakeFailureReason,
} from "./utils/analytics";
