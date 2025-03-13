import type {
    Currency,
    FullInteractionTypesKey,
    TokenAmountType,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";

/**
 * Map the currency to the symbol
 */
const mapCurrencyToSymbol = {
    eur: "€",
    usd: "$",
    gbp: "£",
};

/**
 * Get the currency amount key for a given currency
 * @param currency - The currency to use
 * @returns The currency amount key
 */
function getCurrencyAmountKey(currency: Currency): keyof TokenAmountType {
    return `${currency}Amount` as keyof TokenAmountType;
}

/**
 * The parameters for the getCurrentReward function
 */
type GetCurrentRewardParams = {
    targetInteraction?: FullInteractionTypesKey;
    currency?: Currency;
};

/**
 * Find the estimated reward
 * @param targetInteraction
 * @returns
 */
export async function getCurrentReward({
    targetInteraction,
    currency = "eur",
}: GetCurrentRewardParams) {
    // Get the client
    const client = window.FrakSetup?.client;
    if (!client) {
        console.warn("Frak client not ready yet");
        return;
    }

    const { maxReferrer, rewards } = await getProductInformation(client);

    if (!maxReferrer) return;

    let currentReward = maxReferrer[getCurrencyAmountKey(currency)];
    if (targetInteraction) {
        // Find the max reward for the target interaction
        const targetReward = rewards
            .filter((reward) => reward.interactionTypeKey === targetInteraction)
            .map((reward) => reward.referrer[getCurrencyAmountKey(currency)])
            .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
        if (targetReward > 0) {
            currentReward = Math.ceil(targetReward);
        }
    }

    return {
        amount: currentReward,
        symbol: mapCurrencyToSymbol[currency],
    };
}
