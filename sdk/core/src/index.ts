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
    ClientLifecycleEvent,
    CompressedData,
    Currency,
    // RPC Embedded wallet
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    DisplayModalParamsType,
    EmbeddedViewActionReferred,
    EmbeddedViewActionSharing,
    EstimatedReward,
    FinalActionType,
    FinalModalStepType,
    // Client
    FrakClient,
    // Utils
    FrakContext,
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
    RewardTier,
    // RPC Interaction
    SendInteractionParamsType,
    SendTransactionModalStepType,
    SendTransactionReturnType,
    SendTransactionTxType,
    SiweAuthenticateModalStepType,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
    SsoMetadata,
    TokenAmountType,
    // Tracking
    TrackArrivalInternalParams,
    TrackArrivalParams,
    TrackArrivalResult,
    UtmParams,
    // Rpc
    WalletStatusReturnType,
} from "./types";
// Utils
export {
    type AppSpecificSsoMetadata,
    base64urlDecode,
    base64urlEncode,
    baseIframeProps,
    type CompressedSsoData,
    clearMerchantIdCache,
    compressJsonToB64,
    createIframe,
    DEEP_LINK_SCHEME,
    type DeepLinkFallbackOptions,
    decompressJsonFromB64,
    FrakContextManager,
    type FrakEvent,
    type FullSsoParams,
    fetchMerchantId,
    findIframeInOpener,
    formatAmount,
    generateSsoUrl,
    getBackendUrl,
    getClientId,
    getCurrencyAmountKey,
    getSupportedCurrency,
    getSupportedLocale,
    isFrakDeepLink,
    resolveMerchantId,
    trackEvent,
    triggerDeepLinkWithFallback,
} from "./utils";
export { computeLegacyProductId } from "./utils/computeLegacyProductId";
