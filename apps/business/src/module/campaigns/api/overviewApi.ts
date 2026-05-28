import type {
    OverviewAnalyticsResponse,
    OverviewSummaryResponse,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { authenticatedBackendApi } from "@/api/backendClient";
import campaignsOverviewMock from "@/mock/campaignsOverview.json";

/** Slice of the mock JSON consumed by the summary endpoint. */
export function getOverviewSummaryMock(): OverviewSummaryResponse {
    return {
        kpis: campaignsOverviewMock.kpis,
        topCampaigns:
            campaignsOverviewMock.topCampaigns as OverviewSummaryResponse["topCampaigns"],
        statusBreakdown: campaignsOverviewMock.statusBreakdown,
        series: campaignsOverviewMock.series as OverviewSummaryResponse["series"],
    };
}

/** Slice of the mock JSON consumed by the analytics endpoint. */
export function getOverviewAnalyticsMock(): OverviewAnalyticsResponse {
    return {
        funnels: campaignsOverviewMock.funnels,
        sharing: campaignsOverviewMock.sharing,
        accurateKpis: campaignsOverviewMock.accurateKpis,
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

export async function getOverviewAnalytics({
    merchantId,
    isDemoMode,
    from,
    to,
}: {
    merchantId: string;
    isDemoMode: boolean;
    from?: string;
    to?: string;
}): Promise<OverviewAnalyticsResponse> {
    if (isDemoMode) {
        return getOverviewAnalyticsMock();
    }

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns.overview.analytics.get({ query: { from, to } });

    if (!data || error) {
        throw new Error("Failed to fetch campaigns overview analytics");
    }

    return data;
}
