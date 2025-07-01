import { type Address, isAddressEqual } from "viem";
import {
    addresses,
    currentStablecoins,
    usdcArbitrumAddress,
} from "../blockchain/addresses";

/**
 * Detect currency from token address
 * @param tokenAddress The token address to check
 * @returns The currency if detected, undefined otherwise
 */
export function detectCurrencyFromToken(
    tokenAddress: Address
): "eur" | "gbp" | "usd" | undefined {
    if (isAddressEqual(tokenAddress, currentStablecoins.eure)) {
        return "eur";
    }
    if (isAddressEqual(tokenAddress, currentStablecoins.gbpe)) {
        return "gbp";
    }
    if (
        isAddressEqual(tokenAddress, usdcArbitrumAddress) ||
        isAddressEqual(tokenAddress, addresses.mUSDToken) ||
        isAddressEqual(tokenAddress, currentStablecoins.usde)
    ) {
        return "usd";
    }
    return undefined;
}

/**
 * Get token address for currency
 * @param currency The currency to get token address for
 * @returns The token address
 */
export function getTokenAddressForCurrency(
    currency: "eur" | "gbp" | "usd"
): Address {
    switch (currency) {
        case "eur":
            return currentStablecoins.eure;
        case "gbp":
            return currentStablecoins.gbpe;
        case "usd":
            return usdcArbitrumAddress;
    }
}
