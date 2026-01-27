import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";
import { getMyCampaigns } from "@/context/campaigns/action/getCampaigns";
import type { Campaign } from "@/types/Campaign";

async function getCampaignDetailInternal({
    merchantId,
    campaignId,
}: {
    merchantId?: string;
    campaignId: string;
}): Promise<Campaign | null> {
    // If merchantId is provided, fetch directly
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

    // Fallback: search in all user's campaigns
    // This is less efficient but allows linking without known merchantId
    const allCampaigns = await getMyCampaigns();
    const campaign = allCampaigns.find((c) => c.id === campaignId);

    return campaign || null;
}

export const getCampaignDetail = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    // Use inputValidator for input type safety
    .inputValidator(
        (input: { merchantId?: string; campaignId: string }) => input
    )
    .handler(
        async ({
            data,
        }: {
            data: { merchantId?: string; campaignId: string };
        }) => {
            return getCampaignDetailInternal(data);
        }
    );
