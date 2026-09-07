import type { Currency, EstimatedReward } from "../types";
import { formatAmount } from "../utils/format/formatAmount";
import {
    formatAmountParts,
    percentAmountParts,
    type RewardAmountParts,
} from "../utils/format/formatAmountParts";
import { getCurrencyAmountKey } from "../utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../utils/format/getSupportedCurrency";
import { getRewardRank, getRewardValue, maxRewardPercent } from "./value";

/**
 * Format an {@link EstimatedReward} into a human-readable string; a tiered
 * reward renders its richest tier. Percentages stay as `"X %"`.
 */
export function formatEstimatedReward(
    reward: EstimatedReward,
    currency?: Currency
): string {
    const supportedCurrency = getSupportedCurrency(currency);
    const key = getCurrencyAmountKey(supportedCurrency);

    switch (reward.payoutType) {
        case "fixed":
            return formatAmount(
                Math.round(reward.amount[key]),
                supportedCurrency
            );

        case "percentage":
            return `${reward.percent} %`;

        case "tiered": {
            const maxAmount = getRewardValue(reward, key);
            if (maxAmount > 0) {
                return formatAmount(Math.round(maxAmount), supportedCurrency);
            }
            const maxPercent = maxRewardPercent(reward);
            if (maxPercent > 0) {
                return `${maxPercent} %`;
            }
            return formatAmount(0, supportedCurrency);
        }
    }
}

/**
 * The same selection {@link formatEstimatedReward} makes, expressed as display
 * parts instead of a string. Deliberately a sibling switch rather than derived
 * from it: `formatted` is interpolated into i18next on several surfaces and
 * must stay byte-stable.
 */
export function formatEstimatedRewardParts(
    reward: EstimatedReward,
    currency?: Currency
): RewardAmountParts {
    const supportedCurrency = getSupportedCurrency(currency);
    const key = getCurrencyAmountKey(supportedCurrency);

    switch (reward.payoutType) {
        case "fixed":
            return formatAmountParts(
                Math.round(reward.amount[key]),
                supportedCurrency
            );

        case "percentage":
            return percentAmountParts(reward.percent);

        case "tiered": {
            const maxAmount = getRewardValue(reward, key);
            if (maxAmount > 0) {
                return formatAmountParts(
                    Math.round(maxAmount),
                    supportedCurrency
                );
            }
            const maxPercent = maxRewardPercent(reward);
            if (maxPercent > 0) {
                return percentAmountParts(maxPercent);
            }
            return formatAmountParts(0, supportedCurrency);
        }
    }
}

/**
 * Format a reward for display, or `undefined` when it carries no displayable
 * value (a `fixed`/`tiered` reward worth `0`) so callers can hide the badge.
 */
export function formatRewardOrHide(
    reward: EstimatedReward | undefined,
    currency?: Currency
): string | undefined {
    if (!reward) return undefined;
    const key = getCurrencyAmountKey(getSupportedCurrency(currency));
    if (getRewardRank(reward, key) <= 0) return undefined;
    return formatEstimatedReward(reward, currency);
}

/**
 * Replace the `{REWARD}` placeholder in a text string with a reward value.
 * If no reward is provided, returns the text with `{REWARD}` stripped.
 */
export function applyRewardPlaceholder(
    text: string,
    reward: string | undefined
): string {
    return reward
        ? text.replaceAll("{REWARD}", reward)
        : text.replaceAll("{REWARD}", "");
}
