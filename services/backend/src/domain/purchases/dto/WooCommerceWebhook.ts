export type WooCommerceOrderUpdateWebhookDto = Readonly<{
    id: number; // order_id
    status: WooCommerceOrderStatus; // The financial status of the order (could include "paid", "refunded", etc.)
    total: string; // Total price of the order
    currency: string; // Currency code (ISO 4217)
    date_created_gmt: string; // The creation date of the order
    date_modified_gmt?: string; // The date when the order was last updated
    date_completed_gmt?: string; // The date when the order was last updated
    date_paid_gmt?: string; // The date when the order was last updated
    customer_id: number; // The customer id
    order_key: string; // The key of the order
    transaction_id: string; // The id of the transaction
    line_items: {
        id: number; // The product id
        product_id: number; // The product id
        quantity: number; // The quantity of the product
        price: number; // The price of the product
        name: string; // The name of the product
        image: {
            id?: string;
            src?: string;
        };
    }[];
    // Present when partial or full refunds have been issued. A full refund
    // also flips `status` to `refunded`; partial refunds only populate this
    // array and leave `status` on its pre-refund value (`completed`, etc.).
    refunds?: {
        id: number;
        reason?: string;
        total: string;
    }[];
    // Coupons applied to the order. Forwarded for future analytics use
    // (campaign-aware reward weighting, code-specific attribution); the
    // current handler does not read this. Personalised coupon codes can
    // theoretically embed customer hints (`JOHN-DOE-25`) so we forward only
    // `id` / `code` / `discount` and drop `discount_tax`, `taxes`, and
    // `meta_data` at the plugin edge — see the WooCommerce filter in
    // `Frak_WC_Webhook_Registrar::strip_coupon_lines()`.
    coupon_lines?: {
        id: number;
        code: string;
        discount: string;
    }[];
}>;

export type WooCommerceOrderStatus =
    | "pending"
    | "processing"
    | "on-hold"
    | "completed"
    | "cancelled"
    | "refunded"
    | "failed"
    | "trash"
    | (string & {});
