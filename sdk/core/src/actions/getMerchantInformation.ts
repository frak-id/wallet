import type { FrakClient, GetMerchantInformationReturnType } from "../types";

export async function getMerchantInformation(
    client: FrakClient
): Promise<GetMerchantInformationReturnType> {
    return await client.request({
        method: "frak_getMerchantInformation",
    });
}
