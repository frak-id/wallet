import type { Address } from "viem";
import { isAddress } from "viem";

/**
 * Check if a URL is absolute (http, https, mailto, tel).
 */
export function isAbsoluteUrl(url: string): boolean {
    return /^(https?|mailto|tel):/.test(url);
}

/**
 * Parse a charge_id string to a number. Returns null if invalid.
 */
export function parseChargeId(rawChargeId: string | null): number | null {
    if (!rawChargeId) return null;
    const chargeId = Number.parseInt(rawChargeId, 10);
    if (Number.isNaN(chargeId)) return null;
    return chargeId;
}

/**
 * Validate a wallet address for mint operations.
 */
export function validateMintParams(
    walletAddress: string | null
): { valid: true; address: Address } | { valid: false; error: string } {
    if (!walletAddress) {
        return { valid: false, error: "Missing wallet address" };
    }
    if (!isAddress(walletAddress)) {
        return { valid: false, error: "Invalid wallet address" };
    }
    return { valid: true, address: walletAddress };
}