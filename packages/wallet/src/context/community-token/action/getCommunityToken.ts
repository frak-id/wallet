"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { getAlchemyNftUrl } from "@/context/common/blockchain/alchemy-transport";
import { communityTokenFactoryAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import type { CommunityTokenBalance } from "@/types/CommunityTokenBalances";
import { unstable_cache } from "next/cache";
import type { Address } from "viem";
import { readContract } from "viem/actions";
import { arbitrumSepolia } from "viem/chains";

/**
 * Get the address of the community token for the given content id
 *  - For now, available contentId is 0,1,2
 * @param contentId
 */
async function _getCommunityTokenForContent({
    contentId,
}: { contentId: number }) {
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
    const baseUrl = getAlchemyNftUrl({ chain: arbitrumSepolia });
    if (!baseUrl) {
        throw new Error("No alchemy base url found");
    }

    const queryUrl = new URL(`${baseUrl}/getNFTsForOwner`);
    queryUrl.searchParams.set("owner", wallet);
    queryUrl.searchParams.set("withMetadata", "false");
    // Specify all the known community token right now
    // TODO: In the long term, small pounder.sh indexer doing this stuff (indexing deployed community tokens, and for each community tokens, their holders)
    queryUrl.searchParams.set(
        "contractAddresses[]",
        "0x000D4DA2f31DA29B7BD75C7e16Bef16c289F86aB,0x7352ab0dbfde3dbbb8335ae5757564b9d5687ea9,0xe8bd05dc31320186f220516d25b4b4c47949890a"
    );

    // Then query it and parse the result
    const response = await fetch(queryUrl.toString());
    const result = (await response.json()) as {
        ownedNfts: {
            contractAddress: Address;
            tokenId: string;
            balance: string;
        }[];
    };

    if (!result.ownedNfts) {
        return [];
    }

    return result.ownedNfts.map((nft) => ({
        contractAddress: nft.contractAddress,
        tokenId: BigInt(nft.tokenId),
        balance: BigInt(nft.balance),
    }));
}
