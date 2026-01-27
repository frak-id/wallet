import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";
import { getMyCampaignsMock } from "@/context/campaigns/action/mock";
import type { CampaignWithState } from "@/types/Campaign";

type BackendCampaignStatus = "draft" | "published" | "paused" | "archived";

function mapStatusToState(status: BackendCampaignStatus) {
    switch (status) {
        case "draft":
            return { key: "draft" as const };
        case "published":
            return {
                key: "created" as const,
                isActive: true,
                isRunning: true,
            };
        case "paused":
            return {
                key: "created" as const,
                isActive: true,
                isRunning: false,
            };
        case "archived":
            return {
                key: "created" as const,
                isActive: false,
                isRunning: false,
            };
    }
}

function mapStatusToActions(status: BackendCampaignStatus) {
    return {
        canEdit: status === "draft" || status === "paused",
        canDelete: status === "draft",
        canToggleRunningStatus: status === "published" || status === "paused",
    };
}

async function getMyCampaignsInternal({
    isDemoMode,
}: {
    isDemoMode: boolean;
}): Promise<CampaignWithState[]> {
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
                ...campaign,
                merchantId,
            }));
        })
    );

    const allCampaigns = campaignResults.flat();

    return allCampaigns.map((campaign) => {
        const status = (campaign.status ?? "draft") as BackendCampaignStatus;
        return {
            _id: campaign.id,
            title: campaign.name,
            merchantId: campaign.merchantId,
            state: mapStatusToState(status),
            actions: mapStatusToActions(status),
        } as CampaignWithState;
    });
}

export const getMyCampaigns = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .handler(async ({ context }) => {
        const { isDemoMode } = context;
        return getMyCampaignsInternal({ isDemoMode });
    });
