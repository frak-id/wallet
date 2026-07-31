import type { ProductDetails, SharingPageProduct } from "../../types";
import { decompressJsonFromB64 } from "../compression/decompress";

/**
 * Gates untrusted `imageUrl` / `link` fields: a `javascript:` URL would be an
 * XSS sink in any consumer binding the value to an `href`.
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
 * Coerce a raw `products` value into a candidate array, or null.
 *
 * Accepts real arrays (JS property surface) and JSON-stringified arrays (HTML
 * attribute surface — server-rendered plugins deliver attributes as strings).
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

// HTML attributes and URL params always arrive as strings, so numeric scope
// fields must be recognised on either side.
function asFiniteNumber(value: unknown): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

function nonEmptyString(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
}

/**
 * Normalise one untrusted candidate into its {@link ProductDetails} scope
 * fields, or `undefined` when none survived. Unlike
 * {@link normalizeSharingProduct}, no `title` is required — callers that only
 * need scope fields for reward selection never render a product card.
 */
export function normalizeProductDetails(
    candidate: unknown
): ProductDetails | undefined {
    if (!candidate || typeof candidate !== "object") return undefined;
    const item = candidate as Record<string, unknown>;

    const entry: ProductDetails = {};
    const productId = nonEmptyString(item.productId);
    if (productId !== undefined) entry.productId = productId;
    const sku = nonEmptyString(item.sku);
    if (sku !== undefined) entry.sku = sku;
    const name = nonEmptyString(item.name);
    if (name !== undefined) entry.name = name;
    const quantity = asFiniteNumber(item.quantity);
    if (quantity !== undefined) entry.quantity = quantity;
    const unitPrice = asFiniteNumber(item.unitPrice);
    if (unitPrice !== undefined) entry.unitPrice = unitPrice;
    const totalPrice = asFiniteNumber(item.totalPrice);
    if (totalPrice !== undefined) entry.totalPrice = totalPrice;

    return Object.keys(entry).length > 0 ? entry : undefined;
}

export function sanitizeProductDetailsList(
    input: unknown
): ProductDetails[] | undefined {
    const candidates = coerceProductCandidates(input);
    if (!candidates) return undefined;
    const sanitized: ProductDetails[] = [];
    for (const candidate of candidates) {
        const entry = normalizeProductDetails(candidate);
        if (entry) sanitized.push(entry);
    }
    return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Normalise one untrusted candidate into a {@link SharingPageProduct}, or null
 * when it has no usable title. `products` is a public API boundary, so every
 * URL field is validated structurally before reaching `new URL(...)`.
 */
export function normalizeSharingProduct(
    candidate: unknown
): SharingPageProduct | null {
    if (!candidate || typeof candidate !== "object") return null;
    const item = candidate as Record<string, unknown>;
    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (title === "") return null;

    const entry: SharingPageProduct = {
        title,
        ...normalizeProductDetails(candidate),
    };
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
 * Returns `undefined` (not `[]`) when nothing usable came out —
 * `openSharingPage` / `displaySharingPage` skip the product card section then.
 */
export function sanitizeSharingProducts(
    input: unknown
): SharingPageProduct[] | undefined {
    const candidates = coerceProductCandidates(input);
    if (!candidates) return undefined;
    const sanitized: SharingPageProduct[] = [];
    for (const candidate of candidates) {
        const entry = normalizeSharingProduct(candidate);
        if (entry) sanitized.push(entry);
    }
    return sanitized.length > 0 ? sanitized : undefined;
}

/**
 * Decode a `products` URL query param produced by `compressJsonToB64` — the
 * encoding email tools use when embedding an order's products into a share CTA.
 * Malformed / tampered payloads degrade to `undefined`.
 */
export function decodeProductsParam(
    value: string | null | undefined
): SharingPageProduct[] | undefined {
    if (!value) return undefined;
    let decoded: unknown;
    try {
        decoded = decompressJsonFromB64<unknown>(value);
    } catch {
        return undefined;
    }
    if (decoded === null) return undefined;
    return sanitizeSharingProducts(decoded);
}
