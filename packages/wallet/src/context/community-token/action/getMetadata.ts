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
    let metadataUrl = await readContract(arbSepoliaPocClient, {
        address: tokenAddress,
        abi: contentCommunityTokenAbi,
        functionName: "tokenURI",
        args: [tokenId],
    });

    if (
        process.env.IS_LOCAL === "true" &&
        metadataUrl.indexOf("poc-wallet.frak.id") >= 0
    ) {
        metadataUrl = metadataUrl
            .replace("metadata", "metadata/")
            .replace("https", "http")
            .replace("poc-wallet.frak.id", "localhost:3000");
    }

    // Query it and return it
    const response = await fetch(metadataUrl);

    // Return the metadata
    const result = (await response.json()) as {
        name: string;
        description: string;
        image: string;
    };

    // Map the image url if local
    if (process.env.IS_LOCAL === "true") {
        result.image = result.image
            .replace("https", "http")
            .replace("poc-wallet.frak.id", "localhost:3000");
    }
    return result;
}

export const getNftMetadata = unstable_cache(
    _getNftMetadata,
    ["get-nft-metadata"],
    {
        // Keep that in server cache for 48hr
        revalidate: 60 * 60 * 48,
    }
);
