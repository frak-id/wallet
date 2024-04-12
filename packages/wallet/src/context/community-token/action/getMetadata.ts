"use server";

import { addresses } from "@/context/common/blockchain/addresses";
import { communityTokenAbi } from "@/context/common/blockchain/poc-abi";
import { arbSepoliaPocClient } from "@/context/common/blockchain/provider";
import { unstable_cache } from "next/cache";
import { readContract } from "viem/actions";

function replaceMetadataUrlWithLocal(metadataUrl: string) {
    return metadataUrl
        .replace("https", "http")
        .replace("poc-wallet.frak.id", "localhost:3000");
}

/**
 * Get the metadata for the given NFT
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
        metadataUrl = replaceMetadataUrlWithLocal(metadataUrl);
    }

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
        result.image = replaceMetadataUrlWithLocal(result.image);
        result.images.dark = replaceMetadataUrlWithLocal(result.images.dark);
        result.images.light = replaceMetadataUrlWithLocal(result.images.light);
    }
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
