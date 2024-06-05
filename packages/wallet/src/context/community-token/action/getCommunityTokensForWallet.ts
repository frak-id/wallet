"use server";

import { erc6909Transfer } from "@/context/blockchain/abis/event-abi";
import { communityTokenAbi } from "@/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@/context/blockchain/addresses";
import { frakChainPocClient } from "@/context/blockchain/provider";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { unstable_cache } from "next/cache";
import { unique } from "radash";
import type { Address } from "viem";
import { getLogs, multicall, readContract } from "viem/actions";

/**
 * Check if the community token is enabled for the given content
 * @param contentId
 */
async function _isCommunityTokenForContentEnabled({
    contentId,
}: { contentId: bigint }) {
    return await readContract(frakChainPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "isEnabled",
        args: [contentId],
    });
}

export const isCommunityTokenForContentEnabled = unstable_cache(
    _isCommunityTokenForContentEnabled,
    ["check-community-token-for-content"],
    {
        // Keep that in server cache for 48hr
        revalidate: 60 * 60 * 48,
    }
);

/**
 * Check if the community token is enabled for the given content
 * @param contentId
 * @param wallet
 */
async function _isCommunityTokenEnabledForWallet({
    contentId,
    wallet,
}: { contentId: bigint; wallet: Address }) {
    // Check if that's enabled for the content
    const isEnabled = await isCommunityTokenForContentEnabled({ contentId });
    if (!isEnabled) {
        return false;
    }

    // Check if that's enabled for the wallet
    const communityTokenBalance = await readContract(frakChainPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "balanceOf",
        args: [wallet, contentId],
    });
    return communityTokenBalance === 0n;
}

export const isCommunityTokenEnabledForWallet = unstable_cache(
    _isCommunityTokenEnabledForWallet,
    ["check-community-token-for-wallet"],
    {
        // Keep that in server cache for 1min
        revalidate: 60,
    }
);

/**
 * Get the address of the community token for the given content id
 *  - For now, available contentId is 0,1,2
 * @param contentId
 */
export async function getCommunityTokensForWallet({
    wallet,
}: { wallet: Address }): Promise<CommunityTokenBalance[]> {
    // Get all the transfer to logs
    const transferToLogs = await getLogs(frakChainPocClient, {
        address: addresses.communityToken,
        event: erc6909Transfer,
        args: { to: wallet },
        strict: true,
        fromBlock: "earliest",
        toBlock: "latest",
    });

    const tokenIds = unique(transferToLogs.map((log) => log.args.id));

    // Then, for each logs, check if the user has a balance of this token
    const balances = await multicall(frakChainPocClient, {
        allowFailure: false,
        contracts: tokenIds.map(
            (id) =>
                ({
                    address: addresses.communityToken,
                    abi: communityTokenAbi,
                    functionName: "balanceOf",
                    args: [wallet, id],
                }) as const
        ),
    });

    // Return the balances for each id
    return tokenIds
        .map((id, index) => ({
            tokenId: id,
            balance: BigInt(balances[index]),
        }))
        .filter((balance) => balance.balance > 0n);
}
