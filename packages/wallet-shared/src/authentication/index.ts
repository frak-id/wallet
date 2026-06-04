// Components
export { WebauthnErrorToast } from "./component/WebauthnErrorToast";

// Hooks
export { useLogin } from "./hook/useLogin";
export { useWebauthnErrorToast } from "./hook/useWebauthnErrorToast";
// Query Keys
export { authKey } from "./queryKeys/auth";
export { ssoKey } from "./queryKeys/sso";
// Stores
export {
    useWebauthnErrorToastStore,
    type WebauthnToastOperation,
} from "./stores/webauthnErrorToastStore";

// Utils
export { compressedSsoToParams } from "./utils/ssoDataCompression";
export {
    classifyWebauthnError,
    isAuthenticatorAlreadyRegistered,
    isReportableWebauthnError,
    isUserCancellation,
    type WebauthnError,
    type WebauthnErrorKind,
    webauthnErrorContext,
} from "./webauthn/errors";
export {
    resolveWebauthnErrorView,
    type WebauthnErrorView,
} from "./webauthn/errorView";
// WebAuthn Tauri bridge
export { getTauriCreateFn, getTauriGetFn } from "./webauthn/tauriBridge";
