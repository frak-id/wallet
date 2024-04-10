"use server";

import { contentCommunityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import { unstable_cache } from "next/cache";
import type { Address } from "viem";
import { readContract } from "viem/actions";

/**
 * Get the metadata for the given NFT
 * @param tokenAddress
 * @param tokenId
 */
async function _getNftMetadata({
    tokenAddress,
    tokenId,
}: {
    tokenAddress: Address;
    tokenId: bigint;
}) {
    // Get the metadata url
    const metadataUrl = await readContract(arbSepoliaPocClient, {
        address: tokenAddress,
        abi: contentCommunityTokenAbi,
        functionName: "tokenURI",
        args: [tokenId],
    });

    // Query it and return it
    const response = await fetch(metadataUrl);

    // Return the metadata
    // TODO: Add more fields in the metadata api and here if needed
    return (await response.json()) as {
        name: string;
        description: string;
        image: string;
    };
}

export const getNftMetadata = unstable_cache(
    _getNftMetadata,
    ["get-nft-metadata"],
    {
        // Keep that in server cache for 48hr
        revalidate: 60 * 60 * 48,
    }
);
