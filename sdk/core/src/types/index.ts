// Rpc related
export type { WalletStatusReturnType } from "./rpc/walletStatus";
export type {
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    LoggedOutEmbeddedView,
    LoggedInEmbeddedView,
    EmbeddedViewActionReferred,
    EmbeddedViewActionSharing,
} from "./rpc/embedded";
export type {
    SsoMetadata,
    OpenSsoParamsType,
    OpenSsoReturnType,
} from "./rpc/sso";
export type {
    TokenAmountType,
    GetProductInformationReturnType,
} from "./rpc/productInformation";
export type {
    PreparedInteraction,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "./rpc/interaction";
export { FrakRpcError, RpcErrorCodes, ClientNotFound } from "./rpc/error";
export type { IFrameRpcSchema } from "./rpc";
// Client related
export type { FrakClient } from "./client";
export type {
    IFrameTransport,
    IFrameRpcEvent,
    IFrameEvent,
    ExtractedParametersFromRpc,
    ExtractedReturnTypeFromRpc,
    ExtractedMethodFromRpc,
    RpcResponse,
} from "./transport";
export type {
    IFrameLifecycleEvent,
    ClientLifecycleEvent,
} from "./lifecycle";
export type {
    FrakWalletSdkConfig,
    Currency,
    Language,
    I18nConfig,
    LocalizedI18nConfig,
} from "./config";
export type {
    CompressedData,
    HashProtectedData,
    KeyProvider,
} from "./compression";
// Modal related
export type {
    ModalStepTypes,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
    DisplayModalParamsType,
    ModalRpcMetadata,
} from "./rpc/displayModal";
export type {
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
} from "./rpc/modal";
// Utils
export type { FrakContext } from "./context";
