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

/**
 * Build a campaign creation URL for the Frak business dashboard.
 */
export function buildCampaignLink({
    businessUrl,
    name,
    bankId,
    domain,
    globalBudget,
    rawCAC,
    ratio,
    merchantId,
    preferredCurrency,
}: {
    businessUrl: string;
    name: string;
    bankId: string;
    domain: string;
    globalBudget: number;
    rawCAC: number;
    ratio: number;
    merchantId: string;
    preferredCurrency?: string;
}): string {
    const createUrl = new URL(businessUrl);
    createUrl.pathname = "/embedded/create-campaign";
    createUrl.searchParams.append("n", name);
    createUrl.searchParams.append("bid", bankId);
    createUrl.searchParams.append("d", domain);
    createUrl.searchParams.append("gb", globalBudget.toString());
    createUrl.searchParams.append("cac", rawCAC.toString());
    createUrl.searchParams.append("r", ratio.toString());
    createUrl.searchParams.append("mid", merchantId);
    if (preferredCurrency) {
        createUrl.searchParams.append("sc", preferredCurrency);
    }
    return createUrl.toString();
}

/**
 * Build a webhook management URL for the Frak business dashboard.
 */
export function buildWebhookLink(
    businessUrl: string,
    merchantId: string
): string {
    const createUrl = new URL(businessUrl);
    createUrl.pathname = "/embedded/purchase-tracker";
    createUrl.searchParams.append("mid", merchantId);
    return createUrl.toString();
}
