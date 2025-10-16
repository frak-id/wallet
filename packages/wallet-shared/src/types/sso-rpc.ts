import type { SdkSession, Session } from "./Session";

/**
 * SSO RPC Schema
 *
 * Used for SSO window -> wallet iframe communication.
 * Unlike IFrameRpcSchema (SDK iframe -> wallet), this is used when
 * SSO windows (opened via window.open) send messages back to window.opener.
 *
 * @remarks
 * Methods:
 * - sso_complete: Called when SSO authentication succeeds
 * - sso_error: Called when SSO authentication fails
 */
export type SsoRpcSchema = [
    {
        Method: "sso_complete";
        Parameters: [session: Session, sdkSession: SdkSession];
        ReturnType: { success: true };
    },
];
