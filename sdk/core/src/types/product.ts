/**
 * The purchase line item fields a campaign's `productScope` can target.
 *
 * Mirrors the backend's `PRODUCT_SCOPE_FIELDS` allowlist exactly — a campaign
 * field outside this set cannot have been published.
 */
export type ProductDetails = {
    productId?: string;
    sku?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
};
