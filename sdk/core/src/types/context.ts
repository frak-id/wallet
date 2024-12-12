import type { Address } from "viem";

/**
 * The current Frak Context
 *
 * For now, only contain a referrer address.
 */
export type FrakContext = Readonly<{
    // Referrer address
    r: Address;
}>;
