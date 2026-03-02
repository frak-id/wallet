import campaignsData from "@/mock/campaigns.json";
import { type CampaignDraft, campaignStore } from "@/stores/campaignStore";
import type {
    Campaign,
    CampaignActions,
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

function draftToCampaign(draft: CampaignDraft): Campaign {
    const endDate = draft.scheduled.endDate;
    let expiresAt: string | null = null;
    if (endDate) {
        // Handle both Date objects and serialized strings (from Zustand persist)
        expiresAt =
            endDate instanceof Date ? endDate.toISOString() : String(endDate);
    }

    return {
        id: draft.id ?? "",
        merchantId: draft.merchantId,
        name: draft.name,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: null,
        rule: draft.rule,
        metadata: draft.metadata,
        budgetConfig: draft.budgetConfig,
        budgetUsed: null,
        expiresAt,
        priority: draft.priority,
        bankDistributionStatus: null,
    } as Campaign;
}

export async function getMyCampaignsMock(): Promise<CampaignWithActions[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    return (campaignsData as unknown as Campaign[]).map((campaign) => ({
        ...campaign,
        actions: mapStatusToActions(campaign.status),
    }));
}

export async function getCampaignDetailsMock({
    campaignId,
}: {
    campaignId: string;
}): Promise<Campaign | null> {
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Check mock JSON first (existing campaigns)
    const campaign = (campaignsData as unknown as Campaign[]).find(
        (c) => c.id === campaignId
    );
    if (campaign) {
        return campaign;
    }

    // Fall back to draft store (newly created campaigns not in mock JSON)
    const draft = campaignStore.getState().draft;
    if (draft.id === campaignId) {
        return draftToCampaign(draft);
    }

    return null;
}

export function getCampaignDetailsMockSync(
    campaignId: string
): Campaign | null {
    // Check mock JSON first (existing campaigns)
    const campaign = (campaignsData as unknown as Campaign[]).find(
        (c) => c.id === campaignId
    );
    if (campaign) {
        return campaign;
    }

    // Fall back to draft store (newly created campaigns not in mock JSON)
    const draft = campaignStore.getState().draft;
    if (draft.id === campaignId) {
        return draftToCampaign(draft);
    }

    return null;
}
