import type { Address } from "viem";
import { isAddressEqual } from "viem";
import {
    type Stablecoin,
    currentStablecoins,
    usdcArbitrumAddress,
} from "../blockchain/addresses";

/**
 * Get token address for currency
 * @param currency The currency to get token address for
 * @returns The token address
 */
export function getTokenAddressForStablecoin(currency: Stablecoin): Address {
    switch (currency) {
        case "eure":
            return currentStablecoins.eure;
        case "gbpe":
            return currentStablecoins.gbpe;
        case "usde":
            return currentStablecoins.usde;
        case "usdc":
            return usdcArbitrumAddress;
    }
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
