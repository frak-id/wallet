import type { PurchaseItemInsert } from "../db/schema";

type LineItemSource = {
    productId: string | number;
    quantity: unknown;
    /** Unit price, before discounts. */
    price: unknown;
    /** Amount actually paid for the line: post-discount, tax included. */
    totalPrice?: unknown;
    name: string;
    title: string;
    imageUrl?: string | null;
    sku?: unknown;
};

/**
 * Coerce a webhook value to a trimmed string, dropping anything empty.
 *
 * An empty-string sku is not the same as an absent one downstream: it
 * satisfies `exists`, `neq` and `not_in`, joining a negated scope's matched set.
 */
function optionalString(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : undefined;
    }
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/** Coerce a webhook value to a finite number, or `undefined` when it is not one. */
function optionalNumber(value: unknown): number | undefined {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Normalise one provider line into a storable item.
 *
 * Item uniqueness is keyed on `(external_id, sku)`, so the sku is what
 * separates the variants of one product.
 */
export function toPurchaseItem(source: LineItemSource): PurchaseItemInsert {
    const sku = optionalString(source.sku);

    return {
        externalId: String(source.productId),
        price: String(optionalNumber(source.price) ?? 0),
        totalPrice: optionalNumber(source.totalPrice)?.toString() ?? null,
        name: source.name,
        title: source.title,
        quantity: optionalNumber(source.quantity) ?? 0,
        imageUrl: source.imageUrl ?? null,
        sku: sku ?? null,
    };
}

/**
 * Amount actually paid for a line, falling back to the undiscounted
 * `price * quantity` when the provider sent no line total.
 */
export function resolveLineTotal(item: {
    price: string;
    quantity: number;
    totalPrice?: string | null;
}): number {
    const paid = optionalNumber(item.totalPrice);
    return paid ?? Number(item.price) * item.quantity;
}

/**
 * Sum a provider's per-line money array (Shopify `discount_allocations`,
 * `tax_lines`), skipping entries whose amount is not a number.
 */
export function sumLineAmounts(
    entries: { price?: string; amount?: string }[] | undefined
): number {
    if (!entries) return 0;
    return entries.reduce((sum, entry) => {
        const value = optionalNumber(entry.price ?? entry.amount);
        return value === undefined ? sum : sum + value;
    }, 0);
}
