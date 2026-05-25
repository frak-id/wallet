/**
 * Shared helper to extract Frak config from shop metafields.
 *
 * The Frak Shopify app writes these metafields during onboarding:
 *  - frak.merchant_id  → merchant UUID (JSON-encoded string)
 *  - frak.wallet_url   → wallet base URL (JSON-encoded string)
 *  - frak.appearance   → { logoUrl?: string } (JSON object)
 *
 * Plus translatable text metafields managed via Shopify's Translate &
 * Adapt app. These are read here so the buyer's checkout locale picks
 * the right translation automatically:
 *  - frak.post_purchase_message
 *  - frak.post_purchase_description
 *  - frak.post_purchase_cta_text
 *  - frak.post_purchase_badge_text
 *
 * All JSON values are stored via JSON.stringify(), so we JSON.parse() on
 * read. Text-type metafields come through as plain strings.
 */

type FrakConfig = {
    merchantId?: string;
    walletUrl?: string;
    logoUrl?: string;
    text: {
        message?: string;
        description?: string;
        ctaText?: string;
        badgeText?: string;
    };
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
 * Translate & Adapt may return the same translatable text value as either
 * a plain string or a JSON-encoded string depending on the surface. Strip
 * either shape down to a non-empty string or `undefined`.
 */
function readTextValue(raw: string | number | boolean): string | undefined {
    const parsed = parseJsonValue<unknown>(raw);
    const value = typeof parsed === "string" ? parsed : String(parsed);
    return value.length > 0 ? value : undefined;
}

/**
 * Extract Frak metafields needed by the post-purchase card.
 *
 * Works with both checkout and customer-account surfaces — the MetafieldEntry
 * shape is compatible with AppMetafieldEntry from either import path.
 */
export function extractFrakConfig(
    entries: { metafield: { key: string; value: string | number | boolean } }[]
): FrakConfig {
    return entries.reduce<FrakConfig>(
        (config, entry) => {
            const { key, value } = entry.metafield;
            switch (key) {
                case "merchant_id":
                    config.merchantId = parseJsonValue<string>(value) as string;
                    break;
                case "wallet_url":
                    config.walletUrl = parseJsonValue<string>(value) as string;
                    break;
                case "appearance": {
                    const parsed = parseJsonValue<{ logoUrl?: string }>(value);
                    config.logoUrl =
                        typeof parsed === "object" ? parsed.logoUrl : undefined;
                    break;
                }
                case "post_purchase_message":
                    config.text.message = readTextValue(value);
                    break;
                case "post_purchase_description":
                    config.text.description = readTextValue(value);
                    break;
                case "post_purchase_cta_text":
                    config.text.ctaText = readTextValue(value);
                    break;
                case "post_purchase_badge_text":
                    config.text.badgeText = readTextValue(value);
                    break;
            }
            return config;
        },
        { text: {} }
    );
}
