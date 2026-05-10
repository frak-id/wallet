/**
 * Monerium OAuth flow telemetry — minimal start/end funnel for the bank
 * connect flow.
 *
 * Conversion = count(monerium_callback_outcome { outcome: "exchanged" })
 *            / count(monerium_auth_started).
 *
 * Other outcomes break down the drop-off:
 *   - cancelled       user denied at the OAuth provider
 *   - csrf_mismatch   returned `state` didn't match the stored nonce
 *   - session_expired PKCE verifier was gone by the time the callback ran
 *   - error           token exchange failed (network / Monerium / proxy)
 *   - no_code         callback route hit without an OAuth context
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
    /** Terminal state of the callback flow (fires once per mount). */
    monerium_callback_outcome: {
        outcome: MoneriumCallbackOutcome;
    };
};
