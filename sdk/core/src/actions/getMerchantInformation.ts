import type { FrakClient, GetMerchantInformationReturnType } from "../types";
import { withCache } from "../utils/cache";

/**
 * Fetch the current merchant information (name, rewards, tiers) from the wallet iframe.
 *
 * Results are cached in memory for 30 seconds by default. Concurrent calls
 * while a request is in-flight are deduplicated automatically.
 *
 * @param client - The current Frak Client
 * @param options - Optional cache configuration
 * @param options.cacheTime - Time in ms to cache the result. Default: 30_000 (30s). Set to 0 to disable.
 * @returns The merchant information including available reward tiers
 *
 * @see {@link @frak-labs/core-sdk!index.GetMerchantInformationReturnType | `GetMerchantInformationReturnType`} for the return type shape
 */
export async function getMerchantInformation(
    client: FrakClient,
    options?: { cacheTime?: number }
): Promise<GetMerchantInformationReturnType> {
    return withCache(
        () =>
            client.request({
                method: "frak_getMerchantInformation",
            }),
        {
            cacheKey: "frak_getMerchantInformation",
            cacheTime: options?.cacheTime,
        }
    );
}
