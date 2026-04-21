import type { AnalyticsAuthenticationType } from "../types";

type AuthMethod = "global" | "specific" | "popup" | "link" | "mobile";

type AuthFailureProps = {
    reason: string;
    error_type?: string;
    method?: AuthMethod;
    flow_id?: string;
};

/**
 * Auth event map — kept as snake_case top-level names to preserve historical
 * OpenPanel dashboards. New failure variants follow the same convention.
 * `AnalyticsAuthenticationType` is the source of truth for the auth domain;
 * this map is derived from it so new auth types flow through automatically.
 */
export type AuthEventMap = {
    [K in AnalyticsAuthenticationType as `${K}_initiated`]:
        | { method?: AuthMethod }
        | undefined;
} & {
    [K in AnalyticsAuthenticationType as `${K}_completed`]: undefined;
} & {
    [K in AnalyticsAuthenticationType as `${K}_failed`]: AuthFailureProps;
} & {
    user_logged_in: undefined;
    logout: undefined;
    auth_login_method_selected: { method: "passkey" | "qr" };
    auth_recovery_code_clicked: undefined;
};
