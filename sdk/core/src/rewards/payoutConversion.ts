import { locales } from "../constants/locales";
import type { Currency, EstimatedReward, TokenAmountType } from "../types";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";
import { getSupportedLocale } from "../utils/format/getSupportedLocale";
import { widenGroupSeparator } from "../utils/format/widenGroupSeparator";
import { getRewardValue } from "./value";

/**
 * How a reward shown in `displayCurrency` is actually paid out in
 * `payoutCurrency`.
 * @group Rewards
 */
export type PayoutConversion = {
    /** Currency the reward is displayed in. */
    displayCurrency: Currency;
    /** Fiat the reward token is pegged to, i.e. what the user receives. */
    payoutCurrency: Currency;
    /** Value of one payout unit in `displayCurrency`; absent when the reward carries no usable amounts. */
    rate?: number;
    /** {@link rate} rendered as `"€1 = £0.87"`. */
    formattedRate?: string;
    /** Headline amount in `payoutCurrency` for a fixed or tiered reward; absent for a percentage. */
    payoutAmount?: string;
};

/**
 * Inputs of {@link getPayoutConversion}.
 * @group Rewards
 */
export type PayoutConversionOptions = {
    /** Currency the reward is displayed in; defaults to EUR. */
    displayCurrency?: Currency;
    /** Fiat the reward token is pegged to; no conversion is reported when unknown. */
    payoutCurrency?: Currency;
    /** BCP 47 locale for the formatted strings; defaults to each currency's own locale. */
    locale?: string;
};

function isSupportedCurrency(
    currency: Currency | undefined
): currency is Currency {
    return currency !== undefined && currency in locales;
}

/** The amount the rate is read from: the richest fixed/tier amount, else a percentage's cap. */
function referenceAmount(
    reward: EstimatedReward,
    payoutKey: keyof TokenAmountType
): TokenAmountType | undefined {
    switch (reward.payoutType) {
        case "fixed":
            return reward.amount;
        case "percentage":
            return reward.maxAmount ?? reward.minAmount;
        case "tiered": {
            let best: TokenAmountType | undefined;
            for (const tier of reward.tiers) {
                if (
                    "amount" in tier &&
                    tier.amount[payoutKey] > (best?.[payoutKey] ?? 0)
                ) {
                    best = tier.amount;
                }
            }
            return best;
        }
    }
}

/** `undefined` for a malformed tag, so formatting falls back to the currency's own locale instead of throwing. */
function wellFormedLocale(locale: string | undefined): string | undefined {
    if (!locale) return undefined;
    try {
        return Intl.getCanonicalLocales(locale)[0];
    } catch {
        return undefined;
    }
}

function formatMoney(
    value: number,
    currency: Currency,
    locale: string | undefined,
    [minimumFractionDigits, maximumFractionDigits]: [number, number]
): string {
    return widenGroupSeparator(
        value.toLocaleString(
            wellFormedLocale(locale) ?? getSupportedLocale(currency),
            {
                style: "currency",
                currency,
                currencyDisplay: "narrowSymbol",
                minimumFractionDigits,
                maximumFractionDigits,
            }
        )
    );
}

function formatRate(
    rate: number,
    displayCurrency: Currency,
    payoutCurrency: Currency,
    locale?: string
): string {
    const display = formatMoney(rate, displayCurrency, locale, [
        2,
        rate < 0.1 ? 4 : 2,
    ]);
    return `${formatMoney(1, payoutCurrency, locale, [0, 0])} = ${display}`;
}

/**
 * Describe the currency conversion behind a displayed reward, or `undefined`
 * when the payout currency is unknown or already the display currency.
 * @description The rate comes from the reward's own fiat amounts, so it matches what the backend priced the token at.
 * @group Rewards
 */
export function getPayoutConversion(
    reward: EstimatedReward,
    { displayCurrency, payoutCurrency, locale }: PayoutConversionOptions
): PayoutConversion | undefined {
    if (!isSupportedCurrency(payoutCurrency)) return undefined;
    const display = getSupportedCurrency(displayCurrency);
    if (display === payoutCurrency) return undefined;

    const displayKey = getCurrencyAmountKey(display);
    const payoutKey = getCurrencyAmountKey(payoutCurrency);

    const reference = referenceAmount(reward, payoutKey);
    const displayValue = reference?.[displayKey];
    const payoutValue = reference?.[payoutKey];
    const rate =
        displayValue && payoutValue && displayValue > 0 && payoutValue > 0
            ? displayValue / payoutValue
            : undefined;

    const headline =
        reward.payoutType === "percentage"
            ? 0
            : getRewardValue(reward, payoutKey);

    return {
        displayCurrency: display,
        payoutCurrency,
        ...(rate !== undefined && {
            rate,
            formattedRate: formatRate(rate, display, payoutCurrency, locale),
        }),
        ...(headline > 0 && {
            payoutAmount: formatMoney(headline, payoutCurrency, locale, [0, 2]),
        }),
    };
}
