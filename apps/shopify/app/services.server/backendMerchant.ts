import { LRUCache } from "lru-cache";
import type { Address } from "viem";
import type { AuthenticatedContext } from "../types/context";
import { backendApi } from "../utils/backendApi";
import { resolveMerchantId } from "./merchant";

// ---------------------------------------------------------------------------
// Types — mirrored from backend response schemas
// ---------------------------------------------------------------------------

export type CampaignStatus = "draft" | "active" | "paused" | "archived";

export type CampaignResponse = {
    id: string;
    merchantId: string;
    name: string;
    status: CampaignStatus;
    priority: number;
    rule: {
        trigger: string;
        conditions: unknown;
        rewards: unknown[];
        pendingRewardExpirationDays?: number;
    };
    metadata: Record<string, unknown> | null;
    budgetConfig:
        | { label: string; durationInSeconds: number | null; amount: number }[]
        | null;
    budgetUsed: Record<string, { resetAt?: string; used: number }> | null;
    expiresAt: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type BankStatus = {
    deployed: boolean;
    bankAddress: Address | null;
    ownerHasManagerRole: boolean;
};

export type CampaignStatsItem = {
    campaignId: string;
    campaignName: string;
    trigger: string;
    tokenAddress: Address | null;
    referredInteractions: number;
    purchaseInteractions: number;
    totalRewards: string;
    uniqueWallets: number;
    ambassador: number;
    sharingRate: number;
    ctr: number;
    costPerPurchase: string;
    costPerShare: string;
};

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
        const response = await backendApi.get(
            `business/merchant/${merchantId}/campaigns`,
            {
                headers: buildBackendHeaders(request),
                throwHttpErrors: false,
            }
        );

        if (!response.ok) {
            console.error(
                `[backendMerchant] campaigns fetch failed (${response.status}) for ${merchantId}`
            );
            return null;
        }

        const data = (await response.json()) as {
            campaigns: CampaignResponse[];
        };
        campaignsCache.set(merchantId, data.campaigns);
        return data.campaigns;
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
        const response = await backendApi.get(
            `business/merchant/${merchantId}/bank`,
            {
                headers: buildBackendHeaders(request),
                throwHttpErrors: false,
            }
        );

        if (!response.ok) {
            console.error(
                `[backendMerchant] bank fetch failed (${response.status}) for ${merchantId}`
            );
            return null;
        }

        const data = (await response.json()) as BankStatus;
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
        const response = await backendApi.get(
            `business/merchant/${merchantId}/campaigns/stats`,
            {
                headers: buildBackendHeaders(request),
                throwHttpErrors: false,
            }
        );

        if (!response.ok) {
            console.error(
                `[backendMerchant] stats fetch failed (${response.status}) for ${merchantId}`
            );
            return null;
        }

        const data = (await response.json()) as {
            stats: CampaignStatsItem[];
        };
        return data.stats;
    } catch (error) {
        console.error(
            `[backendMerchant] stats fetch error for ${merchantId}:`,
            error
        );
        return null;
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
        const response = await backendApi.get(
            `business/merchant/${merchantId}/webhooks`,
            {
                headers: buildBackendHeaders(request),
                throwHttpErrors: false,
            }
        );
        if (!response.ok) {
            return {
                userErrors: [],
                setup: false,
            };
        }
        const data = await response.json();
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
