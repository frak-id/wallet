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
export {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
    DrawerTrigger,
} from "./component/Drawer";
export { InAppBrowserToast } from "./component/InAppBrowserToast";
export { Markdown } from "./component/Markdown";
export { TextData } from "./component/TextData";
export { Toast } from "./component/Toast";
export { WalletModal } from "./component/WalletModal";
export { Warning } from "./component/Warning";
// Hooks
export { useAddToHomeScreenPrompt } from "./hook/useAddToHomeScreenPrompt";
export { useCopyToClipboardWithState } from "./hook/useCopyToClipboardWithState";
export {
    estimatedRewardsQueryOptions,
    selectFormattedReward,
    useFormattedEstimatedReward,
} from "./hook/useEstimatedReward";
export { useGetSafeSdkSession } from "./hook/useGetSafeSdkSession";
export { useMountedTimeout } from "./hook/useMountedTimeout";
export { useSessionFlag } from "./hook/useSessionFlag";
// Icons
export { LogoFrakWithName } from "@frak-labs/design-system/icons";
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
export { emitLifecycleEvent } from "./utils/lifecycleEvents";
export { prefixModalCss } from "./utils/prefixModalCss";
// Utils
export {
    getFromLocalStorage,
    getSafeSdkSession,
    getSafeSession,
} from "./utils/safeSession";
