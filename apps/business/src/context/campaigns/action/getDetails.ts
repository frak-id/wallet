import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";
import type { Campaign } from "@/types/Campaign";

async function getCampaignDetailInternal({
    merchantId,
    campaignId,
}: {
    merchantId: string;
    campaignId: string;
}): Promise<Campaign | null> {
    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .get();

    if (error || !data) {
        return null;
    }

    return data as Campaign;
}

export const getCampaignDetail = createServerFn({ method: "GET" })
    .middleware([authMiddleware])
    .inputValidator(
        (input: { merchantId: string; campaignId: string }) => input
    )
    .handler(async ({ data }) => {
        return getCampaignDetailInternal(data);
    });
