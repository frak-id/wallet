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
};
