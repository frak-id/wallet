import type { FrakClient, GetProductInformationReturnType } from "../types";

/**
 * Function used to get the current product information
 * @param client - The current Frak Client
 * @returns The product information in a promise
 */
export async function getProductInformation(
    client: FrakClient
): Promise<GetProductInformationReturnType> {
    return await client.request({
        method: "frak_getProductInformation",
    });
}
