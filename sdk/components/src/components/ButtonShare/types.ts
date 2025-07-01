import type {
    CampaignI18nConfig,
    FullInteractionTypesKey,
} from "@frak-labs/core-sdk";

/**
 * The props type for {@link ButtonShare}.
 * @inline
 */
export type ButtonShareProps = {
    /**
     * Text to display on the button
     *  - To specify where the reward should be displayed, use the placeholder `{REWARD}`, e.g. `Share and earn up to {REWARD}!`
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
    targetInteraction?: FullInteractionTypesKey;
    /**
     * Do we display the wallet modal instead of the share modal?
     * @defaultValue `false`
     */
    showWallet?: boolean;
    /**
     * Campaign ID for campaign-specific i18n configuration
     */
    campaignId?: string;
    /**
     * Campaign-specific i18n configuration (takes precedence over global config)
     */
    campaignI18n?: CampaignI18nConfig;
};
