// Clients

export { ssoPopupFeatures, ssoPopupName } from "./actions/openSso";
export {
    createIFrameFrakClient,
    DebugInfoGatherer,
    setupClient,
} from "./clients";

export {
    type FullInteractionTypesKey,
    type InteractionTypesKey,
    interactionTypes,
} from "./constants/interactionTypes";
export { type LocalesKey, locales } from "./constants/locales";
// Constants
export {
    type ProductTypesKey,
    productTypes,
    productTypesMask,
} from "./constants/productTypes";
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
    FinalActionType,
    FinalModalStepType,
    // Client
    FrakClient,
    // Utils
    FrakContext,
    FrakLifecycleEvent,
    // Config
    FrakWalletSdkConfig,
    GetProductInformationReturnType,
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
    // Interaction
    PreparedInteraction,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
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
    AUTH_STATE_KEY,
    base64urlDecode,
    base64urlEncode,
    baseIframeProps,
    type CompressedSsoData,
    clearClientId,
    clearMerchantIdCache,
    compressJsonToB64,
    createIframe,
    DEEP_LINK_SCHEME,
    decompressJsonFromB64,
    extractUtmParams,
    FrakContextManager,
    type FrakEvent,
    type FullSsoParams,
    fetchMerchantId,
    findIframeInOpener,
    formatAmount,
    generateMergeToken,
    generateSsoUrl,
    getBackendUrl,
    getClientId,
    getCurrencyAmountKey,
    getSupportedCurrency,
    getSupportedLocale,
    redirectWithMerge,
    resolveMerchantId,
    setupMergeTokenListener,
    trackEvent,
} from "./utils";
export { computeProductId } from "./utils/computeProductId";
