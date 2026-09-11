import type { SdkSession, Session } from "./Session";

/**
 * SSO window -> wallet iframe schema: an SSO window opened via `window.open`
 * posting back to `window.opener`, not the SDK iframe channel.
 */
export type SsoRpcSchema = [
    {
        Method: "sso_complete";
        Parameters: [session: Session, sdkSession: SdkSession];
        ReturnType: { success: true };
    },
];
