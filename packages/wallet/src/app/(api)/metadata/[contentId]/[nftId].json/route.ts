import { type NextRequest, NextResponse } from "next/server";

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
    // TODO: Define the metadata structure we need and we want
    return NextResponse.json({
        name: "TestToken",
        description: "Super token description",
        image: "https://placehold.co/400",
        ...params,
    });
}
