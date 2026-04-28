import type {
    InteractionTypeKey,
    SharingPageProduct,
} from "@frak-labs/core-sdk";
import { displaySharingPage } from "@frak-labs/core-sdk/actions";

/**
 * Options forwarded to the underlying `frak_displaySharingPage` RPC.
 *
 * Surfaces that already know which page to share (e.g. the post-purchase
 * card sharing the merchant domain, or a product gallery sharing a
 * specific item) pass them via this object so the helper stays a thin
 * adapter without leaking the full action signature to web components.
 */
export type OpenSharingPageOptions = {
    /**
     * Base URL the sharing page should generate links from. When omitted,
     * the listener falls back to the merchant domain.
     */
    link?: string;
    /**
     * Optional product cards to display on the sharing page. An empty
     * array is treated the same as `undefined` — no card section is shown.
     */
    products?: SharingPageProduct[];
};

export async function openSharingPage(
    targetInteraction?: InteractionTypeKey,
    placement?: string,
    options?: OpenSharingPageOptions
) {
    if (!window.FrakSetup?.client) {
        console.error("Frak client not found");
        return;
    }

    await displaySharingPage(
        window.FrakSetup.client,
        {
            ...(options?.link && { link: options.link }),
            ...(options?.products &&
                options.products.length > 0 && {
                    products: options.products,
                }),
            metadata: {
                ...(targetInteraction && { targetInteraction }),
            },
        },
        placement
    );
}
