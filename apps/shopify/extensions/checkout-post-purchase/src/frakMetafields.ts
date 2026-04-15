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

type FrakConfig = {
    merchantId?: string;
    walletUrl?: string;
    logoUrl?: string;
};

function parseJsonValue<T>(raw: string | number | boolean): T | string {
    const str = String(raw);
    try {
        return JSON.parse(str) as T;
    } catch {
        return str;
    }
}

/**
 * Extract merchantId, walletUrl, and logoUrl from app metafield entries.
 *
 * Works with both checkout and customer-account surfaces — the MetafieldEntry
 * shape is compatible with AppMetafieldEntry from either import path.
 */
export function extractFrakConfig(
    entries: { metafield: { key: string; value: string | number | boolean } }[]
): FrakConfig {
    return entries.reduce<FrakConfig>((config, entry) => {
        const { key, value } = entry.metafield;
        switch (key) {
            case "merchant_id":
                config.merchantId = parseJsonValue<string>(value);
                break;
            case "wallet_url":
                config.walletUrl = parseJsonValue<string>(value);
                break;
            case "appearance": {
                const parsed = parseJsonValue<{ logoUrl?: string }>(value);
                config.logoUrl =
                    typeof parsed === "object" ? parsed.logoUrl : undefined;
                break;
            }
        }
        return config;
    }, {});
}
