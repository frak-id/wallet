import { currentStablecoins, type Stablecoin } from "@frak-labs/app-essentials";
import type { Currency } from "@frak-labs/core-sdk";

const STABLECOIN_FIAT: Record<Stablecoin, Currency> = {
    eure: "eur",
    usdc: "usd",
};

/** Fiat a campaign's amounts are denominated in: its reward token's peg, EUR when unknown. */
export function campaignRewardCurrency(
    rewardToken: string | undefined
): Currency {
    const token = rewardToken?.toLowerCase();
    const stablecoin = (Object.keys(STABLECOIN_FIAT) as Stablecoin[]).find(
        (key) => currentStablecoins[key].toLowerCase() === token
    );
    return stablecoin ? STABLECOIN_FIAT[stablecoin] : "eur";
}
