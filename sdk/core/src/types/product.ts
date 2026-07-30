/**
 * The subset of a purchase line item's fields a campaign's `productScope`
 * can target, and that a merchant surface can supply about a product it
 * knows about (e.g. a product page, a cart, an order's line items).
 *
 * Mirrors the backend's allowlist exactly — see `PRODUCT_SCOPE_FIELDS` in
 * `services/backend/src/domain/campaign/services/CampaignManagementService.ts`.
 * Any campaign field outside this set cannot have been published (validated
 * server-side at publish time), so it never needs handling on this side.
 */
export type ProductDetails = {
    productId?: string;
    sku?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
};
