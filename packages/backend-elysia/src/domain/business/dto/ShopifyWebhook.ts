export type ShopifyOrderUpdateWebhookDto = Readonly<{
    id: number; // order_id
    total_price: string; // Total price of the order
    currency: string; // Currency code (ISO 4217)
    financial_status: "paid" | "refunded" | string; // The financial status of the order (could include "paid", "refunded", etc.)
    test?: boolean; // Whether the order is a test order
    created_at: string; // The creation date of the order
    updated_at?: string; // The date when the order was last updated
}>;
