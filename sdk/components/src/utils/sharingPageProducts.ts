import {
    decompressJsonFromB64,
    type SharingPageProduct,
} from "@frak-labs/core-sdk";

/**
 * Whether `value` is a syntactically valid URL with an `http(s):` scheme.
 *
 * Used to gate `imageUrl` / `link` fields coming from untrusted inputs (the
 * public `products` prop on `<frak-post-purchase>`, decoded query params for
 * Klaviyo / email share links, etc.) — the listener-side sharing-page builder
 * calls `new URL(...)` on the incoming product link, and a `javascript:` URL
 * would be a XSS sink in any consumer that binds the value to an `href`.
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
 * Coerce a raw `products` value into a candidate array suitable for
 * per-item normalisation, or null when it cannot be reduced to one.
 *
 * Accepts:
 * - Real arrays (JS-property surface, decompressed query payloads).
 * - JSON-stringified arrays (HTML-attribute surface — WP / Magento
 *   server-render delivers attribute values as raw strings).
 *
 * Anything else (non-array non-string, JSON parse failure, JSON that
 * decodes to a non-array) is treated as "no products" so the share still
 * works without the product card section.
 */
export function coerceProductCandidates(products: unknown): unknown[] | null {
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
 * The `products` payload is a public API boundary — merchants can set it
 * server-side via WP / Magento, imperatively from arbitrary JS, or via
 * email-template query params built by Klaviyo. Each entry is validated
 * structurally so a malformed `link` reaching `new URL(...)` downstream
 * would not crash the sharing-page builder, and so a `javascript:` URL
 * cannot slip through as `imageUrl` / `link`.
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

/**
 * Pipe `coerceProductCandidates` + `normalizeProductCandidate` over an
 * untrusted value and return a non-empty {@link SharingPageProduct}[] or
 * `undefined` when nothing usable came out.
 *
 * The undefined sentinel is what `openSharingPage` / `displaySharingPage`
 * expect when the caller has no products to show — the sharing page just
 * skips the product card section.
 */
export function sanitizeProductList(
    input: unknown
): SharingPageProduct[] | undefined {
    const candidates = coerceProductCandidates(input);
    if (!candidates) return undefined;
    const sanitized: SharingPageProduct[] = [];
    for (const candidate of candidates) {
        const entry = normalizeProductCandidate(candidate);
        if (entry) sanitized.push(entry);
    }
    return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Decode a `products` URL query param produced by
 * `compressJsonToB64(productsArray)` — the encoding Klaviyo (and any
 * other email tool) uses when embedding the product list of an order
 * confirmation into a Frak share CTA.
 *
 * The result is run through `sanitizeProductList` so every link / image
 * URL is structurally validated before reaching `new URL(...)` downstream.
 * Malformed / tampered payloads degrade gracefully to `undefined` — the
 * share still works, just without the product card section.
 */
export function decodeProductsParam(
    value: string | null | undefined
): SharingPageProduct[] | undefined {
    if (!value) return undefined;
    let decoded: unknown;
    try {
        // `decompressJsonFromB64` throws on non-base64 / non-UTF-8 / invalid JSON
        // input — the query-param surface receives untrusted strings, so we
        // funnel every failure mode into the same "no products" sentinel.
        decoded = decompressJsonFromB64<unknown>(value);
    } catch {
        return undefined;
    }
    if (decoded === null) return undefined;
    return sanitizeProductList(decoded);
}
