import type { FrakClient, GetMerchantInformationReturnType } from "../types";

/**
 * Fetch the current merchant information (name, rewards, tiers) from the wallet iframe
 * @param client - The current Frak Client
 * @returns The merchant information including available reward tiers
 *
 * @see {@link @frak-labs/core-sdk!index.GetMerchantInformationReturnType | `GetMerchantInformationReturnType`} for the return type shape
 */
export async function getMerchantInformation(
    client: FrakClient
): Promise<GetMerchantInformationReturnType> {
    return await client.request({
        method: "frak_getMerchantInformation",
    });
}
