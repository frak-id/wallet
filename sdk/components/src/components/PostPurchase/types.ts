/**
 * Props for the {@link PostPurchase} component.
 * @inline
 */
export type PostPurchaseProps = {
    /**
     * Merchant customer ID for purchase tracking fallback.
     * All three tracking props (`customerId`, `orderId`, `token`) must be
     * present for tracking to fire.
     */
    customerId?: string;
    /**
     * Merchant order ID for purchase tracking fallback.
     */
    orderId?: string;
    /**
     * Checkout token for purchase tracking fallback.
     */
    token?: string;
    /**
     * Base URL to share. Falls back to the merchant domain returned by
     * the backend when omitted.
     */
    sharingUrl?: string;
    /**
     * Override the merchant ID resolved from the SDK config.
     */
    merchantId?: string;
    /**
     * Placement ID for backend-driven CSS customization.
     */
    placement?: string;
    /**
     * CSS class names passed through to the root element (Light DOM).
     */
    classname?: string;
    /**
     * Force a display variant instead of relying on the backend evaluation.
     */
    variant?: "referrer" | "referee";
    /**
     * Label for the pill badge displayed above the message.
     * When omitted (and no placement config provides one), the badge is hidden.
     */
    badgeText?: string;
    /**
     * Override the message shown to referrers.
     * Use `{REWARD}` as placeholder for the reward amount.
     */
    referrerText?: string;
    /**
     * Override the message shown to referees.
     * Use `{REWARD}` as placeholder for the reward amount.
     */
    refereeText?: string;
    /**
     * Override the CTA button text.
     * Use `{REWARD}` as placeholder for the reward amount.
     */
    ctaText?: string;
    /**
     * When set, renders the card in preview mode (e.g. Shopify/WP editor).
     * Bypasses the client-ready / RPC gates that normally hide the card
     * until the backend resolves, and no-ops the click handler so merchants
     * can see the final layout with their configured copy.
     */
    preview?: string;
    /**
     * Which variant to show when {@link preview} is set.
     * Defaults to `"referrer"`.
     */
    previewVariant?: "referrer" | "referee";
};
