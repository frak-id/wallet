import type { FrakClient, UserReferralStatusType } from "../types";

/**
 * Fetch the current user's referral status on the current merchant.
 *
 * The listener resolves the user's identity (via clientId or wallet session)
 * and checks whether a referral link exists where the user is the referee.
 *
 * Returns `null` when the user's identity cannot be resolved.
 *
 * @param client - The current Frak Client
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
    client: FrakClient
): Promise<UserReferralStatusType | null> {
    return await client.request({
        method: "frak_getUserReferralStatus",
    });
}
