// Icons
export {
    LogoFrakBadge,
    LogoFrakWithName,
} from "@frak-labs/design-system/icons";
// HandleErrors lives under `authentication/component/` for historical reasons
// but is dependency-free (clsx + react-i18next only). Re-exporting it from
// `common` so the listener can pull it without touching the `authentication`
// barrel — which transitively drags `ox` + `viem/accounts` via `useLogin`.
export {
    HandleErrors,
    isUserCancellation,
} from "../authentication/component/HandleErrors";
export type {
    AppErrorSource,
    AuthEventMap,
    DeepLinkEventMap,
    DeepLinkSource,
    DiagnosticsEventMap,
    EmbeddedWalletEventMap,
    EventMap,
    Flow,
    FlowEndExtras,
    FlowEvents,
    FlowOutcome,
    FlowStartExtras,
    InAppBrowserRedirectTarget,
    InstallEventMap,
    InstallPageView,
    InstallReferrerMissingReason,
    InstallSource,
    InstallStore,
    ListenerMiscEventMap,
    ListenerTxEventMap,
    ModalDismissSource,
    ModalEventMap,
    MoneriumCallbackOutcome,
    MoneriumEventMap,
    NotificationEventMap,
    NotificationOptInOutcome,
    NotificationTogglePhase,
    OnboardingAction,
    OnboardingEventMap,
    PairingErrorState,
    PairingEventMap,
    PairingMode,
    RecordErrorOptions,
    SharingEventMap,
    SharingSource,
    TokensEventMap,
    TokensSendAmountBucket,
    WalletModalEventMap,
} from "./analytics";
export {
    crashlytics,
    extractAuthError,
    getOrCreateSessionId,
    identifyAuthenticatedUser,
    initAnalytics,
    openPanel,
    recordError,
    setInstallSource,
    setProfileId,
    startFlow,
    trackEvent,
    updateGlobalProperties,
} from "./analytics";
// API
export {
    authenticatedBackendApi,
    authenticatedWalletApi,
} from "./api/backendClient";
export {
    type ApiError,
    type ApiErrorBody,
    type ApiErrorKeyMap,
    asApiError,
    getErrorCode,
    getErrorStatus,
    resolveApiErrorKey,
} from "./api/errors";
// Components
export { CodeInput } from "./component/CodeInput";
export { ExternalLink } from "./component/ExternalLink";
export { InAppBrowserToast } from "./component/InAppBrowserToast";
export { Markdown } from "./component/Markdown";
export { OfflineBanner } from "./component/OfflineBanner";
export { PaginationDots } from "./component/PaginationDots";
// Hooks
export { useCopyToClipboardWithState } from "./hook/useCopyToClipboardWithState";
export {
    estimatedRewardsQueryOptions,
    formatEstimatedReward,
    selectFormattedReward,
    } from "./hook/useEstimatedReward";
export { useFormattedEstimatedReward } from "./hook/useFormattedEstimatedReward";
export { useGetSafeSdkSession } from "./hook/useGetSafeSdkSession";
export { useMountedTimeout } from "./hook/useMountedTimeout";
export { useOnlineStatus } from "./hook/useOnlineStatus";
export { useSessionFlag } from "./hook/useSessionFlag";
// Lib
export { isInIframe } from "./lib/inApp";
export { ua } from "./lib/ua";
export { isWebAuthNSupported } from "./lib/webauthn";

// Query Keys
export { balanceKey } from "./queryKeys/balance";
export { rewardsKey } from "./queryKeys/rewards";
export { sdkKey } from "./queryKeys/sdk";

// Storage
export { authenticatorStorage } from "./storage/authenticators";
export type { PreviousAuthenticatorModel } from "./storage/PreviousAuthenticatorModel";
export type { RecoveryHint } from "./storage/recoveryHint";
export { recoveryHintStorage } from "./storage/recoveryHint";
// Utils
// Tauri
export { getInvoke } from "./tauri";
export { formatCurrency } from "./utils/formatCurrency";
export { emitLifecycleEvent } from "./utils/lifecycleEvents";
export { openExternalUrl } from "./utils/openExternalUrl";
export { prefixModalCss } from "./utils/prefixModalCss";
export {
    getFromLocalStorage,
    getSafeSdkSession,
    getSafeSession,
} from "./utils/safeSession";
export {
    APP_STORE_URL,
    getRateAppUrl,
    PLAY_STORE_URL,
    STORE_PACKAGE_ID,
} from "./utils/storeUrls";
