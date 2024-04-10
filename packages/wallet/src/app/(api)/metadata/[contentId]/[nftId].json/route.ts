import { type NextRequest, NextResponse } from "next/server";

type ContentNames = "le-monde" | "equipe" | "wired";

const rangePerContent: Record<ContentNames, [number, number]> = {
    "le-monde": [1, 3],
    wired: [1, 5],
    equipe: [1, 4],
};

const contentIdToName: Record<number, ContentNames> = {
    0: "le-monde",
    1: "equipe",
    2: "wired",
};

function getImageForId({
    contentName,
    nftId,
}: { contentName: ContentNames; nftId: number }) {
    // Get the content name
    if (!contentName) return "https://placehold.co/400";

    // Get the range for this content
    const [min, max] = rangePerContent[contentName];
    if (!(min && max)) return "https://placehold.co/400";
    // Get an image number in the range from the nft id, the range is inclusive
    const imageNumber = (nftId % (max - min + 1)) + min;
    return `https://poc-wallet.frak.id/images/nft/${contentName}-${imageNumber}.webp`;
}

/**
 * Get the metadata for a specific NFT
 * @param _request
 * @param params
 * @constructor
 */
export function GET(
    _request: NextRequest,
    { params }: { params: { contentId: string; nftId: string } }
) {
    // Get the content name
    const contentName = contentIdToName[Number.parseInt(params.contentId)];

    // TODO: Define the metadata structure we need and we want
    return NextResponse.json({
        name: `${contentName} NFT #${params.nftId}`,
        description: "Super token description",
        image: getImageForId({
            contentName,
            nftId: Number.parseInt(params.nftId),
        }),
        // Content related
        contentId: params.contentId,
        contentType: "news",
    });
}
