import { currentStablecoins, type Stablecoin } from "./addresses";

/** Fiat a stablecoin is pegged to. */
export type StablecoinCurrency = "eur" | "usd" | "gbp";

/** Peg of every stablecoin a reward can be paid in. */
export const stablecoinCurrency = {
    eure: "eur",
    usdc: "usd",
} as const satisfies Record<Stablecoin, StablecoinCurrency>;

const stablecoinByAddress = new Map<string, Stablecoin>(
    (Object.keys(stablecoinCurrency) as Stablecoin[]).map((stablecoin) => [
        currentStablecoins[stablecoin].toLowerCase(),
        stablecoin,
    ])
);

/** Stablecoin whose address on the current environment is `tokenAddress`, or `undefined` when unknown. */
export function getStablecoin(tokenAddress?: string): Stablecoin | undefined {
    if (!tokenAddress) return undefined;
    return stablecoinByAddress.get(tokenAddress.toLowerCase());
}

/** Fiat the token at `tokenAddress` is pegged to on the current environment, or `undefined` when unknown. */
export function getStablecoinCurrency(
    tokenAddress?: string
): StablecoinCurrency | undefined {
    const stablecoin = getStablecoin(tokenAddress);
    return stablecoin ? stablecoinCurrency[stablecoin] : undefined;
}
