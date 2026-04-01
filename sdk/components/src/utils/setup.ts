import type { FrakClient } from "@frak-labs/core-sdk";
import { referralInteraction } from "@frak-labs/core-sdk/actions";

/**
 * Setup the referral
 * @param client
 */
export async function setupReferral(client: FrakClient) {
    const referral = await referralInteraction(client);
    console.log("referral", referral);
}
