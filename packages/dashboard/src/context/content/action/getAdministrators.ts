"use server";
import ky from "ky";
import { type Address, type Hex, toHex } from "viem";

type ApiResult = {
    wallet: Address;
    isContentOwner: number; // bool, 0 false 1 true
    addedTimestamp: string; // bigint
}[];

/**
 * Get all the administrators of a content
 */
export async function getContentAdministrators({
    contentId,
}: { contentId: Hex }) {
    // Get our api results
    const json = await ky
        .get(`https://indexer.frak.id/contents/${contentId}/administrators`)
        .json<ApiResult>();

    console.log(typeof contentId);
    console.log(toHex(contentId));
    console.log(json);

    // Return that mapped with the right types
    return json.map((result) => ({
        wallet: result.wallet,
        isContentOwner: result.isContentOwner === 1,
        addedTimestamp: BigInt(result.addedTimestamp),
    }));
}
