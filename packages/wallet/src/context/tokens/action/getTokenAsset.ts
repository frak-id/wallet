"use server";

import { getAlchemyClientNoBatch } from "@/context/blockchain/provider";
import type { GetTokenMetadataResponse } from "@/context/blockchain/viemActions/AlchemyTypes";
import { getTokenBalances } from "@/context/blockchain/viemActions/getTokenBalances";
import {
    type GetTokenMetadataParams,
    getTokenMetadata,
} from "@/context/blockchain/viemActions/getTokenMetadata";
import { CachesTags } from "@/context/common/caching";
import { revalidateTag, unstable_cache } from "next/cache";
import { parallel } from "radash";
import { formatUnits } from "viem";
import type { Address } from "viem";

/**
 * Get all the user tokens
 * @param wallet
 * @param chainId
 */
async function _getUserErc20Tokens({
    wallet,
    chainId,
}: { wallet: Address; chainId: number }) {
    if (!wallet) {
        return;
    }

    // Get the alchemy client
    const alchemyClient = getAlchemyClientNoBatch({ chainId });

    // Get all of his assets
    const balances = await getTokenBalances(alchemyClient, {
        address: wallet,
        type: "erc20",
    });

    // Get the metadata for assets gt than 0n
    const effectiveBalances = balances.tokenBalances.filter(
        (tBalance) => tBalance.tokenBalance > 0n
    );

    // Fetch every token metadata and return that
    return await parallel(2, effectiveBalances, async (tBalance) => {
        const metadata = await _getTokenMetadata(chainId, {
            address: tBalance.contractAddress,
        });
        const formattedBalance = formatUnits(
            tBalance.tokenBalance,
            metadata.decimals
        );
        return {
            ...tBalance,
            formattedBalance,
            metadata,
        };
    });
}

export type GetUserErc20Token = {
    contractAddress: Address;
    tokenBalance: bigint;
    formattedBalance: string;
    metadata: GetTokenMetadataResponse;
};

/**
 * Cached version of the user tokens
 */
export const getUserErc20Tokens = unstable_cache(
    _getUserErc20Tokens,
    ["get-erc20-assets"],
    {
        // Tags for revalidation
        tags: [CachesTags.WALLET_ERC20_ASSETS, CachesTags.WALLET_ERC20_BALANCE],
        // Keep that in server cache for 2min
        revalidate: 120,
    }
);

/**
 * Invalidate the user erc20 tokens
 */
export async function invalidateUserErc20Tokens() {
    revalidateTag(CachesTags.WALLET_ERC20_ASSETS);
    revalidateTag(CachesTags.WALLET_ERC20_BALANCE);
}

/**
 * Get the metadata of a token, cached version
 * @param address
 */
const _getTokenMetadata = unstable_cache(
    (chainId: number, args: GetTokenMetadataParams) => {
        // Get the alchemy client
        const alchemyClient = getAlchemyClientNoBatch({ chainId });
        // Get and return token metadata
        return getTokenMetadata(alchemyClient, args);
    },
    ["token-metadata"],
    {
        // Keep that in server cache for 48hr
        revalidate: 48 * 60 * 60,
    }
);
