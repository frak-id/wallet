import {
    type EstimatedReward,
    formatAmount,
    getCurrencyAmountKey,
    type InteractionTypeKey,
    type TokenAmountType,
} from "@frak-labs/core-sdk";
import { getMerchantInformation } from "@frak-labs/core-sdk/actions";

type GetCurrentRewardParams = {
    targetInteraction?: InteractionTypeKey;
};

function getFixedAmount(
    estimated: EstimatedReward | undefined,
    key: keyof TokenAmountType
): number {
    if (!estimated || estimated.payoutType !== "fixed") return 0;
    return estimated.amount[key];
}

export async function getCurrentReward({
    targetInteraction,
}: GetCurrentRewardParams) {
    const client = window.FrakSetup?.client;
    if (!client) {
        console.warn("Frak client not ready yet");
        return;
    }

    const { maxReferrer, rewards } = await getMerchantInformation(client);

    if (!maxReferrer) return;

    const currencyAmountKey = getCurrencyAmountKey(
        client.config.metadata?.currency
    );

    let currentReward = Math.round(maxReferrer[currencyAmountKey]);
    if (targetInteraction) {
        const targetReward = rewards
            .filter((reward) => reward.interactionTypeKey === targetInteraction)
            .map((reward) => getFixedAmount(reward.referrer, currencyAmountKey))
            .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
        if (targetReward > 0) {
            currentReward = Math.round(targetReward);
        }
    }

    return formatAmount(currentReward, client.config.metadata?.currency);
}
