import type { FlowEvents } from "./flow";

type AuthLoginFlow = FlowEvents<
    "auth_login",
    {
        method?: "global" | "specific";
        /** Auto-fired `/login` quick-login attempt vs. a user-initiated login. */
        trigger?: "auto" | "manual";
        /**
         * `_failed` only: a `trigger: "auto"` attempt that hit the expected
         * "no passkey on this device" signal (zero UI). Not a real auth
         * failure — filter it out of the failure rate on dashboards.
         */
        silent_fallthrough?: boolean;
    }
>;
type AuthRegisterFlow = FlowEvents<"auth_register">;
type AuthDemoFlow = FlowEvents<"auth_demo">;

type StandaloneAuthEvents = {
    // Pre-flow clicks on the login screen
    auth_login_method_selected: {
        method: "passkey" | "qr" | "email" | "register_redirect";
        /**
         * When method="passkey": did the user tap the pre-filled "use my
         * account 0x…" shortcut ("existing"), or the generic "connect
         * another account" button ("another")? Absent for QR / email /
         * redirect.
         */
        origin?: "existing" | "another";
    };
    auth_recovery_code_clicked: undefined;
    // Fired when the Android auto-fire self-heals a stale authenticator hint
    // after a silent `no-credential` outcome.
    auth_login_self_heal: { reason: "stale_hint_clear_attempted" };
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
