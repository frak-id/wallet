/**
 * Magento 2 order webhook DTO
 * Sent by the FrakLabs_Sdk Magento module on order lifecycle events
 */
export type MagentoOrderWebhookDto = Readonly<{
    id: string; // Magento order increment_id
    customerId: string; // Customer ID or email
    status: MagentoOrderStatus; // Mapped status from Magento events
    token: string; // protectCode (for purchase claim reconciliation)
    currency?: string; // ISO 4217 currency code
    totalPrice?: string; // Grand total as string
    clientId?: string; // frak_client_id from cookie (ad-blocker resistant identity)
    items?: {
        productId: string;
        quantity: number;
        price: string;
        name: string; // SKU
        title: string; // Product name
        image?: string;
    }[];
}>;

export type MagentoOrderStatus =
    | "pending"
    | "confirmed"
    | "refunded"
    | (string & {});
