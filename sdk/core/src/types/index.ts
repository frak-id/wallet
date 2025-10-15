// Rpc related

// Client related
export type { FrakClient } from "./client";
export type {
    CompressedData,
    HashProtectedData,
    KeyProvider,
} from "./compression";
export type {
    Currency,
    FrakWalletSdkConfig,
    I18nConfig,
    Language,
    LocalizedI18nConfig,
} from "./config";
// Utils
export type { FrakContext } from "./context";
export type {
    ClientLifecycleEvent,
    IFrameLifecycleEvent,
} from "./lifecycle";
export type { IFrameRpcSchema } from "./rpc";
// Modal related
export type {
    DisplayModalParamsType,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "./rpc/displayModal";
export type {
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    EmbeddedViewActionReferred,
    EmbeddedViewActionSharing,
    LoggedInEmbeddedView,
    LoggedOutEmbeddedView,
} from "./rpc/embedded";
export type {
    PreparedInteraction,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "./rpc/interaction";
export type {
    FinalActionType,
    FinalModalStepType,
    LoginModalStepType,
    ModalStepMetadata,
    OpenInteractionSessionModalStepType,
    OpenInteractionSessionReturnType,
    SendTransactionModalStepType,
    SendTransactionReturnType,
    SendTransactionTxType,
    SiweAuthenticateModalStepType,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "./rpc/modal";
export type {
    GetProductInformationReturnType,
    TokenAmountType,
} from "./rpc/productInformation";
export type {
    OpenSsoParamsType,
    OpenSsoReturnType,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
    SsoMetadata,
} from "./rpc/sso";
export type { WalletStatusReturnType } from "./rpc/walletStatus";
export type { FrakLifecycleEvent, IFrameTransport } from "./transport";
