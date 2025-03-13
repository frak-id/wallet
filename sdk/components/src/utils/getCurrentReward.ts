import type {
    Currency,
    FullInteractionTypesKey,
    TokenAmountType,
} from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";

/**
 * Map the currency to the locale
 */
const mapLocales = {
    eur: "fr-FR",
    usd: "en-US",
    gbp: "en-GB",
} as const;

/**
 * Get the currency amount key for a given currency
 * @param currency - The currency to use
 * @returns The currency amount key
 */
function getCurrencyAmountKey(currency: Currency): keyof TokenAmountType {
    return `${currency}Amount` as keyof TokenAmountType;
}

/**
 * Get the supported locale for a given currency
 * @param currency - The currency to use
 * @returns The supported locale
 */
function getSupportedLocale(
    currency: Currency
): (typeof mapLocales)[keyof typeof mapLocales] {
    return mapLocales[currency] ?? mapLocales.eur;
}

/**
 * Get the supported currency for a given currency
 * @param currency - The currency to use
 * @returns The supported currency
 */
function getSupportedCurrency(currency: Currency): Currency {
    return currency in mapLocales ? currency : "eur";
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

    // Get the supported locale (e.g. "fr-FR")
    const supportedLocale = getSupportedLocale(currency);

    // Get the supported currency (e.g. "eur")
    const supportedCurrency = getSupportedCurrency(currency);

    // Get the currency amount key (e.g. "eurAmount")
    const currencyAmountKey = getCurrencyAmountKey(supportedCurrency);

    // Get the current reward
    let currentReward = maxReferrer[currencyAmountKey];
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
    });
}
