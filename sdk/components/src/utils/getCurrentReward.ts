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

function getFixedFiatAmount(
    estimated: EstimatedReward | undefined,
    key: keyof TokenAmountType
): number {
    if (!estimated || estimated.payoutType !== "fixed") return 0;
    return estimated.amount[key];
}

function getMaxFixedReferrerReward(
    rewards: { referrer?: EstimatedReward }[],
    key: keyof TokenAmountType
): number {
    return rewards.reduce(
        (max, reward) =>
            Math.max(max, getFixedFiatAmount(reward.referrer, key)),
        0
    );
}

export async function getCurrentReward({
    targetInteraction,
}: GetCurrentRewardParams) {
    const client = window.FrakSetup?.client;
    if (!client) {
        console.warn("Frak client not ready yet");
        return;
    }

    const { rewards } = await getMerchantInformation(client);

    const currencyAmountKey = getCurrencyAmountKey(
        client.config.metadata?.currency
    );

    const filteredRewards = targetInteraction
        ? rewards.filter((r) => r.interactionTypeKey === targetInteraction)
        : rewards;

    const maxReward = getMaxFixedReferrerReward(
        filteredRewards,
        currencyAmountKey
    );

    if (maxReward <= 0) return;

    return formatAmount(
        Math.round(maxReward),
        client.config.metadata?.currency
    );
}
