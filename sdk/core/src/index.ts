// Clients
export { createIFrameNexusClient } from "./clients";

// Utils
export {
    hashAndCompressData,
    decompressDataAndCheckHash,
    compressJson,
    decompressJson,
    createIframe,
    FrakContextManager,
    Deferred,
    baseIframeProps,
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
    GetProductInformationReturnType,
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
    NexusClient,
    // Transport
    RpcResponse,
    IFrameTransport,
    IFrameRpcEvent,
    IFrameEvent,
    IFrameLifecycleEvent,
    ClientLifecycleEvent,
    ExtractedParametersFromRpc,
    ExtractedReturnTypeFromRpc,
    // Config
    NexusWalletSdkConfig,
    // Compression
    KeyProvider,
    CompressedData,
    HashProtectedData,
} from "./types";
export { FrakRpcError, RpcErrorCodes, ClientNotFound } from "./types";
