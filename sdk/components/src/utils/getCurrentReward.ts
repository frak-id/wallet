import {
    type Currency,
    type FullInteractionTypesKey,
    getCurrencyAmountKey,
    getSupportedCurrency,
    getSupportedLocale,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";

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

    // Get the supported locale (e.g. "fr-FR")
    const supportedLocale = getSupportedLocale(currency);

    // Get the supported currency (e.g. "eur")
    const supportedCurrency = getSupportedCurrency(currency);

    // Get the currency amount key (e.g. "eurAmount")
    const currencyAmountKey = getCurrencyAmountKey(supportedCurrency);

    // Get the current reward
    let currentReward = Math.ceil(maxReferrer[currencyAmountKey]);
    if (targetInteraction) {
        // Find the max reward for the target interaction
        const targetReward = rewards
            .filter((reward) => reward.interactionTypeKey === targetInteraction)
            .map((reward) => reward.referrer[currencyAmountKey])
            .reduce((acc, reward) => (reward > acc ? reward : acc), 0);
        if (targetReward > 0) {
            currentReward = Math.ceil(targetReward);
        }
    }

    return currentReward.toLocaleString(supportedLocale, {
        style: "currency",
        currency: supportedCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}
