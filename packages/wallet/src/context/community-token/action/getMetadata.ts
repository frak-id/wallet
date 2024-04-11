"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { communityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import { unstable_cache } from "next/cache";
import { readContract } from "viem/actions";

/**
 * Get the metadata for the given NFT
 * @param tokenAddress
 * @param tokenId
 */
async function _getNftMetadata({
    tokenId,
}: {
    tokenId: bigint;
}) {
    // Get the metadata url
    let metadataUrl = await readContract(arbSepoliaPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "tokenURI",
        args: [tokenId],
    });

    if (
        process.env.IS_LOCAL === "true" &&
        metadataUrl.indexOf("poc-wallet.frak.id") >= 0
    ) {
        metadataUrl = metadataUrl
            .replace("https", "http")
            .replace("poc-wallet.frak.id", "localhost:3000");
    }
    console.log("metadata url", { metadataUrl });

    // Query it and return it
    const response = await fetch(metadataUrl);

    // Return the metadata
    const result = (await response.json()) as {
        name: string;
        description: string;
        image: string;
        images: {
            dark: string;
            light: string;
        };
    };

    // Map the image url if local
    if (process.env.IS_LOCAL === "true") {
        result.image = result.image
            .replace("https", "http")
            .replace("poc-wallet.frak.id", "localhost:3000");
    }
    console.log("metadata results", { result });
    return result;
}

export const getCommunityTokenMetadata = unstable_cache(
    _getNftMetadata,
    ["get-community-token-metadata"],
    {
        // Keep that in server cache for 48hr
        revalidate: 60 * 60 * 48,
    }
);
