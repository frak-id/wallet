export type ShopifyOrderUpdateWebhookDto = Readonly<{
    id: number;
    total_price: string;
    currency: string; // ISO 4217
    financial_status: OrderFinancialStatus;
    test?: boolean;
    created_at: string;
    updated_at?: string;
    customer: {
        id: number;
    };
    token: string;
    checkout_token?: string;
    // When true, `line_items[].price` already carries tax.
    taxes_included?: boolean;
    line_items: {
        product_id: number;
        quantity: number;
        price: string; // Unit price, before discounts
        name: string;
        title: string;
        sku?: string;
        discount_allocations?: { amount: string }[];
        tax_lines?: { price: string }[];
    }[];
    note_attributes?: { name: string; value: string }[];
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
