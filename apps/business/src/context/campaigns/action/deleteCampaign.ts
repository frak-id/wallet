import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";

async function deleteCampaignInternal({
    merchantId,
    campaignId,
}: {
    merchantId: string;
    campaignId: string;
}) {
    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .delete();

    if (!data || error) {
        throw new Error(
            `Failed to delete campaign: ${error?.toString() ?? "Unknown error"}`
        );
    }

    return { success: true } as const;
}

export const deleteCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator(
        (input: { merchantId: string; campaignId: string }) => input
    )
    .handler(async ({ data }) => {
        return deleteCampaignInternal(data);
    });
