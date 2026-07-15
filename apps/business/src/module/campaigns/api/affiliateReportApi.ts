import type { AffiliateReportingResponse } from "@frak-labs/backend-elysia/orchestration/schemas";
import { authenticatedBackendApi } from "@/api/backendClient";
import affiliateReportMock from "@/mock/affiliateReport.json";

export function getAffiliateReportMock(): AffiliateReportingResponse {
    return affiliateReportMock as AffiliateReportingResponse;
}

export async function getAffiliateReport({
    merchantId,
    isDemoMode,
    from,
    to,
}: {
    merchantId: string;
    isDemoMode: boolean;
    from?: string;
    to?: string;
}): Promise<AffiliateReportingResponse> {
    if (isDemoMode) {
        return getAffiliateReportMock();
    }

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .affiliate.reporting.get({ query: { from, to } });

    if (!data || error) {
        throw new Error("Failed to fetch affiliate report");
    }

    return data;
}
