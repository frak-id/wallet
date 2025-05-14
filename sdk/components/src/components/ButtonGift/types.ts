import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";

/**
 * The props type for {@link ButtonGift}.
 * @inline
 */
export type ButtonGiftProps = {
    /**
     * Do we display the reward on the button?
     * @defaultValue `false`
     */
    useReward?: boolean;
    /**
     * Target interaction behind this sharing action (will be used to get the right reward to display)
     */
    targetInteraction?: FullInteractionTypesKey;
};
