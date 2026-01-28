import campaignsData from "@/mock/campaigns.json";
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

    const campaign = (campaignsData as unknown as Campaign[]).find(
        (c) => c.id === campaignId
    );

    if (!campaign) {
        return null;
    }

    return campaign;
}
