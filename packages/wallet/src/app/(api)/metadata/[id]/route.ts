import { contentIds } from "@/context/blockchain/contentIds";
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

    // Check if the content id is in the list
    for (const contentKey of Object.keys(contentIds)) {
        const contentId = contentIds[contentKey];
        if (contentId !== normalisedId) {
            continue;
        }

        return NextResponse.json({
            name: `${contentKey} Community NFT`,
            description: "Super token description",
            ...getImages(contentKey as ContentNames),
            // Content related
            contentId: toHex(normalisedId),
            contentType: "press",
        });
    }

    // Otherwise, return an error
    return NextResponse.error();
}
