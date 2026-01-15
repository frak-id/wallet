/**
 * Track arrival action for referral attribution
 * Logs a touchpoint when a user lands on a merchant site with a referral context
 */

import type { FrakClient } from "../types";
import type {
    TrackArrivalInternalParams,
    TrackArrivalResult,
} from "../types/tracking";
import { getBackendUrl } from "../utils/backendUrl";
import { getClientId } from "../utils/clientId";
import { extractUtmParams } from "../utils/utmParams";

/**
 * Track an arrival event for referral attribution
 *
 * @param client - The Frak client instance
 * @param params - The tracking parameters
 * @returns The tracking result
 *
 * @example
 * ```ts
 * const result = await trackArrival(client, {
 *     merchantId: "uuid-from-dashboard",
 *     referrerWallet: "0x...",
 * });
 * ```
 */
export async function trackArrival(
    client: FrakClient,
    params: TrackArrivalInternalParams
): Promise<TrackArrivalResult> {
    const { merchantId, referrerWallet, landingUrl, utmParams } = params;

    // Get client ID for anonymous tracking
    const clientId = getClientId();

    // Auto-extract UTM params if not provided
    const finalUtmParams = utmParams ?? extractUtmParams();

    // Get current landing URL if not provided
    const finalLandingUrl =
        landingUrl ??
        (typeof window !== "undefined" ? window.location.href : undefined);

    // Build request body
    const body = {
        merchantId,
        referrerWallet,
        landingUrl: finalLandingUrl,
        utmSource: finalUtmParams?.source,
        utmMedium: finalUtmParams?.medium,
        utmCampaign: finalUtmParams?.campaign,
        utmTerm: finalUtmParams?.term,
        utmContent: finalUtmParams?.content,
    };

    // Build headers
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-frak-client-id": clientId,
    };

    try {
        const backendUrl = getBackendUrl(client.config.walletUrl);
        const response = await fetch(`${backendUrl}/user/track/arrival`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn("[Frak SDK] Failed to track arrival:", errorText);
            return {
                success: false,
                error: `HTTP ${response.status}: ${errorText}`,
            };
        }

        const data = (await response.json()) as {
            identityGroupId?: string;
            touchpointId?: string;
        };

        return {
            success: true,
            identityGroupId: data.identityGroupId,
            touchpointId: data.touchpointId,
        };
    } catch (error) {
        console.warn("[Frak SDK] Error tracking arrival:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
