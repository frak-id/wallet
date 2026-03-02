import { isAddress } from "viem";

/**
 * Validate a purchase amount. Returns error message or null.
 */
export function validatePurchaseAmount(rawAmount: string): string | null {
    const amount = Number(rawAmount);
    if (Number.isNaN(amount)) return "Amount must be a number";
    if (amount < 10) return "Amount must be greater than 10";
    if (amount > 1000) return "Amount must be less than 1000";
    return null;
}

/**
 * Validate a bank address. Returns error message or null.
 */
export function validateBank(bank: string): string | null {
    if (!isAddress(bank)) return "Bank must be a valid address";
    return null;
}

/**
 * Parse numeric ID from a Shopify GID string.
 * e.g. parseShopifyGid("gid://shopify/Shop/12345", "Shop") → 12345
 */
export function parseShopifyGid(gid: string, resource: string): number {
    return Number.parseInt(gid.replace(`gid://shopify/${resource}/`, ""), 10);
}
