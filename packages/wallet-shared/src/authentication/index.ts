// Components
export { HandleErrors, isUserCancellation } from "./component/HandleErrors";

// Hooks
export { useLogin } from "./hook/useLogin";

// Query Keys
export { authKey } from "./queryKeys/auth";
export { ssoKey } from "./queryKeys/sso";

// Utils
export { compressedSsoToParams } from "./utils/ssoDataCompression";
export {
    CredentialManagerError,
    classifyNativeWebauthnError,
    getWebauthnErrorDetails,
    type WebauthnErrorCode,
    type WebauthnErrorDetails,
} from "./webauthn/errors";
// WebAuthn Tauri bridge
export { getTauriCreateFn, getTauriGetFn } from "./webauthn/tauriBridge";
