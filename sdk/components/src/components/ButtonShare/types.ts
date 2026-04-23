import type { InteractionTypeKey } from "@frak-labs/core-sdk";

/**
 * The props type for {@link ButtonShare}.
 * @inline
 */
export type ButtonShareProps = {
    placement?: string;
    /**
     * Text to display on the button
     *  - To specify where the reward should be displayed, use the placeholder `{REWARD}`, e.g. `Share and earn up to \{REWARD\}!`
     * @defaultValue `"Share and earn!"`
     */
    text?: string;
    /**
     * Classname to apply to the button
     */
    classname?: string;
    /**
     * Do we display the reward on the share modal?
     * @defaultValue `false`
     */
    useReward?: boolean;
    /**
     * Fallback text if the reward isn't found
     */
    noRewardText?: string;
    /**
     * Target interaction behind this sharing action (will be used to get the right reward to display)
     */
    targetInteraction?: InteractionTypeKey;
    /**
     * Which UI to open on click
     * @defaultValue `"embedded-wallet"`
     */
    clickAction?: "embedded-wallet" | "share-modal" | "sharing-page";
    /**
     * When set, renders the button in preview mode (e.g. Shopify/WP editor).
     * Skips the client-ready gating so the button is always enabled visually,
     * and no-ops the click handler so merchants can see the final layout with
     * their configured copy even when no Frak client is initialized.
     */
    preview?: string;
};
