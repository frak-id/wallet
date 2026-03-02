import ky from "ky";
import type { Address, Hex } from "viem";
import { pad, toHex } from "viem";
import { migrationConfig } from "../config";
import type {
    V1IndexerAdministrator,
    V1IndexerProduct,
    V1IndexerProductInfo,
} from "../types";

const indexerApi = ky.create({ prefixUrl: migrationConfig.indexerUrl });

export async function fetchAllProducts(): Promise<V1IndexerProduct[]> {
    try {
        const response = await indexerApi
            .get("products")
            .json<V1IndexerProduct[]>();
        return response ?? [];
    } catch (error) {
        console.error("Failed to fetch all products:", error);
        return [];
    }
}

export async function fetchProductInfo(
    productId: Hex
): Promise<V1IndexerProductInfo | null> {
    try {
        return await indexerApi
            .get(`products/info?productId=${productId}`)
            .json<V1IndexerProductInfo>();
    } catch (error) {
        console.error(`Failed to fetch product info for ${productId}:`, error);
        return null;
    }
}

export async function fetchProductAdministrators(
    productId: Hex
): Promise<V1IndexerAdministrator[]> {
    try {
        const response = await indexerApi
            .get(`products/${productId}/administrators`)
            .json<
                {
                    wallet: Address;
                    isOwner: boolean;
                    roles: string;
                    addedTimestamp: string;
                }[]
            >();

        return response.map((item) => ({
            productId: productId,
            isOwner: item.isOwner,
            roles: item.roles,
            user: item.wallet,
            createdTimestamp: item.addedTimestamp,
        }));
    } catch (error) {
        console.error(
            `Failed to fetch administrators for ${productId}:`,
            error
        );
        return [];
    }
}

export function productIdToHex(productIdStr: string): Hex {
    return pad(toHex(BigInt(productIdStr)), { size: 32 });
}
