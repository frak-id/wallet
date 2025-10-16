import type { Address } from "viem";
import { isAddressEqual } from "viem";
import { type Stablecoin, currentStablecoins } from "../blockchain/addresses";

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

/**
 * Detect stablecoin from token address
 */
export function detectStablecoinFromToken(
    tokenAddress: Address
): Stablecoin | undefined {
    if (isAddressEqual(tokenAddress, currentStablecoins.eure)) return "eure";
    if (isAddressEqual(tokenAddress, currentStablecoins.gbpe)) return "gbpe";
    if (isAddressEqual(tokenAddress, currentStablecoins.usde)) return "usde";
    if (isAddressEqual(tokenAddress, currentStablecoins.usdc)) return "usdc";
    return undefined;
}
