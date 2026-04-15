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
export type { FrakContext, FrakContextV1, FrakContextV2 } from "./context";
export { isV1Context, isV2Context } from "./context";
export type {
    ClientLifecycleEvent,
    IFrameLifecycleEvent,
} from "./lifecycle";
export type {
    MerchantConfigResponse,
    ResolvedPlacement,
    ResolvedSdkConfig,
    SdkResolvedConfig,
} from "./resolvedConfig";
export type { IFrameRpcSchema } from "./rpc";
// Modal related
export type {
    DisplayModalParamsType,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "./rpc/displayModal";
// Sharing page related
export type {
    DisplaySharingPageParamsType,
    DisplaySharingPageResultType,
    SharingPageProduct,
} from "./rpc/displaySharingPage";
export type {
    DisplayEmbeddedWalletParamsType,
    DisplayEmbeddedWalletResultType,
    EmbeddedViewActionReferred,
    EmbeddedViewActionSharing,
    LoggedInEmbeddedView,
    LoggedOutEmbeddedView,
} from "./rpc/embedded";
export type { SendInteractionParamsType } from "./rpc/interaction";
export type {
    EstimatedReward,
    GetMerchantInformationReturnType,
    RewardTier,
    TokenAmountType,
} from "./rpc/merchantInformation";
export type {
    FinalActionType,
    FinalModalStepType,
    LoginModalStepType,
    ModalStepMetadata,
    SendTransactionModalStepType,
    SendTransactionReturnType,
    SendTransactionTxType,
    SiweAuthenticateModalStepType,
    SiweAuthenticateReturnType,
    SiweAuthenticationParams,
} from "./rpc/modal";
export type {
    OpenSsoParamsType,
    OpenSsoReturnType,
    PrepareSsoParamsType,
    PrepareSsoReturnType,
    SsoMetadata,
} from "./rpc/sso";
export type { UserReferralStatusType } from "./rpc/userReferralStatus";
export type { WalletStatusReturnType } from "./rpc/walletStatus";
// Tracking
export type {
    TrackArrivalParams,
    TrackArrivalResult,
    UtmParams,
} from "./tracking";
export type { FrakLifecycleEvent, IFrameTransport } from "./transport";
