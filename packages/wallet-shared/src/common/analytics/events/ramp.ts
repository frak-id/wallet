import type { MoneriumOrderAmountBucket } from "./monerium";

/** Token the user cashes out from; EURe goes through a CoW swap to USDC first. */
export type RampOfframpSource = "eure" | "usdc";

/** Why the wallet refused a Ramp send request. */
export type RampSendRejection =
    | "unsupported_asset"
    | "invalid_address"
    | "invalid_amount"
    | "insufficient_balance";

/** Ramp off-ramp telemetry. Same privacy rule as Monerium: buckets, never exact amounts. */
export type RampEventMap = {
    ramp_offramp_started: { source: RampOfframpSource };
    ramp_swap_completed: { amount_bucket: MoneriumOrderAmountBucket };
    ramp_swap_failed: {
        amount_bucket: MoneriumOrderAmountBucket;
        reason: string;
    };
    ramp_sale_created: {
        fiat_currency: string;
        amount_bucket: MoneriumOrderAmountBucket;
    };
    ramp_crypto_sent: { amount_bucket: MoneriumOrderAmountBucket };
    ramp_send_rejected: { reason: RampSendRejection };
    ramp_send_failed: { cancelled: boolean };
    /** A native binary's CSP predates the Ramp widget or the CoW API. */
    ramp_blocked_by_csp: { directive: "frame-src" | "connect-src" };
};
