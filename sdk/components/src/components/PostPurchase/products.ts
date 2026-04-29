import type { SharingPageProduct } from "@frak-labs/core-sdk";

/**
 * Whether `value` is a syntactically valid URL with an `http(s):` scheme.
 *
 * Used to gate `imageUrl` / `link` fields coming from the public `products`
 * prop — the listener-side sharing-page builder calls `new URL(...)` on the
 * incoming product link, and a `javascript:` URL would be a XSS sink in any
 * consumer that binds the value to an `href`.
 */
function isHttpUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

/**
 * Coerce a raw `products` prop value into a candidate array suitable for
 * per-item normalisation, or null when it cannot be reduced to one.
 *
 * Surfaces that set the prop via the JS property (`el.products = [...]`)
 * deliver a real array; surfaces that bind it as an HTML attribute
 * (WP / Magento server-render) deliver a JSON-stringified array. Anything
 * else (truthy non-array non-string, JSON parse failure, JSON that decodes
 * to a non-array) is treated as "no products" so the share still works
 * without the product card section.
 */
export function coerceProductCandidates(
    products: SharingPageProduct[] | string | undefined
): unknown[] | null {
    if (!products) return null;
    if (Array.isArray(products)) return products;
    if (typeof products !== "string") return null;
    try {
        const parsed = JSON.parse(products) as unknown;
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Normalise one untrusted candidate into a {@link SharingPageProduct}, or
 * return null when the candidate has no usable title.
 *
 * The `products` prop is a public API boundary (merchants can set it
 * server-side via WP/Magento or imperatively from arbitrary JS). Each entry
 * is validated structurally so a malformed `link` reaching `new URL(...)`
 * downstream would not crash the sharing-page builder, and so a
 * `javascript:` URL cannot slip through as `imageUrl` / `link`.
 */
export function normalizeProductCandidate(
    candidate: unknown
): SharingPageProduct | null {
    if (!candidate || typeof candidate !== "object") return null;
    const item = candidate as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (title === "") return null;

    const entry: SharingPageProduct = { title };
    if (typeof item.imageUrl === "string" && isHttpUrl(item.imageUrl)) {
        entry.imageUrl = item.imageUrl;
    }
    if (typeof item.link === "string" && isHttpUrl(item.link)) {
        entry.link = item.link;
    }
    if (typeof item.utmContent === "string" && item.utmContent !== "") {
        entry.utmContent = item.utmContent;
    }
    return entry;
}
