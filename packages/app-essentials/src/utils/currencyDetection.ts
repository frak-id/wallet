import type { Address } from "viem";
import { currentStablecoins, type Stablecoin } from "../blockchain/addresses";

/**
 * Get token address for currency
 * @param currency The currency to get token address for
 * @returns The token address
 */
export function getTokenAddressForStablecoin(currency: Stablecoin): Address {
    const address = currentStablecoins[currency];
    if (!address) throw new Error("Stablecoin address not found");
    return address;
}
