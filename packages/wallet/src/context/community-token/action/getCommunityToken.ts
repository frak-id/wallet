"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { getAlchemyRpcUrl } from "@/context/common/blockchain/alchemy-transport";
import { communityTokenFactoryAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { unstable_cache } from "next/cache";
import type { Address, Hex } from "viem";
import { readContract } from "viem/actions";
import { arbitrumSepolia } from "viem/chains";

/**
 * Get the address of the community token for the given content id
 *  - For now, available contentId is 0,1,2
 * @param contentId
 */
async function _getCommunityTokenForContent({ contentId }: { contentId: Hex }) {
    return await readContract(arbSepoliaPocClient, {
        address: addresses.communityTokenFactory,
        abi: communityTokenFactoryAbi,
        functionName: "getCommunityToken",
        args: [BigInt(contentId)],
    });
}

export const getCommunityTokenForContent = unstable_cache(
    _getCommunityTokenForContent,
    ["get-community-token-for-content"],
    {
        // Keep that in server cache for 48hr
        revalidate: 60 * 60 * 48,
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
    // Build the alchemy query url
    const baseUrl = getAlchemyRpcUrl({ chain: arbitrumSepolia, version: 3 });
    if (!baseUrl) {
        throw new Error("No alchemy base url found");
    }
    const queryUrl = new URL(`${baseUrl}/getNFTsForOwner`);
    queryUrl.searchParams.set("owner", wallet);
    queryUrl.searchParams.set("withMetadata", "false");
    // TODO: We can also specify 'contractAddresses' to filter out on specific community tokens

    // Then query it and parse the result
    const response = await fetch(queryUrl.toString());
    const result = (await response.json()) as {
        ownedNfts: {
            contractAddress: Address;
            tokenId: string;
            balance: string;
        }[];
    };

    return result.ownedNfts.map((nft) => ({
        contractAddress: nft.contractAddress,
        tokenId: BigInt(nft.tokenId),
        balance: BigInt(nft.balance),
    }));
}
