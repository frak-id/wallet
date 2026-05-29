import type { CampaignDetailsResponse } from "@frak-labs/backend-elysia/orchestration/schemas";
import { authenticatedBackendApi } from "@/api/backendClient";
import campaignDetailsMock from "@/mock/campaignDetails.json";
import type {
    BudgetConfig,
    Campaign,
    CampaignActions,
    CampaignListResponse,
    CampaignMetadata,
    CampaignRuleDefinition,
    CampaignStatus,
} from "@/types/Campaign";
import { getCampaignDetailsMock, getMyCampaignsMock } from "./mock";

function mapStatusToActions(status: CampaignStatus): CampaignActions {
    return {
        canEdit: status === "draft",
        canDelete: status === "draft",
        canPublish: status === "draft",
        canPause: status === "active",
        canResume: status === "paused",
        canArchive: status === "active" || status === "paused",
    };
}

export async function getMerchantCampaigns({
    merchantId,
    isDemoMode,
}: {
    merchantId: string;
    isDemoMode: boolean;
}): Promise<CampaignListResponse> {
    if (isDemoMode) {
        return getMyCampaignsMock(merchantId);
    }

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns.get();

    if (!data || error) {
        console.warn("Error fetching campaigns", error);
        return { bankDistributionStatus: null, campaigns: [] };
    }

    return {
        bankDistributionStatus: data.bankDistributionStatus,
        campaigns: data.campaigns.map((campaign) => ({
            ...campaign,
            actions: mapStatusToActions(campaign.status),
        })),
    } as CampaignListResponse;
}

export async function getCampaignDetail({
    merchantId,
    campaignId,
    isDemoMode,
}: {
    merchantId: string;
    campaignId: string;
    isDemoMode: boolean;
}): Promise<Campaign | null> {
    if (isDemoMode) {
        return getCampaignDetailsMock({ campaignId, merchantId });
    }

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .get();

    if (error || !data) {
        return null;
    }

    return data as Campaign;
}

/**
 * Per-campaign details: economic value, CPA breakdown, ambassador stats,
 * top-ambassador leaderboard and efficiency KPIs. Backed by
 * `GET /business/merchant/:merchantId/campaigns/:campaignId/details`.
 *
 * Demo mode returns the bundled mock fixture so the dashboard renders
 * without a backend.
 */
export async function getCampaignDetails({
    merchantId,
    campaignId,
    isDemoMode,
}: {
    merchantId: string;
    campaignId: string;
    isDemoMode: boolean;
}): Promise<CampaignDetailsResponse> {
    if (isDemoMode) {
        return campaignDetailsMock as CampaignDetailsResponse;
    }

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .details.get();

    if (!data || error) {
        throw new Error(
            `Failed to load campaign details: ${error?.toString() ?? "unknown error"}`
        );
    }

    return data;
}

type CreateCampaignInput = {
    merchantId: string;
    name: string;
    rule: CampaignRuleDefinition;
    metadata?: CampaignMetadata;
    budgetConfig?: BudgetConfig;
    expiresAt?: string;
    priority?: number;
};

export async function createCampaign(
    input: CreateCampaignInput
): Promise<Campaign> {
    const { merchantId, ...body } = input;

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns.post(body);

    if (!data || error) {
        throw new Error(
            `Failed to create campaign: ${error?.toString() ?? "Unknown error"}`
        );
    }

    return data as Campaign;
}

type UpdateCampaignInput = {
    merchantId: string;
    campaignId: string;
    name?: string;
    rule?: CampaignRuleDefinition;
    metadata?: CampaignMetadata;
    budgetConfig?: BudgetConfig;
    expiresAt?: string | null;
    priority?: number;
};

export async function updateCampaign(
    input: UpdateCampaignInput
): Promise<Campaign> {
    const { merchantId, campaignId, ...body } = input;

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .put(body);

    if (!data || error) {
        throw new Error(
            `Failed to update campaign: ${error?.toString() ?? "Unknown error"}`
        );
    }

    return data as Campaign;
}

export async function deleteCampaign({
    merchantId,
    campaignId,
}: {
    merchantId: string;
    campaignId: string;
}): Promise<void> {
    const { error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .delete();

    if (error) {
        throw new Error(
            `Failed to delete campaign: ${error?.toString() ?? "Unknown error"}`
        );
    }
}

function extractErrorMessage(error: unknown): string {
    if (typeof error === "object" && error !== null && "value" in error) {
        return (error as { value: string }).value;
    }
    return "Unknown error";
}

export async function publishCampaign({
    merchantId,
    campaignId,
}: {
    merchantId: string;
    campaignId: string;
}): Promise<Campaign> {
    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .publish.post();

    if (error || !data) {
        throw new Error(
            `Failed to publish campaign: ${extractErrorMessage(error)}`
        );
    }

    return data as Campaign;
}

export async function pauseCampaign({
    merchantId,
    campaignId,
}: {
    merchantId: string;
    campaignId: string;
}): Promise<Campaign> {
    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .pause.post();

    if (error || !data) {
        throw new Error(
            `Failed to pause campaign: ${extractErrorMessage(error)}`
        );
    }

    return data as Campaign;
}

export async function resumeCampaign({
    merchantId,
    campaignId,
}: {
    merchantId: string;
    campaignId: string;
}): Promise<Campaign> {
    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .resume.post();

    if (error || !data) {
        throw new Error(
            `Failed to resume campaign: ${extractErrorMessage(error)}`
        );
    }

    return data as Campaign;
}

export async function archiveCampaign({
    merchantId,
    campaignId,
}: {
    merchantId: string;
    campaignId: string;
}): Promise<Campaign> {
    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .archive.post();

    if (error || !data) {
        throw new Error(
            `Failed to archive campaign: ${extractErrorMessage(error)}`
        );
    }

    return data as Campaign;
}
