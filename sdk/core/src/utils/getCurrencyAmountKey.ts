import type { Currency, TokenAmountType } from "../types";

/**
 * Get the currency amount key for a given currency
 * @param currency - The currency to use
 * @returns The currency amount key
 */
export function getCurrencyAmountKey(
    currency: Currency
): keyof TokenAmountType {
    return `${currency}Amount` as keyof TokenAmountType;
}
