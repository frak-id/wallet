"use server";

import { availableClients } from "@/context/common/blockchain/provider";
import { CachesTags } from "@/context/common/caching";
import { unstable_cache } from "next/cache";
import { erc20Abi } from "viem";
import type { Address } from "viem";
import { readContract } from "viem/actions";

/**
 * Get a user token balance
 * @param wallet
 * @param chainId
 * @param token
 */
async function _getErc20Balance({
    wallet,
    chainId,
    token,
}: { wallet: Address; chainId: number; token: Address }) {
    // Get the alchemy client
    const viemClient = availableClients[chainId];

    // Return the balance
    return await readContract(viemClient, {
        address: token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
    });
}

/**
 * Cached version of the user token balance
 */
export const getErc20Balance = unstable_cache(
    _getErc20Balance,
    ["get-erc20-balance"],
    {
        // Tags for revalidation
        tags: [CachesTags.WALLET_ERC20_BALANCE],
        // Keep that in server cache for 1min
        revalidate: 60,
    }
);
