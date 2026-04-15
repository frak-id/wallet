import type { FrakClient, UserReferralStatusType } from "../types";
import { withCache } from "../utils/cache";

/**
 * Fetch the current user's referral status on the current merchant.
 *
 * The listener resolves the user's identity (via clientId or wallet session)
 * and checks whether a referral link exists where the user is the referee.
 *
 * Results are cached in memory for 30 seconds by default. Concurrent calls
 * while a request is in-flight are deduplicated automatically.
 *
 * Returns `null` when the user's identity cannot be resolved.
 *
 * @param client - The current Frak Client
 * @param options - Optional cache configuration
 * @param options.cacheTime - Time in ms to cache the result. Default: 30_000 (30s). Set to 0 to disable.
 * @returns The user's referral status, or `null` if identity cannot be resolved
 *
 * @example
 * ```ts
 * const status = await getUserReferralStatus(client);
 * if (status?.isReferred) {
 *   console.log("User was referred to this merchant");
 * }
 * ```
 */
export async function getUserReferralStatus(
    client: FrakClient,
    options?: { cacheTime?: number }
): Promise<UserReferralStatusType | null> {
    return withCache(
        () =>
            client.request({
                method: "frak_getUserReferralStatus",
            }),
        {
            cacheKey: "frak_getUserReferralStatus",
            cacheTime: options?.cacheTime,
        }
    );
}
