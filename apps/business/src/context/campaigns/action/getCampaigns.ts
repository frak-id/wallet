import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";
import type {
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

async function getMyCampaignsInternal(): Promise<CampaignWithActions[]> {
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
            return data.campaigns.map(
                (campaign) =>
                    ({
                        ...campaign,
                        merchantId,
                        actions: mapStatusToActions(
                            campaign.status as CampaignStatus
                        ),
                    }) as CampaignWithActions
            );
        })
    );

    return campaignResults.flat();
}

export const getMyCampaigns = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .handler(async () => {
        return getMyCampaignsInternal();
    });
