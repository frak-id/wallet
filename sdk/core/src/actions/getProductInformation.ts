import type { FrakClient, GetProductInformationReturnType } from "../types";

/**
 * Function used to get the current product information
 * @param client
 */
export async function getProductInformation(
    client: FrakClient
): Promise<GetProductInformationReturnType> {
    return await client.request({
        method: "frak_getProductInformation",
    });
}
