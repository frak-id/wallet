/**
 * Monerium OAuth flow telemetry — instruments the bank-flow auth funnel from
 * "Connect" CTA → external browser → App Link callback → token exchange.
 *
 * Used to diagnose Android-specific deep-link delivery: the OAuth provider's
 * HTTPS redirect doesn't always trigger `onNewIntent` on the wallet activity.
 * Empirically, AOSP returns `START_TASK_TO_FRONT` (result code 2) instead of
 * `START_DELIVERED_TO_TOP` (3) for stopped `singleTask` activities launched
 * from a Chrome IntentDispatcher follow-up to a server 302, so the URL is
 * dropped before reaching `tauri-plugin-deep-link`.
 *
 * Funnel correlation: when `monerium_auth_started` count exceeds
 * `monerium_callback_received` count, callbacks were lost between Chrome and
 * the app. Compare against `pairing_*` / `install_*` counts (same App Link
 * infrastructure, but launched via direct user-tap-on-link) to confirm the
 * delivery gap is monerium-specific (i.e., server-redirect-driven).
 */
export type MoneriumCallbackOutcome =
    | "exchanged"
    | "session_expired"
    | "csrf_mismatch"
    | "cancelled"
    | "error"
    | "no_code";

export type MoneriumEventMap = {
    /** User clicked Connect — about to open the OAuth provider externally. */
    monerium_auth_started: {
        is_tauri: boolean;
    };
    /**
     * MoneriumCallback route mounted with the inputs visible to the
     * exchange logic. Compare against `monerium_auth_started` to detect
     * deep-link delivery gaps on Android.
     */
    monerium_callback_received: {
        has_code: boolean;
        has_state: boolean;
        has_pending_verifier: boolean;
        has_pending_state: boolean;
        has_error_param: boolean;
    };
    /** Terminal state of the callback flow (fires once per mount). */
    monerium_callback_outcome: {
        outcome: MoneriumCallbackOutcome;
    };
};
