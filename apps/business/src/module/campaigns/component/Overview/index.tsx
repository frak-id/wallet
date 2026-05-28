import { Stack } from "@frak-labs/design-system/components/Stack";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
    overviewAnalyticsQueryOptions,
    overviewSummaryQueryOptions,
} from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { FunnelCard } from "./FunnelCard";
import { KpiCardsRow } from "./KpiCardsRow";
import { OverviewFloatingFooter } from "./OverviewFloatingFooter";
import * as styles from "./overview.css";
import { ProjectedRevenueCard } from "./ProjectedRevenueCard";
import { PurchasesCard } from "./PurchasesCard";
import { SharingBySourceCard } from "./SharingBySourceCard";
import { TopCampaignsCard } from "./TopCampaignsCard";

export function CampaignsOverview({
    from,
    to,
}: {
    from?: string;
    to?: string;
}) {
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data: summary } = useSuspenseQuery(
        overviewSummaryQueryOptions({ merchantId, isDemoMode, from, to })
    );
    const { data: analytics } = useSuspenseQuery(
        overviewAnalyticsQueryOptions({ merchantId, isDemoMode, from, to })
    );

    return (
        <div className={styles.page}>
            <Stack space="l">
                <KpiCardsRow kpis={summary.kpis} />
                <div className={styles.twoColumns}>
                    <FunnelCard funnels={analytics.funnels} />
                    <TopCampaignsCard
                        topCampaigns={summary.topCampaigns}
                        statusBreakdown={summary.statusBreakdown}
                    />
                </div>
                <div className={styles.threeColumns}>
                    <PurchasesCard purchases={summary.purchases} />
                    <ProjectedRevenueCard
                        projectedRevenue={summary.projectedRevenue}
                    />
                    <SharingBySourceCard sharing={analytics.sharing} />
                </div>
            </Stack>
            <OverviewFloatingFooter />
        </div>
    );
}
