import { createFileRoute, redirect } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { AffiliateReport } from "@/module/campaigns/component/AffiliateReport";
import { affiliateReportQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { PageShell } from "@/module/common/component/PageShell";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import {
    merchantQueryOptions,
    myMerchantsQueryOptions,
} from "@/module/merchant/queries/queryOptions";

export type AffiliateReportSearch = {
    from?: string;
    to?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: unknown): string | undefined {
    return typeof value === "string" && ISO_DATE.test(value)
        ? value
        : undefined;
}

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/affiliate-report"
)({
    validateSearch: (
        search: Record<string, unknown>
    ): AffiliateReportSearch => ({
        from: parseIsoDate(search.from),
        to: parseIsoDate(search.to),
    }),
    // Platform-admin only, and only for merchants linked to a TakeAds brand.
    // Anyone else is bounced back to the campaigns overview.
    beforeLoad: async ({ params }) => {
        const [my, merchant] = await Promise.all([
            queryClient.ensureQueryData(myMerchantsQueryOptions(isDemoMode())),
            queryClient.ensureQueryData(
                merchantQueryOptions(params.merchantId, isDemoMode())
            ),
        ]);
        if (!my.isPlatformAdmin || !merchant.affiliate) {
            throw redirect({
                to: "/m/$merchantId/campaigns",
                params: { merchantId: params.merchantId },
                replace: true,
            });
        }
    },
    loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
    loader: ({ params, deps }) => {
        queryClient.prefetchQuery(
            affiliateReportQueryOptions({
                merchantId: params.merchantId,
                isDemoMode: isDemoMode(),
                from: deps.from,
                to: deps.to,
            })
        );
    },
    component: AffiliateReportPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="affiliate report" />
    ),
});

function AffiliateReportPage() {
    const { from, to } = Route.useSearch();
    return (
        <PageShell page="campaignsAffiliateReport">
            <AffiliateReport from={from} to={to} />
        </PageShell>
    );
}
