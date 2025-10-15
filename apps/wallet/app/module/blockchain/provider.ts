import { isRunningInProd } from "@frak-labs/app-essentials";
import { getViemClientFromChain } from "@frak-labs/app-essentials/blockchain";
import { arbitrum, arbitrumSepolia } from "viem/chains";

/**
 * The current chain
 */
export const currentChain = isRunningInProd ? arbitrum : arbitrumSepolia;

/**
 * The current client
 */
export const currentViemClient = getViemClientFromChain({
    chain: currentChain,
});

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error: Unreachable code error
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};
