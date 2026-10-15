/** Monerium telemetry. Never carries an IBAN, a name, a country or an exact amount. */
/**
 * Portal callback outcomes: `cancelled` (user denied), `session_expired`
 * (backend no longer knows the `state`), `error`, `no_code` (no OAuth context).
 */
export type MoneriumCallbackOutcome =
    | "exchanged"
    | "session_expired"
    | "cancelled"
    | "error"
    | "no_code";

/** Why a silent Sign-In-With-Ethereum reconnect did not end the flow. */
export type MoneriumSiweFailure = "cancelled" | "rejected" | "error";

export type MoneriumOrderAmountBucket =
    | "under_50"
    | "50_to_500"
    | "500_to_5000"
    | "over_5000";

export type MoneriumEventMap = {
    /** User clicked Connect; `method` is the first path attempted. */
    monerium_auth_started: {
        is_tauri: boolean;
        method: "siwe" | "portal";
    };
    /** Terminal state of the portal callback (fires once per mount). */
    monerium_callback_outcome: {
        outcome: MoneriumCallbackOutcome;
    };
    monerium_siwe_attempt: undefined;
    monerium_siwe_outcome: {
        outcome: "success" | MoneriumSiweFailure;
    };
    /** The silent reconnect was rejected or failed, the user is sent to the Monerium portal instead. */
    monerium_siwe_fallback: {
        reason: Exclude<MoneriumSiweFailure, "cancelled">;
    };
    monerium_order_placed: {
        own: boolean;
        amount_bucket: MoneriumOrderAmountBucket;
    };
    monerium_order_failed: {
        own: boolean;
        amount_bucket: MoneriumOrderAmountBucket;
        code: string;
    };
};
