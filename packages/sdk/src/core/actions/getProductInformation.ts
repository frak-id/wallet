import type { GetProductInformationReturnType, NexusClient } from "../types";

/**
 * Function used to get the current product information
 * @param client
 */
export async function getProductInformation(
    client: NexusClient
): Promise<GetProductInformationReturnType> {
    return await client.request({
        method: "frak_getProductInformation",
    });
}
