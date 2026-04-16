import type { InteractionTypeKey } from "../../constants/interactionTypes";
import type { I18nConfig } from "../config";
import type { AttributionParams } from "../tracking";

/**
 * Product information to display on the sharing page
 * @group Sharing Page
 */
export type SharingPageProduct = {
    /**
     * The product title / name
     */
    title: string;
    /**
     * Optional product image URL
     */
    imageUrl?: string;
    /**
     * Optional product-specific sharing link
     * When provided and the product is selected, this link is used instead of the default sharing link
     */
    link?: string;
    /**
     * Optional `utm_content` value to apply when this product is selected.
     * Falls back to the page-level `attribution.utmContent` when omitted.
     */
    utmContent?: string;
};

/**
 * Parameters to display the sharing page
 * @group Sharing Page
 * @group RPC Schema
 */
export type DisplaySharingPageParamsType = {
    /**
     * Products to showcase on the sharing page
     * If provided, they will be displayed in a product card section
     */
    products?: SharingPageProduct[];
    /**
     * Optional link override for sharing
     * If not provided, the sharing link will be generated from the current page URL + merchant context
     */
    link?: string;
    /**
     * Optional attribution overrides for the outbound sharing URL.
     *
     * When provided (even as an empty object), Frak adds standard affiliation
     * params (`utm_source=frak`, `utm_medium=referral`, `utm_campaign=<merchantId>`,
     * `ref=<clientId>`, `via=frak`) alongside `fCtx`. Existing UTMs on the base
     * URL are preserved (gap-fill). Set this to `null` to disable attribution
     * params entirely (only `fCtx` is added).
     *
     * @default {} — defaults applied
     */
    attribution?: AttributionParams | null;
    /**
     * Optional metadata overrides for the sharing page
     */
    metadata?: {
        /**
         * Logo override for the sharing page header
         */
        logo?: string;
        /**
         * Link to the homepage of the calling website
         */
        homepageLink?: string;
        /**
         * The target interaction behind this sharing page
         */
        targetInteraction?: InteractionTypeKey;
        /**
         * i18n overrides for the sharing page
         */
        i18n?: I18nConfig;
    };
};

/**
 * Result of the sharing page display
 * @group Sharing Page
 * @group RPC Schema
 */
export type DisplaySharingPageResultType = {
    /**
     * The action the user took
     * - "shared": User used the native share dialog
     * - "copied": User copied the link to clipboard
     * - "dismissed": User dismissed the sharing page without acting
     */
    action: "shared" | "copied" | "dismissed";
    /**
     * The install URL for the Frak app
     * Can be used as a fallback to redirect the user to the install page
     * from the merchant's top-level page (e.g. via `window.location.href`)
     */
    installUrl?: string;
};
