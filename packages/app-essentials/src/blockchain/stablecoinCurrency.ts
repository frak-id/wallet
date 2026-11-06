import { currentStablecoins, type Stablecoin } from "./addresses";

/** Fiat a stablecoin is pegged to. */
export type StablecoinCurrency = "eur" | "usd" | "gbp";

/** Peg of every stablecoin a reward can be paid in. */
export const stablecoinCurrency = {
    eure: "eur",
    usdc: "usd",
} as const satisfies Record<Stablecoin, StablecoinCurrency>;

const currencyByAddress = new Map<string, StablecoinCurrency>(
    (Object.keys(stablecoinCurrency) as Stablecoin[]).map((stablecoin) => [
        currentStablecoins[stablecoin].toLowerCase(),
        stablecoinCurrency[stablecoin],
    ])
);

/** Fiat the token at `tokenAddress` is pegged to on the current environment, or `undefined` when unknown. */
export function getStablecoinCurrency(
    tokenAddress?: string
): StablecoinCurrency | undefined {
    if (!tokenAddress) return undefined;
    return currencyByAddress.get(tokenAddress.toLowerCase());
}
