"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { erc6909Transfer } from "@/context/common/blockchain/event-abi";
import { communityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { unstable_cache } from "next/cache";
import type { Address } from "viem";
import { getLogs, multicall, readContract } from "viem/actions";

/**
 * Check if the community token is enabled for the given content
 * @param contentId
 */
async function _isCommunityTokenForContentEnabled({
    contentId,
}: { contentId: number }) {
    return await readContract(arbSepoliaPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "isEnabled",
        args: [BigInt(contentId)],
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
}: { contentId: number; wallet: Address }) {
    // Check if that's enabled for the content
    const isEnabled = await isCommunityTokenForContentEnabled({ contentId });
    if (!isEnabled) {
        return false;
    }

    // Check if that's enabled for the wallet
    const communityTokenBalance = await readContract(arbSepoliaPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "balanceOf",
        args: [wallet, BigInt(contentId)],
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
    const transferToLogs = await getLogs(arbSepoliaPocClient, {
        address: addresses.communityToken,
        event: erc6909Transfer,
        args: { to: wallet },
        strict: true,
        fromBlock: "earliest",
        toBlock: "latest",
    });

    // Then, for each logs, check if the user has a balance of this token
    const balances = await multicall(arbSepoliaPocClient, {
        allowFailure: false,
        contracts: transferToLogs.map(
            (log) =>
                ({
                    address: addresses.communityToken,
                    abi: communityTokenAbi,
                    functionName: "balanceOf",
                    args: [wallet, BigInt(log.args.id)],
                }) as const
        ),
    });

    // Return the balances for each id
    return transferToLogs
        .map((log, index) => ({
            tokenId: BigInt(log.args.id),
            balance: BigInt(balances[index]),
        }))
        .filter((balance) => balance.balance > 0n);
}
