import type { InteractionTypeKey } from "@frak-labs/core-sdk";

/**
 * The props type for {@link Banner}.
 * @inline
 */
export type BannerProps = {
    /**
     * Placement ID for backend-driven CSS customization.
     */
    placement?: string;
    /**
     * CSS class names passed through to the root element (Light DOM).
     */
    classname?: string;
    /**
     * Filter rewards by interaction type (e.g. "purchase", "referral").
     * When omitted, the best reward across all interaction types is shown.
     */
    interaction?: InteractionTypeKey;
    /**
     * Override the referral banner title.
     */
    referralTitle?: string;
    /**
     * Override the referral banner description.
     */
    referralDescription?: string;
    /**
     * Override the referral banner CTA button text.
     */
    referralCta?: string;
    /**
     * Override the in-app browser banner title.
     */
    inappTitle?: string;
    /**
     * Override the in-app browser banner description.
     */
    inappDescription?: string;
    /**
     * Override the in-app browser banner CTA button text.
     */
    inappCta?: string;
    /**
     * When set, forces the banner to render in preview mode (e.g. in Shopify theme editor).
     * Bypasses normal event/browser detection and shows static content.
     */
    preview?: string;
    /**
     * Which banner variant to preview: "referral" or "inapp".
     * Only used when {@link preview} is set. Defaults to "referral".
     */
    previewMode?: "referral" | "inapp";
};
