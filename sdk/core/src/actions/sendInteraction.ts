import type { FrakClient } from "../types";
import type { SendInteractionParamsType } from "../types/rpc/interaction";

/**
 * Send an interaction to the backend via the listener RPC.
 * Fire-and-forget: errors are caught and logged, not thrown.
 *
 * @param client - The Frak client instance
 * @param params - The interaction parameters
 *
 * @description Sends a user interaction event through the wallet iframe RPC. Supports three interaction types: arrival tracking, sharing events, and custom interactions.
 *
 * @example
 * Track a user arrival with referral attribution:
 * ```ts
 * await sendInteraction(client, {
 *     type: "arrival",
 *     referrerWallet: "0x1234...abcd",
 *     landingUrl: window.location.href,
 *     utmSource: "twitter",
 *     utmMedium: "social",
 *     utmCampaign: "launch-2026",
 * });
 * ```
 *
 * @example
 * Track a sharing event:
 * ```ts
 * await sendInteraction(client, { type: "sharing" });
 * ```
 *
 * @example
 * Send a custom interaction:
 * ```ts
 * await sendInteraction(client, {
 *     type: "custom",
 *     customType: "newsletter_signup",
 *     data: { email: "user@example.com" },
 * });
 * ```
 */
export async function sendInteraction(
    client: FrakClient,
    params: SendInteractionParamsType
): Promise<void> {
    try {
        await client.request({
            method: "frak_sendInteraction",
            params: [params],
        });
    } catch {
        // Silent failure - fire-and-forget
        console.warn("[Frak SDK] Failed to send interaction:", params.type);
    }
}
