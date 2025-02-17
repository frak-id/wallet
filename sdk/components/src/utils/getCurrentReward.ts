import type { FullInteractionTypesKey } from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";

/**
 * Find the estimated reward
 * @param targetInteraction
 * @returns
 */
export async function getCurrentReward(
    targetInteraction?: FullInteractionTypesKey
) {
    // Get the client
    const client = window.FrakSetup?.client;
    if (!client) {
        console.warn("Frak client not ready yet");
        return;
    }

    const info = await getProductInformation(client);

    if (!info?.estimatedEurReward) return;

    let currentReward = info.estimatedEurReward;
    if (targetInteraction) {
        // Find the max reward for the target interaction
        const targetReward = info.rewards
            .filter((reward) => reward.interactionTypeKey === targetInteraction)
            .map((reward) => reward.referrer.eurAmount)
            .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
        if (targetReward > 0) {
            currentReward = Math.ceil(targetReward).toString();
        }
    }

    return currentReward;
}
