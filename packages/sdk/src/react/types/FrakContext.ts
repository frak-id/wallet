import type { Address } from "viem";

/**
 * The type of the nexus context
 */
export type FrakContext = Readonly<{
    // Referrer address
    r: Address;
}>;
