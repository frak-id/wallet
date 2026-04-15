import type {
    BudgetConfigItem,
    CampaignMetadata,
    CampaignResponse,
    CampaignRuleDefinition,
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
 * Create a campaign draft for the current merchant.
 */
export async function createMerchantCampaign(
    context: AuthenticatedContext,
    request: Request,
    body: {
        name: string;
        rule: CampaignRuleDefinition;
        budgetConfig: BudgetConfigItem[];
        metadata: CampaignMetadata;
        priority: number;
    }
): Promise<CampaignResponse | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns.post(body, {
                headers: buildBackendHeaders(request),
            });
        if (error) {
            console.error(
                `[backendMerchant] campaign create failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        // Invalidate campaigns cache after creation
        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        console.error(
            `[backendMerchant] campaign create error for ${merchantId}:`,
            error
        );
        return null;
    }
}

/**
 * Publish a draft campaign (transitions draft → active).
 */
export async function publishMerchantCampaign(
    context: AuthenticatedContext,
    request: Request,
    campaignId: string
): Promise<CampaignResponse | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .publish.post(
                {},
                {
                    headers: buildBackendHeaders(request),
                }
            );
        if (error) {
            console.error(
                `[backendMerchant] campaign publish failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        // Invalidate campaigns cache after publish
        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        console.error(
            `[backendMerchant] campaign publish error for ${merchantId}:`,
            error
        );
        return null;
    }
}

export async function pauseMerchantCampaign(
    context: AuthenticatedContext,
    request: Request,
    campaignId: string
): Promise<CampaignResponse | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .pause.post(
                {},
                {
                    headers: buildBackendHeaders(request),
                }
            );
        if (error) {
            console.error(
                `[backendMerchant] campaign pause failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        console.error(
            `[backendMerchant] campaign pause error for ${merchantId}:`,
            error
        );
        return null;
    }
}

export async function resumeMerchantCampaign(
    context: AuthenticatedContext,
    request: Request,
    campaignId: string
): Promise<CampaignResponse | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .resume.post(
                {},
                {
                    headers: buildBackendHeaders(request),
                }
            );
        if (error) {
            console.error(
                `[backendMerchant] campaign resume failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        console.error(
            `[backendMerchant] campaign resume error for ${merchantId}:`,
            error
        );
        return null;
    }
}

export async function archiveMerchantCampaign(
    context: AuthenticatedContext,
    request: Request,
    campaignId: string
): Promise<CampaignResponse | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .archive.post(
                {},
                {
                    headers: buildBackendHeaders(request),
                }
            );
        if (error) {
            console.error(
                `[backendMerchant] campaign archive failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        console.error(
            `[backendMerchant] campaign archive error for ${merchantId}:`,
            error
        );
        return null;
    }
}

export async function deleteMerchantCampaign(
    context: AuthenticatedContext,
    request: Request,
    campaignId: string
): Promise<{ success: true } | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { error } = await backendApi.business
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .delete({
                headers: buildBackendHeaders(request),
            });
        if (error) {
            console.error(
                `[backendMerchant] campaign delete failed (${error.status}) for ${merchantId}`
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return { success: true };
    } catch (error) {
        console.error(
            `[backendMerchant] campaign delete error for ${merchantId}:`,
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
            setup: data.setup === true,
        };
    } catch (error) {
        console.error(error);
        return {
            userErrors: [{ message: "Error fetching frak webhook status" }],
            setup: false,
        };
    }
}

export type ExplorerSettings = {
    enabled: boolean;
    heroImageUrl: string;
    logoUrl: string;
    description: string;
};

/**
 * Fetch explorer settings for the current merchant from the Frak backend.
 */
export async function getMerchantExplorerSettings(
    context: AuthenticatedContext,
    request: Request
): Promise<ExplorerSettings | null> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return null;
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .get({
                headers: buildBackendHeaders(request),
            });
        if (error) {
            console.error(
                `[backendMerchant] merchant detail fetch failed for ${merchantId}`
            );
            return null;
        }

        return {
            enabled: data.explorerEnabledAt !== null,
            heroImageUrl: data.explorerConfig?.heroImageUrl ?? "",
            logoUrl: data.explorerConfig?.logoUrl ?? "",
            description: data.explorerConfig?.description ?? "",
        };
    } catch (error) {
        console.error(
            `[backendMerchant] merchant detail fetch error for ${merchantId}:`,
            error
        );
        return null;
    }
}

/**
 * Update explorer settings for the current merchant on the Frak backend.
 */
export async function updateMerchantExplorerSettings(
    context: AuthenticatedContext,
    request: Request,
    settings: ExplorerSettings
): Promise<{ success: boolean; message: string }> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return { success: false, message: "Merchant not found" };
    }

    const config =
        settings.heroImageUrl || settings.logoUrl || settings.description
            ? {
                  heroImageUrl: settings.heroImageUrl || undefined,
                  logoUrl: settings.logoUrl || undefined,
                  description: settings.description || undefined,
              }
            : undefined;

    try {
        const { error } = await backendApi.business
            .merchant({ merchantId })
            .explorer.put(
                { enabled: settings.enabled, config },
                { headers: buildBackendHeaders(request) }
            );
        if (error) {
            console.error(
                `[backendMerchant] explorer update failed for ${merchantId}`
            );
            return {
                success: false,
                message: "Failed to update explorer settings",
            };
        }

        return { success: true, message: "Explorer settings saved" };
    } catch (error) {
        console.error(
            `[backendMerchant] explorer update error for ${merchantId}:`,
            error
        );
        return {
            success: false,
            message: "Failed to update explorer settings",
        };
    }
}

/**
 * Upload a media file (logo or hero image) for the current merchant.
 */
export async function uploadMerchantMedia(
    context: AuthenticatedContext,
    request: Request,
    image: File,
    type: string
): Promise<
    | { success: true; url: string }
    | { success: false; error: string; code: string }
> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return {
            success: false,
            error: "Merchant not found",
            code: "merchant_not_found",
        };
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .media.upload.post(
                { image, type: type as never },
                { headers: buildBackendHeaders(request) }
            );
        if (error) {
            const err = error as unknown as {
                value?: { error?: string; code?: string };
            };
            if (err.value?.error) {
                return {
                    success: false,
                    error: err.value.error,
                    code: err.value.code ?? "upload_failed",
                };
            }
            return {
                success: false,
                error: "Upload failed",
                code: "upload_failed",
            };
        }
        return { success: true, url: data.url };
    } catch (error) {
        console.error(
            `[backendMerchant] media upload error for ${merchantId}:`,
            error
        );
        return {
            success: false,
            error: "Upload failed",
            code: "upload_failed",
        };
    }
}

/**
 * Delete a media file (logo or hero image) for the current merchant.
 */
export async function deleteMerchantMedia(
    context: AuthenticatedContext,
    request: Request,
    type: string
): Promise<{ success: boolean; deleted?: boolean; message?: string }> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return { success: false, message: "Merchant not found" };
    }

    try {
        const { error } = await backendApi.business
            .merchant({ merchantId })
            .media({ type })
            .delete({ headers: buildBackendHeaders(request) });
        if (error) {
            return { success: false, message: "Failed to delete media" };
        }
        return { success: true, deleted: true };
    } catch (error) {
        console.error(
            `[backendMerchant] media delete error for ${merchantId}:`,
            error
        );
        return { success: false, message: "Failed to delete media" };
    }
}

export type MediaFile = { type: "logo" | "hero"; url: string };

/**
 * List existing media files (logo/hero) for the current merchant.
 */
export async function listMerchantMedia(
    context: AuthenticatedContext,
    request: Request
): Promise<MediaFile[]> {
    const merchantId = await resolveMerchantId(context);
    if (!merchantId) {
        return [];
    }

    try {
        const { data, error } = await backendApi.business
            .merchant({ merchantId })
            .media.list.get({
                headers: buildBackendHeaders(request),
            });
        if (error) {
            console.error(
                `[backendMerchant] media list failed for ${merchantId}`
            );
            return [];
        }
        return data.files as MediaFile[];
    } catch (error) {
        console.error(
            `[backendMerchant] media list error for ${merchantId}:`,
            error
        );
        return [];
    }
}
