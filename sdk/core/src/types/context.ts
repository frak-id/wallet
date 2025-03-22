import type { Address } from "viem";

/**
 * The current Frak Context
 *
 * For now, only contain a referrer address.
 *
 * @ignore
 */
export type FrakContext = {
    // Referrer address
    r: Address;
};
