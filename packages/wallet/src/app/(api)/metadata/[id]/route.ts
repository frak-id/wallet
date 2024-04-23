import { appUrl } from "@/context/common/env";
import { type NextRequest, NextResponse } from "next/server";

type ContentNames = "le-monde" | "equipe" | "wired";

const contentIdToName: Record<number, ContentNames> = {
    0: "le-monde",
    1: "equipe",
    2: "wired",
};

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
    const normalisedId = Number.parseInt(params.id.replace(".json", ""));

    // Get the content name
    const contentName = contentIdToName[normalisedId];

    // TODO: Define the metadata structure we need and we want
    return NextResponse.json({
        name: `${contentName} Community NFT`,
        description: "Super token description",
        ...getImages(contentName),
        // Content related
        contentId: normalisedId,
        contentType: "news",
    });
}
