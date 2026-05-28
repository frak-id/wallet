import { Stack } from "@frak-labs/design-system/components/Stack";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
    overviewAnalyticsQueryOptions,
    overviewSummaryQueryOptions,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { FunnelCard } from "./FunnelCard";
import { FunnelCardSkeleton } from "./FunnelCardSkeleton";
import { KpiCardsRow } from "./KpiCardsRow";
import { OverviewFloatingFooter } from "./OverviewFloatingFooter";
import * as styles from "./overview.css";
import { ProjectedRevenueCard } from "./ProjectedRevenueCard";
import { PurchasesCard } from "./PurchasesCard";
import { SharingBySourceCard } from "./SharingBySourceCard";
import { SharingBySourceSkeleton } from "./SharingBySourceSkeleton";
import { TopCampaignsCard } from "./TopCampaignsCard";

type WindowProps = { from?: string; to?: string };

export function CampaignsOverview({ from, to }: WindowProps) {
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data: summary } = useSuspenseQuery(
        overviewSummaryQueryOptions({ merchantId, isDemoMode, from, to })
    );

    return (
        <div className={styles.page}>
            <Stack space="l">
                <KpiCardsRow kpis={summary.kpis} />
                <div className={styles.twoColumns}>
                    <Suspense fallback={<FunnelCardSkeleton />}>
                        <AnalyticsFunnelCard from={from} to={to} />
                    </Suspense>
                    <TopCampaignsCard
                        topCampaigns={summary.topCampaigns}
                        statusBreakdown={summary.statusBreakdown}
                    />
                </div>
                <div className={styles.threeColumns}>
                    <PurchasesCard series={summary.series} />
                    <ProjectedRevenueCard
                        series={summary.series}
                        revenue={summary.kpis.revenue}
                    />
                    <Suspense fallback={<SharingBySourceSkeleton />}>
                        <AnalyticsSharingCard from={from} to={to} />
                    </Suspense>
                </div>
            </Stack>
            <OverviewFloatingFooter />
        </div>
    );
}

function AnalyticsFunnelCard({ from, to }: WindowProps) {
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(
        overviewAnalyticsQueryOptions({ merchantId, isDemoMode, from, to })
    );
    return <FunnelCard funnels={data.funnels} />;
}

function AnalyticsSharingCard({ from, to }: WindowProps) {
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(
        overviewAnalyticsQueryOptions({ merchantId, isDemoMode, from, to })
    );
    return <SharingBySourceCard sharing={data.sharing} />;
}
