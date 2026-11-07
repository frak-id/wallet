import {
    getStablecoin,
    getStablecoinCurrency,
} from "@frak-labs/app-essentials";
import type { Currency } from "@frak-labs/core-sdk";
import { currencyMetadata } from "./tokenStatus";

/** Fiat a campaign's amounts are denominated in: its reward token's peg, EUR when unknown. */
export function campaignRewardCurrency(
    rewardToken: string | undefined
): Currency {
    return getStablecoinCurrency(rewardToken) ?? "eur";
}

export type RewardTokenInfo = { currency: Currency; label: string };

/** Fiat and ticker (`EURe`, `USDC`) of a reward token; EURe when unknown. */
export function rewardTokenInfo(
    rewardToken: string | undefined
): RewardTokenInfo {
    const stablecoin = getStablecoin(rewardToken);
    return {
        currency: campaignRewardCurrency(rewardToken),
        label: currencyMetadata[stablecoin ?? "eure"].label,
    };
}
