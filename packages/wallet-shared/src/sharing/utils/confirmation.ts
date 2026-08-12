import type { SharingPageProduct } from "@frak-labs/core-sdk";

const SHARING_CONFIRMED_KEY = "frak_sharing_confirmed";
const CONFIRMATION_TTL_MS = 60 * 60 * 1000; // 1 hour

// One record, not one per scope: a sharing page is only ever open for a single
// share at a time, which is why `clearConfirmation` takes no argument.

/**
 * What a saved confirmation belongs to: this sharer, this merchant, these
 * products.
 *
 * Keyed on all three because a native host reuses one pooled web view — and so
 * one document, and one `sessionStorage` — across every sheet it opens. Keyed on
 * the merchant alone, a user who shared anything once was sent straight to the
 * success screen for the next hour, whatever they opened the sheet on next.
 *
 * Products contribute their identity only (`productId`/`sku`/`link`/`title`),
 * never quantity or price: a cart whose totals moved is still the same share.
 * Sorted, so the same set offered in a different order is the same scope.
 */
export function sharingConfirmationScope({
    merchantId,
    clientId,
    products,
}: {
    merchantId?: string;
    clientId?: string;
    products?: SharingPageProduct[];
}): string {
    const items = (products ?? [])
        .map(
            (product) =>
                product.productId ??
                product.sku ??
                product.link ??
                product.title ??
                ""
        )
        .sort();
    return hash([merchantId ?? "", clientId ?? "", ...items].join("\u0000"));
}

/**
 * FNV-1a, 32-bit. Not a digest — `SubtleCrypto` is async and this is read in a
 * `useState` initialiser. A collision shows a success screen one share early;
 * nothing here is a trust boundary.
 */
function hash(input: string): string {
    let value = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        value ^= input.charCodeAt(i);
        value = Math.imul(value, 0x01000193);
    }
    return (value >>> 0).toString(36);
}

/** Whether a confirmation was saved within the TTL for this exact scope. */
export function getSavedConfirmation(scope: string): boolean {
    try {
        const raw = sessionStorage.getItem(SHARING_CONFIRMED_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw) as {
            scope?: string;
            timestamp: number;
        };
        return (
            saved.scope === scope &&
            Date.now() - saved.timestamp < CONFIRMATION_TTL_MS
        );
    } catch {
        return false;
    }
}

/** Save a sharing confirmation to sessionStorage. */
export function saveConfirmation(scope: string) {
    try {
        sessionStorage.setItem(
            SHARING_CONFIRMED_KEY,
            JSON.stringify({ scope, timestamp: Date.now() })
        );
    } catch {
        // sessionStorage may not be available in some iframe contexts.
    }
}

/** Clear the saved confirmation. */
export function clearConfirmation() {
    try {
        sessionStorage.removeItem(SHARING_CONFIRMED_KEY);
    } catch {
        // sessionStorage may not be available in some iframe contexts.
    }
}
