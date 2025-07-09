import {
    type FullInteractionTypesKey,
    formatAmount,
    getCurrencyAmountKey,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";

/**
 * The parameters for the getCurrentReward function
 */
type GetCurrentRewardParams = {
    targetInteraction?: FullInteractionTypesKey;
};

/**
 * Find the estimated reward
 * @param targetInteraction
 * @returns
 */
export async function getCurrentReward({
    targetInteraction,
}: GetCurrentRewardParams) {
    // Get the client
    const client = window.FrakSetup?.client;
    if (!client) {
        console.warn("Frak client not ready yet");
        return;
    }

    const { maxReferrer, rewards } = await getProductInformation(client);

    if (!maxReferrer) return;

    // Get the currency amount key (e.g. "eurAmount")
    const currencyAmountKey = getCurrencyAmountKey(
        client.config.metadata?.currency
    );

    // Get the current reward
    let currentReward = Math.round(maxReferrer[currencyAmountKey]);
    if (targetInteraction) {
        // Find the max reward for the target interaction
        const targetReward = rewards
            .filter((reward) => reward.interactionTypeKey === targetInteraction)
            .map((reward) => reward.referrer[currencyAmountKey])
            .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
        if (targetReward > 0) {
            currentReward = Math.round(targetReward);
        }
    }

    return formatAmount(currentReward, client.config.metadata?.currency);
}
