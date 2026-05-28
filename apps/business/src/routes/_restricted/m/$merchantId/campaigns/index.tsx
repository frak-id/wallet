import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { CampaignsOverview } from "@/module/campaigns/component/Overview";
import {
    overviewAnalyticsQueryOptions,
    overviewSummaryQueryOptions,
} from "@/module/campaigns/queries/queryOptions";
import { PageShell } from "@/module/common/component/PageShell";
import { DataLoadError } from "@/module/common/component/RouteError";
import { resolvePreset } from "@/module/common/component/DateRangePopover/presets";
import { queryClient } from "@/module/common/provider/RootProvider";

export type CampaignsOverviewSearch = {
    from?: string;
    to?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: unknown): string | undefined {
    return typeof value === "string" && ISO_DATE.test(value)
        ? value
        : undefined;
}

export const Route = createFileRoute("/_restricted/m/$merchantId/campaigns/")({
    validateSearch: (
        search: Record<string, unknown>
    ): CampaignsOverviewSearch => {
        // Default the overview window to the last 30 days when no range is in the URL.
        // Keeps the loader's prefetch, the header DateRangeChip, and the
        // overview component all reading the same effective window.
        const fallback = resolvePreset("last30");
        return {
            from: parseIsoDate(search.from) ?? fallback.from,
            to: parseIsoDate(search.to) ?? fallback.to,
        };
    },
    loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
    loader: ({ params, deps }) => {
        const args = {
            merchantId: params.merchantId,
            isDemoMode: isDemoMode(),
            from: deps.from,
            to: deps.to,
        };
        queryClient.prefetchQuery(overviewSummaryQueryOptions(args));
        queryClient.prefetchQuery(overviewAnalyticsQueryOptions(args));
    },
    component: CampaignsOverviewPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaign overview data" />
    ),
});

function CampaignsOverviewPage() {
    const { from, to } = Route.useSearch();
    return (
        <PageShell page="campaignsOverview">
            <CampaignsOverview from={from} to={to} />
        </PageShell>
    );
}
