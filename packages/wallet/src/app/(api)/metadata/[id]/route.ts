import { type ContentKey, contentIds } from "@/context/blockchain/contentIds";
import { appUrl } from "@/context/common/env";
import { type NextRequest, NextResponse } from "next/server";
import { toHex } from "viem";

type ContentNames = "le-monde" | "equipe" | "wired" | "frak";

const getImages = (contentName: ContentNames) => ({
    image: `${appUrl}/images/nft/${contentName}-dark.webp`,
    images: {
        dark: `${appUrl}/images/nft/${contentName}-dark.webp`,
        light: `${appUrl}/images/nft/${contentName}-light.webp`,
    },
});

/**
 * Get the metadata for a specific NFT
 * @param _request
 * @param params
 * @constructor
 */
export function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const normalisedId = BigInt(params.id.replace(".json", ""));

    // Find the right content key, or fallback to news paper
    let key =
        Object.keys(contentIds).find(
            (contentKey) =>
                contentIds[contentKey as ContentKey] === normalisedId
        ) ?? "newsPaper";

    if (["ethCCdemo", "newsExample", "newsPaper"].includes(key)) {
        key = "frak";
    }

    return NextResponse.json({
        name: `${key} Community NFT`,
        description: "Super token description",
        ...getImages(key as ContentNames),
        // Content related
        contentId: toHex(normalisedId),
        contentType: "press",
    });
}
