// Clients
export {
    createIFrameFrakClient,
    setupClient,
    DebugInfoGatherer,
} from "./clients";

// Utils
export {
    compressJsonToB64,
    decompressJsonFromB64,
    createIframe,
    FrakContextManager,
    baseIframeProps,
    getSupportedCurrency,
    getSupportedLocale,
    getCurrencyAmountKey,
    formatAmount,
    base64urlDecode,
    base64urlEncode,
    trackEvent,
} from "./utils";

// Constants
export {
    type ProductTypesKey,
    productTypes,
    productTypesMask,
} from "./constants/productTypes";
export {
    interactionTypes,
    type InteractionTypesKey,
    type FullInteractionTypesKey,
} from "./constants/interactionTypes";
export { locales, type LocalesKey } from "./constants/locales";

// Types
export type {
    // Rpc
    WalletStatusReturnType,
    IFrameRpcSchema,
    PreparedInteraction,
    SendInteractionParamsType,
    SendInteractionReturnType,
    SsoMetadata,
    OpenSsoParamsType,
    OpenSsoReturnType,
    Currency,
    Language,
    I18nConfig,
    LocalizedI18nConfig,
    TokenAmountType,
    GetProductInformationReturnType,
    // RPC Embedded wallet
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    LoggedOutEmbeddedView,
    LoggedInEmbeddedView,
    EmbeddedViewActionReferred,
    EmbeddedViewActionSharing,
    // RPC Modal generics
    ModalStepTypes,
    ModalRpcMetadata,
    DisplayModalParamsType,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
    // RPC Modal types
    ModalStepMetadata,
    LoginModalStepType,
    SiweAuthenticateModalStepType,
    SiweAuthenticationParams,
    SiweAuthenticateReturnType,
    SendTransactionTxType,
    SendTransactionModalStepType,
    SendTransactionReturnType,
    OpenInteractionSessionReturnType,
    OpenInteractionSessionModalStepType,
    FinalModalStepType,
    FinalActionType,
    // Client
    FrakClient,
    // Transport
    IFrameTransport,
    IFrameLifecycleEvent,
    ClientLifecycleEvent,
    FrakLifecycleEvent,
    // Config
    FrakWalletSdkConfig,
    // Compression
    KeyProvider,
    CompressedData,
    HashProtectedData,
    // Utils
    FrakContext,
} from "./types";
