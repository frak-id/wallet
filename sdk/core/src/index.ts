// Clients

export { ssoPopupFeatures, ssoPopupName } from "./actions/openSso";
export {
    createIFrameFrakClient,
    DebugInfoGatherer,
    setupClient,
} from "./clients";

export type { InteractionTypeKey } from "./constants/interactionTypes";
export { type LocalesKey, locales } from "./constants/locales";

// Types
export type {
    AttributionParams,
    ClientLifecycleEvent,
    CompressedData,
    Currency,
    // RPC Embedded wallet
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    DisplayModalParamsType,
    // RPC Sharing page
    DisplaySharingPageParamsType,
    DisplaySharingPageResultType,
    EmbeddedViewActionReferred,
    EmbeddedViewActionSharing,
    EstimatedReward,
    FinalActionType,
    FinalModalStepType,
    // Client
    FrakClient,
    // Utils
    FrakContext,
    FrakContextV1,
    FrakContextV2,
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
    LocalizedI18nConfig,
    LoggedInEmbeddedView,
    LoggedOutEmbeddedView,
    LoginModalStepType,
    MerchantConfigResponse,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
    // RPC Modal types
    ModalStepMetadata,
    // RPC Modal generics
    ModalStepTypes,
    OpenSsoParamsType,
    OpenSsoReturnType,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
    ResolvedPlacement,
    ResolvedSdkConfig,
    RewardTier,
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
export { isV1Context, isV2Context } from "./types";
// Utils
export {
    type AppSpecificSsoMetadata,
    base64urlDecode,
    base64urlEncode,
    baseIframeProps,
    type CompressedSsoData,
    clearAllCache,
    compressJsonToB64,
    createIframe,
    DEEP_LINK_SCHEME,
    type DeepLinkFallbackOptions,
    decompressJsonFromB64,
    FrakContextManager,
    type FrakEvent,
    type FullSsoParams,
    findIframeInOpener,
    formatAmount,
    generateSsoUrl,
    getBackendUrl,
    getCache,
    getClientId,
    getCurrencyAmountKey,
    getSupportedCurrency,
    getSupportedLocale,
    isChromiumAndroid,
    isFrakDeepLink,
    isInAppBrowser,
    isIOS,
    redirectToExternalBrowser,
    sdkConfigStore,
    toAndroidIntentUrl,
    trackEvent,
    triggerDeepLinkWithFallback,
    withCache,
} from "./utils";
export { computeLegacyProductId } from "./utils/computeLegacyProductId";
