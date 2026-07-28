import type {
    CampaignListItem,
    CampaignListResponse,
} from "@frak-labs/backend-elysia/api/schemas";
import type {
    BudgetConfigItem,
    CampaignMetadata,
    CampaignResponse,
    CampaignRuleDefinition,
    CampaignStatus,
} from "@frak-labs/backend-elysia/domain/campaign";
import type { BankStatus } from "@frak-labs/backend-elysia/domain/campaign-bank";
import { LRUCache } from "lru-cache";
import type { AuthenticatedContext } from "../types/context";
import { backendApi } from "../utils/backendApi";
import { levelForStatus, log } from "./logger";
import { resolveMerchantId } from "./merchant";
import { getRequestId } from "./requestId";

export type {
    BankStatus,
    CampaignListItem,
    CampaignListResponse,
    CampaignResponse,
    CampaignStatus,
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
 *
 * Always forwards the ingress correlation id (`x-request-id`) so a backend log
 * line for this call can be tied back to the originating Shopify request; the
 * Shopify session token is added when available. Previously this returned
 * `undefined` entirely when there was no session token, which dropped the
 * correlation id for every unauthenticated backend call.
 *
 * Exported for `api.register.tsx` (§4.12 inline embedded mint), the one
 * caller that needs the header before a `merchantId` exists — every other
 * consumer of this module resolves the merchant first.
 */
export function buildBackendHeaders(request: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    // nginx-ingress sets x-request-id on every deployed request; undefined only
    // in local dev, where it is simply omitted.
    const reqId = getRequestId(request);
    if (reqId) {
        headers["x-request-id"] = reqId;
    }

    const sessionToken = extractSessionToken(request);
    if (sessionToken) {
        headers["X-Shopify-Session-Token"] = sessionToken;
    }

    return headers;
}

// ---------------------------------------------------------------------------
// Caches — short TTL, navigation-scoped
// ---------------------------------------------------------------------------

const campaignsCache = new LRUCache<string, CampaignListResponse>({
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
): Promise<CampaignListResponse | null> {
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "campaigns fetch failed"
            );
            return null;
        }

        const response = data as CampaignListResponse;
        campaignsCache.set(merchantId, response);
        return response;
    } catch (error) {
        log.error({ err: error, merchantId }, "campaigns fetch error");
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "bank fetch failed"
            );
            return null;
        }

        bankStatusCache.set(merchantId, data);
        return data;
    } catch (error) {
        log.error({ err: error, merchantId }, "bank fetch error");
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "campaign create failed"
            );
            return null;
        }

        // Invalidate campaigns cache after creation
        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        log.error({ err: error, merchantId }, "campaign create error");
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "campaign publish failed"
            );
            return null;
        }

        // Invalidate campaigns cache after publish
        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        log.error({ err: error, merchantId }, "campaign publish error");
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "campaign pause failed"
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        log.error({ err: error, merchantId }, "campaign pause error");
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "campaign resume failed"
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        log.error({ err: error, merchantId }, "campaign resume error");
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "campaign archive failed"
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return data as CampaignResponse;
    } catch (error) {
        log.error({ err: error, merchantId }, "campaign archive error");
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "campaign delete failed"
            );
            return null;
        }

        campaignsCache.delete(merchantId);
        return { success: true };
    } catch (error) {
        log.error({ err: error, merchantId }, "campaign delete error");
        return null;
    }
}

/**
 * §4.12 inline embedded mint: register the current shop as a Frak merchant
 * directly from the embedded app, no wallet/popup involved. The backend
 * derives the domain from the verified App Bridge token itself — `name` and
 * `currency` are the only inputs the shop can influence, plus `primaryDomain`
 * when the storefront domain differs from the myshopify one.
 */
export async function registerMerchant(
    request: Request,
    body: {
        name?: string;
        currency?: "usd" | "eur" | "gbp";
        primaryDomain?: string;
    }
): Promise<{ merchantId: string } | { error: string }> {
    try {
        const { data, error } =
            await backendApi.business.merchant.register.post(body, {
                headers: buildBackendHeaders(request),
            });
        if (error) {
            const message =
                typeof error.value === "object" &&
                error.value &&
                "error" in error.value
                    ? String(error.value.error)
                    : `Registration failed (${error.status})`;
            log[levelForStatus(error.status)](
                { status: error.status, reason: message },
                "register failed"
            );
            return { error: message };
        }
        return { merchantId: data.merchantId };
    } catch (error) {
        log.error({ err: error }, "register error");
        return { error: "Registration failed" };
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
            log.error(
                { merchantId, reason: errorMessage },
                "webhook setup failed"
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
        log.error({ err: error, merchantId }, "webhook setup error");
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
        log.error(
            { err: error, merchantId },
            "frak webhook status fetch error"
        );
        return {
            userErrors: [{ message: "Error fetching frak webhook status" }],
            setup: false,
        };
    }
}

export type ExplorerSettings = {
    enabled: boolean;
    heroImageUrl: string;
    heroImageUrls: string[];
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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "merchant detail fetch failed"
            );
            return null;
        }

        return {
            enabled: data.explorerEnabledAt !== null,
            heroImageUrl: data.explorerConfig?.heroImageUrl ?? "",
            heroImageUrls: data.explorerConfig?.heroImageUrls ?? [],
            logoUrl: data.explorerConfig?.logoUrl ?? "",
            description: data.explorerConfig?.description ?? "",
        };
    } catch (error) {
        log.error({ err: error, merchantId }, "merchant detail fetch error");
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

    const hasHeroExtras = settings.heroImageUrls.length > 0;
    // Always send the config object (matches the business app): the backend
    // replaces the whole explorer config, so omitting it when every field is
    // empty would fail to clear a previously-set logo/hero on the last removal.
    const config = {
        heroImageUrl: settings.heroImageUrl || undefined,
        heroImageUrls: hasHeroExtras ? settings.heroImageUrls : undefined,
        logoUrl: settings.logoUrl || undefined,
        description: settings.description || undefined,
    };

    try {
        const { error } = await backendApi.business
            .merchant({ merchantId })
            .explorer.put(
                { enabled: settings.enabled, config },
                { headers: buildBackendHeaders(request) }
            );
        if (error) {
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "explorer update failed"
            );
            return {
                success: false,
                message: "Failed to update explorer settings",
            };
        }

        return { success: true, message: "Explorer settings saved" };
    } catch (error) {
        log.error({ err: error, merchantId }, "explorer update error");
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
        log.error({ err: error, merchantId }, "media upload error");
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
        log.error({ err: error, merchantId }, "media delete error");
        return { success: false, message: "Failed to delete media" };
    }
}

export type MediaFile = { type: string; url: string };

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
            log[levelForStatus(error.status)](
                { merchantId, status: error.status },
                "media list failed"
            );
            return [];
        }
        return data.files as MediaFile[];
    } catch (error) {
        log.error({ err: error, merchantId }, "media list error");
        return [];
    }
}
