import type { FlowEvents } from "./flow";

type AuthLoginFlow = FlowEvents<
    "auth_login",
    { method?: "global" | "specific" }
>;
type AuthRegisterFlow = FlowEvents<"auth_register">;
type AuthDemoFlow = FlowEvents<"auth_demo">;

type StandaloneAuthEvents = {
    // Pre-flow clicks on the login screen
    auth_login_method_selected: {
        method: "passkey" | "qr" | "register_redirect";
        /**
         * When method="passkey": did the user tap the pre-filled "use my
         * account 0x…" shortcut ("existing"), or the generic "connect
         * another account" button ("another")? Absent for QR / redirect.
         */
        origin?: "existing" | "another";
    };
    auth_recovery_code_clicked: undefined;
    // Post-auth side-effects
    user_logged_in: undefined;
    logout: undefined;
    // Pairing — not flow-wrapped (different components fire start vs end)
    pairing_initiated: undefined;
    pairing_completed: undefined;
    // SSO — not flow-wrapped (popup/redirect spans different contexts)
    sso_initiated: { method: "popup" | "link" | "mobile" };
    sso_completed: undefined;
    sso_failed: { reason: string };
};

export type AuthEventMap = AuthLoginFlow &
    AuthRegisterFlow &
    AuthDemoFlow &
    StandaloneAuthEvents;
