export type ShopifyOrderUpdateWebhookDto = Readonly<{
    id: number; // order_id
    total_price: string; // Total price of the order
    currency: string; // Currency code (ISO 4217)
    financial_status: OrderFinancialStatus; // The financial status of the order (could include "paid", "refunded", etc.)
    test?: boolean; // Whether the order is a test order
    created_at: string; // The creation date of the order
    updated_at?: string; // The date when the order was last updated
    customer: {
        id: number; // The customer id
    };
    token: string; // The token of the order
    checkout_token?: string; // The token of the order
    line_items: {
        product_id: number; // The product id
        quantity: number; // The quantity of the product
        price: string; // The price of the product
        name: string; // The name of the product
        title: string; // The title of the product
    }[];
}>;

export type OrderFinancialStatus =
    | "authorized"
    | "pending"
    | "paid"
    | "partially_paid"
    | "refunded"
    | "voided"
    | "partially_refunded"
    | "unpaid"
    | (string & {});
