import { authenticatedBackendApi } from "@/context/api/backendClient";
import {
    getCampaignDetailsMock,
    getMyCampaignsMock,
} from "@/context/campaigns/action/mock";
import type {
    BudgetConfig,
    Campaign,
    CampaignActions,
    CampaignMetadata,
    CampaignRuleDefinition,
    CampaignStatus,
    CampaignWithActions,
} from "@/types/Campaign";

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

export async function getMyCampaigns(
    isDemoMode: boolean
): Promise<CampaignWithActions[]> {
    if (isDemoMode) {
        return getMyCampaignsMock();
    }

    const { data: merchantsData, error: merchantsError } =
        await authenticatedBackendApi.merchant.my.get();

    if (!merchantsData || merchantsError) {
        console.warn("Error fetching merchants", merchantsError);
        return [];
    }

    const allMerchantIds = [
        ...merchantsData.owned.map((m) => m.id),
        ...merchantsData.adminOf.map((m) => m.id),
    ];

    const campaignResults = await Promise.all(
        allMerchantIds.map(async (merchantId) => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .campaigns.get();
            if (!data || error) return [];
            return data.campaigns.map((campaign) => ({
                ...(campaign as Campaign),
                merchantId,
                actions: mapStatusToActions(campaign.status),
            }));
        })
    );

    return campaignResults.flat();
}

export async function getCampaignDetail({
    merchantId,
    campaignId,
    isDemoMode,
}: {
    merchantId?: string;
    campaignId: string;
    isDemoMode: boolean;
}): Promise<Campaign | null> {
    if (isDemoMode) {
        return getCampaignDetailsMock({ campaignId });
    }

    if (merchantId) {
        const { data, error } = await authenticatedBackendApi
            .merchant({ merchantId })
            .campaigns({ campaignId })
            .get();

        if (error || !data) {
            return null;
        }

        return data as Campaign;
    }

    const allCampaigns = await getMyCampaigns(isDemoMode);
    const campaign = allCampaigns.find((c) => c.id === campaignId);

    return campaign || null;
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
}): Promise<{ success: true }> {
    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .delete();

    if (!data || error) {
        throw new Error(
            `Failed to delete campaign: ${error?.toString() ?? "Unknown error"}`
        );
    }

    return { success: true };
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
