import type {
    CampaignResponse,
    CampaignStatus,
} from "@frak-labs/backend-elysia/domain/campaign";
import type { BankStatus } from "@frak-labs/backend-elysia/domain/campaign-bank";
import type { CampaignStatsItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { LRUCache } from "lru-cache";
import type { AuthenticatedContext } from "../types/context";
import { backendApi } from "../utils/backendApi";
import { resolveMerchantId } from "./merchant";

export type { BankStatus, CampaignResponse, CampaignStatsItem, CampaignStatus };

// ---------------------------------------------------------------------------
// JWT extraction — Shopify App Bridge session token
// ---------------------------------------------------------------------------

/**
 * Extract the Shopify session token JWT from the request.
 *
 * Shopify embeds the token in two places:
 *  - `Authorization: Bearer <jwt>` header (fetch requests from App Bridge)
 *  - `id_token` query parameter (initial page loads)
 */
function extractSessionToken(request: Request): string | null {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.slice(7);
    }
    const url = new URL(request.url);
    return url.searchParams.get("id_token");
}

/**
 * Build headers for authenticated backend calls.
 * Includes the Shopify session token when available.
 */
function buildBackendHeaders(
    request: Request
): Record<string, string> | undefined {
    const sessionToken = extractSessionToken(request);
    if (!sessionToken) {
        return undefined;
    }
    return { "X-Shopify-Session-Token": sessionToken };
}

// ---------------------------------------------------------------------------
// Caches — short TTL, navigation-scoped
// ---------------------------------------------------------------------------

const campaignsCache = new LRUCache<string, CampaignResponse[]>({
    max: 512,
    ttl: 5_000,
});

const bankStatusCache = new LRUCache<string, BankStatus>({
    max: 512,
    ttl: 5_000,
});

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Fetch campaigns for the current merchant from the Frak backend.
 */
export async function getMerchantCampaigns(
    context: AuthenticatedContext,
    request: Request
): Promise<CampaignResponse[] | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    const cached = campaignsCache.get(merchantId);
    if (cached) {
        return cached;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns.get({
                headers: buildBackendHeaders(request),
            });
        if (error) {
            console.error(
                `[backendMerchant] campaigns fetch failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        const campaigns = data.campaigns as CampaignResponse[];
        campaignsCache.set(merchantId, campaigns);
        return campaigns;
    } catch (error) {
        console.error(
            `[backendMerchant] campaigns fetch error for ${merchantId}:`,
            error
        );
        return null;
    }
}

/**
 * Fetch bank status for the current merchant from the Frak backend.
 */
export async function getMerchantBankStatus(
    context: AuthenticatedContext,
    request: Request
): Promise<BankStatus | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    const cached = bankStatusCache.get(merchantId);
    if (cached) {
        return cached;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .bank.get({
                headers: buildBackendHeaders(request),
            });
        if (error) {
            console.error(
                `[backendMerchant] bank fetch failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        bankStatusCache.set(merchantId, data);
        return data;
    } catch (error) {
        console.error(
            `[backendMerchant] bank fetch error for ${merchantId}:`,
            error
        );
        return null;
    }
}

/**
 * Fetch campaign stats for the current merchant from the Frak backend.
 */
export async function getMerchantCampaignStats(
    context: AuthenticatedContext,
    request: Request
): Promise<CampaignStatsItem[] | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns.stats.get({
                headers: buildBackendHeaders(request),
            });
        if (error) {
            console.error(
                `[backendMerchant] stats fetch failed (${error}) for ${merchantId}`
            );
            return null;
        }
        return data.stats;
    } catch (error) {
        console.error(
            `[backendMerchant] stats fetch error for ${merchantId}:`,
            error
        );
        return null;
    }
}

/**
 * Setup Frak webhook for the current merchant on the Frak backend.
 */
export async function setupFrakWebhook(
    context: AuthenticatedContext,
    request: Request
): Promise<{ success: boolean; userErrors: { message: string }[] }> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return {
            success: false,
            userErrors: [{ message: "Merchant not found" }],
        };
    }

    try {
        const { error } = await backendApi.business
            .merchant({ merchantId })
            .webhooks.post(
                {
                    hookSignatureKey: "SHOPIFY_SECRET",
                    platform: "shopify",
                },
                {
                    headers: buildBackendHeaders(request),
                }
            );
        if (error) {
            const errorMessage =
                typeof error === "string"
                    ? error
                    : error instanceof Error
                      ? error.message
                      : "Failed to setup Frak webhook";
            console.error(
                `[backendMerchant] webhook setup failed for ${merchantId}: ${errorMessage}`
            );
            return {
                success: false,
                userErrors: [{ message: errorMessage }],
            };
        }

        return {
            success: true,
            userErrors: [],
        };
    } catch (error) {
        console.error(
            `[backendMerchant] webhook setup error for ${merchantId}:`,
            error
        );
        return {
            success: false,
            userErrors: [
                {
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to setup Frak webhook",
                },
            ],
        };
    }
}

export type FrakWebhookStatusReturnType = {
    userErrors: {
        message: string;
    }[];
    setup: boolean;
};

export async function getFrakWebookStatus(
    context: AuthenticatedContext,
    request: Request
) {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return {
            userErrors: [],
            setup: false,
        };
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .webhooks.get({
                headers: buildBackendHeaders(request),
            });
        if (error) {
            throw error;
        }
        return {
            userErrors: [],
            setup: Array.isArray(data) ? data.length > 0 : Boolean(data),
        };
    } catch (error) {
        console.error(error);
        return {
            userErrors: [{ message: "Error fetching frak webhook status" }],
            setup: false,
        };
    }
}
