import type { OverviewSummaryResponse } from "@frak-labs/backend-elysia/orchestration/schemas";
import { authenticatedBackendApi } from "@/api/backendClient";
import campaignsOverviewMock from "@/mock/campaignsOverview.json";

/**
 * Slice of the mock JSON consumed by the summary endpoint. Funnels and
 * sharing breakdowns remain on the (still-mocked) analytics endpoint
 * until Phase 3 ships.
 */
export function getOverviewSummaryMock(): OverviewSummaryResponse {
    return {
        kpis: campaignsOverviewMock.kpis,
        topCampaigns:
            campaignsOverviewMock.topCampaigns as OverviewSummaryResponse["topCampaigns"],
        statusBreakdown: campaignsOverviewMock.statusBreakdown,
        purchases: campaignsOverviewMock.purchases,
        projectedRevenue: campaignsOverviewMock.projectedRevenue,
    };
}

export async function getOverviewSummary({
    merchantId,
    isDemoMode,
    from,
    to,
}: {
    merchantId: string;
    isDemoMode: boolean;
    from?: string;
    to?: string;
}): Promise<OverviewSummaryResponse> {
    if (isDemoMode) {
        return getOverviewSummaryMock();
    }

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns.overview.summary.get({ query: { from, to } });

    if (!data || error) {
        throw new Error("Failed to fetch campaigns overview summary");
    }

    return data;
}
