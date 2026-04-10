/**
 * Shared helper to extract Frak config from shop metafields.
 *
 * The Frak Shopify app writes these metafields during onboarding:
 *  - frak.merchant_id  → merchant UUID (JSON-encoded string)
 *  - frak.wallet_url   → wallet base URL (JSON-encoded string)
 *  - frak.appearance   → { logoUrl?: string } (JSON object)
 *
 * All values are stored via JSON.stringify(), so we JSON.parse() on read.
 */

import type { AppMetafieldEntry } from "@shopify/ui-extensions/checkout";

type FrakConfig = {
    merchantId?: string;
    walletUrl?: string;
    logoUrl?: string;
};

function parseJsonValue<T>(raw: string): T | undefined {
    try {
        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}

/**
 * Extract merchantId, walletUrl, and logoUrl from app metafield entries.
 *
 * Works with both checkout and customer-account surfaces — the MetafieldEntry
 * shape is compatible with AppMetafieldEntry from either import path.
 */
export function extractFrakConfig(entries: AppMetafieldEntry[]): FrakConfig {
    const merchantIdEntry = entries.find(
        (e) => e.metafield.key === "merchant_id"
    );
    const walletUrlEntry = entries.find(
        (e) => e.metafield.key === "wallet_url"
    );
    const appearanceEntry = entries.find(
        (e) => e.metafield.key === "appearance"
    );

    return {
        merchantId: merchantIdEntry
            ? parseJsonValue<string>(merchantIdEntry.metafield.value)
            : undefined,
        walletUrl: walletUrlEntry
            ? parseJsonValue<string>(walletUrlEntry.metafield.value)
            : undefined,
        logoUrl: appearanceEntry
            ? parseJsonValue<{ logoUrl?: string }>(
                  appearanceEntry.metafield.value
              )?.logoUrl
            : undefined,
    };
}
