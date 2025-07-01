import type { Address } from "viem";

/**
 * The current Frak Context
 *
 * Contains referrer address and optional campaign ID for scoped targeting.
 *
 * @ignore
 */
export type FrakContext = {
    // Referrer address
    r: Address;
    // Campaign ID for scoped campaign targeting
    c?: Address;
};
