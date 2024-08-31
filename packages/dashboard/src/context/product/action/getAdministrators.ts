"use server";
import ky from "ky";
import { type Address, type Hex, toHex } from "viem";

type ApiResult = {
    wallet: Address;
    isOwner: number; // bool, 0 false 1 true
    roles: string; // bigint
    addedTimestamp: string; // bigint
}[];

/**
 * Get all the administrators of a product
 */
export async function getProductAdministrators({
    productId,
}: { productId: Hex }) {
    // Get our api results
    const json = await ky
        .get(`https://indexer.frak.id/products/${productId}/administrators`)
        .json<ApiResult>();

    // Return that mapped with the right types
    return json.map((result) => ({
        wallet: result.wallet,
        isOwner: result.isOwner === 1,
        roles: toHex(BigInt(result.roles)),
        addedTimestamp: BigInt(result.addedTimestamp),
    }));
}
