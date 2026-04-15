import { registerWebComponent } from "@/utils/registerWebComponent";
import { PostPurchase } from "./PostPurchase";
import type { PostPurchaseProps } from "./types";

export { PostPurchase };

/**
 * Custom element interface for `<frak-post-purchase>`.
 * Combines standard {@link HTMLElement} with {@link PostPurchaseProps}.
 */
export interface PostPurchaseElement extends HTMLElement, PostPurchaseProps {}

declare global {
    interface HTMLElementTagNameMap {
        "frak-post-purchase": PostPurchaseElement;
    }
}

// Register the PostPurchase component
registerWebComponent(
    PostPurchase,
    "frak-post-purchase",
    [
        "customerId",
        "orderId",
        "token",
        "sharingUrl",
        "merchantId",
        "placement",
        "classname",
        "variant",
        "badgeText",
        "referrerText",
        "refereeText",
        "ctaText",
    ],
    {
        shadow: false,
    }
);
