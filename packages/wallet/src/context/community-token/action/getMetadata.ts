"use server";

import { frakChainPocClient } from "@/context/blockchain/provider";
import { isRunningInDev, isRunningLocally } from "@/context/common/env";
import { communityTokenAbi } from "@frak-labs/shared/context/blockchain/abis/frak-gating-abis";
import { addresses } from "@frak-labs/shared/context/blockchain/addresses";
import { unstable_cache } from "next/cache";
import { readContract } from "viem/actions";

function replaceMetadataUrlWithLocal(metadataUrl: string) {
    return metadataUrl
        .replace("https", "http")
        .replace("nexus.frak.id", "localhost:3000")
        .replace("nexus-dev.frak.id", "localhost:3000");
}

function replaceMetadataUrlWithDev(metadataUrl: string) {
    return metadataUrl.replace("nexus.frak.id", "nexus-dev.frak.id");
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
    let metadataUrl = await readContract(frakChainPocClient, {
        address: addresses.communityToken,
        abi: communityTokenAbi,
        functionName: "tokenURI",
        args: [tokenId],
    });

    if (isRunningLocally) {
        metadataUrl = replaceMetadataUrlWithLocal(metadataUrl);
    }
    if (isRunningInDev) {
        metadataUrl = replaceMetadataUrlWithDev(metadataUrl);
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
    if (isRunningLocally) {
        result.image = replaceMetadataUrlWithLocal(result.image);
        result.images.dark = replaceMetadataUrlWithLocal(result.images.dark);
        result.images.light = replaceMetadataUrlWithLocal(result.images.light);
    }

    // If we are in dev, replace with dev url
    if (isRunningInDev) {
        result.image = replaceMetadataUrlWithDev(result.image);
        result.images.dark = replaceMetadataUrlWithDev(result.images.dark);
        result.images.light = replaceMetadataUrlWithDev(result.images.light);
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
