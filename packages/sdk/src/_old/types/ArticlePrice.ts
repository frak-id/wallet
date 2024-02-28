import type { Hex } from "viem";

export type ArticlePrice = Readonly<{
    // The price index
    index: number;
    // The unlock duration of this price
    unlockDurationInSec: number;
    // The frk amount of the price (bigint as Hex)
    frkAmount: Hex;
}>;
