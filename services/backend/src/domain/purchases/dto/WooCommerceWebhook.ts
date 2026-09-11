export type WooCommerceOrderUpdateWebhookDto = Readonly<{
    id: number;
    status: WooCommerceOrderStatus;
    total: string;
    currency: string; // ISO 4217
    date_created_gmt: string;
    date_modified_gmt?: string;
    date_completed_gmt?: string;
    date_paid_gmt?: string;
    customer_id: number;
    order_key: string;
    transaction_id: string;
    line_items: {
        id: number; // Unique within the order
        product_id: number;
        quantity: number;
        price: number; // Unit price after discounts, tax excluded (total / quantity)
        // Line total after discounts, tax excluded, and its tax counterpart.
        total?: string;
        total_tax?: string;
        name: string;
        sku?: string;
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
    // Personalised coupon codes can embed customer hints (`JOHN-DOE-25`), so
    // only `id` / `code` / `discount` are forwarded: `discount_tax`, `taxes`
    // and `meta_data` are stripped at the plugin edge, see
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
