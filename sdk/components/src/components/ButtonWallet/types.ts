import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";

/**
 * The props type for {@link ButtonWallet}.
 * @inline
 */
export type ButtonWalletProps = {
    /**
     * Classname to apply to the button
     */
    classname?: string;
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
