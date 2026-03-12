// Analytics
export {
    openPanel,
    setProfileId,
    trackAuthCompleted,
    trackAuthFailed,
    trackAuthInitiated,
    trackGenericEvent,
    updateGlobalProperties,
} from "./analytics";

// API
export {
    authenticatedBackendApi,
    authenticatedWalletApi,
} from "./api/backendClient";

// Components
export { Drawer, DrawerContent, DrawerTrigger } from "./component/Drawer";
export { InAppBrowserToast } from "./component/InAppBrowserToast";
export { Markdown } from "./component/Markdown";
export { TextData } from "./component/TextData";
export { Toast } from "./component/Toast";
export { WalletModal } from "./component/WalletModal";
export { Warning } from "./component/Warning";

// Hooks
export { useAddToHomeScreenPrompt } from "./hook/useAddToHomeScreenPrompt";
export { useGetSafeSdkSession } from "./hook/useGetSafeSdkSession";
export { useMountedTimeout } from "./hook/useMountedTimeout";
export { useSessionFlag } from "./hook/useSessionFlag";
// Lib
export {
    inAppRedirectUrl,
    isInAppBrowser,
    isInIframe,
} from "./lib/inApp";
export { ua } from "./lib/ua";
export { isWebAuthNSupported } from "./lib/webauthn";
// Notification
export type {
    NotificationAdapter,
    PushTokenPayload,
} from "./notification";
export { notificationAdapter } from "./notification";

// Query Keys
export { balanceKey } from "./queryKeys/balance";
export { rewardsKey } from "./queryKeys/rewards";
export { sdkKey } from "./queryKeys/sdk";

// Storage
export { authenticatorStorage } from "./storage/authenticators";
export type { NotificationModel } from "./storage/NotificationModel";
export { notificationStorage } from "./storage/notifications";
export type { PreviousAuthenticatorModel } from "./storage/PreviousAuthenticatorModel";

// Utils
export {
    getFromLocalStorage,
    getSafeSdkSession,
    getSafeSession,
} from "./utils/safeSession";
