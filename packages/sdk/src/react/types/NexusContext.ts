import type { Address } from "viem";

/**
 * The type of the nexus context
 */
export type NexusContext = Readonly<{
    // Referrer address
    r: Address;
}>;
