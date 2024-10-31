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
}>;

export type WooCommerceOrderStatus =
    | "pending"
    | "processing"
    | "on-hold"
    | "completed"
    | "canncelled"
    | "refunded"
    | "failed"
    | "trash"
    | (string & {});
