export type CustomWebhookDto = Readonly<{
    /**
     * Id of the order on your side (external order id)
     */
    id: string;
    /**
     * Id of the customer on your side (external customer id)
     */
    customerId: string;
    /**
     * Status of the order
     */
    status: "pending" | "confirmed" | "cancelled" | "refunded";
    /**
     * Custom token for this order
     *  - Should be the same one as the one exposed to the end user and submitted through the `listenForPurchase` api method
     */
    token: string;
    /**
     * Currency code (ISO 4217)
     *  - Optional, could be empty
     *  - recommended for the UX in the members space
     */
    currency?: string;
    /**
     * The total price of the order, in the currency provided
     *  - Optional, could be empty
     *  - recommended for the UX in the members space
     */
    totalPrice?: string;
    /**
     * All the items in the order
     *  - Optional
     *  - Will be used in the wallet members space, to display additional data to the end user, e.g. which product they referee bought the most
     */
    items?: {
        /**
         * The product id on your side
         */
        productId: string;
        /**
         * The quantity of the product in the order
         */
        quantity: number;
        /**
         * The price of the product
         */
        price: string;
        /**
         * An internal name for the product, used in url slug
         */
        name: string;
        /**
         * The displayable title of the product
         */
        title: string;
        /**
         * A potential image URL for the product
         */
        image?: string;
    }[];
}>;
